import type { Scene } from './manifest.ts';
import type { SceneChange } from './snap.ts';
import type { Take } from './take.ts';

/** One recording, cut into the normalized take. Times are seconds. */
export type Part = {
  /** The recording's file name, beside take.json. */
  file: string;
  /** The scenes it filmed. */
  scenes: string[];
  /** When it started, by the test's clock. */
  start: number;
  /** How much of it the normalized take keeps, in whole frames. */
  length: number;
  /** How far into it the take's last kept moment falls. */
  kept: number;
  /** Where it begins in the normalized take. */
  offset: number;
};

/** Room left past a part's last kept moment, for the lag correction to shift into, in seconds. */
const tailRoom = 2;

/**
 * Lays a take's recordings end to end: one per scene, or the single recording of a take filmed
 * whole. Each keeps what its scenes kept, and a little room after.
 */
export function layOutParts(
  take: Take,
  fps: number,
  wholeTake: string,
  sceneFile: (index: number) => string
): Part[] {
  const recordings =
    take.recordings.length > 0
      ? take.recordings.map(({ scene, start }, index) => ({
          file: sceneFile(index),
          scenes: [scene],
          start,
        }))
      : [
          {
            file: wholeTake,
            scenes: [...new Set(take.segments.map(({ scene }) => scene))],
            start: 0,
          },
        ];

  let offset = 0;
  return recordings.map((recording) => {
    const segments = take.segments.filter(({ scene }) => recording.scenes.includes(scene));
    const lastKept = Math.max(recording.start, ...segments.map(({ end }) => end));
    const kept = lastKept - recording.start;
    const length = Math.ceil((kept + tailRoom) * fps) / fps;
    const part = { ...recording, length, kept, offset };
    offset += length;
    return part;
  });
}

/** The take with every time moved from the test's clock onto the normalized take's. */
export function onFootage(take: Take, parts: Part[]): Take {
  const partOf = (scene: string) => parts.find(({ scenes }) => scenes.includes(scene)) ?? parts[0];
  const inPart = (part: Part | undefined) => (time: number) =>
    part ? part.offset + Math.min(Math.max(time - part.start, 0), part.length) : time;
  const atTime = (time: number) =>
    inPart(parts.findLast(({ start }) => start <= time) ?? parts[0])(time);

  return {
    ...take,
    segments: take.segments.map((segment) => {
      const move = inPart(partOf(segment.scene));
      return {
        ...segment,
        start: move(segment.start),
        end: move(segment.end),
        ...(segment.activity && {
          activity: {
            ...segment.activity,
            start: move(segment.activity.start),
            end: move(segment.activity.end),
          },
        }),
      };
    }),
    taps: take.taps.map((tap) => ({ ...tap, time: inPart(partOf(tap.scene))(tap.time) })),
    drags: take.drags.map((drag) => ({ ...drag, start: inPart(partOf(drag.scene))(drag.start) })),
    heldFrames: take.heldFrames.map((held) => ({
      ...held,
      start: atTime(held.start),
      end: atTime(held.end),
    })),
    recordings: [],
  };
}

/** How far past a part's last kept moment its changes of screen still count, in seconds. */
const changeReach = 0.5;

/**
 * The changes of screen the take's actions could have caused: those within a part's kept footage
 * or just after it, leaving out where one part cuts to the next and what the recorder caught
 * between a scene's end and its stopping.
 */
export function changesWithinParts(
  changes: SceneChange[],
  parts: Part[],
  fps: number
): SceneChange[] {
  return changes.filter(({ time }) =>
    parts.some(
      ({ offset, kept }) => time > offset + 1.5 / fps && time <= offset + kept + changeReach
    )
  );
}

/** Each scene's footage, kept within the part that filmed it. */
export function withinParts(scenes: Scene[], parts: Part[]): Scene[] {
  return scenes.map((scene) => {
    const part = parts.find(({ scenes: filmed }) => filmed.includes(scene.name));
    if (!part) return scene;
    const ranges = scene.ranges
      .map(({ start, end }) => ({
        start: Math.max(start, part.offset),
        end: Math.min(end, part.offset + part.length),
      }))
      .filter(({ start, end }) => end > start);
    return { ...scene, ranges };
  });
}
