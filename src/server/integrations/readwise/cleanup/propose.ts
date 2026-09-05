import { TRPCError } from '@trpc/server';
import type { ReadwiseCleanupChange } from '@/shared/readwise-cleanup';
import { indexText, isContinuous, locate, type Match, type Range } from './locate';
import { htmlText, parseSource, renderMarkdown, type Source } from './source';

export type CleanupHighlight = {
  id: string;
  content: string | null;
  record: {
    id: number;
    content: string | null;
    contentCreatedAt: Date | null;
    recordCreatedAt: Date;
    recordUpdatedAt: Date;
    media: { url: string }[];
  };
};

type CleanupRecord = CleanupHighlight['record'];

const EDITED_WARNING = 'This record has edits in RCR. Review them before replacing its text.';
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

const legacyContent = (imported: string) => imported.replace(/(?<!\n)\n(?!\n)/g, '\n\n');

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
  const index = source && indexText(source.text);
  const located = highlights.map((highlight) => {
    const native = nativeById.get(highlight.id);
    const plain =
      native === undefined ? (highlight.content ?? '') : htmlText(renderMarkdown(native));
    const match: Match = index ? locate(plain, index) : { status: 'unmatched' };
    const current = highlight.record.content ?? '';
    const imported = highlight.content ?? '';
    const edited =
      current !== imported && current !== legacyContent(imported) && current !== (native ?? '');
    return { highlight, native, match, edited };
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
    const warnings = new Set(items.filter((item) => item.edited).map(() => EDITED_WARNING));
    const matched = items.flatMap((item) =>
      item.match.status === 'matched' ? [item.match.range] : []
    );
    const span = source && matched.length === items.length ? continuousSpan(matched, source) : null;
    if (span && source) {
      const restored = source.render(span);
      const natives = items.flatMap((item) =>
        item.native ? [parseSource(renderMarkdown(item.native), sourceUrl)] : []
      );
      if (natives.some((native) => native.barriers.length > native.images.length)) {
        warnings.add(NATIVE_MEDIA_WARNING);
      }
      for (const issue of restored.issues) warnings.add(issue);
      const attached = new Set(records.flatMap((record) => record.media.map((item) => item.url)));
      const images = [
        ...new Map(
          [...restored.images, ...natives.flatMap((native) => native.images)].map((image) => [
            image.url,
            { url: image.url, altText: image.altText },
          ])
        ).values(),
      ].filter((image) => !attached.has(image.url));
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
        changed:
          merged.length > 0 || restored.content !== (target.content ?? '') || images.length > 0,
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
    warnings.add(UNLOCATED_WARNING);
    const content = item.native ?? target.content ?? '';
    changes.push({
      target: snapshot(target),
      merged: [],
      content,
      source: 'readwise',
      reasons: item.native ? ['Use the formatted highlight supplied by Readwise.'] : [],
      warnings: [...warnings],
      images: [],
      changed: content !== (target.content ?? ''),
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
