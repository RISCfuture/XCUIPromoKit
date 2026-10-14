import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { renderStill, selectComposition } from '@remotion/renderer';
import type { Project } from '../config.ts';
import { creativeSafeArea, creativeStillFolder } from '../devices.ts';
import { ffmpeg, say } from '../process.ts';
import type { CreativeProps } from '../remotion/props.ts';
import { resolveTimeline } from '../storyboard/resolve.ts';
import type { Copy, Creative } from '../storyboard/schema.ts';
import { flattenImage } from './encode.ts';
import { stagePaths, type Stage } from './stage.ts';
import { preparedTake } from './takes.ts';

/** The files a creative needs in the public folder: its template's folder and its stylesheets. */
export function creativeFiles(project: Project, creatives: readonly Creative[]): string[] {
  return creatives.flatMap(({ template, css }) => [
    path.dirname(project.resolve(template)),
    ...css.map(project.resolve),
  ]);
}

/** The Creative composition's props for `creative` in `locale`; `guides` outlines the safe area. */
export async function creativeProps(
  project: Project,
  staged: Stage,
  creative: Creative,
  locale: string,
  copy: Copy,
  guides = false
): Promise<CreativeProps> {
  const template = project.resolve(creative.template);
  const safeArea = guides ? creativeSafeArea(creative.size) : undefined;
  return {
    brandCSS: staged.brandPath(project.resolve(project.config.brand.css)),
    ...creative.size,
    slot: creative.slot,
    locale,
    ...(creative.theme !== undefined && { theme: creative.theme }),
    template: await readFile(template, 'utf8'),
    templateBase: staged.brandPath(path.dirname(template)),
    css: creative.css.map((file) => staged.brandPath(project.resolve(file))),
    copy,
    stills: await stillsIn(project, locale, creativeStillFolder(creative)),
    ...(creative.footage && {
      footage: resolveTimeline(creative.footage, {
        ...(await preparedTake(project, creative.footage.take)),
        copy,
      }),
    }),
    ...(safeArea && { safeArea }),
  };
}

/** The stills captured into one locale's device folder, by name, as paths in the public folder. */
async function stillsIn(project: Project, locale: string, folder: string) {
  const directory = path.join(project.workDirectory, stagePaths.stills, locale, folder);
  const files = (await readdir(directory).catch(() => [])).filter((file) => file.endsWith('.png'));
  return Object.fromEntries(
    files.map((file) => [
      path.basename(file, '.png'),
      path.posix.join(stagePaths.stills, locale, folder, file),
    ])
  );
}

/** Renders one creative image to `destination`, flattened, as a PNG or a JPG. */
export async function renderCreative(
  serveUrl: string,
  inputProps: CreativeProps,
  workDirectory: string,
  destination: string
) {
  const composition = await selectComposition({ serveUrl, id: 'Creative', inputProps });
  const rendered = path.join(
    workDirectory,
    'renders',
    `${path.basename(destination, path.extname(destination))}.png`
  );
  await renderStill({ composition, serveUrl, output: rendered, inputProps });
  if (destination.endsWith('.jpg')) await encodeJPEG(rendered, destination);
  else await flattenImage(rendered, destination);
  say(`rendered ${path.basename(destination)}`);
}

async function encodeJPEG(source: string, destination: string) {
  await ffmpeg(['-i', source, '-frames:v', '1', '-update', '1', '-q:v', '1', destination]);
}
