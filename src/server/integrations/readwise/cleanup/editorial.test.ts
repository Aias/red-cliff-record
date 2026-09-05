import { describe, expect, mock, test } from 'bun:test';
import type { ReadwiseCleanupChange } from '@/shared/readwise-cleanup';
import { addEditorialSuggestions, applyEditorialEdits } from './editorial';

const correction = (before: string, after: string) => ({
  before,
  after,
  reason: 'Correct a typo.',
});

let corrections: { recordId: number; edits: ReturnType<typeof correction>[] }[] = [];

mock.module('@/server/lib/openai', () => ({
  OPENAI_MODEL: 'copyeditor',
  getOpenAIClient: () => ({
    responses: { parse: () => Promise.resolve({ output_parsed: { corrections } }) },
  }),
}));

const change = (recordId: number, content: string): ReadwiseCleanupChange => ({
  recordIds: [recordId],
  before: [{ id: recordId, content, updatedAt: '2026-01-01T00:00:00.000Z' }],
  content,
  source: 'document',
  reasons: [],
  warnings: [],
  images: [],
});

describe('editorial replacements', () => {
  test('applies a small unique correction while preserving surrounding prose', () => {
    expect(applyEditorialEdits('The bird landed on teh branch.', [correction('teh', 'the')])).toBe(
      'The bird landed on the branch.'
    );
  });

  test('rejects ambiguous, missing, and overlapping replacements', () => {
    expect(() => applyEditorialEdits('teh and teh', [correction('teh', 'the')])).toThrow();
    expect(() => applyEditorialEdits('the bird', [correction('teh', 'the')])).toThrow();
    expect(() =>
      applyEditorialEdits('teh bird', [
        correction('teh bird', 'the bird'),
        correction('bird', 'birds'),
      ])
    ).toThrow();
  });

  test('preserves code and link destinations', () => {
    expect(() =>
      applyEditorialEdits('Use `teh` as the key.', [correction('teh', 'the')])
    ).toThrow();
    expect(() =>
      applyEditorialEdits('[Read](https://teh.example)', [correction('teh', 'the')])
    ).toThrow();
    expect(() => applyEditorialEdits('```txt\nteh\n```', [correction('teh', 'the')])).toThrow();
  });

  test('rejects inserted markup and broad rewrites', () => {
    expect(() => applyEditorialEdits('teh bird', [correction('teh', '<b>the</b>')])).toThrow();
    expect(() =>
      applyEditorialEdits('A bird landed on the branch.', [
        correction(
          'A bird landed on the branch.',
          'Somebody arrived at a completely different place.'
        ),
      ])
    ).toThrow();
  });

  test('preserves formatting while editing its text', () => {
    expect(applyEditorialEdits('The **brids** are here.', [correction('brids', 'birds')])).toBe(
      'The **birds** are here.'
    );
  });

  test('preserves numbers and mathematical operators', () => {
    expect(() => applyEditorialEdits('The value is 5.', [correction('5', '9')])).toThrow();
    expect(() => applyEditorialEdits('x + y is the result.', [correction('+', '−')])).toThrow();
    expect(() => applyEditorialEdits('x - y is the result.', [correction('-', '')])).toThrow();
    expect(applyEditorialEdits('A clear statement[1].', [correction('[1]', '')])).toBe(
      'A clear statement.'
    );
  });
});

describe('editorial suggestions', () => {
  test('reports unusable record selections while applying the rest', async () => {
    corrections = [
      { recordId: 99, edits: [correction('teh', 'the')] },
      { recordId: 1, edits: [correction('teh', 'the')] },
      { recordId: 1, edits: [correction('brnach', 'branch')] },
    ];
    const changes = [change(1, 'The bird landed on teh branch.')];
    const issues = await addEditorialSuggestions(changes);
    expect(changes[0]?.content).toBe('The bird landed on the branch.');
    expect(changes[0]?.source).toBe('model');
    expect(issues).toEqual([
      'Record 99: The spelling and grammar check returned an invalid record selection.',
      'Record 1: The spelling and grammar check returned an invalid record selection.',
    ]);
  });
});
