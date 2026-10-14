import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Project } from '../config.ts';
import { Copy, Storyboard } from './schema.ts';

export const storyboardFileName = 'storyboard.json';

export async function loadStoryboard(project: Project): Promise<Storyboard> {
  const file = path.join(project.directory, storyboardFileName);
  return Storyboard.parse(JSON.parse(await readFile(file, 'utf8')));
}

/** Each locale's copy, from copy.<locale>.json beside the storyboard. */
export async function loadCopy(project: Project): Promise<Map<string, Copy>> {
  const entries = await Promise.all(
    project.config.locales.map(async (locale) => {
      const file = path.join(project.directory, `copy.${locale}.json`);
      return [locale, Copy.parse(JSON.parse(await readFile(file, 'utf8')))] as const;
    })
  );
  return new Map(entries);
}
