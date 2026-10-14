import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { prepareStaging, publish } from '../src/render/publish.ts';

let staging: string, destination: string;

const stageFiles = async (...names: string[]) => {
  await prepareStaging(staging);
  for (const name of names) await writeFile(path.join(staging, name), name);
};
const published = async () =>
  (await readdir(destination)).filter((file) => !file.startsWith('.')).sort();

beforeEach(async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'promokit-'));
  staging = path.join(root, 'staging');
  destination = path.join(root, 'out');
});

describe('publish', () => {
  it('replaces what it rendered before and leaves everything else alone', async () => {
    await stageFiles('a.png', 'b.png');
    await publish(staging, destination);
    await writeFile(path.join(destination, 'mine.png'), 'kept');

    await stageFiles('a.png', 'c.png');
    await publish(staging, destination);

    expect(await published()).toEqual(['a.png', 'c.png', 'mine.png']);
  });

  it('leaves the folder as it was when nothing was rendered for it', async () => {
    await stageFiles('a.png');
    await publish(staging, destination);

    await stageFiles();
    await publish(staging, destination);

    expect(await published()).toEqual(['a.png']);
  });

  it('refuses a manifest that reaches outside the folder', async () => {
    await stageFiles('a.png');
    await publish(staging, destination);
    await writeFile(
      path.join(destination, '.promokit-rendered.json'),
      JSON.stringify(['../elsewhere.png'])
    );

    await expect(publish(staging, destination)).rejects.toThrow();
  });
});
