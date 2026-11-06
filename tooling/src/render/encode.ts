import { mkdtemp, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ffmpeg } from '../process.ts';

/**
 * How a rendered master's colours are encoded, for the master and every encode made from it.
 * Remotion's frames are sRGB, and its default colour space converts them to YUV with ffmpeg's
 * BT.601 matrix. Its ProRes names no matrix, and carries the sRGB transfer only where QuickTime
 * ignores it, so QuickTime showed a master lighter than the preview encoded from it.
 */
const colorTags = [
  '-color_primaries',
  'bt709',
  '-color_trc',
  'iec61966-2-1',
  '-colorspace',
  'smpte170m',
];

/** Tags a rendered master with how its colours are encoded, without re-encoding it. */
export async function tagMasterColors(master: string) {
  const tagged = `${master}.tagged.mov`;
  await ffmpeg(['-i', master, '-c', 'copy', ...colorTags, '-movflags', '+write_colr', tagged]);
  await rename(tagged, master);
}

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
    ...colorTags,
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
    ...colorTags,
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
