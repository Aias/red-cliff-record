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
