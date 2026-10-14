/**
 * How fast a stretch plays: `rate` times real time, reached from real time over `ramp` seconds at
 * its start and left over `ramp` seconds at its end, at a steady acceleration.
 */
export type Speed = { rate: number; ramp: number };

/** Seconds a stretch of `length` seconds of footage runs at `speed`. */
export function playedLength(length: number, speed: Speed): number {
  const { rate, ramp } = fitted(length, speed);
  return (length + (rate - 1) * ramp) / rate;
}

/** Seconds into the footage shown `time` seconds into a stretch of `length` played at `speed`. */
export function footageAt(time: number, length: number, speed: Speed): number {
  const { rate, ramp } = fitted(length, speed);
  const played = playedLength(length, speed);
  const ramped = (t: number) => (ramp > 0 ? t + ((rate - 1) * t * t) / (2 * ramp) : t);
  const t = Math.min(Math.max(time, 0), played);
  if (t < ramp) return ramped(t);
  if (t > played - ramp) return length - ramped(played - t);
  return ramped(ramp) + rate * (t - ramp);
}

/** Seconds into a stretch of `length` played at `speed` that show `footage` seconds of it. */
export function playedAt(footage: number, length: number, speed: Speed): number {
  const { rate, ramp } = fitted(length, speed);
  const played = playedLength(length, speed);
  const acceleration = ramp > 0 ? (rate - 1) / (2 * ramp) : 0;
  const unramped = (f: number) =>
    acceleration === 0 ? f : (Math.sqrt(1 + 4 * acceleration * f) - 1) / (2 * acceleration);
  const rampFootage = ramp + acceleration * ramp * ramp;
  const f = Math.min(Math.max(footage, 0), length);
  if (f < rampFootage) return unramped(f);
  if (f > length - rampFootage) return played - unramped(length - f);
  return ramp + (f - rampFootage) / rate;
}

/** `speed` with its ramp shortened to the longest the footage fits at both ends. */
function fitted(length: number, { rate, ramp }: Speed): Speed {
  return { rate, ramp: rate === 1 ? 0 : Math.min(ramp, length / (rate + 1)) };
}
