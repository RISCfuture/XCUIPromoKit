import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

/** Lists, in each output folder, the files promokit put there, so it replaces only its own. */
const manifestName = '.promokit-rendered.json';

const Manifest = z.array(
  z
    .string()
    .regex(/^[^/\\]+$/)
    .refine((name) => name !== '..' && name !== '.')
);

/** Empties a staging folder for a new batch of renders. */
export async function prepareStaging(staging: string) {
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
}

/**
 * Moves a finished batch of renders from `staging` into `destination`, replacing the files the last
 * batch put there and leaving anything else alone. Does nothing for an empty batch, so an output
 * nothing was rendered for keeps what it had.
 */
export async function publish(staging: string, destination: string) {
  const rendered = (await readdir(staging).catch(() => [])).filter((file) => !file.startsWith('.'));
  if (rendered.length === 0) return;

  await mkdir(destination, { recursive: true });
  for (const file of await previouslyRendered(destination)) {
    await rm(path.join(destination, file), { force: true });
  }
  for (const file of rendered) {
    await copyFile(path.join(staging, file), path.join(destination, file));
  }
  await writeFile(
    path.join(destination, manifestName),
    `${JSON.stringify(rendered.sort(), null, 2)}\n`
  );
}

async function previouslyRendered(destination: string): Promise<string[]> {
  const text = await readFile(path.join(destination, manifestName), 'utf8').catch(() => undefined);
  return text === undefined ? [] : Manifest.parse(JSON.parse(text));
}
