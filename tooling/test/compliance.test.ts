import { describe, expect, it } from 'vitest';
import type { Manifest } from '../src/capture/manifest.ts';
import { Config } from '../src/config.ts';
import { lintCopy } from '../src/compliance/copy.ts';
import { checkIntegrity } from '../src/compliance/integrity.ts';
import {
  checkCreative,
  checkCreativeVideo,
  checkPreview,
  checkPreviewCount,
  checkScreenshot,
} from '../src/compliance/media.ts';
import type { Probe } from '../src/probe.ts';
import { Creative, Storyboard } from '../src/storyboard/schema.ts';

const rules = (findings: { rule: string }[]) => findings.map(({ rule }) => rule);

const compliantPreview: Probe = {
  streams: [
    {
      codec_type: 'video',
      codec_name: 'h264',
      width: 886,
      height: 1920,
      avg_frame_rate: '30/1',
      bit_rate: '11000000',
    },
    { codec_type: 'audio', codec_name: 'aac', channels: 2 },
  ],
  format: { duration: '21.2', size: '29000000', format_name: 'mov,mp4' },
};

describe('lintCopy', () => {
  it('passes plain copy', () => {
    expect(lintCopy('copy', 'Add up the risk before you add power.')).toEqual([]);
  });

  it.each([
    ['Only $4.99 this week', 'price'],
    ['Visit example.com', 'URL'],
    ['FART™', 'symbol'],
    ['Better than on Android', 'platform'],
    ['Free to try', 'free'],
    ['The #1 risk tool', 'claim'],
    ['Ready for Christmas', 'dated'],
    ['An Editor’s Choice app', 'recognition'],
    ['Math for Kids', 'reserved'],
  ])('flags “%s” for %s', (text, rule) => {
    expect(rules(lintCopy('copy', text))).toContain(rule);
  });
});

describe('checkPreview', () => {
  it('passes a preview within Apple’s limits', () => {
    expect(checkPreview('a.mp4', compliantPreview)).toEqual([]);
  });

  it('flags length, bitrate, frame rate, size and a missing audio track', () => {
    const findings = checkPreview('a.mp4', {
      streams: [
        {
          codec_type: 'video',
          codec_name: 'h264',
          width: 1320,
          height: 2868,
          avg_frame_rate: '60/1',
          bit_rate: '4000000',
        },
      ],
      format: { duration: '12', size: '1', format_name: 'mov,mp4' },
    });
    expect(rules(findings).sort()).toEqual(['audio', 'bitrate', 'frame rate', 'length', 'size']);
  });

  it('allows at most three previews of a size', () => {
    const previews = Array.from({ length: 4 }, (_, index) => ({
      file: `p/${index}.mp4`,
      media: compliantPreview,
    }));
    expect(rules(checkPreviewCount(previews))).toEqual(['count']);
    expect(checkPreviewCount(previews.slice(1))).toEqual([]);
  });
});

describe('checkScreenshot', () => {
  const image = (width: number, height: number, pix_fmt: string): Probe => ({
    streams: [{ codec_type: 'video', codec_name: 'png', width, height, pix_fmt }],
    format: { format_name: 'png_pipe' },
  });

  it('passes an opaque screenshot of an accepted size, in either orientation', () => {
    expect(checkScreenshot('a.png', image(1320, 2868, 'rgb24'))).toEqual([]);
    expect(checkScreenshot('a.png', image(2868, 1320, 'rgb24'))).toEqual([]);
  });

  it('flags alpha and an unknown size', () => {
    expect(rules(checkScreenshot('a.png', image(1000, 2000, 'rgba')))).toEqual(['size', 'alpha']);
  });
});

describe('checkCreative', () => {
  const image = (codec_name: string, width: number, height: number, pix_fmt: string): Probe => ({
    streams: [{ codec_type: 'video', codec_name, width, height, pix_fmt }],
    format: { format_name: 'image2' },
  });
  const search = Creative.parse({
    id: 'search',
    slot: 'search',
    size: '3840x2560',
    format: 'jpg',
    template: 'search.html',
    device: 'iPhone 18 Pro Max',
  });

  it('passes an opaque image of the size and format its slot accepts', () => {
    expect(checkCreative('s.jpg', image('mjpeg', 3840, 2560, 'yuvj444p'), search)).toEqual([]);
  });

  it('flags an image that is neither PNG nor JPG', () => {
    expect(rules(checkCreative('s.webp', image('webp', 3840, 2560, 'yuv420p'), search))).toEqual([
      'format',
    ]);
  });

  it('flags a size the storyboard didn’t ask for, a size the slot refuses, and alpha', () => {
    expect(rules(checkCreative('s.png', image('png', 3840, 1646, 'rgba'), search))).toEqual([
      'size',
      'slot',
      'alpha',
    ]);
  });
});

describe('checkCreativeVideo', () => {
  const video = (width: number, height: number, frameRate: string, duration: string): Probe => ({
    streams: [
      { codec_type: 'video', codec_name: 'h264', width, height, avg_frame_rate: frameRate },
    ],
    format: { duration, format_name: 'mov,mp4' },
  });
  const header = Creative.parse({
    id: 'loop',
    slot: 'header',
    size: '3840x1646',
    template: 'header.html',
    device: 'iPhone 18 Pro Max',
    footage: { take: 'loop', scenes: [{ scene: 'opening' }] },
  });

  it('passes a header video at 30 or 60 fps within 5–30 s', () => {
    expect(checkCreativeVideo('h.mp4', video(3840, 1646, '30/1', '12'), header)).toEqual([]);
    expect(checkCreativeVideo('h.mp4', video(3840, 1646, '60/1', '5'), header)).toEqual([]);
  });

  it('holds a search video to 15 s at least', () => {
    const search = { ...header, slot: 'search' as const, size: { width: 3840, height: 2560 } };
    expect(rules(checkCreativeVideo('s.mp4', video(3840, 2560, '30/1', '12'), search))).toEqual([
      'length',
    ]);
    expect(checkCreativeVideo('s.mp4', video(3840, 2560, '30/1', '15'), search)).toEqual([]);
  });

  it('flags a size the slot refuses, the length and the frame rate', () => {
    expect(rules(checkCreativeVideo('h.mp4', video(3840, 2560, '24/1', '31'), header))).toEqual([
      'slot',
      'length',
      'frame rate',
    ]);
  });
});

describe('checkIntegrity', () => {
  const config = Config.parse({
    app: 'Demo',
    project: 'Demo.xcodeproj',
    scheme: 'Promo',
    brand: { css: 'brand.css' },
    takes: { loop: { test: 'Promo/Take/testLoop', device: 'iPhone 18 Pro' } },
    stills: { test: 'Promo/Stills/testStills', devices: ['iPhone 18 Pro'] },
  });
  const manifest: Manifest = {
    version: 1,
    video: 'take.mp4',
    width: 1320,
    height: 2868,
    fps: 30,
    duration: 10,
    lag: 0,
    unchanged: [],
    endingEarly: [],
    scenes: [{ name: 'opening', ranges: [{ start: 0, end: 2 }], taps: [], drags: [] }],
  };
  const storyboard = Storyboard.parse({
    previews: [
      {
        id: 'loop',
        take: 'loop',
        device: 'iphone',
        scenes: [{ scene: 'opening', caption: { copy: 'hello', y: 0.2 } }, { scene: 'closing' }],
      },
    ],
    screenshots: [
      { id: 'results', still: '0-results', caption: 'results' },
      { id: 'finder', file: 'finder.webp' },
    ],
    creatives: [
      {
        id: 'header',
        slot: 'header',
        size: '3840x1646',
        template: 'creative/header.html',
        device: 'iPhone 18 Pro',
      },
      {
        id: 'search',
        slot: 'search',
        size: '3840x2560',
        template: 'creative/search.html',
        device: 'iPad Air',
      },
      {
        id: 'wide',
        slot: 'universal',
        size: '5244x2950',
        template: 'creative/wide.html',
        device: 'iPhone 18 Pro',
      },
      {
        id: 'moving',
        slot: 'search',
        size: '1920x1280',
        template: 'creative/moving.html',
        device: 'iPhone 18 Pro',
        footage: { take: 'loop', scenes: [{ scene: 'opening' }] },
      },
    ],
  });

  it('flags scenes, copy and stills the storyboard names but nothing provides', () => {
    const findings = checkIntegrity({
      config,
      storyboard,
      copy: new Map([['en-US', { hello: 'Hello.' }]]),
      manifests: new Map([['loop', manifest]]),
      stills: new Set(),
      stillFolders: new Map([['en-US/iphone-18-pro', new Set(['results'])]]),
      screenshotFiles: new Set(),
      templates: new Map([
        [
          'header',
          '<h1 data-copy="headline"></h1><img data-still="results"><img data-still="dial">',
        ],
        ['search', undefined],
        ['wide', '<div data-footage="stretch"></div>'],
        ['moving', '<p>No box for the footage.</p>'],
      ]),
    });
    expect(findings.map(({ rule, message }) => `${rule}: ${message}`)).toEqual([
      'scene: the take has no scene “closing”',
      'still: no still named “0-results” was captured',
      'copy: copy.en-US.json has no “results”',
      "file: finder.webp doesn't exist",
      'copy: copy.en-US.json has no “headline”',
      'still: no still named “dial” was captured on iPhone 18 Pro (light, en-US)',
      'device: promokit.json captures no stills on “iPad Air”',
      "template: creative/search.html doesn't exist",
      'template: data-footage is “stretch”; use one of cover, contain, fill, none, scale-down',
      "template: a video's template needs exactly one data-footage element; creative/moving.html has 0",
      'placement: “header”, “wide” all fill the header placement; give each its own placement group in the Fastfile',
      'placement: “search”, “wide”, “moving” all fill the search placement; give each its own placement group in the Fastfile',
    ]);
  });
});
