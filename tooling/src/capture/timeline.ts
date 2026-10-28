import type { Scene } from './manifest.ts';
import type { Take } from './take.ts';

/**
 * Turns a take's kept stretches into each scene's source ranges, in order: one range for each
 * stretch the test kept, so a storyboard's stretch numbers follow the test's actions, however
 * the recording timed them.
 *
 * Stretches can overlap: a `keepTail` reaches back over the end of the stretch before it. Footage
 * is kept once, by the earlier stretch, so each stretch only counts from where the previous one
 * ended, and one wholly inside another is kept empty. Taps and drags are filed under their scenes.
 */
export function sceneTimeline(take: Take): Scene[] {
  const scenes: Scene[] = [];
  let keptUntil = 0;

  for (const segment of take.segments) {
    const start = Math.max(segment.start, keptUntil);
    sceneNamed(segment.scene, scenes).ranges.push({ start, end: Math.max(start, segment.end) });
    keptUntil = Math.max(keptUntil, segment.end);
  }

  for (const tap of take.taps) {
    scenes
      .find(({ name }) => name === tap.scene)
      ?.taps.push({ time: tap.time, x: tap.x, y: tap.y });
  }
  for (const { scene, ...drag } of take.drags) {
    scenes.find(({ name }) => name === scene)?.drags.push(drag);
  }
  return scenes;
}

function sceneNamed(name: string, scenes: Scene[]): Scene {
  const last = scenes.at(-1);
  if (last?.name === name) return last;
  if (scenes.some((scene) => scene.name === name)) {
    throw new Error(
      `Scene “${name}” comes back after another scene; give each stretch its own name`
    );
  }
  const scene: Scene = { name, ranges: [], taps: [], drags: [] };
  scenes.push(scene);
  return scene;
}

/** How long a scene's kept footage runs, in seconds. */
export function sceneLength(scene: Scene): number {
  return scene.ranges.reduce((total, { start, end }) => total + end - start, 0);
}
