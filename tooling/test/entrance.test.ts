import { describe, expect, it } from 'vitest';
import { valueAt } from '../src/remotion/components/entrance.ts';
import { Entrance } from '../src/storyboard/schema.ts';

const entrance = (keyframes: Entrance['keyframes'], easing: Entrance['easing'] = 'linear') =>
  Entrance.parse({ duration: 1, easing, keyframes });

describe('valueAt', () => {
  it('starts and ends at rest unless a keyframe says otherwise', () => {
    const fadeUp = entrance([{ at: 0, opacity: 0, y: 1 }]);
    expect(valueAt('opacity', fadeUp, 0)).toBe(0);
    expect(valueAt('opacity', fadeUp, 0.5)).toBe(0.5);
    expect(valueAt('y', fadeUp, 1)).toBe(0);
    expect(valueAt('scale', fadeUp, 0.5)).toBe(1);
  });

  it('steps between only the keyframes that set a property', () => {
    const overshoot = entrance([
      { at: 0, x: -1.4, opacity: 0 },
      { at: 0.3, opacity: 1 },
      { at: 0.7, x: 0.06 },
    ]);
    expect(valueAt('x', overshoot, 0.7)).toBeCloseTo(0.06);
    expect(valueAt('x', overshoot, 0.35)).toBeCloseTo(-0.67);
    expect(valueAt('opacity', overshoot, 0.3)).toBe(1);
    expect(valueAt('x', overshoot, 1)).toBe(0);
  });

  it('eases each step, as CSS animations do', () => {
    const eased = entrance([{ at: 0, x: -1 }], [0.42, 0, 1, 1]);
    expect(valueAt('x', eased, 0.25)).toBeLessThan(-0.75);
  });

  it('holds at its ends outside the entrance', () => {
    const slide = entrance([{ at: 0, x: -2 }]);
    expect(valueAt('x', slide, -0.5)).toBe(-2);
    expect(valueAt('x', slide, 2)).toBe(0);
  });
});
