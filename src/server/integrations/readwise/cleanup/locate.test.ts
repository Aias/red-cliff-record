import { describe, expect, test } from 'bun:test';
import { indexText, isContinuous, locate } from './locate';

const find = (selection: string, source: string) => locate(selection, indexText(source));

describe('locate', () => {
  test('recovers source paragraphs from flattened highlight text', () => {
    const source = 'Introduction.\n\nFirst paragraph.\n\nSecond paragraph.\n\nConclusion.';
    const passage = 'First paragraph.\n\nSecond paragraph.';
    const start = source.indexOf(passage);
    expect(find('First paragraph. Second paragraph.', source)).toEqual({
      status: 'matched',
      range: { start, end: start + passage.length },
    });
  });

  test('ignores invisible characters and whitespace on either side', () => {
    expect(find('cooperate together', 'co­operate\n to​gether')).toEqual({
      status: 'matched',
      range: { start: 0, end: 21 },
    });
    expect(find('co­operate to​gether', 'cooperate together')).toEqual({
      status: 'matched',
      range: { start: 0, end: 18 },
    });
  });

  test('preserves UTF-16 offsets through combining accents, ligatures, and emoji', () => {
    const source = '🪴 A café oﬃce 🧑🏽‍💻.';
    const passage = 'café oﬃce 🧑🏽‍💻';
    const start = source.indexOf(passage);
    expect(find('café office 🧑🏽‍💻', source)).toEqual({
      status: 'matched',
      range: { start, end: start + passage.length },
    });
  });

  test('reports repeated occurrences as ambiguous', () => {
    expect(find('same words', 'same words; same\nwords')).toEqual({ status: 'ambiguous' });
  });

  test('refuses partial words and partial graphemes', () => {
    for (const { selection, source } of [
      { selection: 'cat', source: 'concatenate' },
      { selection: 'can', source: "can't" },
      { selection: 'f', source: 'ﬀ' },
      { selection: '👩', source: '👩‍💻' },
    ]) {
      expect(find(selection, source)).toEqual({ status: 'unmatched' });
    }
    expect(find('cat', "'cat'")).toEqual({ status: 'matched', range: { start: 1, end: 4 } });
  });

  test('does not bridge omitted text or punctuation', () => {
    expect(find('first last', 'first omitted words last')).toEqual({ status: 'unmatched' });
    expect(find('first last', 'first, last')).toEqual({ status: 'unmatched' });
  });

  test('keeps digits and symbols significant', () => {
    for (const { selection, source } of [
      { selection: 'x = 2', source: 'x ≠ 2' },
      { selection: 'x2', source: 'x²' },
      { selection: 'value 20', source: 'value 2.0' },
    ]) {
      expect(find(selection, source)).toEqual({ status: 'unmatched' });
    }
  });

  test('rejects empty input', () => {
    expect(find(' ­', 'Some text')).toEqual({ status: 'unmatched' });
  });
});

describe('isContinuous', () => {
  const text = 'alpha\n\nbeta, gamma';

  test('accepts whitespace gaps, overlaps, and adjacency', () => {
    expect(isContinuous({ start: 0, end: 5 }, { start: 7, end: 11 }, text, [])).toBe(true);
    expect(isContinuous({ start: 0, end: 9 }, { start: 7, end: 11 }, text, [])).toBe(true);
    expect(isContinuous({ start: 0, end: 5 }, { start: 5, end: 11 }, text, [])).toBe(true);
  });

  test('rejects gaps that skip text or cross media', () => {
    expect(isContinuous({ start: 7, end: 11 }, { start: 13, end: 18 }, text, [])).toBe(false);
    expect(isContinuous({ start: 0, end: 5 }, { start: 7, end: 11 }, text, [6])).toBe(false);
    expect(isContinuous({ start: 0, end: 5 }, { start: 5, end: 11 }, text, [5])).toBe(false);
  });
});
