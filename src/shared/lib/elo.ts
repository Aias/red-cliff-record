const OPPONENT_WINDOWS = [200, 400, 800, 1600, Infinity];
const WILDCARD_PROBABILITY = 0.15;
/** A record with fewer matchups than this gets anchored against established opponents. */
export const PROVISIONAL_MATCHUPS = 10;

/** A rankable record: curated, and for artifacts, not contained by a parent. */
export type PoolCandidate = { id: number; eloScore: number; matchupCount: number };

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

/**
 * Sample pool opponents near an anchor score, widening the window until
 * enough candidates exist. When anchoring a provisional record, prefer
 * established opponents (high matchup count) so its score converges faster.
 */
export function selectOpponents(
  pool: readonly PoolCandidate[],
  opts: { anchorElo: number; excludeIds: number[]; needed: number; biasEstablished: boolean }
): number[] {
  const excluded = new Set(opts.excludeIds);
  const eligible = pool.filter((r) => !excluded.has(r.id));
  let sample: PoolCandidate[] = [];
  for (const window of OPPONENT_WINDOWS) {
    const inWindow =
      window === Infinity
        ? eligible
        : eligible.filter((r) => Math.abs(r.eloScore - opts.anchorElo) <= window);
    sample = shuffle(inWindow).slice(0, Math.max(opts.needed * 8, 24));
    if (sample.length >= opts.needed) break;
  }
  if (opts.biasEstablished) {
    // Stable sort keeps the random order within count ties
    sample.sort((a, b) => b.matchupCount - a.matchupCount);
  }
  return sample.slice(0, opts.needed).map((r) => r.id);
}

/**
 * Pick the next matchup from the pool. A focus record triangulates by aiming
 * at a uniformly random point on the pool's score spectrum instead of staying
 * near its own score. Open mode surfaces under-ranked records: occasionally a
 * pure wildcard pair, otherwise the least-played of a random sample against a
 * nearby opponent.
 */
export function selectMatchup(
  pool: readonly PoolCandidate[],
  opts: { focusId?: number; excludeIds: number[] }
): { aId: number; bId: number } | null {
  const excluded = new Set(opts.excludeIds);

  if (opts.focusId !== undefined) {
    const focus = pool.find((r) => r.id === opts.focusId);
    if (!focus) return null;
    const candidates = pool.filter((r) => r.id !== focus.id && !excluded.has(r.id));
    if (candidates.length === 0) return null;
    const scores = pool.map((r) => r.eloScore);
    const target =
      Math.min(...scores) + Math.random() * (Math.max(...scores) - Math.min(...scores));
    const nearest = shuffle(candidates)
      .sort((a, b) => Math.abs(a.eloScore - target) - Math.abs(b.eloScore - target))
      .slice(0, 5);
    const opponent = nearest[Math.floor(Math.random() * nearest.length)];
    return opponent ? { aId: focus.id, bId: opponent.id } : null;
  }

  const eligible = pool.filter((r) => !excluded.has(r.id));
  if (Math.random() < WILDCARD_PROBABILITY) {
    const [a, b] = shuffle(eligible);
    return a && b ? { aId: a.id, bId: b.id } : null;
  }

  const sample = shuffle(eligible).slice(0, 50);
  if (sample.length < 2) return null;
  const [a] = sample.sort((x, y) => x.matchupCount - y.matchupCount);
  if (!a) return null;
  const [bId] = selectOpponents(pool, {
    anchorElo: a.eloScore,
    excludeIds: [a.id, ...opts.excludeIds],
    needed: 1,
    biasEstablished: false,
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
