/**
 * Score windows an opponent is drawn from, with the chance of drawing each.
 * Most picks stay near the anchor while the weighted tail keeps distant
 * regions of the pool connected; an empty window widens to the next.
 */
const OPPONENT_WINDOWS = [
  { span: 200, weight: 0.6 },
  { span: 400, weight: 0.25 },
  { span: 800, weight: 0.1 },
  { span: Infinity, weight: 0.05 },
];
const WILDCARD_PROBABILITY = 0.15;
/** Tournament sample size: the extreme of a few candidates is a soft bias, not a global argmax. */
const TOURNAMENT_SIZE = 8;
/** A record with fewer matchups than this gets anchored against established opponents. */
export const PROVISIONAL_MATCHUPS = 10;

/** A rankable record: curated, and for artifacts, not contained by a parent. */
export type PoolCandidate = { id: number; eloScore: number; matchupCount: number };

/** Orientation-independent key for a pair of records. */
export function matchupKey(aId: number, bId: number): string {
  return aId < bId ? `${aId}:${bId}` : `${bId}:${aId}`;
}

/** Fisher-Yates over a copy. */
function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = result[i];
    const b = result[j];
    if (a !== undefined && b !== undefined) {
      result[i] = b;
      result[j] = a;
    }
  }
  return result;
}

function randomOf<T>(items: readonly T[]): T | undefined {
  return items[Math.floor(Math.random() * items.length)];
}

/** Best-scoring candidate of a small random sample. */
function tournament(
  candidates: readonly PoolCandidate[],
  score: (candidate: PoolCandidate) => number
): PoolCandidate | undefined {
  return shuffle(candidates)
    .slice(0, TOURNAMENT_SIZE)
    .reduce<PoolCandidate | undefined>(
      (best, candidate) =>
        best === undefined || score(candidate) > score(best) ? candidate : best,
      undefined
    );
}

/** Candidates within a rolled score window of the anchor. */
function windowedCandidates(
  candidates: readonly PoolCandidate[],
  anchorElo: number
): PoolCandidate[] {
  let roll = Math.random();
  // A -1 start (floating-point residue) slices to the widest window alone.
  const start = OPPONENT_WINDOWS.findIndex(({ weight }) => (roll -= weight) < 0);
  for (const { span } of OPPONENT_WINDOWS.slice(start)) {
    const inWindow = candidates.filter((r) => Math.abs(r.eloScore - anchorElo) <= span);
    if (inWindow.length > 0) return inWindow;
  }
  return [];
}

/**
 * Drop recency exclusions oldest-first until at least `minimum` records
 * survive, so a small pool degrades to sooner repeats instead of no matchup.
 */
function relaxExclusions(
  pool: readonly PoolCandidate[],
  excludeIds: readonly number[],
  minimum: number
): { eligible: PoolCandidate[]; excludeIds: number[] } {
  for (let drop = 0; ; drop++) {
    const kept = excludeIds.slice(drop);
    const excluded = new Set(kept);
    const eligible = pool.filter((r) => !excluded.has(r.id));
    if (eligible.length >= minimum || kept.length === 0) return { eligible, excludeIds: kept };
  }
}

/**
 * Sample pool opponents for an anchor record, mostly near its score with a
 * weighted tail of distant picks. Pairs the anchor has already played fill
 * seats only when unplayed candidates run out. When anchoring a provisional
 * record, prefer established opponents (high matchup count) so its score
 * converges faster.
 */
export function selectOpponents(
  pool: readonly PoolCandidate[],
  opts: {
    anchor: PoolCandidate;
    excludeIds: number[];
    needed: number;
    biasEstablished: boolean;
    playedPairs: ReadonlySet<string>;
  }
): number[] {
  const excluded = new Set([opts.anchor.id, ...opts.excludeIds]);
  const eligible = pool.filter((r) => !excluded.has(r.id));
  const unplayed = eligible.filter((r) => !opts.playedPairs.has(matchupKey(opts.anchor.id, r.id)));
  const selected: PoolCandidate[] = [];
  for (const candidates of [unplayed, eligible]) {
    let remaining = candidates.filter((r) => !selected.includes(r));
    while (selected.length < opts.needed && remaining.length > 0) {
      const inWindow = windowedCandidates(remaining, opts.anchor.eloScore);
      const pick = opts.biasEstablished
        ? tournament(inWindow, (r) => r.matchupCount)
        : randomOf(inWindow);
      if (pick === undefined) break;
      selected.push(pick);
      remaining = remaining.filter((r) => r !== pick);
    }
  }
  return selected.map((r) => r.id);
}

/**
 * Pick the next matchup from the pool. A focus record triangulates by aiming
 * at a uniformly random point on the pool's score spectrum instead of staying
 * near its own score. Open mode surfaces under-ranked records: occasionally a
 * pure wildcard pair, otherwise the softly least-played record against a
 * windowed opponent. Already-played pairs rematch only when nothing unplayed
 * remains.
 */
export function selectMatchup(
  pool: readonly PoolCandidate[],
  opts: { focusId?: number; excludeIds: number[]; playedPairs: ReadonlySet<string> }
): { aId: number; bId: number } | null {
  if (opts.focusId !== undefined) {
    const focus = pool.find((r) => r.id === opts.focusId);
    if (!focus) return null;
    const others = pool.filter((r) => r.id !== focus.id);
    const { eligible } = relaxExclusions(others, opts.excludeIds, 1);
    const unplayed = eligible.filter((r) => !opts.playedPairs.has(matchupKey(focus.id, r.id)));
    const candidates = unplayed.length > 0 ? unplayed : eligible;
    if (candidates.length === 0) return null;
    const scores = pool.map((r) => r.eloScore);
    const target =
      Math.min(...scores) + Math.random() * (Math.max(...scores) - Math.min(...scores));
    const nearest = shuffle(candidates)
      .sort((a, b) => Math.abs(a.eloScore - target) - Math.abs(b.eloScore - target))
      .slice(0, 5);
    const opponent = randomOf(nearest);
    return opponent ? { aId: focus.id, bId: opponent.id } : null;
  }

  const { eligible, excludeIds } = relaxExclusions(pool, opts.excludeIds, 2);
  if (Math.random() < WILDCARD_PROBABILITY) {
    const [a, ...rest] = shuffle(eligible);
    const b = a && rest.find((r) => !opts.playedPairs.has(matchupKey(a.id, r.id)));
    if (a && b) return { aId: a.id, bId: b.id };
  }
  const a = tournament(eligible, (r) => -r.matchupCount);
  if (!a) return null;
  const [bId] = selectOpponents(pool, {
    anchor: a,
    excludeIds,
    needed: 1,
    biasEstablished: false,
    playedPairs: opts.playedPairs,
  });
  return bId !== undefined ? { aId: a.id, bId } : null;
}

/** Adaptive K: new records move fast through the ranks, established records stabilize. */
export function kFactor(matchupCount: number): number {
  if (matchupCount < 10) return 32;
  if (matchupCount < 30) return 24;
  return 16;
}

export function expectedScore(score: number, opponentScore: number): number {
  return 1 / (1 + 10 ** ((opponentScore - score) / 400));
}

export type EloOutcome = 'win' | 'loss' | 'draw';

/**
 * Score deltas for record A and its opponent B, from A's perspective. Each
 * record uses its own K (asymmetric updates), so points are not conserved
 * between them.
 */
export function eloDeltas(
  a: { eloScore: number; matchupCount: number },
  b: { eloScore: number; matchupCount: number },
  outcome: EloOutcome
): { deltaA: number; deltaB: number } {
  const actualA = outcome === 'win' ? 1 : outcome === 'loss' ? 0 : 0.5;
  const expectedA = expectedScore(a.eloScore, b.eloScore);
  const deltaA = Math.round(kFactor(a.matchupCount) * (actualA - expectedA));
  const deltaB = Math.round(kFactor(b.matchupCount) * (1 - actualA - (1 - expectedA)));
  return { deltaA, deltaB };
}

/** A stored matchup outcome; a null winner is a draw. */
export type MatchupOutcome = { recordAId: number; recordBId: number; winnerId: number | null };

const DEFAULT_ELO = 1200;
/** Points per tenfold strength ratio on the Elo scale, matching expectedScore. */
const ELO_SCALE = 400;
/** Spread of the prior distribution records are percentile-mapped onto. */
const PRIOR_SD = 150;

/**
 * Pseudo-draws each record plays against a fixed anchor at its own prior
 * score. They weight the prior against matchup evidence, keep undefeated
 * records finite, and pin disconnected regions of the comparison graph to a
 * common scale.
 */
const REFIT_ANCHOR_GAMES = 2;
const REFIT_MAX_ITERATIONS = 1000;
const REFIT_TOLERANCE = 1e-10;

const toStrength = (elo: number): number => 10 ** ((elo - DEFAULT_ELO) / ELO_SCALE);

/** Inverse standard normal CDF (Acklam's approximation, |error| < 1.2e-9) on (0, 1). */
function probit(p: number): number {
  const pLow = 0.02425;
  if (p < pLow || p > 1 - pLow) {
    const q = Math.sqrt(-2 * Math.log(Math.min(p, 1 - p)));
    const z =
      (((((-7.784894002430293e-3 * q + -3.223964580411365e-1) * q + -2.400758277161838) * q +
        -2.549732539343734) *
        q +
        4.374664141464968) *
        q +
        2.938163982698783) /
      ((((7.784695709041462e-3 * q + 3.224671290700398e-1) * q + 2.445134137142996) * q +
        3.754408661907416) *
        q +
        1);
    return p < pLow ? z : -z;
  }
  const q = p - 0.5;
  const r = q * q;
  return (
    ((((((-3.969683028665376e1 * r + 2.209460984245205e2) * r + -2.759285104469687e2) * r +
      1.38357751867269e2) *
      r +
      -3.066479806614716e1) *
      r +
      2.506628277459239) *
      q) /
    (((((-5.447609879822406e1 * r + 1.615858368580409e2) * r + -1.556989798598866e2) * r +
      6.680131188771972e1) *
      r +
      -1.328068155288572e1) *
      r +
      1)
  );
}

/**
 * Map raw relevance values onto the Elo scale by percentile rank through the
 * inverse normal CDF, centered on the 1200 default, so priors follow the
 * bell-shaped distribution matchup play converges to. Ties share the average
 * rank, and the median relevance lands on 1200.
 */
export function relevanceToEloPriors(relevances: ReadonlyMap<number, number>): Map<number, number> {
  const tiers = [...Map.groupBy(relevances, ([, relevance]) => relevance)].sort(
    ([a], [b]) => a - b
  );
  const priors = new Map<number, number>();
  let rank = 0;
  for (const [, tied] of tiers) {
    const percentile = (rank + tied.length / 2) / relevances.size;
    const elo = Math.round(DEFAULT_ELO + PRIOR_SD * probit(percentile));
    for (const [id] of tied) priors.set(id, elo);
    rank += tied.length;
  }
  return priors;
}

/**
 * Refit scores for every record in the matchup history or the priors map with
 * a Bradley-Terry model, via the minorization-maximization algorithm (Hunter
 * 2004). Unlike incremental Elo, each result propagates through the whole
 * comparison graph: beating a record also strengthens the case against
 * everything that record has beaten. Each record anchors at its prior score
 * (1200 when absent), so matchup evidence moves records relative to their
 * priors and a record with no matchups scores exactly its prior. Strengths
 * map onto the Elo scale used by expectedScore (strength ratio 10 = 400
 * points).
 */
export function fitBradleyTerry(
  matchups: readonly MatchupOutcome[],
  priors: ReadonlyMap<number, number> = new Map()
): Map<number, number> {
  const wins = new Map<number, number>();
  const games = new Map<number, Map<number, number>>();
  const addGame = (id: number, opponentId: number, won: number) => {
    wins.set(id, (wins.get(id) ?? 0) + won);
    const opponents = games.get(id) ?? new Map<number, number>();
    opponents.set(opponentId, (opponents.get(opponentId) ?? 0) + 1);
    games.set(id, opponents);
  };
  for (const { recordAId, recordBId, winnerId } of matchups) {
    const winA = winnerId === null ? 0.5 : winnerId === recordAId ? 1 : 0;
    addGame(recordAId, recordBId, winA);
    addGame(recordBId, recordAId, 1 - winA);
  }
  const anchors = new Map<number, number>();
  for (const id of [...games.keys(), ...priors.keys()]) {
    anchors.set(id, toStrength(priors.get(id) ?? DEFAULT_ELO));
  }
  const strengths = new Map(anchors);
  for (let iteration = 0; iteration < REFIT_MAX_ITERATIONS; iteration++) {
    let maxChange = 0;
    for (const [id, opponents] of games) {
      const anchor = anchors.get(id) ?? 1;
      const strength = strengths.get(id) ?? anchor;
      let denominator = REFIT_ANCHOR_GAMES / (strength + anchor);
      for (const [opponentId, count] of opponents) {
        denominator += count / (strength + (strengths.get(opponentId) ?? 1));
      }
      const next = ((wins.get(id) ?? 0) + REFIT_ANCHOR_GAMES / 2) / denominator;
      maxChange = Math.max(maxChange, Math.abs(next - strength) / strength);
      strengths.set(id, next);
    }
    if (maxChange < REFIT_TOLERANCE) break;
  }
  return new Map(
    [...strengths].map(([id, strength]) => [
      id,
      Math.round(DEFAULT_ELO + ELO_SCALE * Math.log10(strength)),
    ])
  );
}
