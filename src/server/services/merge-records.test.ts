import { describe, expect, test } from 'bun:test';
import type { LinkSelect } from '@hozo';
import { mergeRecordLinks } from './merge-records';

const link = (overrides: Partial<LinkSelect> = {}): LinkSelect => ({
  id: 1,
  sourceId: 10,
  targetId: 30,
  predicate: 'tagged_with',
  notes: null,
  recordCreatedAt: new Date('2025-01-01'),
  recordUpdatedAt: new Date('2025-01-02'),
  ...overrides,
});

describe('mergeRecordLinks', () => {
  test('joins notes and keeps the earliest date when both records share a relationship', () => {
    const merged = mergeRecordLinks(
      [
        link({ notes: 'Explains the premise.' }),
        link({
          id: 2,
          sourceId: 20,
          notes: 'Includes a counterexample.',
          recordCreatedAt: new Date('2024-03-01'),
        }),
      ],
      10,
      20
    );
    expect(merged).toEqual([
      expect.objectContaining({
        sourceId: 20,
        targetId: 30,
        predicate: 'tagged_with',
        notes: 'Explains the premise.\n\nIncludes a counterexample.',
        recordCreatedAt: new Date('2024-03-01'),
      }),
    ]);
  });

  test('keeps relationships distinct by direction and predicate', () => {
    const merged = mergeRecordLinks(
      [
        link(),
        link({ id: 2, sourceId: 30, targetId: 10 }),
        link({ id: 3, predicate: 'related_to' }),
      ],
      10,
      20
    );
    expect(merged).toMatchObject([
      { sourceId: 20, targetId: 30, predicate: 'tagged_with' },
      { sourceId: 30, targetId: 20, predicate: 'tagged_with' },
      { sourceId: 20, targetId: 30, predicate: 'related_to' },
    ]);
  });

  test('drops links between the merged pair without touching other links', () => {
    const merged = mergeRecordLinks(
      [
        link({ targetId: 20 }),
        link({ id: 2, sourceId: 20, targetId: 10 }),
        link({ id: 3, sourceId: 20 }),
      ],
      10,
      20
    );
    expect(merged).toMatchObject([{ sourceId: 20, targetId: 30 }]);
  });
});
