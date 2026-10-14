import { describe, expect, it } from 'vitest';
import { sceneLength, sceneTimeline } from '../src/capture/timeline.ts';
import type { Take } from '../src/capture/take.ts';

const take = (
  segments: Take['segments'],
  taps: Take['taps'] = [],
  drags: Take['drags'] = []
): Take => ({
  version: 1,
  screen: { width: 440, height: 956 },
  segments,
  taps,
  drags,
  heldFrames: [],
  closingShots: [],
  recordings: [],
});

describe('sceneTimeline', () => {
  it('keeps footage two stretches share only once, in the earlier one', () => {
    const scenes = sceneTimeline(
      take([
        { scene: 'climb', start: 2, end: 3.5 },
        { scene: 'climb', start: 3, end: 4.5 },
        { scene: 'moderate', start: 4.2, end: 6 },
      ])
    );

    expect(scenes.map(({ name, ranges }) => ({ name, ranges }))).toEqual([
      { name: 'climb', ranges: [{ start: 2, end: 4.5 }] },
      { name: 'moderate', ranges: [{ start: 4.5, end: 6 }] },
    ]);
    expect(scenes.map(sceneLength)).toEqual([2.5, 1.5]);
  });

  it('drops a stretch wholly inside one already kept', () => {
    const scenes = sceneTimeline(
      take([
        { scene: 'opening', start: 0, end: 3 },
        { scene: 'opening', start: 1, end: 2 },
      ])
    );
    expect(scenes[0]?.ranges).toEqual([{ start: 0, end: 3 }]);
  });

  it('keeps separate stretches apart', () => {
    const scenes = sceneTimeline(
      take([
        { scene: 'climb', start: 2, end: 3 },
        { scene: 'climb', start: 7, end: 8 },
      ])
    );
    expect(scenes[0]?.ranges).toEqual([
      { start: 2, end: 3 },
      { start: 7, end: 8 },
    ]);
  });

  it('files taps under their scenes', () => {
    const scenes = sceneTimeline(
      take([{ scene: 'climb', start: 2, end: 3 }], [{ scene: 'climb', time: 2.4, x: 0.9, y: 0.3 }])
    );
    expect(scenes[0]?.taps).toEqual([{ time: 2.4, x: 0.9, y: 0.3 }]);
  });

  it('refuses a scene that comes back after another', () => {
    expect(() =>
      sceneTimeline(
        take([
          { scene: 'a', start: 0, end: 1 },
          { scene: 'b', start: 1, end: 2 },
          { scene: 'a', start: 2, end: 3 },
        ])
      )
    ).toThrow(/comes back/);
  });
});
