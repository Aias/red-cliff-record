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
