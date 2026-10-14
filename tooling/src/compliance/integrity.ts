import type { Manifest } from '../capture/manifest.ts';
import type { Config } from '../config.ts';
import { creativeStillFolder } from '../devices.ts';
import { placementsOf } from '../render/placements.ts';
import { PosterError, posterFrame, resolveTimeline, type Timeline } from '../storyboard/resolve.ts';
import type { Copy, Creative, Storyboard } from '../storyboard/schema.ts';
import { footageFits, isFootageFit, templateHooks } from '../storyboard/template.ts';
import { error, warning, type Finding } from './finding.ts';

export type Sources = {
  config: Config;
  storyboard: Storyboard;
  copy: Map<string, Copy>;
  /** Prepared takes by name. A take missing here hasn't been recorded. */
  manifests: Map<string, Manifest>;
  /** Every captured still's name, across devices and locales. */
  stills: Set<string>;
  /** The still names captured into each folder, keyed `<locale>/<device folder>`. */
  stillFolders: Map<string, Set<string>>;
  /** The screenshot files, as the storyboard names them, that exist. */
  screenshotFiles: Set<string>;
  /** Each creative's HTML template by creative id, or undefined where the file is missing. */
  templates: Map<string, string | undefined>;
};

/**
 * Checks that everything the storyboard refers to exists: takes, their scenes, copy and stills.
 * Unknown transitions and other malformed entries are caught earlier, when the storyboard is parsed.
 */
export function checkIntegrity({
  config,
  storyboard,
  copy,
  manifests,
  stills,
  stillFolders,
  screenshotFiles,
  templates,
}: Sources): Finding[] {
  const findings: Finding[] = [];
  const requireCopy = (subject: string, id: string | undefined) => {
    findings.push(...missingCopy(subject, id, copy));
  };

  for (const preview of storyboard.previews) {
    findings.push(...checkFootage(`preview ${preview.id}`, preview, { config, manifests, copy }));
  }

  for (const screenshot of storyboard.screenshots) {
    const subject = `screenshot ${screenshot.id}`;
    if (screenshot.still !== undefined && !stills.has(screenshot.still))
      findings.push(warning(subject, 'still', `no still named “${screenshot.still}” was captured`));
    if (screenshot.file !== undefined && !screenshotFiles.has(screenshot.file))
      findings.push(error(subject, 'file', `${screenshot.file} doesn't exist`));
    requireCopy(subject, screenshot.caption);
  }

  for (const creative of storyboard.creatives) {
    const subject = `creative ${creative.id}`;
    if (!config.stills?.devices.includes(creative.device)) {
      findings.push(
        error(subject, 'device', `promokit.json captures no stills on “${creative.device}”`)
      );
    }
    const template = templates.get(creative.id);
    if (template === undefined) {
      findings.push(error(subject, 'template', `${creative.template} doesn't exist`));
      continue;
    }
    const hooks = templateHooks(template);
    for (const id of hooks.copy) requireCopy(subject, id);
    findings.push(...checkFootageBoxes(subject, creative, hooks.footage));
    if (creative.footage) {
      findings.push(...checkFootage(subject, creative.footage, { config, manifests, copy }));
    }
    findings.push(
      ...missingStills(subject, creative, hooks.stills, { locales: config.locales, stillFolders })
    );
  }
  findings.push(...sharedPlacements(storyboard.creatives));
  return findings;
}

/**
 * Warns where several creatives fill the same placement: deliver uploads each to its own placement
 * group, so the Fastfile must give them different groups.
 */
function sharedPlacements(creatives: readonly Creative[]): Finding[] {
  const byPlacement = Map.groupBy(
    creatives.flatMap((creative) =>
      placementsOf(creative).map((placement) => ({ placement, id: creative.id }))
    ),
    ({ placement }) => placement
  );
  return [...byPlacement]
    .filter(([, sharing]) => sharing.length > 1)
    .map(([placement, sharing]) =>
      warning(
        'creatives',
        'placement',
        `${sharing.map(({ id }) => `“${id}”`).join(', ')} all fill the ${placement} placement; give each its own placement group in the Fastfile`
      )
    );
}

/** Warns of each still a creative's template names that wasn't captured for it in some locale. */
function missingStills(
  subject: string,
  creative: Creative,
  names: Set<string>,
  { locales, stillFolders }: { locales: readonly string[]; stillFolders: Map<string, Set<string>> }
): Finding[] {
  const folder = creativeStillFolder(creative);
  return [...names].flatMap((name) =>
    locales
      .filter((locale) => !stillFolders.get(`${locale}/${folder}`)?.has(name))
      .map((locale) =>
        warning(
          subject,
          'still',
          `no still named “${name}” was captured on ${creative.device} (${creative.appearance}, ${locale})`
        )
      )
  );
}

/** Errors for each locale whose copy lacks `id`. */
function missingCopy(subject: string, id: string | undefined, copy: Map<string, Copy>): Finding[] {
  if (id === undefined) return [];
  return [...copy]
    .filter(([, entries]) => entries[id] === undefined)
    .map(([locale]) => error(subject, 'copy', `copy.${locale}.json has no “${id}”`));
}

/**
 * Checks a preview's or creative video's footage: its take is configured and recorded, its scenes
 * and captions exist, the recorder kept every frame, and its poster falls inside a scene.
 */
function checkFootage(
  subject: string,
  footage: Timeline & { take: string },
  { config, manifests, copy }: Pick<Sources, 'config' | 'manifests' | 'copy'>
): Finding[] {
  const findings: Finding[] = [];
  if (!(footage.take in config.takes))
    findings.push(error(subject, 'take', `promokit.json has no take “${footage.take}”`));
  const manifest = manifests.get(footage.take);
  if (!manifest) findings.push(warning(subject, 'take', `“${footage.take}” hasn't been recorded`));
  for (const scene of footage.scenes) {
    if (manifest && !manifest.scenes.some(({ name }) => name === scene.scene)) {
      findings.push(error(subject, 'scene', `the take has no scene “${scene.scene}”`));
    }
    findings.push(...missingCopy(subject, scene.caption?.copy, copy));
  }
  for (const { scene, time } of manifest?.unchanged ?? []) {
    findings.push(
      warning(
        subject,
        'footage',
        `“${scene}”: the action at ${time.toFixed(2)} s shows no change; the recorder may have dropped its frames`
      )
    );
  }
  for (const scene of manifest?.endingEarly ?? []) {
    findings.push(
      warning(
        subject,
        'footage',
        `“${scene}”: the footage ends before the screen the app showed; the recorder may have dropped its last change`
      )
    );
  }
  const [someCopy] = copy.values();
  if (manifest && someCopy) findings.push(...checkPoster(subject, footage, manifest, someCopy));
  return findings;
}

/**
 * Checks a video's template has one `data-footage` box to play in, naming a fit, and an image's
 * has none.
 */
function checkFootageBoxes(subject: string, creative: Creative, values: string[]): Finding[] {
  const boxes = values.length;
  const unknown = values.filter((value) => !isFootageFit(value));
  if (unknown.length > 0) {
    return unknown.map((value) =>
      error(subject, 'template', `data-footage is “${value}”; use one of ${footageFits.join(', ')}`)
    );
  }
  if (creative.footage && boxes !== 1) {
    return [
      error(
        subject,
        'template',
        `a video's template needs exactly one data-footage element; ${creative.template} has ${String(boxes)}`
      ),
    ];
  }
  if (!creative.footage && boxes > 0) {
    return [
      error(
        subject,
        'template',
        `${creative.template} has data-footage, but no footage plays in it`
      ),
    ];
  }
  return [];
}

/** Checks the poster falls inside its scene, and warns if a transition is under way there. */
function checkPoster(
  subject: string,
  timeline: Timeline,
  manifest: Manifest,
  copy: Copy
): Finding[] {
  let poster;
  try {
    const props = resolveTimeline(timeline, { manifest, copy, video: '' });
    poster = posterFrame(timeline, props);
  } catch (problem) {
    return problem instanceof PosterError ? [error(subject, 'poster', problem.message)] : [];
  }
  return poster?.inTransition
    ? [warning(subject, 'poster', 'the poster falls during a transition')]
    : [];
}
