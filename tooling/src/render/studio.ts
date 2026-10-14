import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import type { Project } from '../config.ts';
import { loadCopy, loadStoryboard } from '../storyboard/load.ts';
import type { Copy, Storyboard } from '../storyboard/schema.ts';
import { creativeFiles, creativeProps } from './creative.ts';
import { entryPoint, previewProps } from './render.ts';
import { stage, type Stage } from './stage.ts';

const toolingDirectory = fileURLToPath(new URL('../..', import.meta.url));

/** What studio opens: one of the storyboard's previews, or one of its creatives. */
export type StudioSubject = { preview?: string } | { creative: string };

/**
 * Opens Remotion Studio, in the first locale, on a preview (the first, if none is named), or on a
 * creative with Apple's art safe area outlined.
 */
export async function studio(project: Project, subject: StudioSubject) {
  const storyboard = await loadStoryboard(project);
  const [locale, copy] = [...(await loadCopy(project))][0] ?? [];
  if (locale === undefined || !copy) throw new Error('promokit.json names no locales');

  const staged = await stage(project, creativeFiles(project, storyboard.creatives));
  const props = path.join(project.workDirectory, 'studio-props.json');
  await writeFile(
    props,
    JSON.stringify(await subjectProps(project, staged, storyboard, subject, locale, copy))
  );
  await execa(
    'remotion',
    ['studio', entryPoint, '--public-dir', staged.directory, '--props', props],
    {
      preferLocal: true,
      localDir: toolingDirectory,
      stdio: 'inherit',
    }
  );
}

async function subjectProps(
  project: Project,
  staged: Stage,
  storyboard: Storyboard,
  subject: StudioSubject,
  locale: string,
  copy: Copy
) {
  if ('creative' in subject) {
    const creative = storyboard.creatives.find(({ id }) => id === subject.creative);
    if (!creative) throw new Error(`No creative “${subject.creative}”`);
    return creativeProps(project, staged, creative, locale, copy, true);
  }
  const { preview: id } = subject;
  const preview =
    id === undefined
      ? storyboard.previews[0]
      : storyboard.previews.find((entry) => entry.id === id);
  if (!preview)
    throw new Error(id === undefined ? 'The storyboard has no previews' : `No preview “${id}”`);
  return previewProps(project, staged, preview, copy);
}
