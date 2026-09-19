import { describe, expect, test } from 'bun:test';
import { mergeFieldRequest, resolutionsFromAnswers } from './resolve-merge-fields';

type Judged = Parameters<typeof mergeFieldRequest>[0];

const judged = (overrides: Partial<Judged> = {}): Judged => ({
  title: null,
  sense: null,
  abbreviation: null,
  url: null,
  mediaCaption: null,
  summary: null,
  content: null,
  notes: null,
  ...overrides,
});

const answer = (choice: 'a' | 'b' | 'equivalent' | 'distinct', confidence: number) => ({
  type: 'choice' as const,
  choice,
  confidence,
  probabilities: { a: 0, b: 0, equivalent: 0, distinct: 0, [choice]: 1 },
});

describe('mergeFieldRequest', () => {
  test('asks only about fields both records fill in with different values', () => {
    const request = mergeFieldRequest(
      judged({ title: 'Shared', url: 'https://b.example', summary: 'Only source' }),
      judged({ title: 'Shared ', url: 'https://a.example' })
    );
    expect(request).not.toBeNull();
    expect(Object.keys(request?.questions ?? {})).toEqual(['url']);
    expect(request?.state).toEqual({
      a: { url: 'https://a.example' },
      b: { url: 'https://b.example' },
    });
  });

  test('returns null when there is nothing to judge', () => {
    expect(mergeFieldRequest(judged({ title: 'Same' }), judged({ title: 'Same' }))).toBeNull();
  });

  test('leaves overlong text to the concatenation rule', () => {
    const long = 'x'.repeat(20_000);
    expect(mergeFieldRequest(judged({ content: long }), judged({ content: 'short' }))).toBeNull();
  });
});

describe('resolutionsFromAnswers', () => {
  test('maps confident answers onto sides and drops uncertain ones', () => {
    expect(
      resolutionsFromAnswers({
        title: answer('b', 0.9),
        url: answer('equivalent', 0.9),
        sense: answer('b', 0.3),
        summary: answer('a', 0.8),
        content: answer('distinct', 0.7),
        notes: answer('b', 0.5),
      })
    ).toEqual({ title: 'source', url: 'target', summary: 'target', content: 'both' });
  });
});
