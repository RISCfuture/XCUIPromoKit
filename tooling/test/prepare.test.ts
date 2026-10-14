import { describe, expect, it } from 'vitest';
import { normalizeFilter } from '../src/capture/prepare.ts';

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
