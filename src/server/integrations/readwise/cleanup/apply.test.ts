import { describe, expect, test } from 'bun:test';
import type { ReadwiseCleanupChange, ReadwiseCleanupPreview } from '@/shared/readwise-cleanup';
import { prepareReadwiseCleanup, validateReadwiseCleanupState } from './apply';

const updatedAt = new Date('2026-01-10T12:00:00.000Z');

function change(recordIds: number[]): ReadwiseCleanupChange {
  return {
    recordIds,
    before: recordIds.map((id) => ({
      id,
      content: `Highlight ${id}`,
      updatedAt: updatedAt.toISOString(),
    })),
    content: 'Restored highlight.',
    source: 'document',
    reasons: [],
    warnings: [],
    images: [],
  };
}

function preview(changes = [change([11, 12])]): ReadwiseCleanupPreview {
  return {
    documentId: 'document-a',
    recordId: 10,
    title: 'An article',
    sourceUrl: 'https://example.com/article',
    sourceAvailable: true,
    changes,
    combinablePairs: [],
    unchangedRecordIds: [],
    issues: [],
  };
}

function currentRecords() {
  return [11, 12].map((id) => ({ id, content: `Highlight ${id}`, recordUpdatedAt: updatedAt }));
}

type Mapping = Parameters<typeof validateReadwiseCleanupState>[2][number];

function mapping(overrides: Partial<Mapping> = {}): Mapping {
  return {
    id: 'highlight-a',
    recordId: 11,
    parentId: 'document-a',
    category: 'highlight',
    deletedAt: null,
    ...overrides,
  };
}

function mappings() {
  return [
    mapping({ id: 'document-a', recordId: 10, parentId: null, category: 'article' }),
    mapping(),
    mapping({ id: 'highlight-b', recordId: 12 }),
  ];
}

describe('prepareReadwiseCleanup', () => {
  test('selects complete groups by their target record', () => {
    const prepared = prepareReadwiseCleanup(preview([change([11, 12]), change([13])]), [11]);
    expect(prepared.changes).toHaveLength(1);
    expect(prepared.changes[0]).toMatchObject({ targetId: 11, recordIds: [11, 12] });
    expect(prepareReadwiseCleanup(preview(), []).changes).toEqual([]);
  });

  test('rejects duplicate selections, unknown targets, and source-only selections', () => {
    for (const selected of [[11, 11], [99], [12]]) {
      expect(() => prepareReadwiseCleanup(preview(), selected)).toThrow();
    }
  });

  test('leaves unchanged combination candidates untouched when selected', () => {
    const unchanged = { ...change([11]), content: 'Highlight 11' };
    expect(prepareReadwiseCleanup(preview([unchanged]), [11]).changes).toEqual([]);
  });

  test('rejects duplicate records and overlapping groups, including unselected groups', () => {
    for (const changes of [[change([11, 11])], [change([11, 12]), change([12, 13])]]) {
      expect(() => prepareReadwiseCleanup(preview(changes), [11])).toThrow(
        'duplicate or overlapping'
      );
    }
  });

  test('requires exactly one before snapshot for each grouped record', () => {
    for (const ids of [[11], [11, 11], [11, 13], [11, 12, 13]]) {
      const candidate = { ...change([11, 12]), before: change(ids).before };
      expect(() => prepareReadwiseCleanup(preview([candidate]), [11])).toThrow(
        'complete record snapshot'
      );
    }
  });

  test('rejects replacement of the parent document', () => {
    expect(() => prepareReadwiseCleanup(preview([change([10, 11])]), [10])).toThrow(
      'parent document'
    );
  });

  test('accepts web image attachments and rejects other URL protocols', () => {
    for (const url of ['http://example.com/image.png', 'https://example.com/image.png']) {
      const candidate = { ...change([11]), images: [{ url, altText: 'A diagram' }] };
      expect(prepareReadwiseCleanup(preview([candidate]), [11]).changes[0]?.images).toEqual(
        candidate.images
      );
    }
    for (const url of [
      'file:///tmp/image.png',
      'ftp://example.com/image.png',
      'data:image/png;base64,abc',
    ]) {
      const candidate = { ...change([11]), images: [{ url, altText: null }] };
      expect(() => prepareReadwiseCleanup(preview([candidate]), [11])).toThrow('HTTP or HTTPS');
    }
  });
});

describe('validateReadwiseCleanupState', () => {
  const prepared = prepareReadwiseCleanup(preview(), [11]);

  test('allows multiple active Reader highlights mapped to one record in the same document', () => {
    expect(() =>
      validateReadwiseCleanupState(prepared, currentRecords(), [
        ...mappings(),
        mapping({ id: 'highlight-c' }),
      ])
    ).not.toThrow();
  });

  test('rejects changed content, changed metadata timestamps, and missing records', () => {
    const changedContent = currentRecords().map((record) => ({
      ...record,
      content: 'An edited highlight',
    }));
    const changedTimestamp = currentRecords().map((record) => ({
      ...record,
      recordUpdatedAt: new Date(updatedAt.getTime() + 1),
    }));
    for (const records of [changedContent, changedTimestamp, currentRecords().slice(0, 1)]) {
      expect(() => validateReadwiseCleanupState(prepared, records, mappings())).toThrow(
        'changed after this preview'
      );
    }
  });

  test('rejects any foreign, deleted, or non-highlight mapping for a selected record', () => {
    for (const extra of [
      mapping({ id: 'foreign', parentId: 'document-b' }),
      mapping({ id: 'deleted', deletedAt: updatedAt }),
      mapping({ id: 'note', category: 'note' }),
    ]) {
      expect(() =>
        validateReadwiseCleanupState(prepared, currentRecords(), [...mappings(), extra])
      ).toThrow('no longer belongs only');
    }
  });

  test('rejects a selected record with no Reader mapping', () => {
    expect(() =>
      validateReadwiseCleanupState(
        prepared,
        currentRecords(),
        mappings().filter((item) => item.recordId !== 12)
      )
    ).toThrow('no longer belongs only');
  });

  test('rejects a deleted, reassigned, or missing parent document', () => {
    for (const changed of [
      mappings().map((item) =>
        item.id === 'document-a' ? { ...item, deletedAt: updatedAt } : item
      ),
      mappings().map((item) => (item.id === 'document-a' ? { ...item, recordId: 99 } : item)),
      mappings().filter((item) => item.id !== 'document-a'),
    ]) {
      expect(() => validateReadwiseCleanupState(prepared, currentRecords(), changed)).toThrow(
        'Readwise document has changed'
      );
    }
  });
});
