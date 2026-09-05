import { describe, expect, test } from 'bun:test';
import { indexSource, locateSelection, mergeContinuousRanges } from './align';

const locate = (selection: string, source: string) =>
  locateSelection(selection, indexSource(source));

describe('locateSelection', () => {
  test('recovers source paragraphs from flattened highlight text', () => {
    const source = 'Introduction.\n\nFirst paragraph.\n\nSecond paragraph.\n\nConclusion.';
    const passage = 'First paragraph.\n\nSecond paragraph.';
    const start = source.indexOf(passage);
    expect(locate('First paragraph. Second paragraph.', source)).toEqual({
      status: 'matched',
      range: { start, end: start + passage.length },
    });
  });

  test('ignores soft hyphens, zero-width spaces, and whitespace inside selections', () => {
    expect(locate('cooperate together', 'co\u00adoperate\n to\u200bgether')).toEqual({
      status: 'matched',
      range: { start: 0, end: 21 },
    });
    expect(locate('co\u00adoperate to\u200bgether', 'cooperate together')).toEqual({
      status: 'matched',
      range: { start: 0, end: 18 },
    });
  });

  test('preserves UTF-16 offsets through canonical accents, ligatures, and emoji', () => {
    const source = '🪴 A cafe\u0301 oﬃce 🧑🏽‍💻.';
    const passage = 'cafe\u0301 oﬃce 🧑🏽‍💻';
    const start = source.indexOf(passage);
    expect(locate('café office 🧑🏽‍💻', source)).toEqual({
      status: 'matched',
      range: { start, end: start + passage.length },
    });
  });

  test('refuses repeated occurrences and counts whitespace-normalized duplicates', () => {
    expect(locate('same words', 'same words; same\nwords')).toEqual({
      status: 'ambiguous',
    });
    expect(locate('cat', 'concatenate cat')).toEqual({
      status: 'matched',
      range: { start: 12, end: 15 },
    });
  });

  test('refuses partial words, contractions, and partial normalized graphemes', () => {
    for (const { selection, source } of [
      { selection: 'cat', source: 'concatenate' },
      { selection: 'can', source: "can't" },
      { selection: 'cat', source: 'cat\u200begory' },
      { selection: 'f', source: 'ﬀ' },
      { selection: '👩', source: '👩‍💻' },
    ]) {
      expect(locate(selection, source)).toEqual({ status: 'unmatched' });
    }
    expect(locate('cat', "'cat'")).toEqual({
      status: 'matched',
      range: { start: 1, end: 4 },
    });
  });

  test('requires the whole selection without bridging substantive source text', () => {
    expect(locate('first last', 'first omitted words last')).toEqual({
      status: 'unmatched',
    });
    expect(locate('first last', 'first, last')).toEqual({ status: 'unmatched' });
  });

  test('preserves digits, punctuation, mathematical notation, and compatibility symbols', () => {
    for (const { selection, source } of [
      { selection: 'x = 2', source: 'x ≠ 2' },
      { selection: 'x2', source: 'x²' },
      { selection: '1', source: '①' },
      { selection: 'A B', source: 'A & B' },
      { selection: 'value 20', source: 'value 2.0' },
    ]) {
      expect(locate(selection, source)).toEqual({ status: 'unmatched' });
    }
  });

  test('does not match empty or entirely ignored input', () => {
    for (const selection of ['', ' \n\t', '\u00ad\u200b']) {
      expect(locate(selection, 'Some text')).toEqual({ status: 'unmatched' });
    }
    expect(locate('text', '')).toEqual({ status: 'unmatched' });
  });
});

describe('mergeContinuousRanges', () => {
  test('groups overlapping and whitespace-separated selections in source order', () => {
    const first = { id: 'first', start: 0, end: 5 };
    const overlap = { id: 'overlap', start: 3, end: 7 };
    const adjacent = { id: 'adjacent', start: 9, end: 13 };
    const input = [adjacent, overlap, first];
    expect(mergeContinuousRanges(input, 'abcdefg\n\nhijk')).toEqual([[first, overlap, adjacent]]);
    expect(input).toEqual([adjacent, overlap, first]);
  });

  test('retains the farthest endpoint when ranges are nested', () => {
    const outer = { start: 0, end: 10 };
    const inner = { start: 2, end: 4 };
    const continuation = { start: 9, end: 13 };
    expect(mergeContinuousRanges([inner, continuation, outer], 'abcdefghijklm')).toEqual([
      [outer, inner, continuation],
    ]);
  });

  test('splits at substantive gaps, including punctuation and invisible non-whitespace', () => {
    for (const separator of [' omitted ', ',', '\u00ad', '\u200b']) {
      const source = `alpha${separator}beta`;
      const first = { start: 0, end: 5 };
      const second = { start: 5 + separator.length, end: source.length };
      expect(mergeContinuousRanges([second, first], source)).toEqual([[first], [second]]);
    }
  });

  test('merges directly adjacent ranges and handles no ranges', () => {
    const first = { start: 0, end: 3 };
    const second = { start: 3, end: 6 };
    expect(mergeContinuousRanges([second, first], 'abcdef')).toEqual([[first, second]]);
    expect(mergeContinuousRanges([], 'abcdef')).toEqual([]);
  });

  test('keeps separate selections apart when an uncovered media boundary lies between them', () => {
    const first = { start: 0, end: 5 };
    const second = { start: 7, end: 11 };
    for (const position of [5, 6, 7]) {
      expect(mergeContinuousRanges([first, second], 'alpha\n\nbeta', [position])).toEqual([
        [first],
        [second],
      ]);
    }
    const adjacent = { start: 5, end: 9 };
    expect(mergeContinuousRanges([first, adjacent], 'alphabeta', [5])).toEqual([
      [first],
      [adjacent],
    ]);
  });

  test('permits overlaps when a selection already spans a media boundary', () => {
    const first = { start: 0, end: 8 };
    const overlapping = { start: 6, end: 12 };
    expect(mergeContinuousRanges([first, overlapping], 'alphabetaend', [7])).toEqual([
      [first, overlapping],
    ]);
  });
});
