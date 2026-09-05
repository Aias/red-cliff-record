import { describe, expect, test } from 'bun:test';
import {
  canCombineReadwiseChanges,
  hasReadwiseCleanupChanges,
  type ReadwiseCleanupChange,
} from './readwise-cleanup';

function change(recordIds: number[]): ReadwiseCleanupChange {
  return {
    recordIds,
    before: recordIds.map((id) => ({
      id,
      content: 'A passage.',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })),
    content: 'A passage.',
    source: 'document',
    reasons: [],
    warnings: [],
    images: [],
  };
}

describe('cleanup updates', () => {
  test('distinguishes untouched combination candidates from text, image, and merge updates', () => {
    expect(hasReadwiseCleanupChanges(change([1]))).toBe(false);
    expect(hasReadwiseCleanupChanges({ ...change([1]), content: 'A corrected passage.' })).toBe(
      true
    );
    expect(
      hasReadwiseCleanupChanges({
        ...change([1]),
        images: [{ url: 'https://example.com/image.png', altText: null }],
      })
    ).toBe(true);
    expect(hasReadwiseCleanupChanges(change([1, 2]))).toBe(true);
  });

  test('includes editorial updates and source warnings without selecting unchanged text', () => {
    expect(
      hasReadwiseCleanupChanges({
        ...change([1]),
        source: 'model',
        content: 'A corrected passage.',
        warnings: ['Review spelling.'],
      })
    ).toBe(true);
    expect(hasReadwiseCleanupChanges({ ...change([1]), warnings: ['Review the source.'] })).toBe(
      false
    );
  });
});

describe('cleanup combination eligibility', () => {
  const pairs: [number, number][] = [
    [1, 2],
    [1, 3],
    [3, 4],
  ];

  test('offers source-proven pairs in either displayed order', () => {
    expect(canCombineReadwiseChanges(change([1]), change([2]), pairs)).toBe(true);
    expect(canCombineReadwiseChanges(change([2]), change([1]), pairs)).toBe(true);
    expect(canCombineReadwiseChanges(change([2]), change([3]), pairs)).toBe(false);
  });

  test('supports chained merges through any member without inventing continuity', () => {
    expect(canCombineReadwiseChanges(change([2, 1]), change([3]), pairs)).toBe(true);
    expect(canCombineReadwiseChanges(change([2, 1]), change([3, 4]), pairs)).toBe(true);
    expect(canCombineReadwiseChanges(change([2, 1]), change([4]), pairs)).toBe(false);
    expect(canCombineReadwiseChanges(change([2, 1]), change([1, 3]), pairs)).toBe(false);
  });
});
