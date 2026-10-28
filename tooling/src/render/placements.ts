import { access, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Creative } from '../storyboard/schema.ts';

/** The placements App Store Connect files creative assets under. */
const placementTypes = {
  header: 'PRODUCT_PAGE_HEADER_ASSET',
  search: 'APP_STORE_SEARCH_RESULTS_ASSET',
} as const;

/**
 * The placement group App Store Connect's reference data gives both placements: one group, holding
 * one asset per localization.
 */
export const placementGroup = 'DEFAULT_PROFILE';

/** Lists, beside the locale folders, every placement a render produced, for deliver. */
export const placementsFileName = 'creative_assets.json';

/**
 * One entry of creative_assets.json, exactly as deliver's `creative_assets` option takes it, but
 * with `path` relative to creative_assets.json. A video carries its poster's time code when the
 * storyboard names a poster; otherwise Apple picks the frame.
 */
export type Placement = {
  locale: string;
  path: string;
  placement_type: (typeof placementTypes)[keyof typeof placementTypes];
  placement_group: typeof placementGroup;
  preview_frame_time_code?: string;
};

/** A creative's file name in its locale folder, from the configured pattern: a video is an MP4. */
export function creativeFileName(creative: Creative, pattern: string): string {
  const fields: Record<string, string> = {
    slot: creative.slot,
    id: creative.id,
    width: String(creative.size.width),
    height: String(creative.size.height),
  };
  const name = pattern.replace(/\{(\w+)\}/g, (_, field: string) => fields[field] ?? '');
  return `${name}.${creative.footage ? 'mp4' : creative.format}`;
}

/**
 * The placements each creative fills, for deliver: a universal asset also fills search unless it
 * says not. `posters` maps a video's path, as listed, to its poster's time code.
 */
export function placements(
  creatives: readonly Creative[],
  locales: readonly string[],
  pattern: string,
  posters: ReadonlyMap<string, string> = new Map()
): Placement[] {
  return locales.flatMap((locale) =>
    creatives.flatMap((creative) => {
      const file = path.posix.join(locale, creativeFileName(creative, pattern));
      const poster = posters.get(file);
      return placementsOf(creative).map((placement) => ({
        locale,
        path: file,
        placement_type: placementTypes[placement],
        placement_group: placementGroup,
        ...(poster && { preview_frame_time_code: poster }),
      }));
    })
  );
}

/** The placements a creative fills: a universal asset fills search too, unless it says not. */
export function placementsOf({ slot, search }: Creative): (keyof typeof placementTypes)[] {
  if (slot !== 'universal') return [slot];
  return search ? ['header', 'search'] : ['header'];
}

/** Writes creative_assets.json into `directory`, the root of the creative output. */
export async function writePlacements(directory: string, entries: Placement[]) {
  await writeFile(
    path.join(directory, placementsFileName),
    `${JSON.stringify(entries, null, 2)}\n`
  );
}

/**
 * Empties an earlier creative_assets.json in `directory`, so deliver uploads nothing a storyboard
 * no longer asks for. Writes none where there was none.
 */
export async function clearPlacements(directory: string) {
  const listing = path.join(directory, placementsFileName);
  const exists = await access(listing).then(
    () => true,
    () => false
  );
  if (exists) await writePlacements(directory, []);
}
