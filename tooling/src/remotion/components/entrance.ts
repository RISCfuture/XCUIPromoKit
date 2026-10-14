import type { CSSProperties } from 'react';
import type { Entrance, Keyframe } from '../../storyboard/schema.ts';
import { easing } from '../easing.ts';

type Property = Exclude<keyof Keyframe, 'at'>;

/** Each property's value at rest, which a keyframe that leaves it out is at. */
const rest: Record<Property, number> = {
  opacity: 1,
  x: 0,
  y: 0,
  scale: 1,
  rotate: 0,
  skew: 0,
  blur: 0,
};

/**
 * A property's value `progress` of the way through the keyframes. As in CSS, a property is at rest
 * at the start and end unless a keyframe there says otherwise, and the entrance's easing paces
 * each step between keyframes that set it.
 */
export function valueAt(property: Property, entrance: Entrance, progress: number): number {
  const stops = entrance.keyframes
    .flatMap(({ at, [property]: value }) => (value === undefined ? [] : [{ at, value }]))
    .sort((a, b) => a.at - b.at);
  if (stops[0]?.at !== 0) stops.unshift({ at: 0, value: rest[property] });
  if (stops.at(-1)?.at !== 1) stops.push({ at: 1, value: rest[property] });

  const clamped = Math.min(1, Math.max(0, progress));
  const next = stops.findIndex(({ at }) => at >= clamped);
  const to = stops[Math.max(next, 1)] ?? stops[1];
  const from = stops[Math.max(next, 1) - 1] ?? stops[0];
  if (!from || !to || to.at === from.at) return to?.value ?? rest[property];
  const local = easing(entrance.easing)((clamped - from.at) / (to.at - from.at));
  return from.value + (to.value - from.value) * local;
}

/** How one unit of a caption looks `progress` of the way through its entrance. */
export function entranceStyle(entrance: Entrance, progress: number): CSSProperties {
  const value = (property: Property) => valueAt(property, entrance, progress);
  const blur = value('blur');
  return {
    opacity: value('opacity'),
    transform: `translate(${value('x')}em, ${value('y')}em) scale(${value('scale')}) rotate(${value('rotate')}deg) skewX(${value('skew')}deg)`,
    filter: blur > 0 ? `blur(${blur}em)` : 'none',
  };
}
