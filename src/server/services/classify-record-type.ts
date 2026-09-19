import type { RecordInsert, RecordType } from '@hozo';
import { choice } from '@typesafe-ai/sdk';
import { createIntegrationLogger } from '@/server/integrations/common/logging';
import { getTypeSafeClient, stateFields } from '@/server/lib/typesafe';

const CONFIDENCE_FLOOR = 0.6;
const CONTENT_PREVIEW_LENGTH = 2000;

const logger = createIntegrationLogger('services', 'classify-record-type');

const criteria = {
  entity:
    'An actor in the world with a will of its own: a person, organization, group, animal, or fictional character.',
  concept:
    'A category, idea, topic, practice, field, or other abstraction: something that can be discussed but not pointed at.',
  artifact:
    'A specific physical or digital object, work, or piece of content: a book, article, film, song, tool, product, website, image, or quotation.',
} satisfies Record<RecordType, string>;

type Classifiable = Pick<
  RecordInsert,
  'title' | 'abbreviation' | 'sense' | 'url' | 'summary' | 'content' | 'notes'
>;

export async function classifyRecordType(record: Classifiable): Promise<RecordType | null> {
  const state = stateFields({
    title: record.title,
    abbreviation: record.abbreviation,
    sense: record.sense,
    url: record.url,
    summary: record.summary,
    content: record.content?.slice(0, CONTENT_PREVIEW_LENGTH),
    notes: record.notes,
  });
  if (Object.keys(state).length === 0) return null;
  try {
    const { answers } = await getTypeSafeClient().systemOne({
      state,
      questions: { type: choice('What kind of thing does this record describe?', criteria) },
    });
    return answers.type.confidence >= CONFIDENCE_FLOOR ? answers.type.choice : null;
  } catch (error) {
    logger.error('Failed to classify record type', error);
    return null;
  }
}
