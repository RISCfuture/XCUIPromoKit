import { keepsFootage, type Scene } from './manifest.ts';

/** A frame where the picture changes, scored by ffmpeg's scdet filter. */
export type SceneChange = {
  time: number;
  score: number;
};

export type SnapOptions = {
  /** The least scdet score that counts as a change of screen. A tab switch scores about 7. */
  threshold: number;
  /** How long before its effect an untapped scene's first stretch starts, in seconds. */
  landing: number;
};

export const defaultSnapOptions: SnapOptions = {
  threshold: 5,
  landing: 0.3,
};

/** How far either side of when a scene should begin to look for its change of screen, in seconds. */
const reach = 0.4;

/** Reads the output of `scdet,metadata=print:key=lavfi.scd.score`. */
export function parseSceneChanges(output: string): SceneChange[] {
  const changes: SceneChange[] = [];
  let time: number | undefined;
  for (const line of output.split('\n')) {
    const frame = /pts_time:([\d.]+)/.exec(line);
    const score = /lavfi\.scd\.score=([\d.]+)/.exec(line);
    if (frame?.[1]) time = Number(frame[1]);
    else if (score?.[1] && time !== undefined) changes.push({ time, score: Number(score[1]) });
  }
  return changes;
}

/**
 * When each scene after the first should visibly begin: its first tap, the one that brought the
 * scene on, or its first stretch's start plus the tap landing.
 */
export function expectedChanges(
  scenes: Scene[],
  options = defaultSnapOptions
): (number | undefined)[] {
  return scenes.map((scene, index) => {
    if (index === 0) return undefined;
    const first = scene.ranges.find(keepsFootage);
    if (!first) return undefined;
    const tap = scene.taps.find(({ time }) => time >= first.start && time <= first.end);
    return tap?.time ?? first.start + options.landing;
  });
}

/** The strongest change in `[from, to]` that clears the threshold. */
export function strongestChange(
  changes: SceneChange[],
  from: number,
  to: number,
  threshold: number
): SceneChange | undefined {
  return changes
    .filter(({ time, score }) => time >= from && time <= to && score >= threshold)
    .reduce<SceneChange | undefined>(
      (best, change) => (best && best.score >= change.score ? best : change),
      undefined
    );
}

/**
 * Starts each scene after the first on the frame its screen actually appears, and ends the scene
 * before it there, so neither shows a moment of the other. A stretch of the scene before that
 * falls wholly after the change is kept empty, so its number still names it. Scenes whose change
 * can't be found are left as they are. Expects scenes on the footage's clock.
 */
export function snapScenes(
  scenes: Scene[],
  changes: SceneChange[],
  options = defaultSnapOptions
): Scene[] {
  const snapped = structuredClone(scenes);
  expectedChanges(snapped, options).forEach((expected, index) => {
    if (expected === undefined) return;
    const change = strongestChange(changes, expected - reach, expected + reach, options.threshold);
    const scene = snapped[index];
    const previous = snapped[index - 1];
    const first = scene?.ranges.find(keepsFootage);
    if (!change || !first || !previous || change.time >= first.end) return;

    first.start = change.time;
    previous.ranges = previous.ranges.map(({ start, end }) => ({
      start: Math.min(start, change.time),
      end: Math.min(end, change.time),
    }));
  });
  return snapped;
}
