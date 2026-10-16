import type { MacCapture } from '../config.ts';
import type { CreativeSlot, Rectangle } from '../devices.ts';
import type { WindowSize } from '../render/window.ts';
import type { Entrance, TapMarks as TapTiming, Transition, Zoom } from '../storyboard/schema.ts';

/** Everything a composition draws in the app's brand gets the brand's stylesheet. */
type Branded = {
  /** brand.css, as a path in the public folder. */
  brandCSS: string;
  width: number;
  height: number;
};

export type Clip = {
  /** The first source frame. */
  from: number;
  /** Frames the clip runs. */
  durationInFrames: number;
  /** How fast the clip plays its `footageFrames` of footage; real time if left out. */
  speed?: { rate: number; ramp: number; footageFrames: number };
};

export type TapMark = {
  /** The frame, into the scene, when the finger lifts. */
  frame: number;
  x: number;
  y: number;
};

export type DragMark = {
  /** The frame, into the scene, when the finger starts moving. */
  frame: number;
  /** Seconds the finger rests at the start of `path` before moving. */
  press: number;
  /** Seconds the finger takes to move along `path`, at an even speed. */
  duration: number;
  /** Seconds the finger rests at the end of `path` before lifting. */
  hold: number;
  path: { x: number; y: number }[];
};

export type Caption = {
  /** The copy's id, which brand.css can style the caption by. */
  id: string;
  /** The copy, with any `*emphasis*`. */
  text: string;
  /** Where the caption's centre sits, as a fraction of the height from the top. */
  y: number;
  entrance?: Entrance;
};

export type PreviewSceneProps = {
  name: string;
  durationInFrames: number;
  clips: Clip[];
  /** How this scene arrives. The first scene's is ignored. */
  transition: Transition;
  /** The frame, into the scene, its transition finishes. Caption and zoom times count from here. */
  arrivalFrames: number;
  caption?: Caption;
  /** Zooms in turn, each from where the one before left the frame. */
  zooms: Zoom[];
  taps: TapMark[];
  drags: DragMark[];
};

/** A take's scenes, edited and joined: the body of a preview, or of a creative video. */
export type TimelineProps = {
  fps: number;
  durationInFrames: number;
  /** The normalized take, as a path in the public folder. */
  video: string;
  tapTiming?: TapTiming;
  scenes: PreviewSceneProps[];
};

export type PreviewProps = Branded & TimelineProps;

export type ScreenshotLayout = 'phone' | 'tablet' | 'mac';

/** A region of a still, as fractions of its width and height. */
export type Highlight = { x: number; y: number; width: number; height: number };

export type ScreenshotProps = Branded & {
  /** The still, as a path in the public folder. */
  still: string;
  highlights?: Highlight[];
  layout: ScreenshotLayout;
  /** How a Mac still was captured: a window's rectangle of screen, or the window on its own. */
  capture?: MacCapture;
  /** The window a `screen` still grabbed, in points, which its corners and shadow scale by. */
  window?: WindowSize;
  caption?: { id: string; text: string };
  theme?: string;
};

export type CreativeProps = Branded & {
  slot: CreativeSlot;
  locale: string;
  theme?: string;
  /** The app's HTML template. */
  template: string;
  /** The template's folder, as a path in the public folder, for its relative image URLs. */
  templateBase: string;
  /** Stylesheets to load after brand.css, as paths in the public folder. */
  css: string[];
  /** The locale's copy, by id. */
  copy: Record<string, string>;
  /** The captured stills `data-still` can name, as paths in the public folder. */
  stills: Record<string, string>;
  /** For a video, the timeline `data-footage` plays. */
  footage?: TimelineProps;
  /** Apple's art safe area to outline, in pixels. Only studio sets it. */
  safeArea?: Rectangle;
};
