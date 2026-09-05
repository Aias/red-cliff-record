import { describe, expect, test } from 'bun:test';
import type { LinkSelect } from '@hozo';
import { mergeRecordLinks } from './merge-records';

function link(overrides: Partial<LinkSelect> = {}): LinkSelect {
  return {
    id: 1,
    sourceId: 10,
    targetId: 30,
    predicate: 'tagged_with',
    notes: null,
    recordCreatedAt: new Date('2025-01-01'),
    recordUpdatedAt: new Date('2025-01-02'),
    ...overrides,
  };
}

describe('mergeRecordLinks', () => {
  test('preserves both notes when source and target share a relationship', () => {
    const source = link({ notes: 'Explains the premise.' });
    const target = link({ id: 2, sourceId: 20, notes: 'Includes a counterexample.' });
    const merged = mergeRecordLinks([source, target], 10, 20);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      sourceId: 20,
      targetId: 30,
      predicate: 'tagged_with',
      notes: 'Explains the premise.\n\nIncludes a counterexample.',
    });
    expect(source.notes).toBe('Explains the premise.');
    expect(target.notes).toBe('Includes a counterexample.');
  });

  test('deduplicates equal notes and retains notes from either input', () => {
    expect(
      mergeRecordLinks(
        [link({ notes: 'Shared note' }), link({ id: 2, sourceId: 20, notes: 'Shared note' })],
        10,
        20
      )[0]?.notes
    ).toBe('Shared note');
    expect(
      mergeRecordLinks([link(), link({ id: 2, sourceId: 20, notes: 'Target note' })], 10, 20)[0]
        ?.notes
    ).toBe('Target note');
    expect(
      mergeRecordLinks([link({ notes: 'Source note' }), link({ id: 2, sourceId: 20 })], 10, 20)[0]
        ?.notes
    ).toBe('Source note');
    expect(mergeRecordLinks([link()], 10, 20)[0]?.notes).toBeNull();
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
    expect(merged).toHaveLength(3);
    expect(merged).toMatchObject([
      { sourceId: 20, targetId: 30, predicate: 'tagged_with' },
      { sourceId: 30, targetId: 20, predicate: 'tagged_with' },
      { sourceId: 20, targetId: 30, predicate: 'related_to' },
    ]);
  });

  test('removes relationships between the merged records without removing other links', () => {
    const merged = mergeRecordLinks(
      [
        link({ targetId: 20 }),
        link({ id: 2, sourceId: 20, targetId: 10 }),
        link({ id: 3, sourceId: 20 }),
      ],
      10,
      20
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ sourceId: 20, targetId: 30 });
  });

  test('retains the earliest relationship creation date', () => {
    const earliest = new Date('2024-03-01');
    const merged = mergeRecordLinks(
      [link(), link({ id: 2, sourceId: 20, recordCreatedAt: earliest })],
      10,
      20
    );
    expect(merged[0]?.recordCreatedAt).toEqual(earliest);
  });
});
