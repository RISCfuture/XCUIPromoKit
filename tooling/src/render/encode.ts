import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ffmpeg } from '../process.ts';

/** Apple's app preview limits that the encode aims for. */
export const previewEncoding = {
  fps: 30,
  /** All-intra keeps a mostly still UI above Apple's 10 Mbps floor. */
  videoBitrate: '11M',
  minimumBitrate: '10M',
  maximumBitrate: '12M',
  audioBitrate: '256k',
} as const;

/**
 * Encodes a rendered preview the way App Store Connect accepts it: H.264 High at 30 fps between
 * 10 and 12 Mbps, with the silent stereo AAC track Apple requires. The video is encoded in two
 * passes, so its average lands on the target rather than sinking to the floor on a mostly still
 * picture.
 */
export async function encodePreview(source: string, destination: string) {
  const passes = await mkdtemp(path.join(tmpdir(), 'promokit-encode-'));
  const log = path.join(passes, 'pass');
  try {
    await ffmpeg(['-i', source, ...videoOptions(log, 1), '-an', '-f', 'null', '-']);
    await ffmpeg([
      '-i',
      source,
      '-f',
      'lavfi',
      '-i',
      'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-map',
      '0:v',
      '-map',
      '1:a',
      ...videoOptions(log, 2),
      '-c:a',
      'aac',
      '-b:a',
      previewEncoding.audioBitrate,
      '-shortest',
      '-movflags',
      '+faststart',
      destination,
    ]);
  } finally {
    await rm(passes, { recursive: true, force: true });
  }
}

/** The video options for one pass of `encodePreview`, sharing `log` between the passes. */
function videoOptions(log: string, pass: 1 | 2): string[] {
  const { fps, videoBitrate, minimumBitrate, maximumBitrate } = previewEncoding;
  return [
    '-c:v',
    'libx264',
    '-profile:v',
    'high',
    '-level:v',
    '4.0',
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(fps),
    '-g',
    '1',
    '-b:v',
    videoBitrate,
    '-minrate',
    minimumBitrate,
    '-maxrate',
    maximumBitrate,
    '-bufsize',
    maximumBitrate,
    '-pass',
    String(pass),
    '-passlogfile',
    log,
  ];
}

/**
 * Encodes a rendered creative video as H.264 High at a constant quality, with a silent stereo AAC
 * track. Apple publishes no codec or bitrate for creative video, so the encode aims for quality
 * rather than a bitrate, and lets the level follow the size.
 */
export async function encodeCreativeVideo(source: string, destination: string) {
  await ffmpeg([
    '-i',
    source,
    '-f',
    'lavfi',
    '-i',
    'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-map',
    '0:v',
    '-map',
    '1:a',
    '-c:v',
    'libx264',
    '-profile:v',
    'high',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '14',
    '-preset',
    'slow',
    '-c:a',
    'aac',
    '-b:a',
    previewEncoding.audioBitrate,
    '-shortest',
    '-movflags',
    '+faststart',
    destination,
  ]);
}

/** Rewrites a PNG without an alpha channel, which App Store Connect rejects. */
export async function flattenImage(source: string, destination: string) {
  await ffmpeg([
    '-i',
    source,
    '-vf',
    'format=rgb24',
    '-frames:v',
    '1',
    '-update',
    '1',
    destination,
  ]);
}
