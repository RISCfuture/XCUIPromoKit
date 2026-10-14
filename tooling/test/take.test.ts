import { describe, expect, it } from 'vitest';
import { Take } from '../src/capture/take.ts';

describe('Take', () => {
  it('reads a straight drag written as from and to as a two-point path', () => {
    const take = Take.parse({
      version: 1,
      screen: { width: 440, height: 956 },
      segments: [],
      taps: [],
      drags: [
        {
          scene: 'write',
          start: 1,
          press: 0.1,
          duration: 0.4,
          hold: 0,
          from: { x: 0, y: 0 },
          to: { x: 1, y: 1 },
        },
      ],
    });
    expect(take.drags[0]?.path).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
  });
});
