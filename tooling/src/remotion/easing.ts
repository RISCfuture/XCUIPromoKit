import { Easing } from 'remotion';
import type { EasingCurve } from '../storyboard/schema.ts';

/** A storyboard pace as a function from linear progress to eased progress. */
export function easing(curve: EasingCurve): (progress: number) => number {
  return curve === 'linear' ? (progress) => progress : Easing.bezier(...curve);
}

/** Progress from 0 to 1 through `[start, start + duration]`, eased and clamped. */
export function progress(time: number, start: number, duration: number, curve: EasingCurve) {
  if (duration <= 0) return time >= start ? 1 : 0;
  return easing(curve)(Math.min(1, Math.max(0, (time - start) / duration)));
}
