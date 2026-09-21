import type { RecordInsert, RecordType } from '@hozo';
import { choice } from '@typesafe-ai/sdk';
import { createIntegrationLogger } from '@/server/integrations/common/logging';
import { stateFields } from '@/server/lib/typesafe';
import { judge } from './judgments';

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
  'title' | 'abbreviation' | 'sense' | 'url' | 'summary' | 'content' | 'notes' | 'mediaCaption'
>;

export type RecordTypeClassification = { type: RecordType | null; judgmentId: number | null };

export async function classifyRecordType(record: Classifiable): Promise<RecordTypeClassification> {
  const state = stateFields({
    title: record.title,
    abbreviation: record.abbreviation,
    disambiguation: record.sense,
    url: record.url,
    summary: record.summary,
    content: record.content?.slice(0, CONTENT_PREVIEW_LENGTH),
    notes: record.notes,
    caption: record.mediaCaption,
  });
  if (Object.keys(state).length === 0) return { type: null, judgmentId: null };
  try {
    const { result, judgmentId } = await judge({
      recordId: null,
      question: 'record_type',
      state,
      questions: {
        type: choice(
          'The state describes one item saved to a personal collection. Judging by its `title` and the other fields, what kind of thing is it?',
          criteria
        ),
      },
      decide: (answers) =>
        answers.type.confidence >= CONFIDENCE_FLOOR ? answers.type.choice : null,
    });
    return { type: result, judgmentId };
  } catch (error) {
    logger.error('Failed to classify record type', error);
    return { type: null, judgmentId: null };
  }
}
