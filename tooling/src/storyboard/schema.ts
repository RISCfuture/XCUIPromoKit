import { z } from 'zod';
import { creativeImageProblem, creativeVideoProblem } from '../devices.ts';

/*
 * The storyboard describes what to render; every stylistic choice in it is the director's. Where a
 * field can be left out, leaving it out means the plainest thing: a cut, a linear pace, a caption
 * that is simply there.
 */

const fraction = z.number().min(0).max(1);
const seconds = z.number().nonnegative();
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);

/** A pace: `linear`, or a CSS-style cubic Bézier's control points `[x1, y1, x2, y2]`. */
export const EasingCurve = z.union([
  z.literal('linear'),
  z.tuple([fraction, z.number(), fraction, z.number()]),
]);
export type EasingCurve = z.infer<typeof EasingCurve>;

export const Direction = z.enum(['left', 'right', 'up', 'down']);
export type Direction = z.infer<typeof Direction>;

/** How one scene gives way to the next. */
export const Transition = z.discriminatedUnion('type', [
  z.object({ type: z.literal('cut') }).strict(),
  z
    .object({
      type: z.literal('dissolve'),
      duration: seconds,
      easing: EasingCurve.default('linear'),
    })
    .strict()
    .describe('The next scene fades in over this one.'),
  z
    .object({
      type: z.literal('fade'),
      duration: seconds,
      easing: EasingCurve.default('linear'),
    })
    .strict()
    .describe('This scene fades out to the background, then the next fades in.'),
  z
    .object({
      type: z.literal('slide'),
      duration: seconds,
      direction: Direction.describe('Which way the content moves.'),
      easing: EasingCurve.default('linear'),
      motionBlur: z
        .number()
        .nonnegative()
        .default(0)
        .describe('Peak blur along the motion, as a fraction of the frame along it.'),
    })
    .strict()
    .describe('The next scene pushes this one out.'),
]);
export type Transition = z.infer<typeof Transition>;

/** One step of an entrance. Properties left out are at rest: in place, upright, opaque, sharp. */
export const Keyframe = z
  .object({
    at: fraction.describe('How far through the entrance.'),
    opacity: fraction.optional(),
    x: z.number().optional().describe('Horizontal offset, in em.'),
    y: z.number().optional().describe('Vertical offset, in em.'),
    scale: z.number().optional(),
    rotate: z.number().optional().describe('Degrees.'),
    skew: z.number().optional().describe('Horizontal skew, in degrees.'),
    blur: z.number().nonnegative().optional().describe('Blur radius, in em.'),
  })
  .strict();
export type Keyframe = z.infer<typeof Keyframe>;

/** How a caption arrives: keyframes played over each unit in turn. */
export const Entrance = z
  .object({
    unit: z.enum(['caption', 'word', 'character']).default('caption'),
    delay: seconds
      .default(0)
      .describe(
        'Seconds after the scene has arrived, its transition done, before the first unit moves.'
      ),
    duration: seconds.describe('Seconds each unit takes.'),
    stagger: seconds.default(0).describe('Seconds between one unit and the next.'),
    easing: EasingCurve.default('linear'),
    keyframes: z.array(Keyframe).min(1),
  })
  .strict();
export type Entrance = z.infer<typeof Entrance>;

export const SceneCaption = z
  .object({
    copy: identifier.describe('A key in copy.<locale>.json.'),
    y: fraction.describe("Where the caption's centre sits, from the top."),
    entrance: Entrance.optional().describe("Overrides the preview's caption entrance."),
  })
  .strict();
export type SceneCaption = z.infer<typeof SceneCaption>;

export const Zoom = z
  .object({
    to: z.number().positive().describe('Scale once the zoom completes; 1 is the full frame.'),
    x: fraction.default(0.5).describe('Horizontal position of the zoom’s point, from the left.'),
    y: fraction.default(0.5).describe('Vertical position of the zoom’s point, from the top.'),
    aim: z
      .enum(['fixed', 'center'])
      .default('fixed')
      .describe(
        'Whether the point stays where it is, or moves as near the centre as the frame allows.'
      ),
    at: seconds
      .default(0)
      .describe('Seconds after the scene has arrived, its transition done, when the zoom starts.'),
    duration: seconds.describe('Seconds the zoom takes.'),
    easing: EasingCurve.default('linear'),
  })
  .strict();
export type Zoom = z.infer<typeof Zoom>;

/** When a tap mark shows: from `before` the finger lifts until `after` it lifts. */
export const TapMarks = z
  .object({
    before: seconds,
    after: seconds,
  })
  .strict();
export type TapMarks = z.infer<typeof TapMarks>;

/** Footage to leave out of a scene, from either end of what the take kept. */
export const Trim = z
  .object({
    start: seconds.default(0).describe('Seconds to leave out from the start.'),
    end: seconds.default(0).describe('Seconds to leave out from the end.'),
  })
  .strict();
export type Trim = z.infer<typeof Trim>;

/** How fast a stretch plays. */
export const Speed = z
  .object({
    rate: z.number().positive().describe('Times real time.'),
    ramp: seconds
      .default(0)
      .describe('Seconds to reach the rate from real time at the start, and to return at the end.'),
  })
  .strict();
export type Speed = z.infer<typeof Speed>;

/** One of the stretches a take kept for a scene, numbered from 0 as `promokit prepare` lists them. */
export const Stretch = z.union([
  z.number().int().nonnegative(),
  z
    .object({
      index: z.number().int().nonnegative(),
      trim: Trim.optional(),
      speed: Speed.optional().describe('How fast the stretch plays; real time if left out.'),
    })
    .strict(),
]);
export type Stretch = z.infer<typeof Stretch>;

export const PreviewScene = z
  .object({
    scene: z.string().min(1).describe('A scene recorded in the take.'),
    stretches: z
      .array(Stretch)
      .min(1)
      .optional()
      .describe(
        'Which stretches to use, in order, each optionally trimmed; all of them if left out.'
      ),
    trim: Trim.optional().describe('Footage to leave out of either end of the scene as edited.'),
    transition: Transition.default({ type: 'cut' }).describe('How this scene arrives.'),
    caption: SceneCaption.optional(),
    zoom: z
      .union([Zoom, z.array(Zoom).min(1)])
      .optional()
      .describe('A zoom, or zooms in turn, each from where the one before left the frame.'),
    taps: z.boolean().default(true).describe('Whether to mark taps, when the preview marks them.'),
  })
  .strict();
export type PreviewScene = z.infer<typeof PreviewScene>;

export const DeviceClass = z.enum(['iphone', 'ipad', 'mac']);
export type DeviceClass = z.infer<typeof DeviceClass>;

export const Preview = z
  .object({
    id: identifier,
    take: identifier.describe('A take named in promokit.json.'),
    device: DeviceClass,
    captionEntrance: Entrance.optional().describe('How captions arrive, unless a scene says.'),
    taps: TapMarks.optional().describe('Marks each tap; left out, taps are not marked.'),
    poster: z
      .object({
        scene: z.string().min(1).describe('One of the preview’s scenes.'),
        at: seconds.describe('Seconds after the scene has arrived, its transition done.'),
      })
      .strict()
      .optional()
      .describe('The frame App Store Connect shows before the preview plays.'),
    scenes: z.array(PreviewScene).min(1),
  })
  .strict();
export type Preview = z.infer<typeof Preview>;

export const Screenshot = z
  .object({
    id: identifier,
    still: identifier.optional().describe('A still the test captures with PromoStill.capture.'),
    file: z
      .string()
      .min(1)
      .optional()
      .describe(
        'An image to use in place of a captured still, relative to promokit.json, such as a photographed window. Used on every device.'
      ),
    caption: identifier.optional().describe('A key in copy.<locale>.json.'),
    theme: identifier.optional().describe('Set as data-theme, for brand.css to style.'),
    highlights: z
      .boolean()
      .default(true)
      .describe('Whether to draw the regions the test highlighted when it captured the still.'),
  })
  .strict()
  .refine(({ still, file }) => (still === undefined) !== (file === undefined), {
    message: 'Give a screenshot either a still or a file',
  });
export type Screenshot = z.infer<typeof Screenshot>;

/** A size in pixels, written `<width>x<height>`. */
export const PixelSize = z
  .string()
  .regex(/^[1-9]\d*x[1-9]\d*$/, 'a size such as 3840x1646')
  .transform((size) => {
    const [width, height] = size.split('x').map(Number);
    return { width: width ?? 0, height: height ?? 0 };
  });

/**
 * A creative video's footage: a take's scenes, edited as a preview's are, played in the template's
 * `data-footage` box at the take's 30 fps.
 */
export const CreativeFootage = Preview.omit({ id: true, device: true });
export type CreativeFootage = z.infer<typeof CreativeFootage>;

/**
 * A creative asset for the App Store's product page header or search results. The app designs it
 * entirely, as an HTML template; the kit fills in its copy, stills and any footage, and renders it
 * at `size`.
 */
export const Creative = z
  .object({
    id: identifier,
    slot: z
      .enum(['header', 'search', 'universal'])
      .describe(
        'The product page header, the search-result asset, or the 16:9 universal image that serves both.'
      ),
    size: PixelSize.describe(
      'header: 3840x1646 or 5244x2950; search: 3:2 from 1920x1280 to 3840x2560, or 5244x2950; universal: 5244x2950.'
    ),
    format: z.enum(['png', 'jpg']).default('png').describe('JPG only for a 3840x1646 header.'),
    template: z
      .string()
      .min(1)
      .describe(
        'An HTML fragment, relative to promokit.json, whose data-copy and data-still elements the kit fills.'
      ),
    css: z
      .array(z.string().min(1))
      .default([])
      .describe('Stylesheets, relative to promokit.json, loaded after brand.css.'),
    device: z.string().min(1).describe('One of the stills devices in promokit.json.'),
    appearance: z
      .enum(['light', 'dark'])
      .default('light')
      .describe('Which appearance’s stills data-still uses.'),
    theme: identifier.optional().describe('Set as data-theme on the canvas.'),
    search: z
      .boolean()
      .default(true)
      .describe('For a universal asset, whether it also fills the search-result placement.'),
    footage: CreativeFootage.optional().describe(
      'Makes the creative a video: the take and scenes its data-footage box plays.'
    ),
  })
  .strict()
  .superRefine(({ slot, size, format, footage }, context) => {
    const problem = footage
      ? creativeVideoProblem(slot, size)
      : creativeImageProblem(slot, size, format);
    if (problem) context.addIssue({ code: 'custom', path: ['size'], message: problem });
    if (footage && format !== 'png')
      context.addIssue({
        code: 'custom',
        path: ['format'],
        message: 'a video has no image format',
      });
  });
export type Creative = z.infer<typeof Creative>;

/** Everything an app renders: previews, captioned screenshots and creative assets. */
export const Storyboard = z
  .object({
    $schema: z.string().optional(),
    previews: z.array(Preview).default([]),
    screenshots: z.array(Screenshot).default([]),
    creatives: z
      .array(Creative)
      .default([])
      .refine(
        (creatives) => new Set(creatives.map(({ id }) => id)).size === creatives.length,
        'Give each creative its own id, which names its file'
      ),
  })
  .strict();
export type Storyboard = z.infer<typeof Storyboard>;

/** One locale's copy, keyed by the ids the storyboard uses. */
export const Copy = z.record(identifier, z.string().min(1));
export type Copy = z.infer<typeof Copy>;
