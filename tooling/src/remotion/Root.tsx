import { Composition, type CalculateMetadataFunction } from 'remotion';
import { Creative } from './compositions/Creative.tsx';
import { Preview } from './compositions/Preview.tsx';
import { Screenshot } from './compositions/Screenshot.tsx';
import type { CreativeProps, PreviewProps, ScreenshotProps } from './props.ts';

const fps = 30;

const previewMetadata: CalculateMetadataFunction<PreviewProps> = ({ props }) => ({
  durationInFrames: Math.max(1, props.durationInFrames),
  fps: props.fps,
  width: props.width,
  height: props.height,
});

/** A creative image is one frame; a video runs as long as its footage. */
const creativeMetadata: CalculateMetadataFunction<CreativeProps> = ({ props }) => ({
  durationInFrames: Math.max(1, props.footage?.durationInFrames ?? 1),
  fps: props.footage?.fps ?? fps,
  width: props.width,
  height: props.height,
});

const stillMetadata: CalculateMetadataFunction<ScreenshotProps> = ({ props }) => ({
  durationInFrames: 1,
  fps,
  width: props.width,
  height: props.height,
});

const brand = { brandCSS: 'brand.css', width: 886, height: 1920 };

/** The compositions promokit renders. Each takes its props from the storyboard at render time. */
export function Root() {
  return (
    <>
      <Composition
        id="Preview"
        component={Preview}
        calculateMetadata={previewMetadata}
        defaultProps={{ ...brand, fps, durationInFrames: 1, video: '', scenes: [] }}
      />
      <Composition
        id="Screenshot"
        component={Screenshot}
        calculateMetadata={stillMetadata}
        defaultProps={{ ...brand, still: '', layout: 'phone' }}
      />
      <Composition
        id="Creative"
        component={Creative}
        calculateMetadata={creativeMetadata}
        defaultProps={{
          ...brand,
          slot: 'header',
          locale: 'en-US',
          template: '',
          templateBase: '',
          css: [],
          copy: {},
          stills: {},
        }}
      />
    </>
  );
}
