import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { readManifest, type Manifest } from '../capture/manifest.ts';
import { takeFiles } from '../capture/prepare.ts';
import type { Project } from '../config.ts';
import { probe } from '../probe.ts';
import { creativeFileName } from '../render/placements.ts';
import { highlightsSuffix, readHighlights } from '../render/highlights.ts';
import { outputDirectory } from '../render/render.ts';
import { readWindow, windowSuffix } from '../render/window.ts';
import type { Copy, Storyboard } from '../storyboard/schema.ts';
import { plainText } from '../storyboard/markup.ts';
import { lintCopy } from './copy.ts';
import { error, warning, type Finding } from './finding.ts';
import { checkIntegrity } from './integrity.ts';
import {
  checkCreative,
  checkCreativeVideo,
  checkPreview,
  checkPreviewCount,
  checkScreenshot,
} from './media.ts';

/** Runs every compliance check over the storyboard, its copy, and what's been rendered. */
export async function check(
  project: Project,
  storyboard: Storyboard,
  copy: Map<string, Copy>
): Promise<Finding[]> {
  const findings = [
    ...[...copy].flatMap(([locale, entries]) =>
      Object.entries(entries).flatMap(([id, text]) =>
        lintCopy(`copy.${locale}.json: ${id}`, plainText(text))
      )
    ),
    ...checkIntegrity({
      config: project.config,
      storyboard,
      copy,
      manifests: await manifests(project),
      stills: await stillNames(project),
      stillFolders: await stillFolders(project),
      screenshotFiles: await screenshotFiles(project, storyboard),
      templates: await templates(project, storyboard),
    }),
    ...(await checkStillFiles(project)),
  ];

  for (const locale of project.config.locales) {
    const previews = await files(outputDirectory(project, 'previews', locale), /\.(mp4|mov)$/);
    const probed = await Promise.all(
      previews.map(async (file) => ({ file, media: await probe(file) }))
    );
    findings.push(
      ...probed.flatMap(({ file, media }) => checkPreview(file, media)),
      ...checkPreviewCount(probed)
    );

    for (const output of ['screenshots', 'macScreenshots'] as const) {
      for (const file of await files(outputDirectory(project, output, locale), /\.(png|jpe?g)$/i)) {
        findings.push(...checkScreenshot(file, await probe(file)));
      }
    }

    for (const creative of storyboard.creatives) {
      const name = creativeFileName(creative, project.config.creativeNames);
      const file = path.join(outputDirectory(project, 'creatives', locale), name);
      const media = await probe(file).catch(() => undefined);
      if (!media) {
        findings.push(
          warning(`creative ${creative.id}`, 'render', `${locale} hasn't been rendered`)
        );
        continue;
      }
      const checkMedia = creative.footage ? checkCreativeVideo : checkCreative;
      findings.push(...checkMedia(file, media, creative));
    }
  }
  return findings;
}

/** The screenshot files the storyboard names that exist. */
async function screenshotFiles(project: Project, storyboard: Storyboard) {
  const named = storyboard.screenshots.flatMap(({ file }) => (file === undefined ? [] : [file]));
  const exists = await Promise.all(
    named.map((file) =>
      access(project.resolve(file)).then(
        () => true,
        () => false
      )
    )
  );
  return new Set(named.filter((_, index) => exists[index]));
}

/** Flags files among the stills that render can't use, and highlights or window sizes it can't read. */
async function checkStillFiles(project: Project): Promise<Finding[]> {
  const root = path.join(project.workDirectory, 'stills');
  const findings: Finding[] = [];
  for (const file of await files(root, /./, true)) {
    const subject = path.relative(root, file);
    if (file.endsWith(highlightsSuffix)) {
      await readHighlights(stillBeside(file, highlightsSuffix)).catch(() =>
        findings.push(error(subject, 'highlights', "isn't a list of regions promokit can read"))
      );
    } else if (file.endsWith(windowSuffix)) {
      await readWindow(stillBeside(file, windowSuffix)).catch(() =>
        findings.push(error(subject, 'window', "isn't a window size promokit can read"))
      );
    } else if (!file.endsWith('.png')) {
      findings.push(warning(subject, 'still', 'is neither a still nor a file beside one'));
    }
  }
  return findings;
}

function stillBeside(file: string, suffix: string) {
  return file.slice(0, -suffix.length) + '.png';
}

/** Each creative's template, by creative id; undefined where it can't be read. */
async function templates(project: Project, storyboard: Storyboard) {
  return new Map(
    await Promise.all(
      storyboard.creatives.map(
        async ({ id, template }) =>
          [id, await readFile(project.resolve(template), 'utf8').catch(() => undefined)] as const
      )
    )
  );
}

/** The still names in each captured folder, keyed `<locale>/<device folder>`. */
async function stillFolders(project: Project): Promise<Map<string, Set<string>>> {
  const root = path.join(project.workDirectory, 'stills');
  const pngs = await files(root, /\.png$/, true);
  const folders = Map.groupBy(pngs, (file) => path.relative(root, path.dirname(file)));
  return new Map(
    [...folders].map(([folder, list]) => [
      folder.split(path.sep).join('/'),
      new Set(list.map((file) => path.basename(file, '.png'))),
    ])
  );
}

async function manifests(project: Project): Promise<Map<string, Manifest>> {
  const entries = await Promise.all(
    Object.keys(project.config.takes).map(async (name) => {
      const file = path.join(project.workDirectory, 'takes', name, takeFiles.manifest);
      return [name, await readManifest(file).catch(() => undefined)] as const;
    })
  );
  return new Map(
    entries.flatMap(([name, manifest]) => (manifest ? [[name, manifest] as const] : []))
  );
}

async function stillNames(project: Project): Promise<Set<string>> {
  const pngs = await files(path.join(project.workDirectory, 'stills'), /\.png$/, true);
  return new Set(pngs.map((file) => path.basename(file, '.png')));
}

async function files(directory: string, pattern: RegExp, recursive = false): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true, recursive }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile() && pattern.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort();
}

/** Prints findings as a table, or as JSON for agents. */
export function report(findings: Finding[], json: boolean) {
  if (json) {
    console.log(JSON.stringify(findings, null, 2));
    return;
  }
  if (findings.length === 0) {
    console.log('All checks pass.');
    return;
  }
  for (const { severity, subject, rule, message } of findings) {
    console.log(`${severity === 'error' ? '✗' : '!'} ${subject} — ${rule}: ${message}`);
  }
  const errors = findings.filter(({ severity }) => severity === 'error').length;
  console.log(`\n${errors} errors, ${findings.length - errors} warnings`);
}
