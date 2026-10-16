import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { macScreenshotSizes } from './devices.ts';
import { run } from './process.ts';
import { PixelSize } from './storyboard/schema.ts';

const relativePath = z.string().min(1).describe('Relative to promokit.json.');

const runtime = z
  .string()
  .min(1)
  .optional()
  .describe(
    'The simulator runtime to film on, by name or identifier, such as "iOS 27.0"; the newest if left out.'
  );

/** How the Mac test captures a window: its rectangle of screen, or the window on its own. */
export const MacCapture = z.enum(['screen', 'window']);
export type MacCapture = z.infer<typeof MacCapture>;

export const Take = z
  .object({
    test: z.string().describe('The -only-testing identifier of the test that plays the take.'),
    device: z.string().describe('The simulator device type to film on.'),
    runtime,
  })
  .strict();

export const Config = z
  .object({
    $schema: z.string().optional(),
    app: z
      .string()
      .regex(/^[A-Za-z0-9-]+$/)
      .describe('Names the simulators this app owns.'),
    project: relativePath.optional(),
    workspace: relativePath.optional(),
    scheme: z.string(),
    testPlan: z
      .string()
      .optional()
      .describe("The scheme's test plan holding the capture tests, when it isn't the default."),
    buildSettings: z
      .record(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/), z.string())
      .default({})
      .describe('Build settings to override when building and running the capture tests.'),
    locales: z.array(z.string()).min(1).default(['en-US']),
    brand: z
      .object({
        css: relativePath.describe('Stylesheet defining the --promo-* tokens and fonts.'),
        assets: z.array(relativePath).default([]).describe('Files and folders brand.css uses.'),
      })
      .strict(),
    takes: z.record(z.string(), Take).default({}),
    stills: z
      .object({
        test: z.string(),
        devices: z.array(z.string()).min(1),
        runtime,
        appearances: z.array(z.enum(['light', 'dark'])).default(['light']),
      })
      .strict()
      .optional(),
    mac: z
      .object({
        test: z.string(),
        size: z
          .enum(macScreenshotSizes)
          .default('2880x1800')
          .transform((size) => PixelSize.parse(size))
          .describe('The Mac screenshot canvas, which brand.css lays the window still out in.'),
        capture: MacCapture.default('screen').describe(
          'How PromoStill.capture(_:of:ownedBy:) captures a window: "screen" grabs its rectangle of screen, and render rounds and shadows it; "window" captures it on its own, with its transparency and real corners and shadow, and needs Screen Recording permission for the test runner.'
        ),
      })
      .strict()
      .optional(),
    output: z
      .object({
        previews: relativePath.default('../fastlane/previews'),
        screenshots: relativePath.default('../fastlane/screenshots'),
        macScreenshots: relativePath.default('../fastlane/screenshots_mac'),
        creatives: relativePath
          .default('../fastlane/creative_assets')
          .describe('Also holds creative_assets.json, listing each placement for deliver.'),
      })
      .strict()
      .prefault({})
      .describe('Where deliver looks for media, a folder per locale in each.'),
    creativeNames: z
      .string()
      .regex(/^(?:[A-Za-z0-9._-]|\{(?:slot|id|width|height)\})+$/)
      .refine((pattern) => pattern.includes('{id}'), 'Include {id}, so each name is unique')
      .default('{id}')
      .describe(
        'How creative assets are named, before the extension: {slot}, {id}, {width} and {height} are filled in.'
      ),
  })
  .strict()
  .refine((config) => (config.project === undefined) !== (config.workspace === undefined), {
    message: 'Name exactly one of project and workspace',
  });
export type Config = z.infer<typeof Config>;

/** A loaded configuration, with the places it refers to resolved. */
export type Project = {
  config: Config;
  /** The folder holding promokit.json. */
  directory: string;
  /** Where promokit keeps takes, stills and renders: `.build/promo` in the repository. */
  workDirectory: string;
  resolve: (relative: string) => string;
};

export const configFileName = 'promokit.json';

/** Loads promokit.json from `directory`. */
export async function loadProject(relativeDirectory: string): Promise<Project> {
  const directory = path.resolve(relativeDirectory);
  const file = path.join(directory, configFileName);
  const config = Config.parse(JSON.parse(await readFile(file, 'utf8')));
  const root = (await run('git', ['rev-parse', '--show-toplevel'], { cwd: directory })).trim();
  return {
    config,
    directory,
    workDirectory: path.join(root, '.build', 'promo'),
    resolve: (relative) => path.resolve(directory, relative),
  };
}

/**
 * The xcodebuild arguments naming the project or workspace, the scheme and its test plan, and
 * the build settings to override.
 */
export function xcodeTarget(project: Project): string[] {
  const { config } = project;
  const container =
    config.workspace === undefined
      ? ['-project', project.resolve(config.project ?? '')]
      : ['-workspace', project.resolve(config.workspace)];
  const testPlan = config.testPlan === undefined ? [] : ['-testPlan', config.testPlan];
  const settings = Object.entries(config.buildSettings).map(([key, value]) => `${key}=${value}`);
  return [...container, '-scheme', config.scheme, ...testPlan, ...settings];
}
