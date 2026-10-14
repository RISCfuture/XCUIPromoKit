import type { Creative, DeviceClass } from './storyboard/schema.ts';

export type Size = {
  width: number;
  height: number;
};

/** App preview sizes, and the display type App Store Connect files each under. */
export const previewFormats: Record<DeviceClass, Size & { displayType: string }> = {
  iphone: { width: 886, height: 1920, displayType: 'IPHONE_67' },
  ipad: { width: 1200, height: 1600, displayType: 'IPAD_PRO_3GEN_129' },
  mac: { width: 1920, height: 1080, displayType: 'DESKTOP' },
};

/** Screenshot sizes App Store Connect accepts, portrait (or for the Mac, landscape) first. */
export const screenshotFormats: readonly { name: string; sizes: readonly [number, number][] }[] = [
  {
    name: 'iPhone 6.9"',
    sizes: [
      [1320, 2868],
      [1290, 2796],
      [1260, 2736],
    ],
  },
  {
    name: 'iPhone 6.5"',
    sizes: [
      [1242, 2688],
      [1284, 2778],
    ],
  },
  {
    name: 'iPhone 6.3"',
    sizes: [
      [1206, 2622],
      [1179, 2556],
    ],
  },
  {
    name: 'iPhone 6.1"',
    sizes: [
      [1170, 2532],
      [1125, 2436],
      [1080, 2340],
    ],
  },
  {
    name: 'iPhone Duo',
    sizes: [
      [1398, 2034],
      [2007, 2853],
    ],
  },
  {
    name: 'iPad 13"',
    sizes: [
      [2064, 2752],
      [2048, 2732],
    ],
  },
  {
    name: 'iPad 11"',
    sizes: [
      [1488, 2266],
      [1668, 2420],
      [1668, 2388],
      [1640, 2360],
    ],
  },
  {
    name: 'Mac',
    sizes: [
      [2880, 1800],
      [2560, 1600],
      [1440, 900],
      [1280, 800],
    ],
  },
];

/** The Mac screenshot sizes App Store Connect accepts, all 16:10. */
export const macScreenshotSizes = ['2880x1800', '2560x1600', '1440x900', '1280x800'] as const;

/** The screenshot display type a size belongs to, in either orientation. */
export function screenshotFormat(size: Size): string | undefined {
  return screenshotFormats.find(({ sizes }) =>
    sizes.some(
      ([width, height]) =>
        (size.width === width && size.height === height) ||
        (size.width === height && size.height === width)
    )
  )?.name;
}

/** Which kind of device a simulator device type is. */
export function deviceClass(deviceType: string): DeviceClass {
  if (deviceType.startsWith('iPad')) return 'ipad';
  if (deviceType.startsWith('iPhone')) return 'iphone';
  throw new Error(`Can't tell whether “${deviceType}” is an iPhone or an iPad`);
}

/** A file-name-safe form of a device name, such as `iphone-18-pro-max`. */
export function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** The App Store's creative-asset slots, which iOS 27 and iPadOS 27 added. */
export type CreativeSlot = 'header' | 'search' | 'universal';

export type ImageFormat = 'png' | 'jpg';

/** A rectangle in pixels. */
export type Rectangle = Size & { x: number; y: number };

/** The 16:9 size that can serve as both the product page header and the search-result asset. */
export const universalSize: Size = { width: 5244, height: 2950 };

const headerSize: Size = { width: 3840, height: 1646 };

/** The range of 3:2 sizes a search-result asset may have. */
export const searchRange = {
  smallest: { width: 1920, height: 1280 },
  largest: { width: 3840, height: 2560 },
} as const;

/**
 * Apple's "art safe area" for each creative shape, as drawn in its creative-asset templates: where
 * the focal point survives every device's crop. Search sizes scale theirs from the 3840×2560
 * template.
 */
const safeAreas: { size: Size; area: Rectangle }[] = [
  { size: headerSize, area: { x: 1097, y: 493, width: 1646, height: 661 } },
  { size: searchRange.largest, area: { x: 836, y: 765, width: 2168, height: 1030 } },
  { size: universalSize, area: { x: 1921, y: 660, width: 1402, height: 962 } },
];

const sameSize = (a: Size, b: Size) => a.width === b.width && a.height === b.height;
const isUniversal = (size: Size) => sameSize(size, universalSize);
const isSearchSize = (size: Size) =>
  size.width * 2 === size.height * 3 &&
  size.width >= searchRange.smallest.width &&
  size.width <= searchRange.largest.width;

/**
 * Why `slot` can't be an image of `size` in `format`, or undefined if it can. JPG is accepted only
 * for the 21:9 header, and only PNG for the 16:9 universal size.
 */
export function creativeImageProblem(
  slot: CreativeSlot,
  size: Size,
  format: ImageFormat
): string | undefined {
  const fits = {
    header: sameSize(size, headerSize) || isUniversal(size),
    search: isSearchSize(size) || isUniversal(size),
    universal: isUniversal(size),
  }[slot];
  if (!fits) return `${describe(size)} isn't a ${slot} size; ${creativeSizes[slot]}`;
  if (format === 'jpg' && !sameSize(size, headerSize))
    return 'only the 3840×1646 header may be a JPG; use PNG';
  return undefined;
}

/**
 * Why `slot` can't be a video of `size`, or undefined if it can: a header video is 3840×1646, a
 * search video 3:2, and the universal asset is an image only.
 */
export function creativeVideoProblem(slot: CreativeSlot, size: Size): string | undefined {
  const fits = { header: sameSize(size, headerSize), search: isSearchSize(size), universal: false }[
    slot
  ];
  if (fits) return undefined;
  return slot === 'universal'
    ? 'the universal asset is an image only'
    : `${describe(size)} isn't a ${slot} video size; ${slot === 'header' ? '3840×1646' : '3:2, from 1920×1280 to 3840×2560'}`;
}

const creativeSizes: Record<CreativeSlot, string> = {
  header: '3840×1646, or 5244×2950',
  search: '3:2, from 1920×1280 to 3840×2560, or 5244×2950',
  universal: '5244×2950',
};

/** Apple's art safe area for a creative of `size`, or undefined if Apple draws none for it. */
export function creativeSafeArea(size: Size): Rectangle | undefined {
  const template = safeAreas.find(
    ({ size: shape }) => shape.width * size.height === shape.height * size.width
  );
  if (!template) return undefined;
  const scale = size.width / template.size.width;
  const { x, y, width, height } = template.area;
  return { x: x * scale, y: y * scale, width: width * scale, height: height * scale };
}

function describe({ width, height }: Size) {
  return `${String(width)}×${String(height)}`;
}

/** The still folder a creative's `data-still` names come from: its device, in its appearance. */
export function creativeStillFolder({
  device,
  appearance,
}: Pick<Creative, 'device' | 'appearance'>) {
  return appearance === 'light' ? slug(device) : `${slug(device)}-${appearance}`;
}
