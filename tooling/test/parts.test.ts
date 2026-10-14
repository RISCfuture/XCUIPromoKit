import { describe, expect, it } from 'vitest';
import { changesWithinParts, layOutParts, onFootage, withinParts } from '../src/capture/parts.ts';
import type { Take } from '../src/capture/take.ts';

const take: Take = {
  version: 1,
  screen: { width: 440, height: 956 },
  segments: [
    { scene: 'write', start: 0.5, end: 3 },
    {
      scene: 'read',
      start: 25.6,
      end: 28.5,
      activity: { start: 25.9, end: 26.3, landing: 0.3, settle: 2.2 },
    },
  ],
  taps: [{ scene: 'read', time: 26.3, x: 0.5, y: 0.5 }],
  drags: [],
  heldFrames: [{ file: 'held-0.png', start: 27, end: 28 }],
  closingShots: [],
  recordings: [
    { scene: 'write', start: 0.4 },
    { scene: 'read', start: 25.8 },
  ],
};
const fps = 30;
const parts = layOutParts(take, fps, 'raw.mp4', (index) => `scene-${String(index)}.mp4`);

describe('layOutParts', () => {
  it('gives each scene its own recording, kept to its last moment and some room, end to end', () => {
    expect(parts.map(({ file, offset, kept }) => ({ file, offset, kept }))).toEqual([
      { file: 'scene-0.mp4', offset: 0, kept: 2.6 },
      { file: 'scene-1.mp4', offset: 4.6, kept: expect.closeTo(2.7) as number },
    ]);
  });

  it('films a take without scene recordings as one', () => {
    const whole = layOutParts({ ...take, recordings: [] }, fps, 'raw.mp4', String);
    expect(whole).toMatchObject([{ file: 'raw.mp4', scenes: ['write', 'read'], start: 0 }]);
  });
});

describe('onFootage', () => {
  const filmed = onFootage(take, parts);

  it('moves each scene’s times into its own recording, however long the test spent between', () => {
    expect(filmed.segments[1]?.end).toBeCloseTo(4.6 + 2.7);
    expect(filmed.taps[0]?.time).toBeCloseTo(4.6 + 0.5);
  });

  it('starts a stretch reaching back before its recording at the recording’s start', () => {
    expect(filmed.segments[1]?.start).toBeCloseTo(4.6);
  });

  it('places a held frame in the recording running when it was taken', () => {
    expect(filmed.heldFrames[0]?.start).toBeCloseTo(4.6 + 1.2);
  });
});

describe('changesWithinParts', () => {
  it('leaves out the cut between parts and what was caught after a scene ended', () => {
    const changes = [1, 3.4, 4.6, 5, 8].map((time) => ({ time, score: 10 }));
    expect(changesWithinParts(changes, parts, fps).map(({ time }) => time)).toEqual([1, 5]);
  });
});

describe('withinParts', () => {
  it('keeps a scene’s footage inside the part that filmed it', () => {
    const scenes = withinParts(
      [{ name: 'read', ranges: [{ start: 4.2, end: 6 }], taps: [], drags: [] }],
      parts
    );
    expect(scenes[0]?.ranges).toEqual([{ start: 4.6, end: 6 }]);
  });
});
