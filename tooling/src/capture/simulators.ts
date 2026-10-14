import { z } from 'zod';
import { slug } from '../devices.ts';
import { run, say } from '../process.ts';

const DeviceList = z.object({
  devices: z.record(z.string(), z.array(z.object({ name: z.string(), udid: z.string() }))),
});

const RuntimeList = z.object({
  runtimes: z.array(z.object({ identifier: z.string(), name: z.string() })),
});

type Simulator = { name: string; udid: string; runtime: string };

/** The status bar every capture shows. */
const statusBar = [
  '--time',
  '9:41',
  '--dataNetwork',
  'wifi',
  '--wifiBars',
  '3',
  '--cellularBars',
  '4',
  '--batteryState',
  'charged',
  '--batteryLevel',
  '100',
];

/** The name of the simulator an app owns for a device type, such as `promokit-FART-iphone-18-pro`. */
export function simulatorName(app: string, deviceType: string) {
  return `promokit-${app}-${slug(deviceType)}`;
}

async function simulators(): Promise<Simulator[]> {
  const output = await run('xcrun', ['simctl', 'list', '--json', 'devices', 'available']);
  return Object.entries(DeviceList.parse(JSON.parse(output)).devices).flatMap(
    ([runtime, devices]) => devices.map((device) => ({ ...device, runtime }))
  );
}

/** The identifier of the installed runtime named or identified as `runtime`. */
async function runtimeIdentifier(runtime: string): Promise<string> {
  const output = await run('xcrun', ['simctl', 'list', '--json', 'runtimes', 'available']);
  const match = RuntimeList.parse(JSON.parse(output)).runtimes.find(
    ({ identifier, name }) => identifier === runtime || name === runtime
  );
  if (!match) throw new Error(`No simulator runtime “${runtime}” is installed`);
  return match.identifier;
}

/**
 * Boots the app's own simulator for `deviceType`, creating it if need be, with the capture status
 * bar. Owning the simulator keeps runs for different apps, or by different sessions, apart. Given a
 * `runtime`, an owned simulator on any other runtime is replaced.
 */
export async function bootOwnedSimulator(
  app: string,
  deviceType: string,
  runtime?: string
): Promise<string> {
  const name = simulatorName(app, deviceType);
  const wanted = runtime === undefined ? undefined : await runtimeIdentifier(runtime);
  const existing = (await simulators()).find((simulator) => simulator.name === name);
  let udid = existing?.udid;
  if (existing && wanted !== undefined && existing.runtime !== wanted) {
    await deleteSimulator(existing);
    udid = undefined;
  }
  if (!udid) {
    say(`creating simulator ${name}`);
    const create = [
      'simctl',
      'create',
      name,
      deviceType,
      ...(wanted === undefined ? [] : [wanted]),
    ];
    udid = (await run('xcrun', create)).trim();
  }
  await run('xcrun', ['simctl', 'bootstatus', udid, '-b']);
  await run('xcrun', ['simctl', 'status_bar', udid, 'override', ...statusBar]);
  return udid;
}

export async function setAppearance(udid: string, appearance: 'light' | 'dark') {
  await run('xcrun', ['simctl', 'ui', udid, 'appearance', appearance]);
}

/** Shuts down and deletes every simulator the app owns. */
export async function deleteOwnedSimulators(app: string) {
  const owned = (await simulators()).filter(({ name }) => name.startsWith(`promokit-${app}-`));
  for (const simulator of owned) await deleteSimulator(simulator);
}

async function deleteSimulator({ name, udid }: Simulator) {
  say(`deleting simulator ${name}`);
  await run('xcrun', ['simctl', 'shutdown', udid]).catch(() => undefined);
  await run('xcrun', ['simctl', 'delete', udid]);
}
