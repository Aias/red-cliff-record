import { describe, expect, test } from 'bun:test';
import {
  eloDeltas,
  expectedScore,
  fitBradleyTerry,
  kFactor,
  relevanceToEloPriors,
  selectMatchup,
  selectOpponents,
  type MatchupOutcome,
  type PoolCandidate,
} from './elo';

function makePool(scores: number[], matchupCount = 0): PoolCandidate[] {
  return scores.map((eloScore, index) => ({ id: index + 1, eloScore, matchupCount }));
}

describe('selectOpponents', () => {
  const pool = makePool([1000, 1100, 1200, 1300, 1400, 2400]);

  test('returns the requested number of distinct pool members', () => {
    const ids = selectOpponents(pool, {
      anchorElo: 1200,
      excludeIds: [],
      needed: 3,
      biasEstablished: false,
    });
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) expect(pool.some((r) => r.id === id)).toBe(true);
  });

  test('honors exclusions', () => {
    const ids = selectOpponents(pool, {
      anchorElo: 1200,
      excludeIds: [1, 2, 3],
      needed: 3,
      biasEstablished: false,
    });
    expect(ids.sort((a, b) => a - b)).toEqual([4, 5, 6]);
  });

  test('widens the window when nearby candidates run out', () => {
    // Only the outlier remains: reachable solely through the Infinity window.
    const ids = selectOpponents(pool, {
      anchorElo: 1000,
      excludeIds: [1, 2, 3, 4, 5],
      needed: 1,
      biasEstablished: false,
    });
    expect(ids).toEqual([6]);
  });

  test('prefers established opponents when anchoring a provisional record', () => {
    const mixed: PoolCandidate[] = [
      { id: 1, eloScore: 1200, matchupCount: 0 },
      { id: 2, eloScore: 1210, matchupCount: 50 },
      { id: 3, eloScore: 1190, matchupCount: 2 },
    ];
    const ids = selectOpponents(mixed, {
      anchorElo: 1200,
      excludeIds: [],
      needed: 2,
      biasEstablished: true,
    });
    expect(ids[0]).toBe(2);
  });

  test('returns everything available when the pool is smaller than needed', () => {
    const ids = selectOpponents(pool.slice(0, 2), {
      anchorElo: 1200,
      excludeIds: [],
      needed: 5,
      biasEstablished: false,
    });
    expect(ids.sort((a, b) => a - b)).toEqual([1, 2]);
  });
});

describe('selectMatchup', () => {
  const pool = makePool([1000, 1100, 1200, 1300, 1400]);

  test('open mode pairs two distinct pool members', () => {
    const pair = selectMatchup(pool, { excludeIds: [] });
    expect(pair).not.toBeNull();
    expect(pair?.aId).not.toBe(pair?.bId);
  });

  test('open mode returns null when fewer than two candidates remain', () => {
    expect(selectMatchup(pool.slice(0, 1), { excludeIds: [] })).toBeNull();
    expect(selectMatchup(pool, { excludeIds: [1, 2, 3, 4] })).toBeNull();
  });

  test('focused mode anchors on the focus record', () => {
    const pair = selectMatchup(pool, { focusId: 3, excludeIds: [] });
    expect(pair?.aId).toBe(3);
    expect(pair?.bId).not.toBe(3);
  });

  test('focused mode returns null when the focus is not in the pool', () => {
    expect(selectMatchup(pool, { focusId: 99, excludeIds: [] })).toBeNull();
  });

  test('focused mode respects exclusions', () => {
    const pair = selectMatchup(pool, { focusId: 1, excludeIds: [2, 3, 4] });
    expect(pair).toEqual({ aId: 1, bId: 5 });
  });
});

describe('kFactor', () => {
  test('steps down as matchups accumulate', () => {
    expect(kFactor(0)).toBe(32);
    expect(kFactor(9)).toBe(32);
    expect(kFactor(10)).toBe(24);
    expect(kFactor(29)).toBe(24);
    expect(kFactor(30)).toBe(16);
    expect(kFactor(100)).toBe(16);
  });
});

describe('expectedScore', () => {
  test('is 0.5 for equal scores', () => {
    expect(expectedScore(1200, 1200)).toBe(0.5);
  });

  test('a 400-point favorite expects ~0.91', () => {
    expect(expectedScore(1600, 1200)).toBeCloseTo(1 / 1.1, 5);
  });

  test('sums to 1 across both sides', () => {
    expect(expectedScore(1350, 1180) + expectedScore(1180, 1350)).toBeCloseTo(1, 10);
  });
});

describe('eloDeltas', () => {
  const fresh = { eloScore: 1200, matchupCount: 0 };

  test('even win/loss moves both sides by K/2', () => {
    const { deltaA, deltaB } = eloDeltas(fresh, { ...fresh }, 'win');
    expect(deltaA).toBe(16);
    expect(deltaB).toBe(-16);
  });

  test('draw between equals moves nothing', () => {
    const { deltaA, deltaB } = eloDeltas(fresh, { ...fresh }, 'draw');
    expect(deltaA).toBe(0);
    expect(deltaB).toBe(0);
  });

  test('draw rewards the underdog', () => {
    const { deltaA, deltaB } = eloDeltas(
      { eloScore: 1000, matchupCount: 0 },
      { eloScore: 1400, matchupCount: 0 },
      'draw'
    );
    expect(deltaA).toBeGreaterThan(0);
    expect(deltaB).toBeLessThan(0);
  });

  test('upset win pays more than expected win', () => {
    const underdogWin = eloDeltas(
      { eloScore: 1000, matchupCount: 0 },
      { eloScore: 1400, matchupCount: 0 },
      'win'
    );
    const favoriteWin = eloDeltas(
      { eloScore: 1400, matchupCount: 0 },
      { eloScore: 1000, matchupCount: 0 },
      'win'
    );
    expect(underdogWin.deltaA).toBeGreaterThan(favoriteWin.deltaA);
  });

  test('asymmetric K: established records move less than fresh ones', () => {
    const { deltaA, deltaB } = eloDeltas(
      { eloScore: 1200, matchupCount: 0 },
      { eloScore: 1200, matchupCount: 50 },
      'win'
    );
    expect(deltaA).toBe(16);
    expect(deltaB).toBe(-8);
  });
});

describe('fitBradleyTerry', () => {
  const win = (winnerId: number, loserId: number): MatchupOutcome => ({
    recordAId: winnerId,
    recordBId: loserId,
    winnerId,
  });
  const draw = (recordAId: number, recordBId: number): MatchupOutcome => ({
    recordAId,
    recordBId,
    winnerId: null,
  });
  const score = (scores: Map<number, number>, id: number): number => {
    const value = scores.get(id);
    if (value === undefined) throw new Error(`No score for record ${id}`);
    return value;
  };

  test('empty history fits nothing', () => {
    expect(fitBradleyTerry([]).size).toBe(0);
  });

  test('a single win places the winner symmetrically above the loser', () => {
    const scores = fitBradleyTerry([win(1, 2)]);
    expect(score(scores, 1)).toBeGreaterThan(1200);
    expect(score(scores, 1) - 1200).toBe(1200 - score(scores, 2));
  });

  test('a draw leaves both records at the default score', () => {
    const scores = fitBradleyTerry([draw(1, 2)]);
    expect(score(scores, 1)).toBe(1200);
    expect(score(scores, 2)).toBe(1200);
  });

  test('orders a transitive chain never directly compared end to end', () => {
    const scores = fitBradleyTerry([win(1, 2), win(1, 2), win(2, 3), win(2, 3)]);
    expect(score(scores, 1)).toBeGreaterThan(score(scores, 2));
    expect(score(scores, 2)).toBeGreaterThan(score(scores, 3));
  });

  test('a result propagates to records outside the new matchup', () => {
    const history = [win(1, 2), win(2, 3)];
    const before = fitBradleyTerry(history);
    const after = fitBradleyTerry([...history, win(3, 4)]);
    // Record 3 proving strength lifts record 2 (who beat it), and record 1 in turn.
    expect(score(after, 2)).toBeGreaterThan(score(before, 2));
    expect(score(after, 1)).toBeGreaterThan(score(before, 1));
  });

  test('the anchor keeps an undefeated record finite', () => {
    const scores = fitBradleyTerry(Array.from({ length: 20 }, () => win(1, 2)));
    expect(score(scores, 1)).toBeGreaterThan(1200);
    expect(score(scores, 1)).toBeLessThan(2400);
  });

  test('disconnected components share a common scale', () => {
    const scores = fitBradleyTerry([win(1, 2), win(3, 4)]);
    expect(score(scores, 1)).toBe(score(scores, 3));
    expect(score(scores, 2)).toBe(score(scores, 4));
  });

  test('priors: a record with no matchups scores exactly its prior', () => {
    const scores = fitBradleyTerry([win(1, 2)], new Map([[3, 1750]]));
    expect(score(scores, 3)).toBe(1750);
  });

  test('priors: equal wins over equal opponents preserve the prior gap', () => {
    const priors = new Map([
      [1, 1800],
      [2, 900],
      [3, 1200],
      [4, 1200],
    ]);
    const scores = fitBradleyTerry([win(1, 3), win(2, 4)], priors);
    expect(score(scores, 1)).toBeGreaterThan(score(scores, 2));
    expect(score(scores, 1)).toBeGreaterThan(1800);
    expect(score(scores, 2)).toBeGreaterThan(900);
  });

  test('priors: beating a stronger opponent earns more', () => {
    const priors = new Map([
      [1, 1200],
      [2, 1200],
      [3, 1600],
      [4, 1000],
    ]);
    const scores = fitBradleyTerry([win(1, 3), win(2, 4)], priors);
    expect(score(scores, 1)).toBeGreaterThan(score(scores, 2));
  });
});

describe('relevanceToEloPriors', () => {
  test('a single record sits at the 1200 median', () => {
    expect(relevanceToEloPriors(new Map([[1, 7]])).get(1)).toBe(1200);
  });

  test('ordering follows relevance and ties share a score', () => {
    const priors = relevanceToEloPriors(
      new Map([
        [1, 10],
        [2, 5],
        [3, 5],
        [4, 1],
      ])
    );
    expect(priors.get(2)).toBe(priors.get(3));
    expect(priors.get(1)).toBeGreaterThan(priors.get(2) ?? 0);
    expect(priors.get(2)).toBeGreaterThan(priors.get(4) ?? 0);
  });

  test('percentiles map symmetrically around 1200', () => {
    const priors = relevanceToEloPriors(
      new Map([
        [1, 1],
        [2, 2],
        [3, 3],
      ])
    );
    expect(priors.get(2)).toBe(1200);
    expect((priors.get(1) ?? 0) - 1200).toBe(1200 - (priors.get(3) ?? 0));
  });
});
