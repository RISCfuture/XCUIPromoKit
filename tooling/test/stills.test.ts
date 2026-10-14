import { describe, expect, it } from 'vitest';
import { attachmentName } from '../src/capture/stills.ts';

describe('attachmentName', () => {
  const uuid = '9D3F2A61-0C4B-4E8A-9F1D-7B5E3C2A1F00';

  it('drops the index and UUID the exporter inserts', () => {
    expect(attachmentName(`plan_0_${uuid}.png`, '.png')).toBe('plan.png');
  });

  it('keeps a dotted name, inserted before its last dot, and adds the real extension', () => {
    expect(attachmentName(`override_3_${uuid}.highlights`, '.json')).toBe(
      'override.highlights.json'
    );
  });
});
