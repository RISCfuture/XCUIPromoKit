import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ffmpeg, run, say, warn } from '../process.ts';
import { probe, videoStream } from '../probe.ts';
import {
  estimateLag,
  narrowToMotion,
  parseMotion,
  shiftTake,
  unchangedActions,
} from './activity.ts';
import { scenesEndingEarly } from './closing.ts';
import type { Manifest } from './manifest.ts';
import { parseSceneChanges, snapScenes, type SceneChange } from './snap.ts';
import { changesWithinParts, layOutParts, onFootage, withinParts, type Part } from './parts.ts';
import { readTake, type Take } from './take.ts';
import { sceneTimeline } from './timeline.ts';

export const takeFrameRate = 30;

/** Files in a take's folder. */
export const takeFiles = {
  /** The recording of a take filmed whole, rather than scene by scene. */
  raw: 'raw.mp4',
  take: 'take.json',
  video: 'take.mp4',
  manifest: 'manifest.json',
} as const;

/** The recording of the take's `index`th scene. */
export function sceneRecording(index: number) {
  return `scene-${String(index)}.mp4`;
}

/**
 * Prepares a recorded take for rendering: lays its scenes' recordings end to end at a constant
 * frame rate and their native resolution, finds where the screen changes, moves the test's times
 * onto that footage, corrects them for the recorder's lag, and writes manifest.json.
 */
export async function prepareTake(directory: string): Promise<Manifest> {
  const video = path.join(directory, takeFiles.video);
  const take = await readTake(path.join(directory, takeFiles.take));
  const parts = layOutParts(take, takeFrameRate, takeFiles.raw, sceneRecording).map((part) => ({
    ...part,
    file: path.join(directory, part.file),
  }));
  say(`normalizing ${String(parts.length)} recording(s)`);
  await normalize(parts, video);

  const [media, allChanges, moving] = await Promise.all([
    probe(video),
    detectSceneChanges(video),
    detectMotion(video),
  ]);
  const stream = videoStream(media);
  const duration = Number(media.format.duration);
  if (!stream?.width || !stream.height || !duration) throw new Error(`${video} has no video`);

  const changes = changesWithinParts(allChanges, parts, takeFrameRate);
  const filmed = onFootage(take, parts);
  const lag = estimateLag(filmed, changes);
  if (lag === undefined)
    warn('found no screen changes to measure the recorder’s lag by; assuming none');
  else say(`the recorder ran ${lag.toFixed(2)} s behind the test`);

  const shifted = shiftTake(filmed, lag ?? 0);
  if (shifted.heldFrames.length > 0) {
    say(`holding on ${String(shifted.heldFrames.length)} screenshot(s)`);
    const size = { width: stream.width, height: stream.height };
    const overlays = shifted.heldFrames.map((held) => ({
      ...held,
      file: path.join(directory, held.file),
    }));
    await normalize(parts, video, { size, overlays });
  }

  const unchanged = unchangedActions(shifted, moving);
  for (const { scene, time } of unchanged) {
    warn(
      `“${scene}”: the action at ${time.toFixed(2)} s changed nothing on screen, so the recorder ` +
        'probably dropped its frames. Record the take again.'
    );
  }

  const manifest: Manifest = {
    version: 1,
    video: takeFiles.video,
    width: stream.width,
    height: stream.height,
    fps: takeFrameRate,
    duration,
    lag: lag ?? 0,
    unchanged,
    endingEarly: [],
    scenes: withinParts(snapScenes(sceneTimeline(narrowToMotion(shifted, moving)), changes), parts),
  };
  manifest.endingEarly = await scenesEndingEarly(directory, take, manifest);
  for (const scene of manifest.endingEarly) {
    warn(
      `“${scene}”: the footage ends before the screen the app showed as the scene finished, so ` +
        'the recorder dropped its last change. Record the take again, or end the scene with ' +
        'holdOnScreenshot.'
    );
  }
  describeStretches(manifest);
  await writeFile(
    path.join(directory, takeFiles.manifest),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  return manifest;
}

type HeldFrames = {
  size: { width: number; height: number };
  overlays: Take['heldFrames'];
};

/**
 * Re-encodes the simulator's variable-rate recordings at a constant rate, keeping every pixel,
 * and joins them end to end. Each part is cut to its length, its last frame held if the
 * recording ends sooner: the simulator writes a frame only when the screen changes, so a closing
 * held shot never reaches the file, and holding that frame is faithful. Each held frame's
 * screenshot replaces the footage from its start to its end.
 */
async function normalize(parts: Part[], video: string, held?: HeldFrames) {
  const overlays = held?.overlays ?? [];
  await ffmpeg([
    ...parts.flatMap(({ file }) => ['-i', file]),
    ...overlays.flatMap(({ file }) => ['-i', file]),
    '-filter_complex',
    normalizeFilter(parts, held),
    '-map',
    '[out]',
    '-an',
    '-c:v',
    'libx264',
    '-crf',
    '10',
    '-g',
    String(takeFrameRate / 2),
    video,
  ]);
}

/** The filter graph for `normalize`, reading each part's recording, then each held frame. */
export function normalizeFilter(parts: Pick<Part, 'length'>[], held?: HeldFrames): string {
  const rate = String(takeFrameRate);
  const cutParts = parts.map(
    ({ length }, index) =>
      `[${String(index)}:v]fps=${rate},tpad=stop_mode=clone:stop_duration=${length.toFixed(3)},` +
      `trim=duration=${length.toFixed(3)},setpts=PTS-STARTPTS,format=yuv420p[p${String(index)}]`
  );
  const joined =
    parts.map((_, index) => `[p${String(index)}]`).join('') +
    `concat=n=${String(parts.length)}:v=1:a=0[v0]`;
  const overlays = held?.overlays ?? [];
  const steps = overlays.flatMap(({ start, end }, index) => {
    const input = parts.length + index;
    const output = index + 1 === overlays.length ? 'out' : `v${String(index + 1)}`;
    return [
      `[${String(input)}:v]scale=${String(held?.size.width)}:${String(held?.size.height)},format=yuv420p[h${String(index)}]`,
      `[v${String(index)}][h${String(index)}]overlay=enable='between(t,${start.toFixed(3)},${end.toFixed(3)})'[${output}]`,
    ];
  });
  const graph = [...cutParts, joined, ...steps].join(';');
  return overlays.length > 0 ? graph : graph.replace('[v0]', '[out]');
}

async function detectSceneChanges(video: string): Promise<SceneChange[]> {
  const output = await run('ffmpeg', [
    '-nostdin',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    video,
    '-vf',
    'scdet=threshold=1,metadata=print:key=lavfi.scd.score:file=-',
    '-an',
    '-f',
    'null',
    '-',
  ]);
  return parseSceneChanges(output);
}

/** The times of frames that differ from the one before. */
async function detectMotion(video: string): Promise<number[]> {
  const output = await run('ffmpeg', [
    '-nostdin',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    video,
    '-vf',
    'tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YMAX:file=-',
    '-an',
    '-f',
    'null',
    '-',
  ]);
  return parseMotion(output);
}

/** Lists each scene's stretches by the numbers a storyboard picks them with. */
function describeStretches({ scenes }: Manifest) {
  for (const { name, ranges } of scenes) {
    const stretches = ranges.map(
      ({ start, end }, index) =>
        `${index}: ${start.toFixed(2)}–${end.toFixed(2)} (${(end - start).toFixed(2)} s)`
    );
    say(`${name}  ${stretches.join('  ')}`);
  }
}
