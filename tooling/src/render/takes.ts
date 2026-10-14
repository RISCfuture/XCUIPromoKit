import path from 'node:path';
import { readManifest } from '../capture/manifest.ts';
import { takeFiles } from '../capture/prepare.ts';
import type { Project } from '../config.ts';
import { stagePaths } from './stage.ts';

/** A prepared take's manifest, and its normalized footage as a path in the public folder. */
export async function preparedTake(project: Project, take: string) {
  const manifest = await readManifest(
    path.join(project.workDirectory, 'takes', take, takeFiles.manifest)
  );
  return { manifest, video: path.posix.join(stagePaths.takes, take, manifest.video) };
}
