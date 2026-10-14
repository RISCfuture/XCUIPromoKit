import { copyFile, link, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import type { Project } from '../config.ts';

/**
 * The public folder Remotion serves while rendering. Brand files keep their places relative to the
 * repository, under `repo/`, so brand.css can reach fonts by the same relative URLs it uses in the
 * repository. So do `files`, such as creative templates' folders. Takes and stills are linked in
 * under `takes/` and `stills/`.
 */
export type Stage = {
  directory: string;
  /** A repository file's path in the public folder. */
  brandPath(file: string): string;
};

export const stagePaths = {
  takes: 'takes',
  stills: 'stills',
  repo: 'repo',
} as const;

/** Rebuilds the public folder for `project`, with `files` (or folders) beside its brand files. */
export async function stage(project: Project, files: readonly string[] = []): Promise<Stage> {
  const directory = path.join(project.workDirectory, 'public');
  const root = path.dirname(path.dirname(project.workDirectory));
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });

  const brandPath = (file: string) =>
    path.posix.join(stagePaths.repo, repositoryPath(root, file).split(path.sep).join('/'));
  const { brand } = project.config;
  for (const file of [...[brand.css, ...brand.assets].map(project.resolve), ...files]) {
    await place(file, path.join(directory, brandPath(file)));
  }
  await place(path.join(project.workDirectory, 'takes'), path.join(directory, stagePaths.takes));
  await place(path.join(project.workDirectory, 'stills'), path.join(directory, stagePaths.stills));
  return { directory, brandPath };
}

/** `file`'s path in the repository at `root`. Throws for a file outside it, which isn't staged. */
function repositoryPath(root: string, file: string) {
  const relative = path.relative(root, file);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(
      `${file} is outside the repository; promokit renders only the repository's files`
    );
  }
  return relative;
}

/** Hard-links a file, or every file in a folder, into place, copying where a link can't be made. */
async function place(source: string, destination: string) {
  const info = await stat(source).catch(() => undefined);
  if (!info) return;
  if (info.isDirectory()) {
    for (const entry of await readdir(source, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const file = path.join(entry.parentPath, entry.name);
      await place(file, path.join(destination, path.relative(source, file)));
    }
    return;
  }
  await mkdir(path.dirname(destination), { recursive: true });
  await link(source, destination).catch(() => copyFile(source, destination));
}
