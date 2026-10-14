import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import type { Highlight } from '../remotion/props.ts';

const length = z.number().nonnegative();

/** The regions `PromoStill.capture` highlighted, in the still's pixels. */
const HighlightsFile = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
  regions: z.array(z.object({ x: length, y: length, width: length, height: length })),
});

/** How the file beside a still that lists its highlighted regions ends, in place of `.png`. */
export const highlightsSuffix = '.highlights.json';

function highlightsPath(still: string) {
  return still.replace(/\.png$/, highlightsSuffix);
}

/** The regions highlighted on `still`, as fractions of its size; none if it has no highlights. */
export async function readHighlights(still: string): Promise<Highlight[]> {
  const json = await readFile(highlightsPath(still), 'utf8').catch(() => undefined);
  if (json === undefined) return [];
  const { width, height, regions } = HighlightsFile.parse(JSON.parse(json));
  return regions.map((region) => ({
    x: region.x / width,
    y: region.y / height,
    width: region.width / width,
    height: region.height / height,
  }));
}
