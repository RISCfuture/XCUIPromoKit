import path from 'node:path';
import { execa } from 'execa';
import { xcodeTarget, type Project } from '../config.ts';
import { run, say } from '../process.ts';

/** Builds the app and its tests for `destination`, into promokit's own DerivedData. */
export async function buildForTesting(project: Project, destination: string) {
  say(`building for ${destination}`);
  await run('xcodebuild', ['build-for-testing', ...common(project, destination), '-quiet']);
}

export type TestRun = {
  destination: string;
  test: string;
  /** Variables the test sees, without the TEST_RUNNER_ prefix. */
  environment: Record<string, string>;
  extraArguments?: string[];
};

/** Starts one already-built test, passing `environment` through to the test runner. */
export function testWithoutBuilding(
  project: Project,
  { destination, test, environment, extraArguments = [] }: TestRun
) {
  const runnerEnvironment = Object.fromEntries(
    Object.entries(environment).map(([key, value]) => [`TEST_RUNNER_${key}`, value])
  );
  return execa(
    'xcodebuild',
    [
      'test-without-building',
      ...common(project, destination),
      '-only-testing',
      test,
      '-collect-test-diagnostics',
      'never',
      '-parallel-testing-enabled',
      'NO',
      ...extraArguments,
      '-quiet',
    ],
    { env: runnerEnvironment, stdin: 'ignore', stdout: 'inherit', stderr: 'inherit' }
  );
}

function common(project: Project, destination: string) {
  return [
    ...xcodeTarget(project),
    '-destination',
    destination,
    '-derivedDataPath',
    path.join(project.workDirectory, 'DerivedData'),
    '-clonedSourcePackagesDirPath',
    path.join(project.workDirectory, 'SourcePackages'),
  ];
}
