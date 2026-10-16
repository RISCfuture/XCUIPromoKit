import { readFile } from 'node:fs/promises';
import { z } from 'zod';

/** A Mac window's size in points, which `PromoStill` saves beside a still it grabs from the screen. */
const WindowFile = z.object({ width: z.number().positive(), height: z.number().positive() });
export type WindowSize = z.infer<typeof WindowFile>;

/** How the file beside a still that gives its window's size ends, in place of `.png`. */
export const windowSuffix = '.window.json';

/** The size of the window grabbed in `still`; undefined if the still isn't a window's grab. */
export async function readWindow(still: string): Promise<WindowSize | undefined> {
  const json = await readFile(still.replace(/\.png$/, windowSuffix), 'utf8').catch(() => undefined);
  return json === undefined ? undefined : WindowFile.parse(JSON.parse(json));
}
