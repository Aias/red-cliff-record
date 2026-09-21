import { describe, expect, test } from 'bun:test';
import { choice, noul } from '@typesafe-ai/sdk';
import { compactAnswers, fingerprintOf } from './judgments';

describe('fingerprintOf', () => {
  test('is stable for the same request and changes with the state or the questions', () => {
    const questions = { kind: choice('What is it?', { a: null, b: null }) };
    expect(fingerprintOf({ title: 'x' }, questions)).toBe(fingerprintOf({ title: 'x' }, questions));
    expect(fingerprintOf({ title: 'y' }, questions)).not.toBe(
      fingerprintOf({ title: 'x' }, questions)
    );
    expect(fingerprintOf({ title: 'x' }, { kind: noul('Is it a?') })).not.toBe(
      fingerprintOf({ title: 'x' }, questions)
    );
  });
});

describe('compactAnswers', () => {
  test('drops zero-probability options and keeps the rest of each answer', () => {
    expect(
      compactAnswers({
        kind: {
          type: 'choice',
          choice: 'a',
          confidence: 0.9,
          probabilities: { a: 0.95, b: 0.05, c: 0 },
        },
        flag: { type: 'noul', noul: 0.4 },
      })
    ).toEqual({
      kind: { type: 'choice', choice: 'a', confidence: 0.9, probabilities: { a: 0.95, b: 0.05 } },
      flag: { type: 'noul', noul: 0.4 },
    });
  });
});
