import { createHash } from 'node:crypto';
import { judgments, type Json, type JudgmentQuestion } from '@hozo';
import type { EntryType, Questions, RequestOptions, SystemOneResult } from '@typesafe-ai/sdk';
import { eq } from 'drizzle-orm';
import type { z } from 'zod';
import { db, type Db } from '@/server/db/connections/postgres';
import { getTypeSafeClient, TYPESAFE_MODEL } from '@/server/lib/typesafe';

type Answers<Q extends Questions> = SystemOneResult<Q>['answers'];

export function fingerprintOf(state: EntryType, questions: Questions): string {
  return createHash('sha256')
    .update(JSON.stringify({ model: TYPESAFE_MODEL, state, questions }))
    .digest('hex');
}

export function compactAnswers(answers: Answers<Questions>): Json {
  const compacted: { [key: string]: Json } = {};
  for (const [key, answer] of Object.entries(answers)) {
    if (answer.type === 'noul') {
      compacted[key] = { type: 'noul', noul: answer.noul };
    } else if (answer.type === 'choice') {
      const probabilities: { [label: string]: number } = {};
      for (const [label, probability] of Object.entries(answer.probabilities)) {
        if (probability > 0) probabilities[label] = probability;
      }
      compacted[key] = {
        type: 'choice',
        choice: answer.choice,
        confidence: answer.confidence,
        probabilities,
      };
    } else {
      compacted[key] = { type: 'score', score: answer.score, confidence: answer.confidence };
    }
  }
  return compacted;
}

export type Judged<R> = { result: R; judgmentId: number; reused: boolean };

export async function judge<Q extends Questions, R>(
  input: {
    recordId: number | null;
    question: JudgmentQuestion;
    state: EntryType;
    questions: Q;
    decide: (answers: Answers<Q>) => R;
    reuse?: z.ZodType<R>;
    options?: RequestOptions;
  },
  connection: Pick<Db, 'query' | 'insert'> = db
): Promise<Judged<R>> {
  const fingerprint = fingerprintOf(input.state, input.questions);
  if (input.recordId !== null && input.reuse) {
    const previous = await connection.query.judgments.findFirst({
      where: { recordId: input.recordId, question: input.question, fingerprint },
      orderBy: { recordCreatedAt: 'desc' },
      columns: { id: true, result: true },
    });
    if (previous) {
      const parsed = input.reuse.safeParse(previous.result);
      if (parsed.success) return { result: parsed.data, judgmentId: previous.id, reused: true };
    }
  }
  const response = await getTypeSafeClient().systemOne(
    { state: input.state, questions: input.questions },
    input.options
  );
  const result = input.decide(response.answers);
  const [row] = await connection
    .insert(judgments)
    .values({
      recordId: input.recordId,
      question: input.question,
      model: response.model,
      fingerprint,
      state: input.state,
      answers: compactAnswers(response.answers),
      result,
      inputTokens: response.usage.input_tokens,
    })
    .returning({ id: judgments.id });
  if (!row) throw new Error('Failed to record the judgment');
  return { result, judgmentId: row.id, reused: false };
}

export async function attachJudgment(judgmentId: number, recordId: number) {
  await db.update(judgments).set({ recordId }).where(eq(judgments.id, judgmentId));
}
