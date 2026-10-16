import { mkdir, readdir, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { Project } from '../config.ts';
import { slug } from '../devices.ts';
import { macDevice } from '../render/render.ts';
import { run, say } from '../process.ts';
import { bootOwnedSimulator, setAppearance } from './simulators.ts';
import { buildForTesting, testWithoutBuilding } from './xcodebuild.ts';

const stillVariable = 'PROMO_STILL_DIRECTORY';
const localeVariable = 'PROMO_LOCALE';
const macCaptureVariable = 'PROMO_MAC_CAPTURE';

/** Where one device's stills for one locale go: `.build/promo/stills/<locale>/<device>`. */
export function stillsDirectory(project: Project, locale: string, device: string) {
  return path.join(project.workDirectory, 'stills', locale, device);
}

/**
 * Captures stills on each configured device, in each appearance and locale, on the app's own
 * simulators. Fails if any run leaves no stills: xcodebuild can report success for a run that
 * captured nothing.
 */
export async function captureStills(project: Project) {
  const { stills, locales, app } = project.config;
  if (!stills) throw new Error('promokit.json has no stills');

  for (const deviceType of stills.devices) {
    const udid = await bootOwnedSimulator(app, deviceType, stills.runtime);
    const destination = `id=${udid}`;
    await buildForTesting(project, destination);

    for (const appearance of stills.appearances) {
      await setAppearance(udid, appearance);
      for (const locale of locales) {
        const device =
          appearance === 'light' ? slug(deviceType) : `${slug(deviceType)}-${appearance}`;
        const directory = stillsDirectory(project, locale, device);
        await rm(directory, { recursive: true, force: true });
        await mkdir(directory, { recursive: true });

        say(`capturing ${locale} stills on ${deviceType} (${appearance})`);
        await testWithoutBuilding(project, {
          destination,
          test: stills.test,
          environment: { [stillVariable]: directory, [localeVariable]: locale },
          extraArguments: localeArguments(locale),
        });
        await expectStills(directory);
      }
    }
  }
}

/**
 * Captures the Mac stills, which the test attaches to its result bundle, in each locale, telling
 * the test how promokit.json's `mac.capture` asks it to capture windows.
 */
export async function captureMacStills(project: Project) {
  const { mac, locales } = project.config;
  if (!mac) throw new Error('promokit.json has no mac');

  const destination = 'platform=macOS';
  await buildForTesting(project, destination);
  for (const locale of locales) {
    const work = path.join(project.workDirectory, 'mac', locale);
    const bundle = path.join(work, 'stills.xcresult');
    await rm(work, { recursive: true, force: true });
    await mkdir(work, { recursive: true });

    say(`capturing ${locale} Mac stills`);
    await testWithoutBuilding(project, {
      destination,
      test: mac.test,
      environment: { [localeVariable]: locale, [macCaptureVariable]: mac.capture },
      extraArguments: [...localeArguments(locale), '-resultBundlePath', bundle],
    });
    const directory = stillsDirectory(project, locale, macDevice);
    await rm(directory, { recursive: true, force: true });
    await exportAttachments(bundle, path.join(work, 'attachments'), directory);
    await expectStills(directory);
  }
}

function localeArguments(locale: string) {
  const [language, region] = locale.split('-');
  return [
    ...(language ? ['-testLanguage', language] : []),
    ...(region ? ['-testRegion', region] : []),
  ];
}

async function expectStills(directory: string) {
  const count = (await readdir(directory)).filter((file) => file.endsWith('.png')).length;
  if (count === 0) throw new Error(`The test ran but captured no stills into ${directory}`);
  say(`captured ${count} stills`);
}

const AttachmentManifest = z.array(
  z.object({
    attachments: z.array(
      z.object({ exportedFileName: z.string(), suggestedHumanReadableName: z.string() })
    ),
  })
);

/**
 * Exports a result bundle's stills and the files beside them, and files each under the name the test
 * gave it. The exporter inserts an index and a UUID, as in `pilot_0_9D3F….png`, before whatever
 * looks like an extension, so `pilot.highlights` becomes `pilot_0_9D3F….highlights`.
 */
async function exportAttachments(bundle: string, exported: string, directory: string) {
  await run('xcrun', [
    'xcresulttool',
    'export',
    'attachments',
    '--path',
    bundle,
    '--output-path',
    exported,
  ]);
  const manifest = AttachmentManifest.parse(
    JSON.parse(await readFile(path.join(exported, 'manifest.json'), 'utf8'))
  );
  await mkdir(directory, { recursive: true });
  for (const { exportedFileName, suggestedHumanReadableName } of manifest.flatMap(
    ({ attachments }) => attachments
  )) {
    const extension = path.extname(exportedFileName);
    if (!['.png', '.json'].includes(extension)) continue;
    const name = attachmentName(suggestedHumanReadableName, extension);
    await rename(path.join(exported, exportedFileName), path.join(directory, name));
  }
}

/** The file name a test gave an attachment, with the exported file's extension. */
export function attachmentName(suggested: string, extension: string) {
  const name = suggested.replace(/_\d+_[0-9A-F-]{36}/i, '');
  return name.endsWith(extension) ? name : `${name}${extension}`;
}
