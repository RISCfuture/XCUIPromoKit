import { describe, expect, it } from 'vitest';
import type { Manifest } from '../src/capture/manifest.ts';
import { posterFrame, resolvePreview, timeCode } from '../src/storyboard/resolve.ts';
import { Preview } from '../src/storyboard/schema.ts';

const manifest: Manifest = {
  version: 1,
  video: 'take.mp4',
  width: 1320,
  height: 2868,
  fps: 30,
  duration: 30,
  lag: 0.8,
  unchanged: [],
  endingEarly: [],
  scenes: [
    { name: 'opening', ranges: [{ start: 1, end: 3 }], taps: [], drags: [] },
    {
      name: 'climb',
      ranges: [
        { start: 5, end: 6 },
        { start: 8, end: 10 },
      ],
      taps: [
        { time: 5.5, x: 0.9, y: 0.3 },
        { time: 7, x: 0.9, y: 0.4 },
        { time: 9, x: 0.9, y: 0.5 },
      ],
      drags: [
        {
          start: 7,
          press: 0.1,
          duration: 0.5,
          hold: 0,
          path: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
        },
        {
          start: 8.5,
          press: 0.1,
          duration: 0.5,
          hold: 0,
          path: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
        },
      ],
    },
  ],
};

const sources = {
  manifest,
  copy: { hello: 'Hello there.' },
  video: 'takes/loop/take.mp4',
  brandCSS: 'brand.css',
};

const preview = (overrides: object) =>
  Preview.parse({
    id: 'loop',
    take: 'loop',
    device: 'iphone',
    scenes: [{ scene: 'opening' }, { scene: 'climb' }],
    ...overrides,
  });

describe('resolvePreview', () => {
  it('runs each scene as long as its kept footage, less the transitions that overlap them', () => {
    const props = resolvePreview(
      preview({
        scenes: [
          { scene: 'opening' },
          { scene: 'climb', transition: { type: 'dissolve', duration: 0.5 } },
        ],
      }),
      sources
    );
    expect(props.scenes.map(({ durationInFrames }) => durationInFrames)).toEqual([60, 90]);
    expect(props.scenes.map(({ arrivalFrames }) => arrivalFrames)).toEqual([0, 15]);
    expect(props.durationInFrames).toBe(135);
    expect(props.scenes[1]?.clips).toEqual([
      { from: 150, durationInFrames: 30 },
      { from: 240, durationInFrames: 60 },
    ]);
    expect(props).toMatchObject({ width: 886, height: 1920 });
  });

  it('leaves trimmed footage out of either end, across stretches', () => {
    const props = resolvePreview(
      preview({ scenes: [{ scene: 'climb', trim: { start: 1.5, end: 0.5 } }] }),
      sources
    );
    expect(props.scenes[0]?.clips).toEqual([{ from: 255, durationInFrames: 30 }]);
  });

  it('uses the chosen stretches in order, each trimmed', () => {
    const props = resolvePreview(
      preview({ scenes: [{ scene: 'climb', stretches: [{ index: 1, trim: { end: 1 } }, 0] }] }),
      sources
    );
    expect(props.scenes[0]?.clips).toEqual([
      { from: 240, durationInFrames: 30 },
      { from: 150, durationInFrames: 30 },
    ]);
  });

  it('runs a sped-up stretch for its footage divided by the rate', () => {
    const props = resolvePreview(
      preview({
        taps: { before: 0.2, after: 0.3 },
        scenes: [{ scene: 'climb', stretches: [0, { index: 1, speed: { rate: 4 } }] }],
      }),
      sources
    );
    const scene = props.scenes[0];
    expect(scene?.clips[1]).toMatchObject({ durationInFrames: 15, speed: { footageFrames: 60 } });
    expect(scene?.durationInFrames).toBe(45);
    expect(scene?.taps.at(-1)?.frame).toBe(38);
  });

  it('refuses a stretch the scene doesn’t have', () => {
    expect(() =>
      resolvePreview(preview({ scenes: [{ scene: 'opening', stretches: [3] }] }), sources)
    ).toThrow(/no stretch 3/);
  });

  it('refuses a trim that leaves nothing', () => {
    expect(() =>
      resolvePreview(preview({ scenes: [{ scene: 'opening', trim: { start: 2 } }] }), sources)
    ).toThrow(/leaves none/);
  });

  it('places taps and drags in kept footage on the scene’s timeline and drops the rest', () => {
    const props = resolvePreview(preview({ taps: { before: 0.2, after: 0.3 } }), sources);
    expect(props.scenes[1]?.taps).toEqual([
      { frame: 15, x: 0.9, y: 0.3 },
      { frame: 60, x: 0.9, y: 0.5 },
    ]);
    expect(props.scenes[1]?.drags.map(({ frame }) => frame)).toEqual([45]);
  });

  it('marks no taps unless the preview asks', () => {
    expect(resolvePreview(preview({}), sources).scenes[1]?.taps).toEqual([]);
  });

  it('takes caption text from the locale’s copy', () => {
    const props = resolvePreview(
      preview({ scenes: [{ scene: 'opening', caption: { copy: 'hello', y: 0.2 } }] }),
      sources
    );
    expect(props.scenes[0]?.caption).toEqual({ id: 'hello', text: 'Hello there.', y: 0.2 });
  });

  it('refuses a scene the take doesn’t have', () => {
    expect(() => resolvePreview(preview({ scenes: [{ scene: 'missing' }] }), sources)).toThrow(
      /no scene/
    );
  });
});

describe('posterFrame', () => {
  const withPoster = (poster: object) =>
    preview({
      poster,
      scenes: [
        { scene: 'opening' },
        { scene: 'climb', transition: { type: 'dissolve', duration: 0.5 } },
      ],
    });
  const frameOf = (poster: object) => {
    const board = withPoster(poster);
    return posterFrame(board, resolvePreview(board, sources));
  };

  it('counts from the scene’s arrival, after the transitions before it', () => {
    expect(frameOf({ scene: 'climb', at: 1 })).toEqual({ frame: 90, inTransition: false });
  });

  it('notices a poster during the next scene’s transition', () => {
    expect(frameOf({ scene: 'opening', at: 1.8 })?.inTransition).toBe(true);
  });

  it('refuses a poster past the end of its scene', () => {
    expect(() => frameOf({ scene: 'climb', at: 5 })).toThrow(/after the end/);
  });
});

describe('timeCode', () => {
  it('writes hours, minutes, seconds and frames', () => {
    expect(timeCode(30 * 74 + 7, 30)).toBe('00:01:14:07');
  });
});
