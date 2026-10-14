import { readFile } from 'node:fs/promises';
import { z } from 'zod';

const Point = z.object({ x: z.number(), y: z.number() });

/** The points a drag moves through, at an even speed. */
export const DragPath = z.array(Point).min(2);

/** Reads a straight drag written as `from` and `to` as a two-point `path`. */
export function withDragPath(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || 'path' in value) return value;
  const { from, to, ...rest } = value as { from?: unknown; to?: unknown };
  return { ...rest, path: [from, to] };
}

/** A screenshot's file name, beside take.json. */
const Screenshot = z.string().regex(/^[\w-]+\.png$/, 'a PNG file name, with no folder');

/** take.json, as XCUIPromoKit's PromoTake writes it. Times are by the test's clock. */
export const Take = z.object({
  version: z.literal(1),
  screen: z.object({ width: z.number().positive(), height: z.number().positive() }),
  segments: z.array(
    z.object({
      scene: z.string(),
      start: z.number().nonnegative(),
      end: z.number().nonnegative(),
      activity: z
        .object({
          start: z.number(),
          end: z.number(),
          landing: z.number().nonnegative(),
          settle: z.number().nonnegative(),
        })
        .optional()
        .describe('When an action ran, for narrowing the stretch to what it changed.'),
    })
  ),
  taps: z.array(z.object({ scene: z.string(), time: z.number(), x: z.number(), y: z.number() })),
  drags: z
    .array(
      z.preprocess(
        withDragPath,
        z.object({
          scene: z.string(),
          start: z.number().describe('When the finger starts moving.'),
          press: z.number().nonnegative(),
          duration: z.number().nonnegative(),
          hold: z.number().nonnegative(),
          path: DragPath,
        })
      )
    )
    .default([]),
  heldFrames: z
    .array(z.object({ file: Screenshot, start: z.number(), end: z.number() }))
    .default([])
    .describe('Screenshots, beside take.json, to show in place of the footage.'),
  closingShots: z
    .array(z.object({ scene: z.string(), file: Screenshot }))
    .default([])
    .describe('Screenshots, beside take.json, of the screen as each scene finished.'),
  recordings: z
    .array(z.object({ scene: z.string(), start: z.number() }))
    .default([])
    .describe('When the host started filming each scene, each to its own file.'),
});
export type Take = z.infer<typeof Take>;

export async function readTake(file: string): Promise<Take> {
  return Take.parse(JSON.parse(await readFile(file, 'utf8')));
}
