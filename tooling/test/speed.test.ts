import { describe, expect, it } from 'vitest';
import { footageAt, playedAt, playedLength } from '../src/storyboard/speed.ts';

describe('speed', () => {
  it('plays footage at a steady rate in its length divided by the rate', () => {
    expect(playedLength(24, { rate: 4, ramp: 0 })).toBe(6);
    expect(footageAt(3, 24, { rate: 4, ramp: 0 })).toBe(12);
  });

  it('ramps up from real time and back down, ending on the footage’s last moment', () => {
    const speed = { rate: 5, ramp: 1 };
    const played = playedLength(24, speed);
    expect(played).toBeCloseTo(5.6);
    expect(footageAt(0.01, 24, speed) / 0.01).toBeCloseTo(1, 1);
    expect(footageAt(played, 24, speed)).toBeCloseTo(24);
    expect(footageAt(played / 2, 24, speed)).toBeCloseTo(12);
  });

  it('shortens a ramp too long for the footage to fit it', () => {
    const speed = { rate: 3, ramp: 10 };
    expect(footageAt(playedLength(8, speed), 8, speed)).toBeCloseTo(8);
  });

  it('finds when a moment of footage plays', () => {
    const speed = { rate: 5, ramp: 1 };
    expect(footageAt(playedAt(17, 24, speed), 24, speed)).toBeCloseTo(17);
  });
});
