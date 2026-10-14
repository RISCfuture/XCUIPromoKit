import type { Manifest, Range, Scene } from '../capture/manifest.ts';
import { previewFormats } from '../devices.ts';
import type {
  Caption,
  Clip,
  DragMark,
  PreviewProps,
  PreviewSceneProps,
  TapMark,
  TimelineProps,
} from '../remotion/props.ts';
import type { Copy, Preview, PreviewScene, SceneCaption, Speed, Stretch, Trim } from './schema.ts';
import { playedAt, playedLength } from './speed.ts';

/** A stretch of footage kept for a scene, and how fast it plays. */
type KeptRange = Range & { speed?: Speed };

/** A recorded scene as the storyboard edits it. */
type KeptScene = Omit<Scene, 'ranges'> & { ranges: KeptRange[] };

/** What a timeline is edited from: a preview's scenes, or a creative video's. */
export type Timeline = Pick<Preview, 'scenes' | 'taps' | 'captionEntrance' | 'poster'>;

export type TimelineSources = {
  manifest: Manifest;
  copy: Copy;
  /** The normalized take, as a path in the public folder. */
  video: string;
};

export type PreviewSources = TimelineSources & { brandCSS: string };

/** Turns a storyboard preview and its prepared take into the Preview composition's props. */
export function resolvePreview(preview: Preview, sources: PreviewSources): PreviewProps {
  return {
    ...previewFormats[preview.device],
    brandCSS: sources.brandCSS,
    ...resolveTimeline(preview, sources),
  };
}

/** Edits a take's scenes as `timeline` says, and joins them. */
export function resolveTimeline(timeline: Timeline, sources: TimelineSources): TimelineProps {
  const { fps } = sources.manifest;
  const scenes = timeline.scenes.map((scene, index) =>
    resolveScene(scene, index, timeline, sources)
  );
  const overlap = scenes
    .slice(1)
    .reduce((total, { transition }) => total + transitionFrames(transition, fps), 0);

  return {
    fps,
    video: sources.video,
    ...(timeline.taps && { tapTiming: timeline.taps }),
    scenes,
    durationInFrames: scenes.reduce((total, scene) => total + scene.durationInFrames, 0) - overlap,
  };
}

/** How many frames a transition overlaps the scenes either side of it. */
export function transitionFrames(transition: PreviewScene['transition'], fps: number) {
  return transition.type === 'cut' ? 0 : Math.round(transition.duration * fps);
}

function resolveScene(
  scene: PreviewScene,
  index: number,
  timeline: Timeline,
  sources: TimelineSources
): PreviewSceneProps {
  const recorded = sources.manifest.scenes.find(({ name }) => name === scene.scene);
  if (!recorded) throw new Error(`The take has no scene “${scene.scene}”`);

  const { fps } = sources.manifest;
  const chosen = scene.stretches ? selected(recorded, scene.stretches) : recorded;
  const kept = scene.trim ? trimmed(chosen, scene.trim) : chosen;
  const clips = kept.ranges.map((range) => clip(range, fps));
  const entrance = scene.caption?.entrance ?? timeline.captionEntrance;
  return {
    name: scene.scene,
    durationInFrames: clips.reduce((total, { durationInFrames }) => total + durationInFrames, 0),
    clips,
    transition: scene.transition,
    arrivalFrames: index === 0 ? 0 : transitionFrames(scene.transition, fps),
    ...(scene.caption && {
      caption: { ...caption(scene.caption, sources.copy), ...(entrance && { entrance }) },
    }),
    zooms: scene.zoom === undefined ? [] : [scene.zoom].flat(),
    ...(timeline.taps && scene.taps
      ? { taps: tapMarks(kept, fps), drags: dragMarks(kept, fps) }
      : { taps: [], drags: [] }),
  };
}

/** The scene's chosen stretches, in the order given, each trimmed and paced as the storyboard says. */
function selected(scene: KeptScene, stretches: Stretch[]): KeptScene {
  const ranges = stretches.flatMap((stretch) => {
    const { index, trim, speed } = typeof stretch === 'number' ? { index: stretch } : stretch;
    const found = scene.ranges[index];
    if (!found) throw new Error(`“${scene.name}” has no stretch ${String(index)}`);
    const range = speed ? { ...found, speed } : found;
    return trim ? trimmed({ ...scene, ranges: [range] }, trim).ranges : [range];
  });
  return { ...scene, ranges };
}

/** A scene with `trim.start` seconds left out of the front of its footage and `trim.end` out of the back. */
function trimmed(scene: KeptScene, trim: Trim): KeptScene {
  const total = scene.ranges.reduce((sum, { start, end }) => sum + end - start, 0);
  const from = trim.start,
    to = total - trim.end;
  if (to <= from) throw new Error(`Trimming “${scene.name}” leaves none of its footage`);

  let elapsed = 0;
  const ranges = scene.ranges.flatMap((range) => {
    const length = range.end - range.start;
    const keepFrom = Math.max(from - elapsed, 0),
      keepTo = Math.min(to - elapsed, length);
    elapsed += length;
    return keepTo > keepFrom
      ? [{ ...range, start: range.start + keepFrom, end: range.start + keepTo }]
      : [];
  });
  return { ...scene, ranges };
}

function clip({ start, end, speed }: KeptRange, fps: number): Clip {
  const from = Math.round(start * fps);
  const footageFrames = Math.max(1, Math.round(end * fps) - from);
  if (!speed) return { from, durationInFrames: footageFrames };
  const played = playedLength(footageFrames / fps, speed);
  return {
    from,
    durationInFrames: Math.max(1, Math.round(played * fps)),
    speed: { ...speed, footageFrames },
  };
}

function caption({ copy: id, y }: SceneCaption, copy: Copy): Caption {
  const text = copy[id];
  if (text === undefined) throw new Error(`The copy has no “${id}”`);
  return { id, text, y };
}

/** Each tap the scene keeps, at its frame into the scene. Taps in footage that was cut are dropped. */
function tapMarks(scene: KeptScene, fps: number): TapMark[] {
  return scene.taps.flatMap(({ time, x, y }) => {
    const frame = sceneFrame(scene, time, fps);
    return frame === undefined ? [] : [{ frame, x, y }];
  });
}

/** Each drag the scene keeps, from the frame it starts moving. Drags that start in cut footage are dropped. */
function dragMarks(scene: KeptScene, fps: number): DragMark[] {
  return scene.drags.flatMap(({ start, press, duration, hold, path }) => {
    const frame = sceneFrame(scene, start, fps);
    if (frame === undefined) return [];
    const played = (footage: number, length: number) => {
      const end = sceneFrame(scene, footage, fps);
      return end === undefined ? length : Math.abs(end - frame) / fps;
    };
    const moved = played(start + duration, duration);
    return [
      {
        frame,
        press: played(start - press, press),
        duration: moved,
        hold: played(start + duration + hold, duration + hold) - moved,
        path,
      },
    ];
  });
}

/** The frame, into the scene as edited, that shows the footage at `time`; none if it was cut. */
function sceneFrame(scene: KeptScene, time: number, fps: number): number | undefined {
  let elapsed = 0;
  for (const { start, end, speed } of scene.ranges) {
    const length = end - start;
    if (time >= start && time <= end) {
      const into = time - start;
      return Math.round((elapsed + (speed ? playedAt(into, length, speed) : into)) * fps);
    }
    elapsed += speed ? playedLength(length, speed) : length;
  }
  return undefined;
}

/** A poster that falls outside its preview. */
export class PosterError extends Error {}

/** Where a preview's poster falls: its frame, and whether a transition is under way there. */
export type Poster = { frame: number; inTransition: boolean };

/** The frame of `preview`'s poster in its resolved `props`; none if it names no poster. */
export function posterFrame(
  { poster }: Pick<Timeline, 'poster'>,
  props: Pick<TimelineProps, 'scenes' | 'fps'>
): Poster | undefined {
  if (!poster) return undefined;
  const index = props.scenes.findIndex(({ name }) => name === poster.scene);
  const scene = props.scenes[index];
  if (!scene) throw new PosterError(`The preview has no scene “${poster.scene}” for its poster`);

  const before = props.scenes.slice(0, index);
  const arrivals = props.scenes.slice(1, index + 1);
  const start =
    before.reduce((total, { durationInFrames }) => total + durationInFrames, 0) -
    arrivals.reduce((total, { transition }) => total + transitionFrames(transition, props.fps), 0);
  const into = scene.arrivalFrames + Math.round(poster.at * props.fps);
  if (into >= scene.durationInFrames) {
    throw new PosterError(`The poster falls after the end of “${poster.scene}”`);
  }
  const next = props.scenes[index + 1];
  const leaving = next
    ? scene.durationInFrames - transitionFrames(next.transition, props.fps)
    : Infinity;
  return { frame: start + into, inTransition: into >= leaving };
}

/** A frame as an App Store Connect time code, `HH:MM:SS:FF`. */
export function timeCode(frame: number, fps: number): string {
  const seconds = Math.floor(frame / fps);
  const parts = [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
    frame % fps,
  ];
  return parts.map((part) => String(part).padStart(2, '0')).join(':');
}
