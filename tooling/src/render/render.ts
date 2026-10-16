import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import type { VideoConfig } from 'remotion';
import type { MacCapture, Project } from '../config.ts';
import { previewFormats, type Size } from '../devices.ts';
import { say } from '../process.ts';
import { probe, videoStream } from '../probe.ts';
import type { CreativeProps, PreviewProps, ScreenshotLayout } from '../remotion/props.ts';
import { posterFrame, resolvePreview, timeCode } from '../storyboard/resolve.ts';
import type {
  Copy,
  Creative,
  CreativeFootage,
  Preview,
  Screenshot,
  Storyboard,
} from '../storyboard/schema.ts';
import { readHighlights } from './highlights.ts';
import { readWindow } from './window.ts';
import { encodeCreativeVideo, encodePreview, flattenImage } from './encode.ts';
import { creativeFiles, creativeProps, renderCreative } from './creative.ts';
import { clearPlacements, creativeFileName, placements, writePlacements } from './placements.ts';
import { prepareStaging, publish } from './publish.ts';
import { preparedTake } from './takes.ts';
import { stage, stagePaths, type Stage } from './stage.ts';

export const entryPoint = fileURLToPath(new URL('../../src/remotion/index.ts', import.meta.url));

export type RenderKind = 'previews' | 'screenshots' | 'creatives';

/** The folders promokit renders into, as promokit.json names them. */
export type Output = keyof Project['config']['output'];

/** The still folder the Mac's stills are captured into. Its screenshots render apart. */
export const macDevice = 'mac';

type Session = {
  project: Project;
  stage: Stage;
  serveUrl: string;
  copy: Map<string, Copy>;
};

/** Renders the storyboard's previews, screenshots and creative assets into the app's fastlane folders. */
export async function render(
  project: Project,
  storyboard: Storyboard,
  copy: Map<string, Copy>,
  kinds: readonly RenderKind[] = ['previews', 'screenshots', 'creatives']
) {
  const staged = await stage(project, [
    ...creativeFiles(project, storyboard.creatives),
    ...screenshotFiles(project, storyboard.screenshots),
  ]);
  say('bundling the renderer');
  const serveUrl = await bundle({ entryPoint, publicDir: staged.directory });
  const session: Session = { project, stage: staged, serveUrl, copy };

  if (kinds.includes('previews')) await renderPreviews(session, storyboard.previews);
  if (kinds.includes('screenshots')) await renderScreenshots(session, storyboard.screenshots);
  if (kinds.includes('creatives')) await renderCreatives(session, storyboard.creatives);
}

/** Where rendered media goes, for deliver to find. */
export function outputDirectory(project: Project, output: Output, locale: string) {
  return path.join(project.resolve(project.config.output[output]), locale);
}

/** Where renders for one output folder wait until the whole batch has rendered. */
function stagingDirectory(project: Project, output: Output, locale: string) {
  return path.join(project.workDirectory, 'renders', 'staged', output, locale);
}

async function renderPreviews(session: Session, previews: Preview[]) {
  const { project } = session;
  for (const [locale, copy] of session.copy) {
    const staging = stagingDirectory(project, 'previews', locale);
    await prepareStaging(staging);
    const indices = new Map<string, number>();
    for (const preview of previews) {
      const { displayType } = previewFormats[preview.device];
      const index = indices.get(displayType) ?? 0;
      indices.set(displayType, index + 1);
      const name = `${displayType}-${index}-${preview.id}.mp4`;
      await renderPreview(session, preview, copy, path.join(staging, name));
    }
  }
  for (const locale of session.copy.keys()) {
    await publish(
      stagingDirectory(project, 'previews', locale),
      outputDirectory(project, 'previews', locale)
    );
  }
}

/** The Preview composition's props for `preview` in one locale. */
export async function previewProps(project: Project, staged: Stage, preview: Preview, copy: Copy) {
  return resolvePreview(preview, {
    ...(await preparedTake(project, preview.take)),
    copy,
    brandCSS: staged.brandPath(project.resolve(project.config.brand.css)),
  });
}

async function renderPreview(session: Session, preview: Preview, copy: Copy, destination: string) {
  const inputProps = await previewProps(session.project, session.stage, preview, copy);

  const master = path.join(
    session.project.workDirectory,
    'renders',
    `${path.basename(destination, '.mp4')}.mov`
  );
  const composition = await selectComposition({
    serveUrl: session.serveUrl,
    id: 'Preview',
    inputProps,
  });
  say(`rendering ${preview.id} (${(composition.durationInFrames / composition.fps).toFixed(1)} s)`);
  await renderMedia({
    composition,
    serveUrl: session.serveUrl,
    codec: 'prores',
    proResProfile: 'hq',
    outputLocation: master,
    inputProps,
  });

  await encodePreview(master, destination);
  say(`rendered ${path.basename(destination)}`);

  const poster = posterFrame(preview, inputProps);
  if (poster) await renderPoster(session, composition, inputProps, poster.frame, destination);
}

/**
 * Writes the poster's time code beside the preview as `<name>-poster.txt`, for the upload, and its
 * frame as `<name>-poster.png`, for review.
 */
async function renderPoster(
  session: Session,
  composition: VideoConfig,
  inputProps: PreviewProps | CreativeProps,
  frame: number,
  destination: string
) {
  const base = destination.replace(/\.mp4$/, '');
  await writeFile(`${base}-poster.txt`, `${timeCode(frame, composition.fps)}\n`);
  await renderStill({
    composition,
    serveUrl: session.serveUrl,
    frame,
    output: `${base}-poster.png`,
    inputProps,
  });
}

async function renderCreatives(session: Session, creatives: Creative[]) {
  const { project } = session;
  if (creatives.length === 0) {
    await clearPlacements(project.resolve(project.config.output.creatives));
    return;
  }
  const { creativeNames } = project.config;
  for (const [locale, copy] of session.copy) {
    const staging = stagingDirectory(project, 'creatives', locale);
    await prepareStaging(staging);
    for (const creative of creatives) {
      const inputProps = await creativeProps(project, session.stage, creative, locale, copy);
      const destination = path.join(staging, creativeFileName(creative, creativeNames));
      if (creative.footage)
        await renderCreativeVideo(session, creative.footage, inputProps, destination);
      else await renderCreative(session.serveUrl, inputProps, project.workDirectory, destination);
    }
  }
  for (const locale of session.copy.keys()) {
    await publish(
      stagingDirectory(project, 'creatives', locale),
      outputDirectory(project, 'creatives', locale)
    );
  }
  await writePlacements(
    project.resolve(project.config.output.creatives),
    placements(creatives, [...session.copy.keys()], creativeNames)
  );
}

/** Renders a creative video, then writes its poster beside it if the storyboard names one. */
async function renderCreativeVideo(
  session: Session,
  footage: CreativeFootage,
  inputProps: CreativeProps,
  destination: string
) {
  const composition = await selectComposition({
    serveUrl: session.serveUrl,
    id: 'Creative',
    inputProps,
  });
  const master = path.join(
    session.project.workDirectory,
    'renders',
    `${path.basename(destination, '.mp4')}.mov`
  );
  await renderMedia({
    composition,
    serveUrl: session.serveUrl,
    codec: 'prores',
    proResProfile: 'hq',
    outputLocation: master,
    inputProps,
  });
  await encodeCreativeVideo(master, destination);
  say(`rendered ${path.basename(destination)}`);

  const poster = inputProps.footage && posterFrame(footage, inputProps.footage);
  if (poster) await renderPoster(session, composition, inputProps, poster.frame, destination);
}

async function renderScreenshots(session: Session, screenshots: Screenshot[]) {
  const { project } = session;
  const outputs = ['screenshots', 'macScreenshots'] as const;
  for (const [locale, copy] of session.copy) {
    const stills = path.join(project.workDirectory, stagePaths.stills, locale);
    for (const output of outputs) await prepareStaging(stagingDirectory(project, output, locale));
    for (const device of await subfolders(stills)) {
      const output = device === macDevice ? 'macScreenshots' : 'screenshots';
      for (const [index, screenshot] of screenshots.entries()) {
        const still = screenshotImage(session, screenshot, path.join(locale, device));
        const name = `${device}-${String(index).padStart(2, '0')}-${screenshot.id}.png`;
        const destination = path.join(stagingDirectory(project, output, locale), name);
        const canvas = device === macDevice ? macCanvas(project) : undefined;
        await renderScreenshot(session, screenshot, copy, still, destination, canvas);
      }
    }
  }
  for (const locale of session.copy.keys()) {
    for (const output of outputs) {
      await publish(
        stagingDirectory(project, output, locale),
        outputDirectory(project, output, locale)
      );
    }
  }
}

async function renderScreenshot(
  session: Session,
  screenshot: Screenshot,
  copy: Copy,
  still: { path: string; publicPath: string },
  destination: string,
  canvas?: Canvas
) {
  const stream = await probe(still.path)
    .then(videoStream)
    .catch(() => undefined);
  if (!stream?.width || !stream.height) return;
  const { width, height, layout } = canvas ?? screenCanvas(stream.width, stream.height);
  const capture = screenshot.still === undefined ? undefined : canvas?.capture;

  const id = screenshot.caption;
  const text = id === undefined ? undefined : copy[id];
  const caption = id !== undefined && text !== undefined ? { id, text } : undefined;
  const highlights =
    screenshot.highlights && screenshot.still !== undefined ? await readHighlights(still.path) : [];
  const window = capture === 'screen' ? await readWindow(still.path) : undefined;
  const inputProps = {
    brandCSS: session.stage.brandPath(session.project.resolve(session.project.config.brand.css)),
    width,
    height,
    still: still.publicPath,
    layout,
    ...(capture && { capture }),
    ...(window && { window }),
    ...(caption && { caption }),
    ...(highlights.length > 0 && { highlights }),
    ...(screenshot.theme !== undefined && { theme: screenshot.theme }),
  };
  const composition = await selectComposition({
    serveUrl: session.serveUrl,
    id: 'Screenshot',
    inputProps,
  });
  const rendered = path.join(session.project.workDirectory, 'renders', path.basename(destination));
  await renderStill({ composition, serveUrl: session.serveUrl, output: rendered, inputProps });

  await flattenImage(rendered, destination);
  say(`rendered ${path.basename(destination)}`);
}

/** The files screenshots use in place of captured stills. */
function screenshotFiles(project: Project, screenshots: readonly Screenshot[]): string[] {
  return screenshots.flatMap(({ file }) => (file === undefined ? [] : [project.resolve(file)]));
}

/** A screenshot's image: its file, or its still in one locale's device folder. */
function screenshotImage(
  { project, stage: staged }: Session,
  { still, file }: Screenshot,
  folder: string
) {
  if (file !== undefined) {
    const resolved = project.resolve(file);
    return { path: resolved, publicPath: staged.brandPath(resolved) };
  }
  const name = `${still ?? ''}.png`;
  return {
    path: path.join(project.workDirectory, stagePaths.stills, folder, name),
    publicPath: path.posix.join(stagePaths.stills, ...folder.split(path.sep), name),
  };
}

type Canvas = Size & { layout: ScreenshotLayout; capture?: MacCapture };

/**
 * A Mac screenshot lays its window still out on the canvas promokit.json sizes, and frames it as
 * the window was captured.
 */
function macCanvas(project: Project): Canvas {
  const { mac } = project.config;
  if (!mac) throw new Error('There are Mac stills, but promokit.json has no mac to size them');
  return { ...mac.size, layout: 'mac', capture: mac.capture };
}

/** A phone or tablet screenshot is drawn around its whole-screen still, at the still's size. */
function screenCanvas(width: number, height: number): Canvas {
  return { width, height, layout: height / width > 1.5 ? 'phone' : 'tablet' };
}

async function subfolders(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isDirectory())
    .map(({ name }) => name)
    .sort();
}
