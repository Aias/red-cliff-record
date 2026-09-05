export type Range = { start: number; end: number };

export type Match =
  | { status: 'matched'; range: Range }
  | { status: 'ambiguous'; ranges: Range[] }
  | { status: 'unmatched' };

const graphemes = new Intl.Segmenter('en', { granularity: 'grapheme' });
const words = new Intl.Segmenter('en', { granularity: 'word' });

const normalize = (text: string) =>
  text
    .normalize('NFC')
    .replace(/[ﬀ-ﬆ]/gu, (ligature) => ligature.normalize('NFKC'))
    .replace(/[\u00ad\u200b\u2022\u25aa\u25e6\u2023]/gu, '')
    .replace(/[\u2018\u2019\u201a]/gu, "'")
    .replace(/[\u201c\u201d\u201e]/gu, '"');

const SNAP_TO_WORD_MIN_LENGTH = 20;

export function indexText(source: string, skip: readonly Range[] = []) {
  let normalized = '';
  let compact = '';
  const normalizedRanges: Range[] = [];
  const ranges: Range[] = [];
  const wordInteriors = new Uint8Array(source.length + 1);
  const skipped = new Uint8Array(source.length + 1);
  for (const range of skip) skipped.fill(1, range.start, range.end);
  for (const { segment, index } of graphemes.segment(source)) {
    const range = { start: index, end: index + segment.length };
    for (const character of normalize(segment).split('')) {
      normalized += character;
      normalizedRanges.push(range);
      if (skipped[index] || /\s/u.test(character)) continue;
      compact += character;
      ranges.push(range);
    }
  }
  for (const { segment, index, isWordLike } of words.segment(normalized)) {
    const first = normalizedRanges[index];
    const last = normalizedRanges[index + segment.length - 1];
    if (isWordLike && first && last) wordInteriors.fill(1, first.start + 1, last.end);
  }
  return { compact, ranges, wordInteriors };
}

export type TextIndex = ReturnType<typeof indexText>;

export function locate(selection: string, { compact, ranges, wordInteriors }: TextIndex): Match {
  const needle = normalize(selection).replace(/\s/gu, '');
  if (!needle) return { status: 'unmatched' };
  const matches: Range[] = [];
  for (
    let index = compact.indexOf(needle);
    index !== -1;
    index = compact.indexOf(needle, index + 1)
  ) {
    const first = ranges[index];
    const last = ranges[index + needle.length - 1];
    if (!first || !last) continue;
    if (ranges[index - 1]?.start === first.start) continue;
    if (ranges[index + needle.length]?.end === last.end) continue;
    let { start } = first;
    let { end } = last;
    if (wordInteriors[start] || wordInteriors[end]) {
      if (needle.length < SNAP_TO_WORD_MIN_LENGTH) continue;
      while (wordInteriors[start]) start--;
      while (wordInteriors[end]) end++;
      const before = ranges.findIndex((range) => range.start >= start);
      const afterIndex = ranges.findIndex((range) => range.start >= end);
      const after = afterIndex === -1 ? ranges.length : afterIndex;
      const leading = compact.slice(before, index);
      const trailing = compact.slice(index + needle.length, after);
      if (!/^\p{L}*$/u.test(leading) || !/^\p{Ll}*$/u.test(trailing)) continue;
    }
    matches.push({ start, end });
  }
  const [range] = matches;
  if (!range) return { status: 'unmatched' };
  return matches.length === 1
    ? { status: 'matched', range }
    : { status: 'ambiguous', ranges: matches };
}

export const isContinuous = (
  left: Range,
  right: Range,
  text: string,
  barriers: readonly number[]
) =>
  right.start < left.end ||
  (/^\s*$/u.test(text.slice(left.end, right.start)) &&
    !barriers.some((position) => position >= left.end && position <= right.start));
