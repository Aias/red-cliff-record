import { describe, expect, test } from 'bun:test';
import { proposeCleanup, type CleanupHighlight } from './propose';
import { parseSource } from './source';

const highlight = (
  id: string,
  recordId: number,
  content: string,
  current = content
): CleanupHighlight => ({
  id,
  content,
  record: {
    id: recordId,
    content: current,
    contentCreatedAt: new Date('2026-01-01'),
    recordCreatedAt: new Date('2026-01-01'),
    recordUpdatedAt: new Date('2026-01-01'),
    recordCuratedAt: null,
    media: [],
  },
});

const propose = (
  highlights: CleanupHighlight[],
  html: string | null,
  native = new Map<string, string>(),
  merge?: number[]
) => proposeCleanup(highlights, native, html ? parseSource(html, null) : null, null, merge);

const ids = (result: ReturnType<typeof propose>) =>
  result.changes.map((change) => [change.target.id, ...change.merged.map((record) => record.id)]);

describe('proposeCleanup', () => {
  test('keeps continuous highlights separate and offers a merge', () => {
    const result = propose(
      [highlight('a', 1, 'North wind.'), highlight('b', 2, 'South wind.')],
      '<p>North wind.</p><p>South wind.</p><p>Other text.</p>'
    );
    expect(ids(result)).toEqual([[1], [2]]);
    expect(result.changes.map((change) => change.changed)).toEqual([false, false]);
    expect(result.mergeable).toEqual([[1, 2]]);
  });

  test('merges continuous or overlapping passages only when requested', () => {
    const html = '<p>North wind. South wind. West wind.</p>';
    const highlights = [
      highlight('a', 1, 'North wind. South wind.'),
      highlight('b', 2, 'South wind. West wind.'),
    ];
    expect(propose(highlights, html).mergeable).toEqual([[1, 2]]);
    const merged = propose(highlights, html, new Map(), [2, 1]);
    expect(ids(merged)).toEqual([[2, 1]]);
    expect(merged.changes[0]).toMatchObject({
      content: 'North wind. South wind. West wind.',
      changed: true,
    });
  });

  test('rejects merges across unselected prose, media, or without a source', () => {
    const highlights = [highlight('a', 1, 'North wind.'), highlight('b', 2, 'South wind.')];
    for (const html of [
      '<p>North wind. Other text. South wind.</p>',
      '<p>North wind.</p><img src="https://example.org/map.png"><p>South wind.</p>',
      null,
    ]) {
      expect(() => propose(highlights, html, new Map(), [1, 2])).toThrow('Only continuous');
    }
    expect(() =>
      propose(highlights, '<p>North wind. South wind.</p>', new Map(), [1, 99])
    ).toThrow();
  });

  test('separates selections split by media and attaches the image to its neighbor', () => {
    const result = propose(
      [highlight('a', 1, 'North wind.'), highlight('b', 2, 'South wind.')],
      '<p>North wind.</p><img src="https://example.org/map.png"><p>South wind.</p>'
    );
    expect(result.mergeable).toEqual([]);
    expect(result.changes.map((change) => change.images)).toEqual([
      [],
      [{ url: 'https://example.org/map.png', altText: null }],
    ]);
  });

  test('renders a record that already spans continuous selections as one change', () => {
    const result = propose(
      [
        highlight('a', 1, 'North wind.', 'North wind.\n\nSouth wind.'),
        highlight('b', 1, 'South wind.', 'North wind.\n\nSouth wind.'),
      ],
      '<p>North wind.</p><p>South wind.</p>'
    );
    expect(ids(result)).toEqual([[1]]);
    expect(result.changes[0]?.content).toBe('North wind.\n\nSouth wind.');
    expect(result.mergeable).toEqual([]);
  });

  test('leaves a record alone when its selections fall in separate places', () => {
    const result = propose(
      [
        highlight('a', 1, 'North wind.', 'North wind. South wind.'),
        highlight('b', 1, 'South wind.', 'North wind. South wind.'),
      ],
      '<p>North wind. Other text. South wind.</p>'
    );
    expect(result.changes.map((change) => change.changed)).toEqual([false]);
    expect(result.changes[0]?.warnings).toContain(
      'This record combines selections that are separate or could not be located in the source.'
    );
  });

  test('ignores whitespace differences between the record and its import', () => {
    const result = propose(
      [highlight('a', 1, 'North wind.\nSouth wind.', 'North wind.\n\nSouth wind.')],
      '<p>North wind. South wind.</p>'
    );
    expect(result.changes[0]?.warnings).toEqual([]);
  });

  test('does not flag a record whose text already matches the proposal as edited', () => {
    const result = propose(
      [highlight('a', 1, 'North wind.', 'North **wind**.')],
      '<p>North <strong>wind</strong>.</p>'
    );
    expect(result.changes[0]).toMatchObject({ changed: false, warnings: [] });
  });

  test('accepts an ambiguous match when every occurrence restores the same text', () => {
    const result = propose(
      [highlight('a', 1, 'North wind.')],
      '<p>North wind.</p><p>Body.</p><p>North wind.</p>'
    );
    expect(result.changes[0]).toMatchObject({ source: 'document', warnings: [] });
  });

  test('prefers the body occurrence over a table-of-contents link when ambiguous', () => {
    const result = propose(
      [highlight('a', 1, 'Observation 1: Paper helps thinking.')],
      '<ul><li><a href="#one">Observation 1: Paper helps thinking.</a></li></ul><h2 id="one">Observation 1: Paper helps thinking.</h2><p>Body.</p>'
    );
    expect(result.changes[0]).toMatchObject({
      source: 'document',
      content: '## Observation 1: Paper helps thinking.',
      warnings: [],
    });
  });

  test('flags curated records only when the proposal would change them', () => {
    const curated = highlight('a', 1, 'North wind.');
    curated.record.recordCuratedAt = new Date('2026-02-01');
    expect(propose([curated], '<p>North <em>wind</em>.</p>').changes[0]?.warnings).toEqual([
      'This record is curated. Review it before replacing its text.',
    ]);
    expect(propose([curated], '<p>North wind.</p>').changes[0]?.warnings).toEqual([]);
  });

  test('flags edits and ambiguous matches', () => {
    const result = propose(
      [highlight('a', 1, 'North wind.', 'My edited passage.')],
      '<p>North wind. North wind.</p>',
      new Map([['a', 'North wind.']])
    );
    expect(result.changes[0]?.source).toBe('readwise');
    expect(result.changes[0]?.warnings).toHaveLength(2);
  });

  test('turns an image-only highlight into a media attachment', () => {
    const result = propose(
      [highlight('a', 1, '')],
      '<p>North wind.</p>',
      new Map([['a', '![](https://example.org/map.png)']])
    );
    expect(result.changes[0]).toMatchObject({
      content: '',
      images: [{ url: 'https://example.org/map.png', altText: null }],
      warnings: [],
      changed: true,
    });
  });

  test('falls back to the formatted highlight when the source is unavailable', () => {
    const result = propose(
      [highlight('a', 1, 'North wind.')],
      null,
      new Map([['a', '**North** wind.']])
    );
    expect(result.changes[0]).toMatchObject({
      content: '**North** wind.',
      source: 'readwise',
      changed: true,
    });
  });

  test('locates a highlight whose source carries a footnote marker it lacks', () => {
    const result = propose(
      [highlight('a', 1, 'North wind. South wind.')],
      '<p>North wind.<sup><a href="#fn5">[5]</a></sup> South wind.</p>'
    );
    expect(result.changes[0]).toMatchObject({
      source: 'document',
      content: 'North wind. South wind.',
      warnings: [],
    });
  });

  test('falls back to the imported plain text when Reader Markdown cannot be located', () => {
    const result = propose(
      [highlight('a', 1, 'North wind. South wind.')],
      '<p>North wind. South wind.</p>',
      new Map([['a', 'North wind.* South wind.*']])
    );
    expect(result.changes[0]).toMatchObject({
      source: 'document',
      content: 'North wind. South wind.',
      warnings: [],
    });
  });

  test('attaches native images missing from the source unless already attached', () => {
    const native = new Map([['a', 'North wind.\n\n![Map](https://example.org/map.png)']]);
    const attached = highlight('a', 1, 'North wind.');
    attached.record.media = [{ url: 'https://example.org/map.png' }];
    expect(
      propose([highlight('a', 1, 'North wind.')], '<p>North wind.</p>', native).changes[0]?.images
    ).toEqual([{ url: 'https://example.org/map.png', altText: 'Map' }]);
    expect(propose([attached], '<p>North wind.</p>', native).changes[0]?.images).toEqual([]);
  });

  test('warns when the formatted highlight has media that cannot be attached', () => {
    const result = propose(
      [highlight('a', 1, 'North wind.')],
      '<p>North wind.</p>',
      new Map([['a', 'North wind. ![Map](data:image/png;base64,YQ==)']])
    );
    expect(result.changes[0]?.warnings).toContain(
      'The formatted highlight contains media that could not be recovered. Review the original highlight.'
    );
  });

  test('orders changes by highlight date and places merges at their earliest member', () => {
    const dated = (item: CleanupHighlight, date: string) => ({
      ...item,
      record: { ...item.record, contentCreatedAt: new Date(date) },
    });
    const result = propose(
      [
        dated(highlight('a', 30, 'South wind.'), '2026-01-01'),
        dated(highlight('b', 10, 'Opening passage.'), '2026-01-02'),
        dated(highlight('c', 20, 'North wind.'), '2026-01-03'),
      ],
      '<p>Opening passage. Unselected text.</p><p>North wind.</p><p>South wind.</p>',
      new Map(),
      [20, 30]
    );
    expect(ids(result)).toEqual([[20, 30], [10]]);
  });
});
