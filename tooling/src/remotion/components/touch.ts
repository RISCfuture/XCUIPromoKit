import type { TapMarks as TapTiming } from '../../storyboard/schema.ts';
import type { DragMark, TapMark } from '../props.ts';

/** Where a touch mark sits and how far through landing and lifting it is, at one moment. */
export type TouchMarkState = {
  gesture: 'tap' | 'drag';
  x: number;
  y: number;
  /** From 0, `before` the finger lands, to 1 as it lands. */
  landing: number;
  /** From 0 as the finger lifts to 1, `after` it lifts. */
  lifting: number;
  /** For a drag, from 0 as the finger starts moving to 1 as it stops. */
  progress?: number;
};

/** A tap's mark `time` seconds after the finger lifts; none outside the timing's window. */
export function tapMarkState(
  { x, y }: TapMark,
  time: number,
  timing: TapTiming
): TouchMarkState | undefined {
  if (time < -timing.before || time > timing.after) return undefined;
  return { gesture: 'tap', x, y, ...envelope(time, time, timing) };
}

/** A drag's mark `time` seconds after the finger starts moving; none outside the timing's window. */
export function dragMarkState(
  { press, duration, hold, path }: DragMark,
  time: number,
  timing: TapTiming
): TouchMarkState | undefined {
  const sinceLanding = time + press,
    sinceLifting = time - duration - hold;
  if (sinceLanding < -timing.before || sinceLifting > timing.after) return undefined;
  const progress = ramp(time, duration);
  return {
    gesture: 'drag',
    ...pointAlong(path, progress),
    ...envelope(sinceLanding, sinceLifting, timing),
    progress,
  };
}

/** The point `fraction` of the way along `path` by distance. */
function pointAlong(path: DragMark['path'], fraction: number): { x: number; y: number } {
  const legs = path.slice(1).map((end, index) => {
    const start = path[index] ?? end;
    return { start, end, length: Math.hypot(end.x - start.x, end.y - start.y) };
  });
  let remaining = fraction * legs.reduce((total, { length }) => total + length, 0);
  for (const { start, end, length } of legs) {
    if (remaining <= length && length > 0) {
      const share = remaining / length;
      return { x: start.x + (end.x - start.x) * share, y: start.y + (end.y - start.y) * share };
    }
    remaining -= length;
  }
  return path.at(-1) ?? { x: 0, y: 0 };
}

function envelope(sinceLanding: number, sinceLifting: number, { before, after }: TapTiming) {
  return { landing: ramp(sinceLanding + before, before), lifting: ramp(sinceLifting, after) };
}

/** From 0 at `time` 0 to 1 at `length`, held either side; a step where `length` is 0. */
function ramp(time: number, length: number) {
  if (length <= 0) return time >= 0 ? 1 : 0;
  return Math.min(1, Math.max(0, time / length));
}
