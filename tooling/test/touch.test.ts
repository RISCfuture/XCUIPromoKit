import { describe, expect, it } from 'vitest';
import { dragMarkState } from '../src/remotion/components/touch.ts';

const drag = {
  frame: 0,
  press: 0.2,
  duration: 1,
  hold: 0.5,
  path: [
    { x: 0.2, y: 0.4 },
    { x: 0.6, y: 0.8 },
  ],
};
const timing = { before: 0.1, after: 0.3 };

describe('dragMarkState', () => {
  it('rests where the finger presses until it starts moving', () => {
    expect(dragMarkState(drag, -0.2, timing)).toMatchObject({
      x: 0.2,
      y: 0.4,
      progress: 0,
      landing: 1,
    });
  });

  it('follows the finger along the drag', () => {
    const mark = dragMarkState(drag, 0.5, timing);
    expect(mark?.x).toBeCloseTo(0.4);
    expect(mark?.y).toBeCloseTo(0.6);
    expect(mark?.progress).toBeCloseTo(0.5);
  });

  it('rests where the finger lifts, then lifts after the hold', () => {
    expect(dragMarkState(drag, 1.4, timing)).toMatchObject({ x: 0.6, y: 0.8, lifting: 0 });
    expect(dragMarkState(drag, 1.65, timing)?.lifting).toBeCloseTo(0.5);
  });

  it('follows a path through several points at an even speed', () => {
    const corner = {
      ...drag,
      path: [
        { x: 0, y: 0 },
        { x: 0.3, y: 0 },
        { x: 0.3, y: 0.1 },
      ],
    };
    const turning = dragMarkState(corner, 0.75, timing);
    expect(turning?.x).toBeCloseTo(0.3);
    expect(turning?.y).toBeCloseTo(0);
    const mark = dragMarkState(corner, 0.875, timing);
    expect(mark?.x).toBeCloseTo(0.3);
    expect(mark?.y).toBeCloseTo(0.05);
  });

  it('shows only from before the finger lands until after it lifts', () => {
    expect(dragMarkState(drag, -0.31, timing)).toBeUndefined();
    expect(dragMarkState(drag, 1.81, timing)).toBeUndefined();
  });
});
