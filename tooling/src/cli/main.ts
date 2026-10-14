#!/usr/bin/env node
import { access } from 'node:fs/promises';
import path from 'node:path';
import { Command, Option } from 'commander';
import { prepareTake } from '../capture/prepare.ts';
import { recordTake } from '../capture/record.ts';
import { deleteOwnedSimulators } from '../capture/simulators.ts';
import { captureMacStills, captureStills } from '../capture/stills.ts';
import { check, report } from '../compliance/check.ts';
import { configFileName, loadProject, type Project } from '../config.ts';
import { render, type RenderKind } from '../render/render.ts';
import { loadCopy, loadStoryboard } from '../storyboard/load.ts';
import { studio } from '../render/studio.ts';

/** Finds promokit.json in `directory`, or in its `promo` folder. */
async function project(directory: string): Promise<Project> {
  for (const candidate of [directory, path.join(directory, 'promo')]) {
    const found = await access(path.join(candidate, configFileName)).then(
      () => true,
      () => false
    );
    if (found) return loadProject(candidate);
  }
  throw new Error(`No ${configFileName} in ${directory} or its promo folder`);
}

const program = new Command('promokit')
  .description('Records, renders and checks App Store promo media from UI tests.')
  .option('-C, --directory <path>', 'where promokit.json is', process.cwd());

/**
 * Loads the project and works from its folder, where Remotion keeps its browser download, in the
 * folder's node_modules.
 */
async function here(): Promise<Project> {
  const loaded = await project(program.opts<{ directory: string }>().directory);
  process.chdir(loaded.directory);
  return loaded;
}

program
  .command('record')
  .description('record a take on the app’s own simulator, then prepare it')
  .argument('<take>', 'a take named in promokit.json')
  .action(async (take: string) => {
    const loaded = await here();
    await prepareTake(await recordTake(loaded, take));
  });

program
  .command('prepare')
  .description('prepare a recorded take again: normalize, find scene changes, correct for lag')
  .argument('<take>')
  .action(async (take: string) => {
    const loaded = await here();
    await prepareTake(path.join(loaded.workDirectory, 'takes', take));
  });

program
  .command('stills')
  .description('capture stills on each configured simulator, appearance and locale')
  .action(async () => {
    await captureStills(await here());
  });

program
  .command('mac-stills')
  .description('capture Mac stills (hold the machine’s UI lock while this runs)')
  .action(async () => {
    await captureMacStills(await here());
  });

program
  .command('render')
  .description('render previews, screenshots and creative assets into the fastlane folders')
  .addOption(
    new Option('--only <kind>', 'render only one kind').choices([
      'previews',
      'screenshots',
      'creatives',
    ])
  )
  .action(async ({ only }: { only?: RenderKind }) => {
    const loaded = await here();
    await render(
      loaded,
      await loadStoryboard(loaded),
      await loadCopy(loaded),
      only ? [only] : undefined
    );
  });

program
  .command('check')
  .description('check copy, storyboard and rendered media against Apple’s rules')
  .option('--json', 'print findings as JSON')
  .action(async ({ json = false }: { json?: boolean }) => {
    const loaded = await here();
    const findings = await check(loaded, await loadStoryboard(loaded), await loadCopy(loaded));
    report(findings, json);
    if (findings.some(({ severity }) => severity === 'error')) process.exitCode = 1;
  });

program
  .command('studio')
  .description('open Remotion Studio on a preview, or on a creative asset with its safe area')
  .argument('[preview]', 'a preview id; the first if left out')
  .option('--creative <id>', 'open a creative asset instead, outlining Apple’s art safe area')
  .action(async (preview: string | undefined, { creative }: { creative?: string }) => {
    await studio(await here(), creative === undefined ? { preview } : { creative });
  });

program
  .command('clean')
  .description('delete the simulators this app owns')
  .action(async () => {
    await deleteOwnedSimulators((await here()).config.app);
  });

await program.parseAsync();
