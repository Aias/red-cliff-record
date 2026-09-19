import { describe, expect, test } from 'bun:test';
import type { RecordSlim } from '@/shared/types/domain';
import { mergeRecords, mergeTextFields } from './merge-records';

const record = (overrides: Partial<RecordSlim> = {}): RecordSlim => ({
  id: 1,
  slug: null,
  type: 'artifact',
  title: null,
  sense: null,
  abbreviation: null,
  url: null,
  avatarUrl: null,
  summary: null,
  content: null,
  notes: null,
  mediaCaption: null,
  eloScore: 1200,
  isPrivate: false,
  recordCuratedAt: null,
  reminderAt: null,
  sources: null,
  recordCreatedAt: new Date('2025-01-01'),
  recordUpdatedAt: new Date('2025-01-01'),
  contentCreatedAt: null,
  contentUpdatedAt: null,
  textEmbeddedAt: null,
  ...overrides,
});

describe('mergeTextFields', () => {
  test('concatenates target first unless a side is resolved', () => {
    expect(mergeTextFields('from source', 'from target')).toBe('from target\n---\nfrom source');
    expect(mergeTextFields('from source', 'from target', 'source')).toBe('from source');
    expect(mergeTextFields('from source', 'from target', 'target')).toBe('from target');
  });

  test('keeps whichever side has text regardless of resolution', () => {
    expect(mergeTextFields('from source', null, 'target')).toBe('from source');
    expect(mergeTextFields('', 'from target', 'source')).toBe('from target');
    expect(mergeTextFields(null, '', 'both')).toBeNull();
  });
});

describe('mergeRecords', () => {
  const source = record({
    id: 2,
    title: 'A Pattern Language: Towns, Buildings, Construction',
    url: 'https://publisher.example/a-pattern-language',
    summary: 'Source summary',
  });
  const target = record({
    title: 'A Pattern Language',
    url: 'https://t.co/abc',
    summary: 'Target summary',
  });

  test('prefers the target when no resolution is given', () => {
    const merged = mergeRecords(source, target);
    expect(merged).toMatchObject({
      title: 'A Pattern Language',
      url: 'https://t.co/abc',
      summary: 'Target summary\n---\nSource summary',
    });
  });

  test('applies per-field resolutions', () => {
    const merged = mergeRecords(source, target, {
      title: 'source',
      url: 'target',
      summary: 'source',
    });
    expect(merged).toMatchObject({
      title: 'A Pattern Language: Towns, Buildings, Construction',
      url: 'https://t.co/abc',
      summary: 'Source summary',
    });
  });

  test('never replaces text with an empty source value', () => {
    const merged = mergeRecords(record({ id: 2, title: '' }), target, { title: 'source' });
    expect(merged.title).toBe('A Pattern Language');
  });
});
