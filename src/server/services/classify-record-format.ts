import { containmentPredicateSlugs, records, type PredicateSlug, type RecordSelect } from '@hozo';
import { choice } from '@typesafe-ai/sdk';
import { eq, isNotNull } from 'drizzle-orm';
import { db } from '@/server/db/connections/postgres';
import { createIntegrationLogger } from '@/server/integrations/common/logging';
import { runTrackedEnrichment } from '@/server/integrations/runtime/runtime';
import { getTypeSafeClient, stateFields } from '@/server/lib/typesafe';
import { runConcurrentPool } from '@/shared/lib/async-pool';

const CONFIDENCE_FLOOR = 0.65;
const CONTENT_PREVIEW_LENGTH = 1500;
const CONCURRENCY = 8;
const NONE_LABEL = 'none of these';

const logger = createIntegrationLogger('services', 'classify-record-format');

export type FormatOption = { id: number; title: string; description: string | null };

export async function loadFormatVocabulary(): Promise<FormatOption[]> {
  const used = await db
    .selectDistinct({ id: records.formatId })
    .from(records)
    .where(isNotNull(records.formatId));
  const ids = used.flatMap((row) => (row.id === null ? [] : [row.id]));
  if (ids.length === 0) return [];
  const formats = await db.query.records.findMany({
    where: { id: { in: ids } },
    columns: { id: true, title: true, summary: true },
    with: { format: { columns: { title: true } } },
    orderBy: { title: 'asc' },
  });
  return formats.flatMap((format) => {
    if (!format.title) return [];
    const parent = format.format?.title;
    const description = [format.summary?.trim(), parent ? `A kind of ${parent}.` : undefined]
      .filter((part): part is string => Boolean(part))
      .join(' ');
    return [{ id: format.id, title: format.title, description: description || null }];
  });
}

export function formatQuestion(vocabulary: FormatOption[]) {
  const idsByLabel = new Map<string, number>();
  const criteria: Record<string, string | null> = {
    [NONE_LABEL]: 'None of the listed formats describes what the record is.',
  };
  for (const option of vocabulary) {
    const taken = option.title === NONE_LABEL || idsByLabel.has(option.title);
    const label = taken ? `${option.title} (${option.id})` : option.title;
    idsByLabel.set(label, option.id);
    criteria[label] = option.description;
  }
  return {
    question: choice(
      'Which format best describes what this record is, as distinct from what it is about?',
      criteria
    ),
    idsByLabel,
  };
}

export type FormatQuestion = ReturnType<typeof formatQuestion>;

type OriginSignals = {
  readwiseDocuments: { category: string | null }[];
  raindropBookmarks: { type: string | null }[];
  raindropHighlights: unknown[];
  twitterTweets: unknown[];
  twitterUsers: unknown[];
  githubRepositories: unknown[];
  githubUsers: unknown[];
  lightroomImages: unknown[];
  outgoingLinks: { predicate: PredicateSlug }[];
};

export function describeOrigin(row: OriginSignals): string {
  const parts: string[] = [];
  const readwise = row.readwiseDocuments[0];
  if (readwise) {
    parts.push(
      readwise.category === 'highlight'
        ? 'a highlight saved from a document in Readwise'
        : readwise.category
          ? `a Readwise document of category "${readwise.category}"`
          : 'a Readwise document'
    );
  }
  const raindrop = row.raindropBookmarks[0];
  if (raindrop)
    parts.push(`a Raindrop bookmark${raindrop.type ? ` of type "${raindrop.type}"` : ''}`);
  if (row.raindropHighlights.length) parts.push('a highlight from a Raindrop bookmark');
  if (row.twitterTweets.length) parts.push('a tweet');
  if (row.twitterUsers.length) parts.push('a Twitter account');
  if (row.githubRepositories.length) parts.push('a GitHub repository');
  if (row.githubUsers.length) parts.push('a GitHub user or organization');
  if (row.lightroomImages.length) parts.push('a photograph from Lightroom');
  if (
    row.outgoingLinks.some((link) =>
      containmentPredicateSlugs.some((slug) => slug === link.predicate)
    )
  ) {
    parts.push('part of a larger record');
  }
  return parts.length ? parts.join('; ') : 'created by hand';
}

export type ClassifiableRecord = Pick<
  RecordSelect,
  'id' | 'type' | 'title' | 'abbreviation' | 'sense' | 'url' | 'summary' | 'content' | 'notes'
> & { origin: string };

export async function classifyRecordFormat(
  record: ClassifiableRecord,
  { question, idsByLabel }: FormatQuestion
) {
  const state = stateFields({
    type: record.type,
    title: record.title,
    abbreviation: record.abbreviation,
    sense: record.sense,
    url: record.url,
    summary: record.summary,
    content: record.content?.slice(0, CONTENT_PREVIEW_LENGTH),
    notes: record.notes,
    origin: record.origin,
  });
  const { answers } = await getTypeSafeClient().systemOne({
    state,
    questions: { format: question },
  });
  const { choice: label, confidence } = answers.format;
  const formatId = idsByLabel.get(label);
  if (formatId === undefined || formatId === record.id || confidence < CONFIDENCE_FLOOR) {
    return { label, confidence, formatId: null };
  }
  return { label, confidence, formatId };
}

async function assignMissingFormats(limit: number | undefined, signal: AbortSignal | undefined) {
  const vocabulary = await loadFormatVocabulary();
  if (vocabulary.length === 0) {
    logger.warn('No record has a format yet, so there is no vocabulary to choose from');
    return 0;
  }
  const question = formatQuestion(vocabulary);
  const pending = await db.query.records.findMany({
    where: { formatId: { isNull: true } },
    columns: {
      id: true,
      type: true,
      title: true,
      abbreviation: true,
      sense: true,
      url: true,
      summary: true,
      content: true,
      notes: true,
    },
    with: {
      readwiseDocuments: { columns: { category: true } },
      raindropBookmarks: { columns: { type: true } },
      raindropHighlights: { columns: { id: true } },
      twitterTweets: { columns: { id: true } },
      twitterUsers: { columns: { id: true } },
      githubRepositories: { columns: { id: true } },
      githubUsers: { columns: { id: true } },
      lightroomImages: { columns: { id: true } },
      outgoingLinks: { columns: { predicate: true } },
    },
    orderBy: { recordCreatedAt: 'desc' },
    limit,
  });
  logger.info(
    `Choosing formats for ${pending.length} record(s) from ${vocabulary.length} format(s)`
  );
  const results = await runConcurrentPool({
    items: pending,
    concurrency: CONCURRENCY,
    signal,
    async worker(row) {
      const result = await classifyRecordFormat({ ...row, origin: describeOrigin(row) }, question);
      if (result.formatId === null) {
        logger.info(`Record ${row.id}: skipped ${result.label} (${result.confidence.toFixed(2)})`);
        return false;
      }
      await db
        .update(records)
        .set({ formatId: result.formatId, recordUpdatedAt: new Date() })
        .where(eq(records.id, row.id));
      logger.info(`Record ${row.id}: ${result.label} (${result.confidence.toFixed(2)})`);
      return true;
    },
  });
  let assigned = 0;
  for (const result of results) {
    if (!result.ok) logger.error('Format classification failed', result.error);
    else if (result.value) assigned++;
  }
  logger.info(`Assigned formats to ${assigned} of ${pending.length} record(s)`);
  return assigned;
}

export async function runFormatEnrichment(options: { limit?: number; signal?: AbortSignal } = {}) {
  return runTrackedEnrichment(
    'manual',
    'enrich.formats',
    () => assignMissingFormats(options.limit, options.signal),
    options.signal
  );
}
