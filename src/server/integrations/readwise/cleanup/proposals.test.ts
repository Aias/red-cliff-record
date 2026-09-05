import { describe, expect, test } from 'bun:test';
import { proposeReadwiseCleanup } from './proposals';

const highlight = (id: string, recordId: number, content: string, current = content) => ({
  id,
  recordId,
  content,
  record: {
    id: recordId,
    content: current,
    contentCreatedAt: new Date('2026-01-01'),
    recordCreatedAt: new Date('2026-01-01'),
    recordUpdatedAt: new Date('2026-01-01'),
    media: [],
  },
});

describe('cleanup proposals', () => {
  test('interleaves source-matched and Readwise-only changes in highlight chronology', () => {
    const highlights = [
      { item: highlight('a', 30, 'Opening passage.'), createdAt: '2026-01-01' },
      { item: highlight('b', 10, 'Middle passage.'), createdAt: '2026-01-02' },
      { item: highlight('c', 20, 'Closing passage.'), createdAt: '2026-01-03' },
    ].map(({ item, createdAt }) => ({
      ...item,
      record: { ...item.record, contentCreatedAt: new Date(createdAt) },
    }));
    const result = proposeReadwiseCleanup(
      highlights.toReversed(),
      new Map([['a', '**Opening** passage.']]),
      '<p>Middle passage. Unselected text. Closing passage.</p>',
      null
    );
    expect(result.changes.map((change) => change.recordIds)).toEqual([[30], [10], [20]]);
  });

  test('orders source-free changes by content date, then record date, with stable ID ties', () => {
    const highlights = [
      { item: highlight('c', 30, 'Closing passage.'), createdAt: new Date('2026-01-02') },
      { item: highlight('b', 20, 'Middle passage.'), createdAt: null },
      { item: highlight('a', 10, 'Opening passage.'), createdAt: null },
    ].map(({ item, createdAt }) => ({
      ...item,
      record: { ...item.record, contentCreatedAt: createdAt },
    }));
    const result = proposeReadwiseCleanup(
      highlights,
      new Map(highlights.map((item) => [item.id, item.content])),
      null,
      null
    );
    expect(result.changes.map((change) => change.recordIds)).toEqual([[10], [20], [30]]);
  });

  test('positions merges at their earliest highlight while preserving source text order', () => {
    const highlights = [
      { item: highlight('a', 30, 'South wind.'), createdAt: '2026-01-01' },
      { item: highlight('b', 10, 'Opening passage.'), createdAt: '2026-01-02' },
      { item: highlight('c', 20, 'North wind.'), createdAt: '2026-01-03' },
    ].map(({ item, createdAt }) => ({
      ...item,
      record: { ...item.record, contentCreatedAt: new Date(createdAt) },
    }));
    const result = proposeReadwiseCleanup(
      highlights,
      new Map(),
      '<p>Opening passage. Unselected text.</p><p>North wind.</p><p>South wind.</p>',
      null,
      false,
      [30, 20]
    );
    expect(result.changes.map((change) => change.recordIds)).toEqual([[20, 30], [10]]);
    expect(result.changes[0]?.content).toBe('North wind.\n\nSouth wind.');
    expect(result.changes[0]?.before.map((record) => record.id)).toEqual([20, 30]);
  });

  test('keeps continuous highlights separate and offers an explicit combination', () => {
    const result = proposeReadwiseCleanup(
      [highlight('a', 1, 'North wind.'), highlight('b', 2, 'South wind.')],
      new Map(),
      '<p>North wind.</p><p>South wind.</p><p>Other text.</p>',
      null
    );
    expect(result.changes.map((change) => change.recordIds)).toEqual([[1], [2]]);
    expect(result.changes.map((change) => change.content)).toEqual(['North wind.', 'South wind.']);
    expect(result.combinablePairs).toEqual([[1, 2]]);
  });

  test('combines continuous passages only when requested, using selected source wording', () => {
    const highlights = [highlight('a', 1, 'North wind.'), highlight('b', 2, 'South wind.')];
    const result = proposeReadwiseCleanup(
      highlights,
      new Map(),
      '<p>North wind.</p><p>South wind.</p><p>Other text.</p>',
      null,
      false,
      [1, 2]
    );
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]?.recordIds).toEqual([1, 2]);
    expect(result.changes[0]?.content).toBe('North wind.\n\nSouth wind.');
  });

  test('keeps overlaps separate until explicitly combined without repeating the overlap', () => {
    const highlights = [
      highlight('a', 1, 'North wind. South wind.'),
      highlight('b', 2, 'South wind. West wind.'),
    ];
    const html = '<p>North wind. South wind. West wind.</p>';
    const separate = proposeReadwiseCleanup(highlights, new Map(), html, null);
    expect(separate.changes.map((change) => change.recordIds)).toEqual([[1], [2]]);
    expect(separate.combinablePairs).toEqual([[1, 2]]);
    const combined = proposeReadwiseCleanup(highlights, new Map(), html, null, false, [2, 1]);
    expect(combined.changes[0]?.recordIds).toEqual([1, 2]);
    expect(combined.changes[0]?.content).toBe('North wind. South wind. West wind.');
  });

  test('combines only the requested neighbors in a longer continuous selection', () => {
    const result = proposeReadwiseCleanup(
      [
        highlight('a', 1, 'North wind.'),
        highlight('b', 2, 'South wind.'),
        highlight('c', 3, 'West wind.'),
      ],
      new Map(),
      '<p>North wind.</p><p>South wind.</p><p>West wind.</p>',
      null,
      false,
      [1, 2]
    );
    expect(result.changes.map((change) => change.recordIds)).toEqual([[1, 2], [3]]);
    expect(result.changes[0]?.content).toBe('North wind.\n\nSouth wind.');
  });

  test('offers pairwise overlaps without combining disjoint selections inside a larger highlight', () => {
    const result = proposeReadwiseCleanup(
      [
        highlight('a', 1, 'North wind. Unselected text. South wind.'),
        highlight('b', 2, 'North wind.'),
        highlight('c', 3, 'South wind.'),
      ],
      new Map(),
      '<p>North wind. Unselected text. South wind.</p>',
      null
    );
    expect(result.changes.map((change) => change.recordIds)).toEqual([[1], [2], [3]]);
    expect(result.combinablePairs).toEqual([
      [1, 2],
      [1, 3],
    ]);
  });

  test('rejects explicit combinations with unselected prose, media, or missing source evidence', () => {
    const highlights = [highlight('a', 1, 'North wind.'), highlight('b', 2, 'South wind.')];
    const native = new Map(highlights.map((item) => [item.id, item.content]));
    for (const html of [
      '<p>North wind. Other text. South wind.</p>',
      '<p>North wind.</p><img src="https://example.org/map.png"><p>South wind.</p>',
      '<p>North wind.</p><iframe src="https://example.org/video"></iframe><p>South wind.</p>',
      null,
    ]) {
      expect(() => proposeReadwiseCleanup(highlights, native, html, null, false, [1, 2])).toThrow(
        'Only continuous or overlapping highlights'
      );
    }
    for (const ids of [[1], [1, 1], [1, 99]]) {
      expect(() =>
        proposeReadwiseCleanup(
          highlights,
          native,
          '<p>North wind. South wind.</p>',
          null,
          false,
          ids
        )
      ).toThrow();
    }
  });

  test('preserves a record that already combines continuous source selections', () => {
    const result = proposeReadwiseCleanup(
      [
        highlight('a', 1, 'North wind.', 'North wind.\n\nSouth wind.'),
        highlight('b', 1, 'South wind.', 'North wind.\n\nSouth wind.'),
      ],
      new Map(),
      '<p>North wind.</p><p>South wind.</p>',
      null
    );
    expect(result.changes.map((change) => change.recordIds)).toEqual([[1]]);
    expect(result.changes[0]?.content).toBe('North wind.\n\nSouth wind.');
    expect(result.combinablePairs).toEqual([]);
  });

  test('keeps selections separated by unselected prose independent', () => {
    const highlights = [highlight('a', 1, 'North wind.'), highlight('b', 2, 'South wind.')];
    const result = proposeReadwiseCleanup(
      highlights,
      new Map(),
      '<p>North wind. Other text. South wind.</p>',
      null
    );
    expect(result.changes.map((change) => change.recordIds)).toEqual([[1], [2]]);
    expect(result.combinablePairs).toEqual([]);
  });

  test('keeps selections separated by an image independent and attaches it to its neighbor', () => {
    const highlights = [highlight('a', 1, 'North wind.'), highlight('b', 2, 'South wind.')];
    const result = proposeReadwiseCleanup(
      highlights,
      new Map(),
      '<p>North wind.</p><img src="https://example.org/map.png"><p>South wind.</p>',
      null
    );
    expect(result.changes.map((change) => change.recordIds)).toEqual([[1], [2]]);
    expect(result.changes.map((change) => change.images)).toEqual([
      [],
      [{ url: 'https://example.org/map.png', altText: null }],
    ]);
    expect(result.combinablePairs).toEqual([]);
  });

  test('keeps all content of a combined record when its source is unavailable', () => {
    const highlights = [
      highlight('a', 1, 'North wind.', 'North wind. South wind.'),
      highlight('b', 1, 'South wind.', 'North wind. South wind.'),
    ];
    const result = proposeReadwiseCleanup(
      highlights,
      new Map([
        ['a', 'North wind.'],
        ['b', 'South wind.'],
      ]),
      null,
      null,
      true
    );
    expect(result.changes).toEqual([]);
    expect(result.issues).toHaveLength(1);
  });

  test('skips a combined record whose selections cover separate source regions', () => {
    const highlights = [
      highlight('a', 1, 'North wind.', 'North wind. South wind.'),
      highlight('b', 1, 'South wind.', 'North wind. South wind.'),
    ];
    const result = proposeReadwiseCleanup(
      highlights,
      new Map(),
      '<p>North wind. Other text. South wind.</p>',
      null
    );
    expect(result.changes).toEqual([]);
    expect(result.issues).toHaveLength(1);
  });

  test('flags hand edits and ambiguous source matches', () => {
    const result = proposeReadwiseCleanup(
      [highlight('a', 1, 'North wind.', 'My edited passage.')],
      new Map([['a', 'North wind.']]),
      '<p>North wind. North wind.</p>',
      null
    );
    expect(result.changes[0]?.warnings).toHaveLength(2);
  });

  test('does not flag a record with no content of its own as edited', () => {
    const source = highlight('a', 1, 'North wind.');
    const result = proposeReadwiseCleanup(
      [{ ...source, record: { ...source.record, content: null } }],
      new Map(),
      '<p>North wind.</p>',
      null
    );
    expect(result.changes[0]?.warnings).toEqual([]);
  });

  test('preserves native images absent from the saved document as attachments', () => {
    const result = proposeReadwiseCleanup(
      [highlight('a', 1, 'North wind.')],
      new Map([['a', 'North wind.\n\n![Map](https://example.org/map.png)']]),
      '<p>North wind.</p>',
      null
    );
    expect(result.changes[0]?.images).toEqual([
      { url: 'https://example.org/map.png', altText: 'Map' },
    ]);
  });

  test('does not suggest attaching an image that is already preserved', () => {
    const source = highlight('a', 1, 'North wind.');
    const result = proposeReadwiseCleanup(
      [
        {
          ...source,
          record: { ...source.record, media: [{ url: 'https://example.org/map.png' }] },
        },
      ],
      new Map([['a', 'North wind.\n\n![Map](https://example.org/map.png)']]),
      '<p>North wind.</p>',
      null
    );
    expect(result.changes[0]?.images).toEqual([]);
  });

  test('requires review for native-only media that cannot become an attachment', () => {
    const result = proposeReadwiseCleanup(
      [highlight('a', 1, 'North wind.')],
      new Map([['a', 'North wind. ![Map](data:image/png;base64,YQ==)']]),
      '<p>North wind.</p>',
      null
    );
    expect(result.changes[0]?.warnings.some((warning) => warning.includes('media'))).toBe(true);
  });

  test('preserves literal Markdown-looking characters in unformatted imports', () => {
    for (const { content, expected } of [
      { content: '1. Dogs have tails.', expected: '1\\. Dogs have tails.' },
      { content: '# A heading', expected: '\\# A heading' },
      { content: '* A point', expected: '\\* A point' },
    ]) {
      const result = proposeReadwiseCleanup(
        [highlight('a', 1, content)],
        new Map(),
        `<p>${content}</p>`,
        null
      );
      expect(result.changes[0]?.content).toBe(expected);
    }
  });

  test('preserves literal Markdown syntax inside source code', () => {
    for (const content of ['[ref](url)', '*bold*']) {
      const result = proposeReadwiseCleanup(
        [highlight('a', 1, content)],
        new Map(),
        `<pre><code>${content}</code></pre>`,
        null
      );
      expect(result.changes[0]?.content).toBe(`\`\`\`\n${content}\n\`\`\``);
    }
  });
});
