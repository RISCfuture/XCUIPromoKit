import { access } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

const pollInterval = 100;

/**
 * Waits until `file` exists. Fails if `alive` returns false first: the process that should
 * create it has ended.
 */
export async function waitForFile(file: string, alive: () => boolean) {
  await waitForAnyFile([file], alive);
}

/**
 * Waits until any of `files` exists, and returns the first found. Fails if `alive` returns false
 * first: the process that should create them has ended.
 */
export async function waitForAnyFile(files: string[], alive: () => boolean): Promise<string> {
  for (;;) {
    for (const file of files) if (await exists(file)) return file;
    if (!alive()) throw new Error(`The test ended before ${files.join(' or ')} appeared`);
    await sleep(pollInterval);
  }
}

function exists(file: string) {
  return access(file).then(
    () => true,
    () => false
  );
}
