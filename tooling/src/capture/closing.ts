import path from 'node:path';
import { run } from '../process.ts';
import type { Manifest } from './manifest.ts';
import type { Take } from './take.ts';

/** The side, in pixels, of the blocks two screens are compared by. */
const block = 8;

/**
 * The largest difference in mean luma, out of 255, that a block of the footage may show from the
 * same block of a screenshot and still count as the same screen. Compression leaves about 10.
 */
const sameScreen = 32;

/**
 * The share of the screen's height, from the top, left out of the comparison: the status bar and
 * the Dynamic Island, which the recording shows and XCUITest's screenshots don't.
 */
const statusBar = 0.07;

/**
 * The scenes whose footage ends on a different screen than the app showed as the scene finished:
 * the recorder dropped the frames of their last change.
 */
export async function scenesEndingEarly(
  directory: string,
  take: Take,
  manifest: Manifest
): Promise<string[]> {
  const video = path.join(directory, manifest.video);
  const early: string[] = [];
  for (const { scene, file } of take.closingShots) {
    const last = manifest.scenes.find(({ name }) => name === scene)?.ranges.at(-1);
    if (!last) continue;
    const time = Math.max(last.start, last.end - 1 / manifest.fps);
    const difference = await screenDifference(video, time, path.join(directory, file), manifest);
    if (difference > sameScreen) early.push(scene);
  }
  return early;
}

/** How far the frame of `video` at `time` differs from `screenshot`, in its most changed block. */
async function screenDifference(
  video: string,
  time: number,
  screenshot: string,
  { width, height }: Pick<Manifest, 'width' | 'height'>
): Promise<number> {
  const size = String(block);
  const output = await run('ffmpeg', [
    '-nostdin',
    '-hide_banner',
    '-loglevel',
    'error',
    '-ss',
    time.toFixed(3),
    '-i',
    video,
    '-i',
    screenshot,
    '-filter_complex',
    `[0:v]trim=end_frame=1,format=gray[footage];` +
      `[1:v]scale=${String(width)}:${String(height)},format=gray[shot];` +
      `[footage][shot]blend=all_mode=difference,crop=iw:ih*${String(1 - statusBar)}:0:ih*${String(statusBar)},` +
      `scale=iw/${size}:ih/${size}:flags=area,signalstats,` +
      'metadata=print:key=lavfi.signalstats.YMAX:file=-',
    '-frames:v',
    '1',
    '-f',
    'null',
    '-',
  ]);
  const difference = /signalstats\.YMAX=([\d.]+)/.exec(output)?.[1];
  if (difference === undefined) {
    throw new Error(`Couldn't compare ${screenshot} with the footage at ${time.toFixed(2)} s`);
  }
  return Number(difference);
}
