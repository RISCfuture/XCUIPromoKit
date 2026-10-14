import { execa, type Options } from 'execa';

/** Runs a command to completion and returns its standard output. */
export async function run(file: string, args: readonly string[], options: Options = {}) {
  const result = await execa(file, args, { ...options, stdin: 'ignore' });
  return String(result.stdout);
}

/** Runs ffmpeg quietly, never letting it read standard input. */
export async function ffmpeg(args: readonly string[]) {
  return run('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', ...args]);
}

/** Prints a progress line. */
export function say(message: string) {
  console.error(`promokit: ${message}`);
}

/** Reports something the user should look into, without stopping. */
export function warn(message: string) {
  console.error(`promokit: warning: ${message}`);
}
