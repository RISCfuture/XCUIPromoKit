import { describe, expect, it } from 'vitest';
import type { Scene } from '../src/capture/manifest.ts';
import { parseSceneChanges, snapScenes } from '../src/capture/snap.ts';

const scenes: Scene[] = [
  { name: 'opening', ranges: [{ start: 0, end: 1.5 }], taps: [], drags: [] },
  {
    name: 'climb',
    ranges: [{ start: 3, end: 5 }],
    taps: [{ time: 3.3, x: 0.5, y: 0.95 }],
    drags: [],
  },
  {
    name: 'moderate',
    ranges: [{ start: 7, end: 9 }],
    taps: [{ time: 7.3, x: 0.7, y: 0.95 }],
    drags: [],
  },
];

describe('parseSceneChanges', () => {
  it('reads each frame’s time and score', () => {
    const output = [
      'frame:0    pts:0       pts_time:0',
      'lavfi.scd.score=0.000',
      'frame:1    pts:512     pts_time:0.0333',
      'lavfi.scd.score=7.250',
    ].join('\n');
    expect(parseSceneChanges(output)).toEqual([
      { time: 0, score: 0 },
      { time: 0.0333, score: 7.25 },
    ]);
  });
});

describe('snapScenes', () => {
  it('starts each scene on its screen change and ends the scene before there', () => {
    const snapped = snapScenes(scenes, [
      { time: 3.35, score: 7 },
      { time: 7.25, score: 7 },
    ]);
    expect(snapped[1]?.ranges[0]?.start).toBe(3.35);
    expect(snapped[2]?.ranges[0]?.start).toBe(7.25);
    expect(snapped[0]?.ranges).toEqual([{ start: 0, end: 1.5 }]);
  });

  it('trims the scene before when the change falls inside it, keeping its stretches’ numbers', () => {
    const overlapping: Scene[] = [
      {
        name: 'a',
        ranges: [
          { start: 0, end: 3.95 },
          { start: 3.95, end: 4 },
        ],
        taps: [],
        drags: [],
      },
      {
        name: 'b',
        ranges: [
          { start: 4, end: 4 },
          { start: 4, end: 6 },
        ],
        taps: [{ time: 4.2, x: 0, y: 0 }],
        drags: [],
      },
    ];
    const snapped = snapScenes(overlapping, [{ time: 3.9, score: 8 }]);
    expect(snapped[0]?.ranges).toEqual([
      { start: 0, end: 3.9 },
      { start: 3.9, end: 3.9 },
    ]);
    expect(snapped[1]?.ranges[1]?.start).toBe(3.9);
  });

  it('leaves a scene alone when no change is found', () => {
    expect(snapScenes(scenes, [])).toEqual(scenes);
  });
});
