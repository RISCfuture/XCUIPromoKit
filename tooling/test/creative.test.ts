import { describe, expect, it } from 'vitest';
import { creativeSafeArea } from '../src/devices.ts';
import { creativeFileName, placements } from '../src/render/placements.ts';
import { Creative, Storyboard } from '../src/storyboard/schema.ts';

const creative = (fields: Record<string, unknown>) =>
  Creative.safeParse({ id: 'art', template: 'art.html', device: 'iPhone 18 Pro', ...fields });

describe('Creative', () => {
  it.each([
    ['header', '3840x1646', 'png'],
    ['header', '5244x2950', 'png'],
    ['search', '1920x1280', 'png'],
    ['search', '3000x2000', 'png'],
    ['search', '3840x2560', 'jpg'],
    ['search', '5244x2950', 'png'],
    ['universal', '5244x2950', 'png'],
  ])('accepts a %s image at %s as %s', (slot, size, format) => {
    expect(creative({ slot, size, format }).success).toBe(true);
  });

  it.each([
    ['header', '3840x2560', 'png'],
    ['search', '1800x1200', 'png'],
    ['search', '3840x2400', 'png'],
    ['universal', '3840x1646', 'png'],
    ['header', '3840x1646', 'jpg'],
    ['header', '5244x2950', 'jpg'],
    ['search', '5244x2950', 'jpg'],
  ])('refuses a %s image at %s as %s', (slot, size, format) => {
    expect(creative({ slot, size, format }).success).toBe(false);
  });

  const footage = { take: 'loop', scenes: [{ scene: 'opening' }] };

  it.each([
    ['header', '3840x1646', true],
    ['search', '3000x2000', true],
    ['header', '5244x2950', false],
    ['universal', '5244x2950', false],
  ])('takes a %s video at %s: %s', (slot, size, accepted) => {
    expect(creative({ slot, size, footage }).success).toBe(accepted);
  });
});

describe('Storyboard', () => {
  it('refuses two creatives with one id, since the id names the file', () => {
    const header = { id: 'art', slot: 'header', size: '3840x1646', template: 'a', device: 'X' };
    const search = { ...header, slot: 'search', size: '3840x2560' };
    expect(Storyboard.safeParse({ creatives: [header, search] }).success).toBe(false);
  });
});

describe('placements', () => {
  const parse = (fields: Record<string, unknown>) => Creative.parse({ ...fields, device: 'X' });
  const universal = parse({ id: 'wide', slot: 'universal', size: '5244x2950', template: 'a' });
  const header = parse({ id: 'tall', slot: 'header', size: '3840x1646', template: 'b' });

  it('files a universal image under both placements, and each other creative under its own', () => {
    expect(placements([universal, header], ['en-US'], '{slot}-{id}')).toEqual([
      {
        locale: 'en-US',
        path: 'en-US/universal-wide.png',
        placement_type: 'PRODUCT_PAGE_HEADER_ASSET',
        placement_group: 'DEFAULT_PROFILE',
      },
      {
        locale: 'en-US',
        path: 'en-US/universal-wide.png',
        placement_type: 'APP_STORE_SEARCH_RESULTS_ASSET',
        placement_group: 'DEFAULT_PROFILE',
      },
      {
        locale: 'en-US',
        path: 'en-US/header-tall.png',
        placement_type: 'PRODUCT_PAGE_HEADER_ASSET',
        placement_group: 'DEFAULT_PROFILE',
      },
    ]);
  });

  it('lists a video with its poster’s time code, and without one when it has no poster', () => {
    const video = (id: string) =>
      parse({
        id,
        slot: 'header',
        size: '3840x1646',
        template: 'c',
        footage: { take: 'loop', scenes: [{ scene: 'opening' }] },
      });
    const posters = new Map([['en-US/loop.mp4', '00:00:02:15']]);
    expect(
      placements([video('loop'), video('plain')], ['en-US'], '{id}', posters).map(
        ({ path, preview_frame_time_code }) => [path, preview_frame_time_code]
      )
    ).toEqual([
      ['en-US/loop.mp4', '00:00:02:15'],
      ['en-US/plain.mp4', undefined],
    ]);
    expect(creativeFileName(video('loop'), '{id}')).toBe('loop.mp4');
  });

  it('keeps a universal image out of search when it says so', () => {
    const headerOnly = { ...universal, search: false };
    expect(
      placements([headerOnly], ['de-DE'], '{id}').map(({ placement_type }) => placement_type)
    ).toEqual(['PRODUCT_PAGE_HEADER_ASSET']);
  });

  it('names files from the pattern', () => {
    expect(creativeFileName(header, '{id}-{width}x{height}')).toBe('tall-3840x1646.png');
  });
});

describe('creativeSafeArea', () => {
  it('scales the 3840×2560 search template’s safe area to a smaller 3:2 size', () => {
    expect(creativeSafeArea({ width: 1920, height: 1280 })).toEqual({
      x: 418,
      y: 382.5,
      width: 1084,
      height: 515,
    });
  });
});
