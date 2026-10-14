import { copyFile, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execa, type ResultPromise } from 'execa';
import type { Project } from '../config.ts';
import { say } from '../process.ts';
import { sceneRecording, takeFiles } from './prepare.ts';
import { readTake } from './take.ts';
import { bootOwnedSimulator } from './simulators.ts';
import { waitForAnyFile } from './wait.ts';
import { buildForTesting, testWithoutBuilding } from './xcodebuild.ts';

const markerVariable = 'PROMO_MARKER_DIRECTORY';

/**
 * Records a take: runs its test on the app's own simulator and films each scene the test plays,
 * from when the scene says its opening shot is ready until its steps finish, each to its own file.
 * Returns the take's folder once the test writes take.json.
 */
export async function recordTake(project: Project, name: string): Promise<string> {
  const take = project.config.takes[name];
  if (!take) throw new Error(`promokit.json has no take “${name}”`);

  const directory = path.join(project.workDirectory, 'takes', name);
  const markers = path.join(directory, 'markers');
  await rm(directory, { recursive: true, force: true });
  await mkdir(markers, { recursive: true });

  const udid = await bootOwnedSimulator(project.config.app, take.device, take.runtime);
  const destination = `id=${udid}`;
  await buildForTesting(project, destination);

  say(`playing ${take.test}`);
  const test = testWithoutBuilding(project, {
    destination,
    test: take.test,
    environment: { [markerVariable]: markers },
  });
  let running = true;
  const finished = test.then(
    () => undefined,
    (error: unknown) => (error instanceof Error ? error : new Error(`${take.test} failed`))
  );
  void finished.then(() => (running = false));
  const alive = () => running;

  const marker = (name: string) => path.join(markers, name);
  const written = marker(takeFiles.take);
  let recorder: Recorder | undefined;
  let filmed = 0;
  try {
    for (;;) {
      const ready = marker(`scene-${String(filmed)}-ready`);
      if ((await waitForAnyFile([ready, written], alive)) !== ready) break;
      recorder = await startRecorder(udid, path.join(directory, sceneRecording(filmed)));
      await writeFile(marker(`scene-${String(filmed)}-recording`), '');
      say(`filming scene ${String(filmed + 1)}`);
      await waitForAnyFile([marker(`scene-${String(filmed)}-cut`), written], alive);
      await stopRecorder(recorder);
      recorder = undefined;
      filmed++;
    }
  } catch (error) {
    test.kill();
    await finished;
    throw error;
  } finally {
    if (recorder) await stopRecorder(recorder);
  }
  const failure = await finished;
  if (failure) throw failure;
  for (let index = 0; index < filmed; index++) {
    await expectFootage(path.join(directory, sceneRecording(index)));
  }

  await copyFile(path.join(markers, takeFiles.take), path.join(directory, takeFiles.take));
  const { heldFrames, closingShots } = await readTake(path.join(directory, takeFiles.take));
  for (const { file } of [...heldFrames, ...closingShots]) {
    await copyFile(path.join(markers, file), path.join(directory, file));
  }
  return directory;
}

/** Fails unless the recorder wrote any footage, as it doesn't if the test ran on another simulator. */
async function expectFootage(file: string) {
  const { size } = await stat(file).catch(() => ({ size: 0 }));
  if (size === 0) {
    throw new Error(
      `The recorder captured nothing in ${file}. Did the test run on another simulator, such as a parallel-testing clone?`
    );
  }
}

type Recorder = {
  process: ResultPromise;
};

/** Starts filming the simulator, resolving once the recorder says it has started. */
async function startRecorder(udid: string, file: string): Promise<Recorder> {
  const process = execa(
    'xcrun',
    ['simctl', 'io', udid, 'recordVideo', '--codec=h264', '--force', file],
    {
      stdin: 'ignore',
      reject: false,
    }
  );
  await new Promise<void>((resolve, reject) => {
    process.stderr.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('Recording started')) resolve();
    });
    void process.then(() => {
      reject(new Error('The simulator recorder stopped before it started recording'));
    });
  });
  return { process };
}

async function stopRecorder({ process }: Recorder) {
  process.kill('SIGINT');
  await process;
}
