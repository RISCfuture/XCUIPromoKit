import type { Zoom } from '../../storyboard/schema.ts';
import { progress } from '../easing.ts';

/**
 * Where the camera is: the frame scaled by `scale` from its top-left corner, then moved by `x` and
 * `y`, as fractions of the frame.
 */
export type Camera = { scale: number; x: number; y: number };

const fullFrame: Camera = { scale: 1, x: 0, y: 0 };

/** The camera `time` seconds after the scene arrives, each zoom moving it from where the last left it. */
export function cameraAt(zooms: Zoom[], time: number): Camera {
  return zooms.reduce((camera, zoom) => {
    const done = progress(time, zoom.at, zoom.duration, zoom.easing);
    return done === 0 ? camera : between(camera, framing(zoom), done);
  }, fullFrame);
}

/**
 * The camera once `zoom` completes, scaled by `to`: with its point staying put, or brought as
 * near the centre as it can be without showing past the frame's edges.
 */
function framing({ to, x, y, aim }: Zoom): Camera {
  if (aim === 'fixed') return { scale: to, x: x * (1 - to), y: y * (1 - to) };
  const centred = (point: number) => clamp(0.5 - to * point, 1 - to, 0);
  return { scale: to, x: centred(x), y: centred(y) };
}

function clamp(value: number, bound: number, otherBound: number) {
  return Math.min(Math.max(value, Math.min(bound, otherBound)), Math.max(bound, otherBound));
}

function between(from: Camera, to: Camera, done: number): Camera {
  return {
    scale: from.scale + (to.scale - from.scale) * done,
    x: from.x + (to.x - from.x) * done,
    y: from.y + (to.y - from.y) * done,
  };
}
