import { z } from 'zod';
import { run } from './process.ts';

const Stream = z.object({
  codec_type: z.string(),
  codec_name: z.string().optional(),
  profile: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  pix_fmt: z.string().optional(),
  avg_frame_rate: z.string().optional(),
  r_frame_rate: z.string().optional(),
  channels: z.number().optional(),
  bit_rate: z.string().optional(),
});

const Probe = z.object({
  streams: z.array(Stream),
  format: z.object({
    duration: z.string().optional(),
    size: z.string().optional(),
    bit_rate: z.string().optional(),
    format_name: z.string(),
  }),
});
export type Probe = z.infer<typeof Probe>;
export type Stream = z.infer<typeof Stream>;

/** What ffprobe knows about a media file. */
export async function probe(file: string): Promise<Probe> {
  const output = await run('ffprobe', [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_streams',
    '-show_format',
    file,
  ]);
  return Probe.parse(JSON.parse(output));
}

/** A rate such as `30000/1001` as a number. */
export function rate(fraction: string | undefined): number {
  const [numerator, denominator] = (fraction ?? '0/1').split('/').map(Number);
  return denominator ? (numerator ?? 0) / denominator : 0;
}

export function videoStream(media: Probe): Stream | undefined {
  return media.streams.find(({ codec_type }) => codec_type === 'video');
}

export function audioStream(media: Probe): Stream | undefined {
  return media.streams.find(({ codec_type }) => codec_type === 'audio');
}
