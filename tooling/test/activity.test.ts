import { describe, expect, it } from 'vitest';
import {
  estimateLag,
  narrowToMotion,
  parseMotion,
  shiftTake,
  unchangedActions,
} from '../src/capture/activity.ts';
import type { Take } from '../src/capture/take.ts';

const activity = (start: number, end: number) => ({ start, end, landing: 0.3, settle: 0.6 });

const take: Take = {
  version: 1,
  screen: { width: 440, height: 956 },
  segments: [
    { scene: 'opening', start: 0, end: 1.5 },
    { scene: 'climb', start: 4.1, end: 5, activity: activity(2, 4.4) },
    { scene: 'climb', start: 7.1, end: 8, activity: activity(5, 7.4) },
    { scene: 'moderate', start: 9.1, end: 10, activity: activity(8, 9.4) },
  ],
  taps: [
    { scene: 'climb', time: 4.45, x: 0.5, y: 0.95 },
    { scene: 'climb', time: 7.45, x: 0.9, y: 0.3 },
  ],
  drags: [
    {
      scene: 'moderate',
      start: 8.2,
      press: 0.1,
      duration: 1,
      hold: 0.1,
      path: [
        { x: 0.2, y: 0.5 },
        { x: 0.8, y: 0.5 },
      ],
    },
  ],
  heldFrames: [{ file: 'held-0.png', start: 10, end: 12 }],
  closingShots: [],
  recordings: [],
};

describe('parseMotion', () => {
  it('keeps the frames that differ from the one before', () => {
    const output = [
      'frame:0 pts:0 pts_time:20.9',
      'lavfi.signalstats.YMAX=71',
      'frame:1 pts:1 pts_time:20.933',
      'lavfi.signalstats.YMAX=2',
    ].join('\n');
    expect(parseMotion(output)).toEqual([20.9]);
  });
});

describe('estimateLag', () => {
  it('finds none when each scene changes while its action runs', () => {
    expect(
      estimateLag(take, [
        { time: 2.5, score: 7 },
        { time: 8.6, score: 7 },
      ])
    ).toBe(0);
  });

  it('measures how far after its action a scene changes', () => {
    expect(
      estimateLag(take, [
        { time: 5.2, score: 7 },
        { time: 10, score: 7 },
      ])
    ).toBeCloseTo(0.7);
  });

  it('ignores changes too faint to be a new screen', () => {
    expect(estimateLag(take, [{ time: 2.5, score: 2 }])).toBeUndefined();
  });
});

describe('narrowToMotion', () => {
  it('keeps from the landing before an action’s first change to the settle after its last', () => {
    const narrowed = narrowToMotion(take, [3, 3.5, 3.9, 6.2]);
    expect(narrowed.segments[1]).toMatchObject({ start: 2.7, end: 4.5 });
    expect(narrowed.segments[2]).toMatchObject({ start: 5.9, end: 6.8 });
  });

  it('marks a tap where the touch lands', () => {
    const narrowed = narrowToMotion(take, [3, 3.5, 6.2]);
    expect(narrowed.taps.map(({ time }) => time)).toEqual([3, 6.2]);
  });

  it('starts a drag moving at its action’s first change', () => {
    const narrowed = narrowToMotion(take, [8.6, 9.2]);
    expect(narrowed.drags[0]?.start).toBe(8.6);
  });

  it('keeps the test’s times for an action that changed nothing', () => {
    const narrowed = narrowToMotion(take, []);
    expect(narrowed.segments).toEqual(take.segments);
  });
});

describe('shiftTake', () => {
  it('moves every time onto the footage’s clock', () => {
    const shifted = shiftTake(take, 0.5);
    expect(shifted.segments[1]).toMatchObject({
      start: 4.6,
      end: 5.5,
      activity: { start: 2.5, end: 4.9 },
    });
    expect(shifted.taps[0]?.time).toBeCloseTo(4.95);
    expect(shifted.drags[0]?.start).toBeCloseTo(8.7);
    expect(shifted.heldFrames[0]).toMatchObject({ start: 10.5, end: 12.5 });
  });
});

describe('unchangedActions', () => {
  it('names each action whose window shows no change', () => {
    expect(unchangedActions(take, [3, 6.2])).toEqual([{ scene: 'moderate', time: 8 }]);
  });
});
