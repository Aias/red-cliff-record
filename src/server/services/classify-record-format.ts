import { containmentPredicateSlugs, records, type PredicateSlug, type RecordSelect } from '@hozo';
import {
  choice,
  noul,
  type Description,
  type NoulQuestion,
  type NoulResponse,
  type ResultFor,
} from '@typesafe-ai/sdk';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/server/db/connections/postgres';
import { createIntegrationLogger } from '@/server/integrations/common/logging';
import { runTrackedEnrichment } from '@/server/integrations/runtime/runtime';
import { getTypeSafeClient, stateFields } from '@/server/lib/typesafe';
import { runConcurrentPool } from '@/shared/lib/async-pool';

const CONFIDENCE_FLOOR = 0.65;
const CONTENT_PREVIEW_LENGTH = 1500;
const DEFINITION_LENGTH = 400;
const EXAMPLES_PER_FORMAT = 5;
const CONCURRENCY = 8;
const NONE_LABEL = 'none of these';
const CHOICE_KEY = 'format';
const SUGGESTION_COUNT = 5;
const SUGGESTION_FLOOR = 0.5;
const IMAGE_DESCRIPTIONS_LENGTH = 800;

const logger = createIntegrationLogger('services', 'classify-record-format');

export type FormatOption = { id: number; title: string; description: Description };

export type FormatSource = {
  id: number;
  title: string;
  summary: string | null;
  sense: string | null;
  content: string | null;
  parent: string | null;
  examples: string[];
};

export function formatOptions(sources: FormatSource[]): FormatOption[] {
  return sources.map((source) => {
    const description: Record<string, string | string[]> = {};
    const definition = source.summary?.trim() || source.content?.trim().slice(0, DEFINITION_LENGTH);
    if (definition) description.definition = definition;
    const sense = source.sense?.trim();
    if (sense) description.sense = sense;
    if (source.parent) description.kindOf = source.parent;
    if (source.examples.length) description.examples = source.examples;
    return {
      id: source.id,
      title: source.title,
      description: Object.keys(description).length ? description : null,
    };
  });
}

export async function loadFormatVocabulary(): Promise<FormatOption[]> {
  const used = await db.query.records.findMany({
    where: { type: 'artifact', formatId: { isNotNull: true } },
    columns: { formatId: true },
  });
  const ids = [...new Set(used.flatMap((row) => (row.formatId === null ? [] : [row.formatId])))];
  if (ids.length === 0) return [];
  const [formats, curated] = await Promise.all([
    db.query.records.findMany({
      where: { id: { in: ids } },
      columns: { id: true, title: true, summary: true, sense: true, content: true },
      with: { format: { columns: { title: true } } },
      orderBy: { title: 'asc' },
    }),
    db.query.records.findMany({
      where: { type: 'artifact', formatId: { in: ids }, recordCuratedAt: { isNotNull: true } },
      columns: { formatId: true, title: true },
      orderBy: { recordCuratedAt: 'desc' },
    }),
  ]);
  const examples = new Map<number, string[]>();
  for (const record of curated) {
    if (record.formatId === null || !record.title) continue;
    const titles = examples.get(record.formatId) ?? [];
    if (titles.length < EXAMPLES_PER_FORMAT)
      examples.set(record.formatId, [...titles, record.title]);
  }
  return formatOptions(
    formats.flatMap((format) =>
      format.title
        ? [
            {
              id: format.id,
              title: format.title,
              summary: format.summary,
              sense: format.sense,
              content: format.content,
              parent: format.format?.title ?? null,
              examples: examples.get(format.id) ?? [],
            },
          ]
        : []
    )
  );
}

export function formatQuestion(vocabulary: FormatOption[]) {
  const idsByLabel = new Map<string, number>();
  const criteria: Record<string, Description> = {
    [NONE_LABEL]: 'None of the listed formats is the kind of thing the item is.',
  };
  for (const option of vocabulary) {
    const taken = option.title === NONE_LABEL || idsByLabel.has(option.title);
    const label = taken ? `${option.title} (${option.id})` : option.title;
    idsByLabel.set(label, option.id);
    criteria[label] = option.description;
  }
  return {
    question: choice(
      "The state is one item saved to a personal collection: its `title`, `url`, `summary`, an excerpt of its `content`, the collector's `notes`, and `origin`, which says how it was collected. Which of the listed formats is the kind of thing the item is, as opposed to the subject it is about?",
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

const READ_LATER_KINDS: Record<string, string> = {
  article: 'an article',
  email: 'an email newsletter',
  epub: 'an e-book',
  pdf: 'a PDF',
  podcast: 'a podcast episode',
  rss: 'a feed post',
  tweet: 'a tweet',
  video: 'a video',
};

const BOOKMARK_KINDS: Record<string, string> = {
  article: 'a bookmarked article',
  audio: 'a bookmarked audio file',
  document: 'a bookmarked document',
  image: 'a bookmarked image',
  link: 'a bookmarked web page',
  video: 'a bookmarked video',
};

export function describeOrigin(row: OriginSignals): string {
  const parts: string[] = [];
  const readwise = row.readwiseDocuments[0];
  if (readwise) {
    if (readwise.category === 'highlight') {
      parts.push('a passage highlighted while reading a longer piece');
    } else {
      const kind = readwise.category ? READ_LATER_KINDS[readwise.category] : undefined;
      parts.push(kind ? `${kind} saved to a read-later app` : 'saved to a read-later app');
    }
  }
  const raindrop = row.raindropBookmarks[0];
  if (raindrop) {
    parts.push((raindrop.type ? BOOKMARK_KINDS[raindrop.type] : undefined) ?? 'a bookmark');
  }
  if (row.raindropHighlights.length) parts.push('a passage highlighted on a bookmarked web page');
  if (row.twitterTweets.length) parts.push('a post on Twitter');
  if (row.twitterUsers.length) parts.push('a Twitter account profile');
  if (row.githubRepositories.length) parts.push('a source code repository on GitHub');
  if (row.githubUsers.length) parts.push('a GitHub account profile');
  if (row.lightroomImages.length) parts.push("a photograph from the collector's own camera");
  if (
    row.outgoingLinks.some((link) =>
      containmentPredicateSlugs.some((slug) => slug === link.predicate)
    )
  ) {
    parts.push('part of a larger collection or work');
  }
  return parts.length ? parts.join('; ') : 'added by hand';
}

export type ClassifiableRecord = Pick<
  RecordSelect,
  | 'id'
  | 'type'
  | 'title'
  | 'abbreviation'
  | 'sense'
  | 'url'
  | 'summary'
  | 'content'
  | 'notes'
  | 'mediaCaption'
> & { origin: string; imageDescriptions: string | null };

export function describeImages(media: { altText: string | null }[]): string | null {
  const descriptions = media.flatMap((item) => {
    const text = item.altText?.trim();
    return text ? [text] : [];
  });
  if (descriptions.length === 0) return null;
  return descriptions.join(' ').slice(0, IMAGE_DESCRIPTIONS_LENGTH);
}

const CLASSIFIABLE_COLUMNS = {
  id: true,
  type: true,
  title: true,
  abbreviation: true,
  sense: true,
  url: true,
  summary: true,
  content: true,
  notes: true,
  mediaCaption: true,
} as const;

const ORIGIN_RELATIONS = {
  readwiseDocuments: { columns: { category: true } },
  raindropBookmarks: { columns: { type: true } },
  raindropHighlights: { columns: { id: true } },
  twitterTweets: { columns: { id: true } },
  twitterUsers: { columns: { id: true } },
  githubRepositories: { columns: { id: true } },
  githubUsers: { columns: { id: true } },
  lightroomImages: { columns: { id: true } },
  outgoingLinks: { columns: { predicate: true } },
  media: { columns: { altText: true } },
} as const;

async function askFormat(record: ClassifiableRecord, question: FormatQuestion['question']) {
  const state = stateFields({
    title: record.title,
    abbreviation: record.abbreviation,
    disambiguation: record.sense,
    url: record.url,
    summary: record.summary,
    content: record.content?.slice(0, CONTENT_PREVIEW_LENGTH),
    notes: record.notes,
    caption: record.mediaCaption,
    imageDescriptions: record.imageDescriptions,
    origin: record.origin,
  });
  const { answers } = await getTypeSafeClient().systemOne({
    state,
    questions: { format: question },
  });
  return answers.format;
}

const classifiable = <
  T extends Parameters<typeof describeOrigin>[0] & { media: { altText: string | null }[] },
>(
  row: T
) => ({
  ...row,
  origin: describeOrigin(row),
  imageDescriptions: describeImages(row.media),
});

export async function classifyRecordFormat(
  record: ClassifiableRecord,
  { question, idsByLabel }: FormatQuestion
) {
  const { choice: label, confidence } = await askFormat(record, question);
  const formatId = idsByLabel.get(label);
  if (formatId === undefined || formatId === record.id || confidence < CONFIDENCE_FLOOR) {
    return { label, confidence, formatId: null };
  }
  return { label, confidence, formatId };
}

export type FormatSuggestion = { id: number; title: string; probability: number };

export function formatNouls(vocabulary: FormatOption[]) {
  return Object.fromEntries(
    vocabulary.map((option) => [
      String(option.id),
      noul(
        `Is the item described in the state an example of the format "${option.title}": is it that kind of thing, rather than something merely about it?`,
        { true: option.description }
      ),
    ])
  );
}

type SuggestionAnswer = ResultFor<FormatQuestion['question']> | NoulResponse;

export function rankSuggestions(
  answers: Readonly<Record<string, SuggestionAnswer>>,
  vocabulary: FormatOption[],
  idsByLabel: ReadonlyMap<string, number>,
  recordId: number,
  limit = SUGGESTION_COUNT
): FormatSuggestion[] {
  const pick = answers[CHOICE_KEY];
  const pickedId = pick?.type === 'choice' ? idsByLabel.get(pick.choice) : undefined;
  return vocabulary
    .flatMap((option) => {
      const answer = answers[String(option.id)];
      if (answer?.type !== 'noul' || option.id === recordId) return [];
      const keep = option.id === pickedId || answer.noul >= SUGGESTION_FLOOR;
      return keep ? [{ id: option.id, title: option.title, probability: answer.noul }] : [];
    })
    .sort((a, b) => b.probability - a.probability)
    .slice(0, limit);
}

export async function suggestRecordFormats(recordId: number): Promise<FormatSuggestion[] | null> {
  const row = await db.query.records.findFirst({
    where: { id: recordId },
    columns: CLASSIFIABLE_COLUMNS,
    with: ORIGIN_RELATIONS,
  });
  if (!row) return null;
  const vocabulary = await loadFormatVocabulary();
  if (vocabulary.length === 0) return [];
  const { question, idsByLabel } = formatQuestion(vocabulary);
  const record = classifiable(row);
  const state = stateFields({
    title: record.title,
    abbreviation: record.abbreviation,
    disambiguation: record.sense,
    url: record.url,
    summary: record.summary,
    content: record.content?.slice(0, CONTENT_PREVIEW_LENGTH),
    notes: record.notes,
    caption: record.mediaCaption,
    imageDescriptions: record.imageDescriptions,
    origin: record.origin,
  });
  const questions: Record<string, FormatQuestion['question'] | NoulQuestion> = {
    ...formatNouls(vocabulary),
    [CHOICE_KEY]: question,
  };
  const { answers } = await getTypeSafeClient().systemOne({ state, questions });
  return rankSuggestions(answers, vocabulary, idsByLabel, recordId);
}

async function assignMissingFormats(limit: number | undefined, signal: AbortSignal | undefined) {
  const vocabulary = await loadFormatVocabulary();
  if (vocabulary.length === 0) {
    logger.warn('No record has a format yet, so there is no vocabulary to choose from');
    return 0;
  }
  const question = formatQuestion(vocabulary);
  const pending = await db.query.records.findMany({
    where: {
      type: 'artifact',
      formatId: { isNull: true },
      recordCuratedAt: { isNull: true },
      OR: [
        { formatCheckedAt: { isNull: true } },
        { RAW: (t) => sql`${t.formatCheckedAt} < ${t.recordUpdatedAt}` },
      ],
    },
    columns: CLASSIFIABLE_COLUMNS,
    with: ORIGIN_RELATIONS,
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
      const result = await classifyRecordFormat(classifiable(row), question);
      const now = new Date();
      if (result.formatId === null) {
        await db.update(records).set({ formatCheckedAt: now }).where(eq(records.id, row.id));
        logger.info(`Record ${row.id}: skipped ${result.label} (${result.confidence.toFixed(2)})`);
        return false;
      }
      await db
        .update(records)
        .set({ formatId: result.formatId, formatCheckedAt: now, recordUpdatedAt: now })
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
