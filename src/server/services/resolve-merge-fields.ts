import type { RecordSelect } from '@hozo';
import { choice, type ChoiceResponse } from '@typesafe-ai/sdk';
import { createIntegrationLogger } from '@/server/integrations/common/logging';
import { getTypeSafeClient } from '@/server/lib/typesafe';
import {
  MERGE_SCALAR_FIELDS,
  MERGE_TEXT_FIELDS,
  type MergeResolutions,
  type MergeScalarField,
  type MergeTextField,
} from '@/shared/lib/merge-records';

const CONFIDENCE_FLOOR = 0.6;
const MAX_JUDGED_TEXT_LENGTH = 12_000;

const logger = createIntegrationLogger('services', 'merge-records');

const scalarQualities: Record<MergeScalarField, string> = {
  title:
    'is the more complete and specific title, cleanly formatted without a site name, trailing punctuation, or truncation',
  abbreviation: 'is the more widely recognized short form, handle, or acronym',
  sense: 'more precisely disambiguates what the record is',
  url: 'points to the original source rather than an aggregator, mirror, shortened link, tracking link, or search page',
  mediaCaption: 'describes the media more accurately and completely',
};

const scalarQuestion = (field: MergeScalarField) =>
  choice(`Which of \`a.${field}\` and \`b.${field}\` should one record that describes both keep?`, {
    a: `\`a.${field}\` ${scalarQualities[field]}.`,
    b: `\`b.${field}\` ${scalarQualities[field]}.`,
    equivalent:
      'They are the same value, differing only in capitalization, punctuation, or whitespace.',
  });

const textQuestion = (field: MergeTextField) =>
  choice(`How does \`a.${field}\` relate to \`b.${field}\`?`, {
    a: `\`a.${field}\` contains all the meaningful information in \`b.${field}\`.`,
    b: `\`b.${field}\` contains all the meaningful information in \`a.${field}\`.`,
    equivalent: 'They convey the same information in different words.',
    distinct: 'Each contains meaningful information the other lacks.',
  });

type MergeQuestion = ReturnType<typeof scalarQuestion> | ReturnType<typeof textQuestion>;
type MergeAnswer =
  | ChoiceResponse<ReturnType<typeof scalarQuestion>['criteria']>
  | ChoiceResponse<ReturnType<typeof textQuestion>['criteria']>;

type JudgedRecord = Pick<RecordSelect, MergeScalarField | MergeTextField>;

const text = (value: string | null) => value?.trim() ?? '';

export function mergeFieldRequest(source: JudgedRecord, target: JudgedRecord) {
  const state: { a: Record<string, string>; b: Record<string, string> } = { a: {}, b: {} };
  const questions: Record<string, MergeQuestion> = {};
  const include = (
    field: MergeScalarField | MergeTextField,
    question: MergeQuestion,
    maxLength = Number.POSITIVE_INFINITY
  ) => {
    const a = text(target[field]);
    const b = text(source[field]);
    if (!a || !b || a === b || a.length > maxLength || b.length > maxLength) return;
    state.a[field] = a;
    state.b[field] = b;
    questions[field] = question;
  };
  for (const field of MERGE_SCALAR_FIELDS) include(field, scalarQuestion(field));
  for (const field of MERGE_TEXT_FIELDS)
    include(field, textQuestion(field), MAX_JUDGED_TEXT_LENGTH);
  return Object.keys(questions).length > 0 ? { state, questions } : null;
}

export function resolutionsFromAnswers(
  answers: Readonly<Record<string, MergeAnswer>>
): MergeResolutions {
  const resolutions: MergeResolutions = {};
  for (const field of MERGE_SCALAR_FIELDS) {
    const answer = answers[field];
    if (!answer || answer.confidence < CONFIDENCE_FLOOR) continue;
    resolutions[field] = answer.choice === 'b' ? 'source' : 'target';
  }
  for (const field of MERGE_TEXT_FIELDS) {
    const answer = answers[field];
    if (!answer || answer.confidence < CONFIDENCE_FLOOR) continue;
    resolutions[field] =
      answer.choice === 'b' ? 'source' : answer.choice === 'distinct' ? 'both' : 'target';
  }
  return resolutions;
}

export async function resolveMergeFields(
  source: JudgedRecord,
  target: JudgedRecord
): Promise<MergeResolutions> {
  const request = mergeFieldRequest(source, target);
  if (!request) return {};
  try {
    const { answers } = await getTypeSafeClient().systemOne(request);
    return resolutionsFromAnswers(answers);
  } catch (error) {
    logger.error('Failed to judge which merged fields to keep', error);
    return {};
  }
}
