import { describe, expect, it } from 'vitest';
import { piecesOfRuns, plainText, runs } from '../src/storyboard/markup.ts';

describe('runs', () => {
  it('sets text between asterisks with emphasis', () => {
    expect(runs('Every fix, *corrected*.')).toEqual([
      { text: 'Every fix, ', emphasis: false },
      { text: 'corrected', emphasis: true },
      { text: '.', emphasis: false },
    ]);
  });

  it('keeps an asterisk without a partner as written', () => {
    expect(runs('5* rated')).toEqual([{ text: '5* rated', emphasis: false }]);
  });
});

describe('plainText', () => {
  it('drops the emphasis marks', () => {
    expect(plainText('*Every* fix, *corrected*.')).toBe('Every fix, corrected.');
  });
});

describe('piecesOfRuns', () => {
  it('keeps punctuation in the unit of the emphasised word it follows', () => {
    expect(
      piecesOfRuns('Cold air puts you *low*.', ['Cold ', 'air ', 'puts ', 'you ', 'low.'])
    ).toEqual([
      [{ text: 'Cold ', emphasis: false }],
      [{ text: 'air ', emphasis: false }],
      [{ text: 'puts ', emphasis: false }],
      [{ text: 'you ', emphasis: false }],
      [
        { text: 'low', emphasis: true },
        { text: '.', emphasis: false },
      ],
    ]);
  });
});
