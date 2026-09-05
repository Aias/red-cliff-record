export type SourceRange = { start: number; end: number };

const graphemes = new Intl.Segmenter('en', { granularity: 'grapheme' });
const words = new Intl.Segmenter('en', { granularity: 'word' });

function normalizeText(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[ﬀ-ﬆ]/gu, (ligature) => ligature.normalize('NFKC'))
    .replace(/[\u00ad\u200b]/gu, '');
}

export function indexSource(source: string) {
  let normalized = '';
  let compact = '';
  const normalizedRanges: SourceRange[] = [];
  const ranges: SourceRange[] = [];
  const wordInteriors = new Uint8Array(source.length + 1);

  for (const { segment, index } of graphemes.segment(source)) {
    const text = normalizeText(segment);
    const range = { start: index, end: index + segment.length };
    normalized += text;
    for (let offset = 0; offset < text.length; offset++) {
      normalizedRanges.push(range);
      const character = text.charAt(offset);
      if (/\s/u.test(character)) continue;
      compact += character;
      ranges.push(range);
    }
  }

  for (const { segment, index, isWordLike } of words.segment(normalized)) {
    if (!isWordLike) continue;
    const first = normalizedRanges[index];
    const last = normalizedRanges[index + segment.length - 1];
    if (first && last) wordInteriors.fill(1, first.start + 1, last.end);
  }

  return { compact, ranges, wordInteriors };
}

export type SourceIndex = ReturnType<typeof indexSource>;

export type SelectionMatch =
  | { status: 'matched'; range: SourceRange }
  | { status: 'ambiguous' }
  | { status: 'unmatched' };

export function locateSelection(
  selection: string,
  { compact, ranges, wordInteriors }: SourceIndex
): SelectionMatch {
  const needle = normalizeText(selection).replace(/\s/gu, '');
  if (!needle) return { status: 'unmatched' };
  let match: SourceRange | undefined;
  let cursor = 0;

  while (cursor <= compact.length - needle.length) {
    const index = compact.indexOf(needle, cursor);
    if (index === -1) break;
    cursor = index + 1;
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

export function mergeContinuousRanges<T extends SourceRange>(
  ranges: readonly T[],
  source: string,
  barriers: readonly number[] = []
): T[][] {
  const groups: T[][] = [];
  let group: T[] = [];
  let end = 0;

  for (const range of [...ranges].sort(
    (left, right) => left.start - right.start || left.end - right.end
  )) {
    const crossesBarrier =
      range.start >= end && barriers.some((position) => position >= end && position <= range.start);
    const skipsText = range.start > end && !/^\s*$/u.test(source.slice(end, range.start));
    if (group.length && (crossesBarrier || skipsText)) {
      groups.push(group);
      group = [];
    }
    group.push(range);
    end = Math.max(end, range.end);
  }
  if (group.length) groups.push(group);
  return groups;
}
