import { TRPCError } from '@trpc/server';
import type { ReadwiseCleanupChange } from '@/shared/readwise-cleanup';
import { indexText, isContinuous, locate, type Match, type Range } from './locate';
import { htmlText, parseSource, renderMarkdown, type Source, type SourceImage } from './source';

export type CleanupHighlight = {
  id: string;
  content: string | null;
  record: {
    id: number;
    content: string | null;
    contentCreatedAt: Date | null;
    recordCreatedAt: Date;
    recordUpdatedAt: Date;
    recordCuratedAt: Date | null;
    media: { url: string }[];
  };
};

type CleanupRecord = CleanupHighlight['record'];

const EDITED_WARNING = 'This record has edits in RCR. Review them before replacing its text.';
const CURATED_WARNING = 'This record is curated. Review it before replacing its text.';
const UNLOCATED_WARNING = 'The selection could not be uniquely located in the saved source.';
const SPLIT_WARNING =
  'This record combines selections that are separate or could not be located in the source.';
const NATIVE_MEDIA_WARNING =
  'The formatted highlight contains media that could not be recovered. Review the original highlight.';

const invalidMerge = () =>
  new TRPCError({
    code: 'BAD_REQUEST',
    message: 'Only continuous or overlapping highlights can be merged.',
  });

const snapshot = (record: CleanupRecord) => ({
  id: record.id,
  content: record.content,
  updatedAt: record.recordUpdatedAt.toISOString(),
});

const collapse = (text: string) => text.replace(/\s+/gu, ' ').trim();

const attachments = (images: SourceImage[], records: CleanupRecord[]) => {
  const attached = new Set(records.flatMap((record) => record.media.map((media) => media.url)));
  return [
    ...new Map(
      images.map((image) => [image.url, { url: image.url, altText: image.altText }])
    ).values(),
  ].filter((image) => !attached.has(image.url));
};
const withoutImages = (markdown: string) =>
  markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, '')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();

function continuousSpan(ranges: Range[], source: Source): Range | null {
  const sorted = ranges.toSorted((left, right) => left.start - right.start || left.end - right.end);
  const [first] = sorted;
  if (!first) return null;
  const span = { ...first };
  for (const range of sorted.slice(1)) {
    if (!isContinuous(span, range, source.text, source.barriers)) return null;
    span.end = Math.max(span.end, range.end);
  }
  return span;
}

export function proposeCleanup(
  highlights: CleanupHighlight[],
  nativeById: ReadonlyMap<string, string>,
  source: Source | null,
  sourceUrl: string | null,
  merge: number[] = []
) {
  if (
    merge.length &&
    (merge.length < 2 ||
      new Set(merge).size !== merge.length ||
      merge.some((id) => !highlights.some((highlight) => highlight.record.id === id)))
  ) {
    throw invalidMerge();
  }
  const indexes = source
    ? [
        { index: indexText(source.text), omitSkippable: false },
        ...(source.skippable.length
          ? [{ index: indexText(source.text, source.skippable), omitSkippable: true }]
          : []),
        ...(source.brackets.length
          ? [{ index: indexText(source.text, source.brackets), omitSkippable: false }]
          : []),
      ]
    : [];
  const located = highlights.map((highlight) => {
    const native = nativeById.get(highlight.id);
    const candidates = [
      ...(native === undefined ? [] : [htmlText(renderMarkdown(native))]),
      highlight.content ?? '',
      highlight.record.content ?? '',
    ];
    let match: Match = { status: 'unmatched' };
    let omitSkippable = false;
    for (const candidate of candidates) {
      for (const textIndex of indexes) {
        if (match.status === 'matched') break;
        match = locate(candidate, textIndex.index);
        omitSkippable = textIndex.omitSkippable;
      }
    }
    if (match.status === 'ambiguous' && source && match.ranges.length <= 5) {
      const insideLink = (range: Range) =>
        source.links.some((link) => link.start <= range.start && range.end <= link.end);
      const candidates = match.ranges.filter((range) => !insideLink(range));
      const [first, ...rest] = candidates.length ? candidates : match.ranges;
      const content = first && source.render(first, { omitSkippable }).content;
      if (
        first &&
        rest.every((range) => source.render(range, { omitSkippable }).content === content)
      ) {
        match = { status: 'matched', range: first };
      }
    }
    const current = collapse(highlight.record.content ?? '');
    const edited =
      current !== collapse(highlight.content ?? '') && current !== collapse(native ?? '');
    const textless = candidates.every((candidate) => !candidate.trim());
    return { highlight, native, match, omitSkippable, edited, textless };
  });

  const [mergeTarget] = merge;
  const groups = new Map<number, typeof located>();
  for (const item of located) {
    const id = item.highlight.record.id;
    const key = mergeTarget !== undefined && merge.includes(id) ? mergeTarget : id;
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }

  const changes: ReadwiseCleanupChange[] = [];
  const ranges = new Map<number, Range>();
  for (const [targetId, items] of groups) {
    const target = items.find((item) => item.highlight.record.id === targetId)?.highlight.record;
    if (!target) continue;
    const records = [
      ...new Map(items.map(({ highlight }) => [highlight.record.id, highlight.record])).values(),
    ];
    const merged = records.filter((record) => record.id !== targetId);
    const current = target.content ?? '';
    const warnings = new Set<string>();
    const flagEdits = (content: string) => {
      if (content !== current && items.some((item) => item.edited)) warnings.add(EDITED_WARNING);
    };
    const matched = items.flatMap((item) =>
      item.match.status === 'matched' ? [item.match.range] : []
    );
    const span = source && matched.length === items.length ? continuousSpan(matched, source) : null;
    if (span && source) {
      const restored = source.render(span, {
        omitSkippable: items.some((item) => item.omitSkippable),
      });
      flagEdits(restored.content);
      const natives = items.flatMap((item) =>
        item.native ? [parseSource(renderMarkdown(item.native), sourceUrl)] : []
      );
      if (natives.some((native) => native.barriers.length > native.images.length)) {
        warnings.add(NATIVE_MEDIA_WARNING);
      }
      for (const issue of restored.issues) warnings.add(issue);
      const images = attachments(
        [...restored.images, ...natives.flatMap((native) => native.images)],
        records
      );
      const changed = merged.length > 0 || restored.content !== current || images.length > 0;
      if (changed && records.some((record) => record.recordCuratedAt)) {
        warnings.add(CURATED_WARNING);
      }
      changes.push({
        target: snapshot(target),
        merged: merged.map(snapshot),
        content: restored.content,
        source: 'document',
        reasons: [
          merged.length
            ? 'Merge continuous or overlapping source selections.'
            : 'Restore formatting from the saved document.',
        ],
        warnings: [...warnings],
        images,
        changed,
      });
      if (!merged.length) ranges.set(targetId, span);
      continue;
    }
    if (merge.length) throw invalidMerge();
    const [item] = items;
    if (!item || items.length > 1) {
      warnings.add(SPLIT_WARNING);
      changes.push({
        target: snapshot(target),
        merged: [],
        content: target.content ?? '',
        source: 'readwise',
        reasons: [],
        warnings: [...warnings],
        images: [],
        changed: false,
      });
      continue;
    }
    if (!item.textless) warnings.add(UNLOCATED_WARNING);
    const nativeSource =
      item.native === undefined ? null : parseSource(renderMarkdown(item.native), sourceUrl);
    if (nativeSource && nativeSource.barriers.length > nativeSource.images.length) {
      warnings.add(NATIVE_MEDIA_WARNING);
    }
    const images = attachments(nativeSource?.images ?? [], [target]);
    const content = item.native === undefined ? current : withoutImages(item.native);
    flagEdits(content);
    const changed = content !== current || images.length > 0;
    if (changed && target.recordCuratedAt) warnings.add(CURATED_WARNING);
    changes.push({
      target: snapshot(target),
      merged: [],
      content,
      source: 'readwise',
      reasons:
        item.native === undefined ? [] : ['Use the formatted highlight supplied by Readwise.'],
      warnings: [...warnings],
      images,
      changed,
    });
  }

  const recordById = new Map(highlights.map(({ record }) => [record.id, record]));
  const timestamp = (id: number) => {
    const record = recordById.get(id);
    return record ? (record.contentCreatedAt ?? record.recordCreatedAt).getTime() : 0;
  };
  const position = (change: ReadwiseCleanupChange) =>
    Math.min(...[change.target, ...change.merged].map((record) => timestamp(record.id)));
  changes.sort(
    (left, right) => position(left) - position(right) || left.target.id - right.target.id
  );

  const mergeable: [number, number][] = [];
  const spans = [...ranges];
  for (const [offset, [leftId, left]] of spans.entries()) {
    for (const [rightId, right] of spans.slice(offset + 1)) {
      const first = left.start <= right.start ? left : right;
      const second = first === left ? right : left;
      if (source && isContinuous(first, second, source.text, source.barriers)) {
        mergeable.push([leftId, rightId]);
      }
    }
  }
  return { changes, mergeable };
}
