import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { DragPath, withDragPath } from './take.ts';

const Range = z.object({ start: z.number(), end: z.number() });
export type Range = z.infer<typeof Range>;

/** Whether a stretch shows any footage of its own; one an earlier stretch covers shows none. */
export function keepsFootage({ start, end }: Range): boolean {
  return end > start;
}

const Tap = z.object({ time: z.number(), x: z.number(), y: z.number() });
export type Tap = z.infer<typeof Tap>;

const Drag = z.preprocess(
  withDragPath,
  z.object({
    start: z.number().describe('When the finger starts moving.'),
    press: z.number().describe('Seconds the finger rests before moving.'),
    duration: z.number().describe('Seconds the finger takes to move.'),
    hold: z.number().describe('Seconds the finger rests before lifting.'),
    path: DragPath.describe('The points the finger moves through, at an even speed.'),
  })
);
export type Drag = z.infer<typeof Drag>;

const Scene = z.object({
  name: z.string(),
  ranges: z.array(Range),
  taps: z.array(Tap),
  drags: z.array(Drag).default([]),
});
export type Scene = z.infer<typeof Scene>;

/**
 * A prepared take: its footage at a constant frame rate, and what to keep of it, scene by scene.
 * Times are seconds into `video`, already corrected for the recorder's lag.
 */
export const Manifest = z.object({
  version: z.literal(1),
  video: z.string().describe('The normalized take, beside the manifest.'),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().positive(),
  duration: z.number().positive(),
  lag: z.number().describe('Seconds the footage ran behind the test clock.'),
  scenes: z.array(Scene),
  unchanged: z
    .array(z.object({ scene: z.string(), time: z.number() }))
    .default([])
    .describe('Actions whose window shows no change on screen: frames the recorder dropped.'),
  endingEarly: z
    .array(z.string())
    .default([])
    .describe(
      'Scenes whose footage ends before the screen the app showed: frames the recorder dropped.'
    ),
});
export type Manifest = z.infer<typeof Manifest>;

export async function readManifest(file: string): Promise<Manifest> {
  return Manifest.parse(JSON.parse(await readFile(file, 'utf8')));
}
