export type Range = { start: number; end: number };

export type Match =
  | { status: 'matched'; range: Range }
  | { status: 'ambiguous' }
  | { status: 'unmatched' };

const graphemes = new Intl.Segmenter('en', { granularity: 'grapheme' });
const words = new Intl.Segmenter('en', { granularity: 'word' });

const normalize = (text: string) =>
  text
    .normalize('NFC')
    .replace(/[ﬀ-ﬆ]/gu, (ligature) => ligature.normalize('NFKC'))
    .replace(/[­​]/gu, '');

export function indexText(source: string) {
  let normalized = '';
  let compact = '';
  const normalizedRanges: Range[] = [];
  const ranges: Range[] = [];
  const wordInteriors = new Uint8Array(source.length + 1);
  for (const { segment, index } of graphemes.segment(source)) {
    const range = { start: index, end: index + segment.length };
    for (const character of normalize(segment).split('')) {
      normalized += character;
      normalizedRanges.push(range);
      if (/\s/u.test(character)) continue;
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
  let match: Range | undefined;
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
    if (wordInteriors[first.start] || wordInteriors[last.end]) continue;
    if (match) return { status: 'ambiguous' };
    match = { start: first.start, end: last.end };
  }
  return match ? { status: 'matched', range: match } : { status: 'unmatched' };
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
