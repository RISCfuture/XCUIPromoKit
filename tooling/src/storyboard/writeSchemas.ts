import { writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { Config } from '../config.ts';
import { Copy, Storyboard } from './schema.ts';

/** Writes JSON Schemas for promokit.json, storyboard.json and copy files, for editors and agents. */
const schemas = {
  'promokit.schema.json': Config,
  'storyboard.schema.json': Storyboard,
  'copy.schema.json': Copy,
};

for (const [file, schema] of Object.entries(schemas)) {
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
  await writeFile(
    new URL(`../../schema/${file}`, import.meta.url),
    `${JSON.stringify(json, null, 2)}\n`
  );
}
