import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { Fragment } from 'react';
import { AbsoluteFill } from 'remotion';
import { easing } from '../easing.ts';
import type { PreviewSceneProps, TimelineProps } from '../props.ts';
import { Caption } from './Caption.tsx';
import type { FootageFit } from '../../storyboard/template.ts';
import { Footage } from './Footage.tsx';
import { TapMarks } from './TapMarks.tsx';
import { presentation } from './transitions.tsx';
import { Zoom } from './Zoom.tsx';

/**
 * A take's scenes, framed, captioned and joined as the storyboard says, filling their box as `fit`
 * says.
 */
export function Timeline({ timeline, fit }: { timeline: TimelineProps; fit?: FootageFit }) {
  return (
    <TransitionSeries>
      {timeline.scenes.map((scene, index) => (
        <Fragment key={scene.name}>
          {index > 0 && scene.transition.type !== 'cut' && (
            <TransitionSeries.Transition
              presentation={presentation(scene.transition)}
              timing={linearTiming({
                durationInFrames: Math.round(scene.transition.duration * timeline.fps),
                easing: easing(scene.transition.easing),
              })}
            />
          )}
          <TransitionSeries.Sequence durationInFrames={scene.durationInFrames}>
            <Scene scene={scene} timeline={timeline} fit={fit} />
          </TransitionSeries.Sequence>
        </Fragment>
      ))}
    </TransitionSeries>
  );
}

function Scene({
  scene,
  timeline,
  fit,
}: {
  scene: PreviewSceneProps;
  timeline: TimelineProps;
  fit: FootageFit | undefined;
}) {
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Zoom zooms={scene.zooms} arrivalFrames={scene.arrivalFrames}>
        <Footage video={timeline.video} clips={scene.clips} {...(fit && { fit })} />
        <TapMarks taps={scene.taps} drags={scene.drags} timing={timeline.tapTiming} />
      </Zoom>
      {scene.caption && <Caption caption={scene.caption} arrivalFrames={scene.arrivalFrames} />}
    </AbsoluteFill>
  );
}
