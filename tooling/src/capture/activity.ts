import { strongestChange, type SceneChange } from './snap.ts';
import type { Take } from './take.ts';

type Segment = Take['segments'][number];

export type ActivityOptions = {
  /** The least scdet score that counts as a change of screen. A tab switch scores about 7. */
  threshold: number;
  /** How far before and after an action to look for the screen change it caused, in seconds. */
  reach: number;
};

export const defaultActivityOptions: ActivityOptions = { threshold: 5, reach: 2 };

/**
 * The least difference, in luma levels, between consecutive frames that counts as the screen
 * changing. A still screen's frames differ by about 2 through compression; a switch flipping
 * differs by tens.
 */
export const motionThreshold = 6;

/**
 * Reads the output of `tblend=all_mode=difference,signalstats,metadata=print:key=…YMAX`: the
 * times of frames that differ from the one before.
 */
export function parseMotion(output: string, threshold = motionThreshold): number[] {
  const moving: number[] = [];
  let time: number | undefined;
  for (const line of output.split('\n')) {
    const frame = /pts_time:([\d.]+)/.exec(line);
    const difference = /signalstats\.YMAX=([\d.]+)/.exec(line);
    if (frame?.[1]) time = Number(frame[1]);
    else if (difference?.[1] && time !== undefined && Number(difference[1]) >= threshold) {
      moving.push(time);
    }
  }
  return moving;
}

/**
 * How far the footage runs behind the test's clock: the median, over the actions that bring on
 * each scene after the first, of how far outside the action's window its change of screen falls.
 * `undefined` when no such change shows up.
 */
export function estimateLag(
  take: Take,
  changes: SceneChange[],
  options = defaultActivityOptions
): number | undefined {
  const gaps = scenesOpeningActivities(take).flatMap(({ start, end }) => {
    const change = strongestChange(
      changes,
      start - options.reach,
      end + options.reach,
      options.threshold
    );
    if (!change) return [];
    return [Math.min(0, change.time - start) + Math.max(0, change.time - end)];
  });
  return median(gaps);
}

/** The activity of each scene's first action, for every scene after the first. */
function scenesOpeningActivities(take: Take) {
  const openings = new Map<string, NonNullable<Segment['activity']>>();
  for (const { scene, activity } of take.segments) {
    if (activity && !openings.has(scene)) openings.set(scene, activity);
  }
  const first = take.segments[0]?.scene;
  return [...openings].filter(([scene]) => scene !== first).map(([, activity]) => activity);
}

function median(values: number[]): number | undefined {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return undefined;
  return sorted.length % 2
    ? sorted[middle]
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/** The take with every time moved `lag` seconds later, onto the footage's clock. */
export function shiftTake(take: Take, lag: number): Take {
  const shift = (time: number) => Math.max(0, time + lag);
  return {
    ...take,
    segments: take.segments.map((segment) => ({
      ...segment,
      start: shift(segment.start),
      end: shift(segment.end),
      ...(segment.activity && {
        activity: {
          ...segment.activity,
          start: shift(segment.activity.start),
          end: shift(segment.activity.end),
        },
      }),
    })),
    taps: take.taps.map((tap) => ({ ...tap, time: shift(tap.time) })),
    drags: take.drags.map((drag) => ({ ...drag, start: shift(drag.start) })),
    heldFrames: take.heldFrames.map((held) => ({
      ...held,
      start: shift(held.start),
      end: shift(held.end),
    })),
  };
}

/**
 * Narrows each action's stretch to what it changed on screen: from its landing before the first
 * moving frame during the action to its settle after the last. A tap made by the action is marked
 * at that first moving frame, where the touch lands, and a drag starts moving there. Stretches whose action changed nothing keep
 * the times the test gave them. Expects a take already on the footage's clock.
 */
export function narrowToMotion(take: Take, moving: number[]): Take {
  const taps = [...take.taps];
  const drags = [...take.drags];
  const segments = take.segments.map((segment) => {
    const { activity } = segment;
    if (!activity) return segment;
    const during = moving.filter((time) => time >= activity.start && time <= activity.end);
    const first = during[0];
    const last = during.at(-1);
    if (first === undefined || last === undefined) return segment;

    taps.forEach((tap, index) => {
      if (tap.scene === segment.scene && tap.time >= activity.start && tap.time <= segment.end) {
        taps[index] = { ...tap, time: first };
      }
    });
    drags.forEach((drag, index) => {
      const lift = drag.start + drag.duration + drag.hold;
      if (drag.scene === segment.scene && lift >= activity.start && lift <= segment.end) {
        drags[index] = { ...drag, start: first };
      }
    });
    return {
      ...segment,
      start: Math.max(0, first - activity.landing),
      end: last + activity.settle,
    };
  });
  return { ...take, segments, taps, drags };
}

/**
 * The actions whose window shows no change on screen. An action kept with `keepTail` always
 * changes something, so none showing means the recorder dropped the frames.
 */
export function unchangedActions(take: Take, moving: number[]): { scene: string; time: number }[] {
  return take.segments.flatMap(({ scene, activity }) => {
    if (!activity) return [];
    const changed = moving.some((time) => time >= activity.start && time <= activity.end);
    return changed ? [] : [{ scene, time: activity.start }];
  });
}
