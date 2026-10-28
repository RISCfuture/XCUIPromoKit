import { describe, expect, it } from 'vitest';
import { layOutParts } from '../src/capture/parts.ts';
import { filmedScenes, normalizeFilter } from '../src/capture/prepare.ts';
import type { Take } from '../src/capture/take.ts';

describe('normalizeFilter', () => {
  it('cuts each recording to its length and joins them end to end', () => {
    expect(normalizeFilter([{ length: 4 }, { length: 2.5 }]).split(';')).toEqual([
      '[0:v]fps=30,tpad=stop_mode=clone:stop_duration=4.000,trim=duration=4.000,setpts=PTS-STARTPTS,format=yuv420p[p0]',
      '[1:v]fps=30,tpad=stop_mode=clone:stop_duration=2.500,trim=duration=2.500,setpts=PTS-STARTPTS,format=yuv420p[p1]',
      '[p0][p1]concat=n=2:v=1:a=0[out]',
    ]);
  });

  it('lays each held frame over the joined footage for its stretch, in turn', () => {
    const filter = normalizeFilter([{ length: 12 }], {
      size: { width: 1320, height: 2868 },
      overlays: [
        { file: 'a.png', start: 2, end: 4 },
        { file: 'b.png', start: 9, end: 10.25 },
      ],
    });
    expect(filter.split(';').slice(2)).toEqual([
      '[1:v]scale=1320:2868,format=yuv420p[h0]',
      "[v0][h0]overlay=enable='between(t,2.000,4.000)'[v1]",
      '[2:v]scale=1320:2868,format=yuv420p[h1]',
      "[v1][h1]overlay=enable='between(t,9.000,10.250)'[out]",
    ]);
  });
});

describe('filmedScenes', () => {
  const activity = (start: number, end: number, settle: number) => ({
    start,
    end,
    landing: 0.3,
    settle,
  });
  const take: Take = {
    version: 1,
    screen: { width: 440, height: 956 },
    segments: [
      { scene: 'load', start: 0.7, end: 2, activity: activity(0.5, 1.2, 0.8) },
      { scene: 'load', start: 2, end: 3.5 },
      { scene: 'load', start: 3.9, end: 5, activity: activity(3.6, 4.2, 0.8) },
      { scene: 'map', start: 5.5, end: 8.5, activity: activity(5.2, 5.5, 3) },
      { scene: 'map', start: 8.5, end: 11.5 },
    ],
    taps: [],
    drags: [],
    heldFrames: [],
    closingShots: [],
    recordings: [],
  };
  const parts = layOutParts(take, 30, 'raw.mp4', String);
  const stretchCounts = (moving: number[], changes: { time: number; score: number }[] = []) =>
    filmedScenes(take, moving, changes, parts).map(({ name, ranges }) => [name, ranges.length]);

  it('numbers each scene’s stretches by the actions the test kept, whatever the recording shows', () => {
    const touching = stretchCounts([0.9, 1.2, 4, 5.4]);
    const apart = stretchCounts([0.6, 0.7, 3.6, 5.5], [{ time: 5.45, score: 8 }]);
    const unmoved = stretchCounts([]);

    expect(touching).toEqual([
      ['load', 3],
      ['map', 2],
    ]);
    expect(apart).toEqual(touching);
    expect(unmoved).toEqual(touching);
  });
});
