import { describe, expect, it } from 'vitest';
import { cameraAt } from '../src/remotion/components/camera.ts';
import { Zoom } from '../src/storyboard/schema.ts';

const zoom = (fields: object) => Zoom.parse(fields);

describe('cameraAt', () => {
  const push = zoom({ to: 2, x: 0.5, y: 0.25, at: 1, duration: 1 });

  it('keeps the zoom’s point fixed while it scales', () => {
    const { scale, x, y } = cameraAt([push], 1.5);
    expect(scale).toBe(1.5);
    expect(0.5 * scale + x).toBeCloseTo(0.5);
    expect(0.25 * scale + y).toBeCloseTo(0.25);
  });

  it('moves each zoom on from where the one before left the camera', () => {
    const further = zoom({ to: 4, x: 0.6, y: 0.3, at: 3, duration: 1 });
    expect(cameraAt([push, further], 2.5)).toEqual({ scale: 2, x: -0.5, y: -0.25 });
    expect(cameraAt([push, further], 3.5)).toMatchObject({ scale: 3 });
    expect(cameraAt([push, further], 4)).toEqual({ scale: 4, x: 0.6 * -3, y: 0.3 * -3 });
  });

  it('centres the point when aimed there, as far as the frame’s edges allow', () => {
    const centred = zoom({ to: 2, x: 0.4, y: 0.95, aim: 'center', at: 0, duration: 1 });
    const { scale, x, y } = cameraAt([centred], 1);
    expect(0.4 * scale + x).toBeCloseTo(0.5);
    expect(y).toBe(-1);
  });

  it('returns to the full frame on a zoom to 1', () => {
    const back = zoom({ to: 1, at: 3, duration: 0.5 });
    expect(cameraAt([push, back], 3.5)).toEqual({ scale: 1, x: 0, y: 0 });
  });
});
