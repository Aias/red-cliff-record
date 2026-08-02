import { describe, expect, test } from 'bun:test';
import { eloDeltas, expectedScore, kFactor } from './elo';

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
