import type { Range, Scene } from './manifest.ts';
import type { Take } from './take.ts';

/** Stretches closer together than this are joined, in seconds: about a frame at 30 fps. */
const contiguity = 1 / 60;

/**
 * Turns a take's kept stretches into each scene's source ranges, in order.
 *
 * Stretches can overlap: a `keepTail` reaches back over the end of the stretch before it. Footage
 * is kept once, by the earlier stretch, so each stretch only counts from where the previous one
 * ended. Taps and drags are filed under their scenes.
 */
export function sceneTimeline(take: Take): Scene[] {
  const scenes: Scene[] = [];
  let keptUntil = 0;

  for (const segment of take.segments) {
    const start = Math.max(segment.start, keptUntil);
    keptUntil = Math.max(keptUntil, segment.end);
    if (segment.end <= start) continue;

    const scene = sceneNamed(segment.scene, scenes);
    appendRange(scene.ranges, { start, end: segment.end });
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

function appendRange(ranges: Range[], range: Range) {
  const last = ranges.at(-1);
  if (last && range.start - last.end < contiguity) last.end = range.end;
  else ranges.push(range);
}

/** How long a scene's kept footage runs, in seconds. */
export function sceneLength(scene: Scene): number {
  return scene.ranges.reduce((total, { start, end }) => total + end - start, 0);
}
