import { describe, expect, test } from 'bun:test';
import { applyEditorialEdits } from './editorial';

const edit = (before: string, after: string) => ({ before, after, reason: 'Correct a typo.' });

describe('applyEditorialEdits', () => {
  test('applies unique corrections and keeps surrounding formatting', () => {
    expect(applyEditorialEdits('The bird landed on teh branch.', [edit('teh', 'the')])).toBe(
      'The bird landed on the branch.'
    );
    expect(applyEditorialEdits('The **brids** are here.', [edit('brids', 'birds')])).toBe(
      'The **birds** are here.'
    );
    expect(applyEditorialEdits('A clear statement[1].', [edit('[1]', '')])).toBe(
      'A clear statement.'
    );
  });

  test('rejects ambiguous, missing, and overlapping spans', () => {
    expect(() => applyEditorialEdits('teh and teh', [edit('teh', 'the')])).toThrow('unique span');
    expect(() => applyEditorialEdits('the bird', [edit('teh', 'the')])).toThrow('unique span');
    expect(() =>
      applyEditorialEdits('teh bird', [edit('teh bird', 'the bird'), edit('bird', 'birds')])
    ).toThrow('unique span');
  });

  test('protects code, link destinations, and Markdown structure', () => {
    expect(() => applyEditorialEdits('Use `teh` as the key.', [edit('teh', 'the')])).toThrow(
      'Markdown structure'
    );
    expect(() => applyEditorialEdits('[Read](https://teh.example)', [edit('teh', 'the')])).toThrow(
      'Markdown structure'
    );
    expect(() => applyEditorialEdits('teh bird', [edit('teh', '_the_')])).toThrow(
      'Markdown structure'
    );
  });

  test('rejects changed numbers, operators, and broad rewrites', () => {
    expect(() => applyEditorialEdits('The value is 5.', [edit('5', '9')])).toThrow(
      'number or mathematical symbol'
    );
    expect(() => applyEditorialEdits('x - y is the result.', [edit('-', '')])).toThrow(
      'number or mathematical symbol'
    );
    expect(() =>
      applyEditorialEdits('A bird landed on the branch.', [
        edit('A bird landed on the branch.', 'Somebody arrived at a completely different place.'),
      ])
    ).toThrow('too much');
  });
});
