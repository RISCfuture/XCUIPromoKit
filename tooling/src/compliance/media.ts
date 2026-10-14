import path from 'node:path';
import {
  creativeImageProblem,
  creativeVideoProblem,
  previewFormats,
  type ImageFormat,
  screenshotFormat,
} from '../devices.ts';
import { audioStream, rate, videoStream, type Probe } from '../probe.ts';
import type { Creative } from '../storyboard/schema.ts';
import { error, type Finding } from './finding.ts';

/** Apple's app preview requirements. */
export const previewRules = {
  minimumSeconds: 15,
  maximumSeconds: 30,
  maximumFPS: 30,
  minimumBitrate: 10_000_000,
  maximumBitrate: 12_000_000,
  maximumBytes: 500 * 1024 * 1024,
  maximumPerSize: 3,
} as const;

const previewSizes = Object.values(previewFormats).flatMap(({ width, height }) => [
  `${width}x${height}`,
  `${height}x${width}`,
]);

/** Checks one app preview against Apple's requirements. */
export function checkPreview(file: string, media: Probe): Finding[] {
  const subject = path.basename(file);
  const video = videoStream(media);
  const audio = audioStream(media);
  const seconds = Number(media.format.duration ?? 0);
  const bytes = Number(media.format.size ?? 0);
  const findings: Finding[] = [];
  const fail = (rule: string, message: string) => findings.push(error(subject, rule, message));

  if (!video) {
    fail('video', 'has no video track');
    return findings;
  }
  if (seconds < previewRules.minimumSeconds || seconds > previewRules.maximumSeconds) {
    fail('length', `runs ${seconds.toFixed(2)} s; previews run 15–30 s`);
  }
  const fps = rate(video.avg_frame_rate);
  if (fps > previewRules.maximumFPS + 0.01)
    fail('frame rate', `runs at ${fps.toFixed(2)} fps; at most 30`);
  if (!previewSizes.includes(`${video.width ?? 0}x${video.height ?? 0}`)) {
    fail('size', `is ${video.width ?? 0}×${video.height ?? 0}, not an app preview size`);
  }

  if (video.codec_name === 'h264') {
    const bitrate = Number(video.bit_rate ?? media.format.bit_rate ?? 0);
    if (bitrate < previewRules.minimumBitrate || bitrate > previewRules.maximumBitrate) {
      fail(
        'bitrate',
        `averages ${(bitrate / 1e6).toFixed(1)} Mbps; H.264 previews need 10–12 Mbps`
      );
    }
  } else if (!(video.codec_name === 'prores' && video.profile === 'HQ')) {
    fail('codec', `is ${video.codec_name ?? 'unknown'}; previews are H.264 or ProRes 422 HQ`);
  }
  if (bytes > previewRules.maximumBytes)
    fail('file size', `is ${(bytes / 2 ** 20).toFixed(0)} MB; at most 500 MB`);
  if (audio?.codec_name !== 'aac' || audio.channels !== 2) {
    fail('audio', 'needs a stereo AAC track, even a silent one');
  }
  return findings;
}

/** Checks there are no more than three previews of any one size. */
export function checkPreviewCount(previews: { file: string; media: Probe }[]): Finding[] {
  const bySize = Map.groupBy(previews, ({ media }) => {
    const video = videoStream(media);
    return `${video?.width ?? 0}×${video?.height ?? 0}`;
  });
  return [...bySize].flatMap(([size, group]) =>
    group.length > previewRules.maximumPerSize
      ? [
          error(
            path.dirname(group[0]?.file ?? ''),
            'count',
            `has ${group.length} ${size} previews; at most 3`
          ),
        ]
      : []
  );
}

/** Checks one screenshot's size and that it has no alpha channel. */
export function checkScreenshot(file: string, media: Probe): Finding[] {
  const subject = path.basename(file);
  const image = videoStream(media);
  const findings: Finding[] = [];
  if (!image?.width || !image.height) return [error(subject, 'image', 'is not an image')];

  if (!screenshotFormat({ width: image.width, height: image.height })) {
    findings.push(
      error(subject, 'size', `is ${image.width}×${image.height}, not a screenshot size`)
    );
  }
  if (hasAlpha(image.pix_fmt))
    findings.push(error(subject, 'alpha', `has an alpha channel (${image.pix_fmt ?? ''})`));
  return findings;
}

/** Apple's limits for creative video. */
export const creativeVideoRules = {
  minimumSeconds: 5,
  maximumSeconds: 30,
  frameRates: [30, 60],
} as const;

/** Checks a rendered creative video is the size its slot accepts, at 30 or 60 fps, for 5–30 s. */
export function checkCreativeVideo(file: string, media: Probe, creative: Creative): Finding[] {
  const subject = path.basename(file);
  const video = videoStream(media);
  if (!video?.width || !video.height) return [error(subject, 'video', 'has no video track')];

  const findings: Finding[] = [];
  const size = { width: video.width, height: video.height };
  const problem = creativeVideoProblem(creative.slot, size);
  if (problem) findings.push(error(subject, 'slot', problem));
  const seconds = Number(media.format.duration ?? 0);
  const { minimumSeconds, maximumSeconds, frameRates } = creativeVideoRules;
  if (seconds < minimumSeconds || seconds > maximumSeconds)
    findings.push(
      error(subject, 'length', `runs ${seconds.toFixed(2)} s; creative video runs 5–30 s`)
    );
  const fps = rate(video.avg_frame_rate);
  if (!frameRates.some((allowed) => Math.abs(fps - allowed) < 0.01))
    findings.push(error(subject, 'frame rate', `runs at ${fps.toFixed(2)} fps; 30 or 60`));
  return findings;
}

/** The image formats App Store Connect takes, by ffprobe's codec name. */
const imageFormats: Partial<Record<string, ImageFormat>> = { png: 'png', mjpeg: 'jpg' };

/** Checks a rendered creative image is the size and format its slot accepts, with no alpha. */
export function checkCreative(file: string, media: Probe, creative: Creative): Finding[] {
  const subject = path.basename(file);
  const image = videoStream(media);
  if (!image?.width || !image.height) return [error(subject, 'image', 'is not an image')];

  const findings: Finding[] = [];
  const size = { width: image.width, height: image.height };
  if (size.width !== creative.size.width || size.height !== creative.size.height) {
    findings.push(
      error(
        subject,
        'size',
        `is ${size.width}×${size.height}; the storyboard asks for ${creative.size.width}×${creative.size.height}`
      )
    );
  }
  const format = imageFormats[image.codec_name ?? ''];
  if (format) {
    const problem = creativeImageProblem(creative.slot, size, format);
    if (problem) findings.push(error(subject, 'slot', problem));
  } else {
    findings.push(error(subject, 'format', `is ${image.codec_name ?? 'unknown'}, not PNG or JPG`));
  }
  if (hasAlpha(image.pix_fmt))
    findings.push(error(subject, 'alpha', `has an alpha channel (${image.pix_fmt ?? ''})`));
  return findings;
}

function hasAlpha(pixelFormat: string | undefined) {
  return /^(rgba|bgra|argb|abgr|ya|yuva|gbrap)|a(8|16)?(be|le)?$/.test(pixelFormat ?? '');
}
