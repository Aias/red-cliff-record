import type { ReadwiseCleanupChange } from '@/shared/readwise-cleanup';
import { indexSource, locateSelection, mergeContinuousRanges, type SelectionMatch } from './align';
import { parseSourceDocument, renderMarkdown } from './source';

const plainMarkdown = (content: string) =>
  parseSourceDocument(renderMarkdown(content), null).text.trim();

type CleanupHighlight = {
  id: string;
  recordId: number | null;
  content: string | null;
  record: {
    id: number;
    content: string | null;
    contentCreatedAt: Date | null;
    recordCreatedAt: Date;
    recordUpdatedAt: Date;
    media: { url: string }[];
  } | null;
};

export function proposeReadwiseCleanup(
  highlights: CleanupHighlight[],
  nativeById: Map<string, string>,
  html: string | null,
  sourceUrl: string | null,
  editorial = false,
  combineRecordIds: number[] = []
) {
  const issues: string[] = [];
  const source = html ? parseSourceDocument(html, sourceUrl) : null;
  const sourceIndex = source ? indexSource(source.text) : null;
  const prepared = highlights.flatMap((highlight) => {
    if (!highlight.record) return [];
    const native = nativeById.get(highlight.id);
    const plain = native === undefined ? (highlight.content ?? '') : plainMarkdown(native);
    const match: SelectionMatch = sourceIndex
      ? locateSelection(plain, sourceIndex)
      : { status: 'unmatched' };
    const warnings: string[] = [];
    const current = highlight.record.content ?? '';
    const imported = highlight.content ?? '';
    const hasEdits =
      current !== imported &&
      current !== imported.replace(/(?<!\n)\n(?!\n)/g, '\n\n') &&
      current !== (native ?? '');
    if (hasEdits)
      warnings.push('This record has edits in RCR. Review them before replacing its text.');
    return [{ highlight, record: highlight.record, native, match, warnings }];
  });
  const matched = prepared.flatMap((item) =>
    item.match.status === 'matched' ? [{ ...item, ...item.match.range }] : []
  );
  const selections = new Map<number, typeof matched>();
  const [combineTargetId] = combineRecordIds;
  for (const item of matched) {
    const targetId =
      combineTargetId !== undefined && combineRecordIds.includes(item.record.id)
        ? combineTargetId
        : item.record.id;
    const selection = selections.get(targetId) ?? [];
    selection.push(item);
    selections.set(targetId, selection);
  }
  const groups = source
    ? [...selections.values()].flatMap((selection) =>
        mergeContinuousRanges(selection, source.text, source.mediaBoundaries)
      )
    : [];
  const changes: ReadwiseCleanupChange[] = [];
  const sourceSelections: { recordId: number; start: number; end: number }[] = [];
  const handled = new Set<number>();

  for (const group of groups) {
    const first = group[0];
    if (!first || !source) continue;
    const records = group.map((item) => item.record);
    const uniqueRecords = [...new Map(records.map((record) => [record.id, record])).values()];
    const recordIds: [number, ...number[]] = [
      first.record.id,
      ...uniqueRecords.slice(1).map((record) => record.id),
    ];
    if (recordIds.some((id) => handled.has(id))) continue;
    const range = { start: first.start, end: Math.max(...group.map((item) => item.end)) };
    const restored = source.render(range);
    const merging = uniqueRecords.length > 1;
    const warnings = [...new Set(group.flatMap((item) => item.warnings).concat(restored.issues))];
    const elsewhere = prepared.some(
      (item) =>
        recordIds.includes(item.record.id) &&
        !group.some((member) => member.highlight.id === item.highlight.id)
    );
    if (elsewhere) {
      issues.push(
        `Record ${recordIds.join(', ')} already combines separate selections and was left unchanged.`
      );
      recordIds.forEach((id) => handled.add(id));
      continue;
    }
    const nativeSources = group.flatMap((item) =>
      item.native ? [parseSourceDocument(renderMarkdown(item.native), sourceUrl)] : []
    );
    if (nativeSources.some((native) => native.mediaBoundaries.length > native.images.length)) {
      warnings.push(
        'The formatted highlight contains media that could not be recovered. Review the original highlight.'
      );
    }
    for (const native of nativeSources) {
      warnings.push(...native.render({ start: 0, end: native.text.length }).issues);
    }
    const selectedImages = [
      ...restored.images,
      ...nativeSources.flatMap((native) => native.images),
    ];
    const images = [...new Map(selectedImages.map((image) => [image.url, image])).values()]
      .filter(
        (image) =>
          !uniqueRecords.some((record) => record.media.some((media) => media.url === image.url))
      )
      .map(({ url, altText }) => ({ url, altText }));
    recordIds.forEach((id) => handled.add(id));
    changes.push({
      recordIds,
      before: uniqueRecords.map((record) => ({
        id: record.id,
        content: record.content,
        updatedAt: record.recordUpdatedAt.toISOString(),
      })),
      content: restored.content,
      source: 'document',
      reasons: [
        merging
          ? 'Combine continuous or overlapping source selections.'
          : 'Restore formatting from the saved document.',
      ],
      warnings: [...new Set(warnings)],
      images,
    });
    if (!merging) sourceSelections.push({ recordId: first.record.id, ...range });
  }

  for (const item of prepared) {
    const record = item.record;
    if (handled.has(record.id)) continue;
    handled.add(record.id);
    if (prepared.filter((candidate) => candidate.record.id === record.id).length > 1) {
      issues.push(
        `Record ${record.id} combines selections that could not all be located in the source and was left unchanged.`
      );
      continue;
    }
    if (!item.native && !editorial) {
      issues.push(
        `Record ${record.id} could not be matched to its source and has no formatted export.`
      );
      continue;
    }
    changes.push({
      recordIds: [record.id],
      before: [
        { id: record.id, content: record.content, updatedAt: record.recordUpdatedAt.toISOString() },
      ],
      content: item.native ?? record.content ?? '',
      source: 'readwise',
      reasons: item.native ? ['Use the formatted highlight supplied by Readwise.'] : [],
      warnings: [
        ...item.warnings,
        'The selection could not be uniquely located in the saved source.',
      ],
      images: [],
    });
  }

  const orderedRecords = prepared
    .map(({ record }) => record)
    .sort(
      (left, right) =>
        (left.contentCreatedAt ?? left.recordCreatedAt).getTime() -
          (right.contentCreatedAt ?? right.recordCreatedAt).getTime() || left.id - right.id
    );
  changes.sort(
    (left, right) =>
      orderedRecords.findIndex((record) => left.recordIds.includes(record.id)) -
      orderedRecords.findIndex((record) => right.recordIds.includes(record.id))
  );
  if (
    combineRecordIds.length &&
    (combineRecordIds.length < 2 ||
      new Set(combineRecordIds).size !== combineRecordIds.length ||
      !changes.some(
        (change) =>
          change.recordIds.length === combineRecordIds.length &&
          combineRecordIds.every((id) => change.recordIds.includes(id))
      ))
  ) {
    throw new Error('Only continuous or overlapping highlights can be combined.');
  }
  const combinablePairs: [number, number][] = [];
  for (const [index, left] of sourceSelections.entries()) {
    for (const right of sourceSelections.slice(index + 1)) {
      if (
        source &&
        mergeContinuousRanges([left, right], source.text, source.mediaBoundaries).length === 1
      ) {
        combinablePairs.push([left.recordId, right.recordId]);
      }
    }
  }
  return { changes, combinablePairs, issues, sourceAvailable: source !== null };
}
