import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from '@remotion/transitions';
import { useId } from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import type { Transition } from '../../storyboard/schema.ts';

type Moving = Exclude<Transition, { type: 'cut' }>;
type Slide = Extract<Transition, { type: 'slide' }>;
type Props = TransitionPresentationComponentProps<{ transition: Moving }>;

/**
 * Pushes this scene out with the next, the content moving in the slide's direction, blurred along
 * the motion if the storyboard asks, most at the midpoint.
 */
function SlideScene({
  children,
  presentationDirection,
  presentationProgress,
  slide,
}: Props & { slide: Slide }) {
  const filter = useId().replaceAll(':', '');
  const { width, height } = useVideoConfig();
  const horizontal = slide.direction === 'left' || slide.direction === 'right';
  const sign = slide.direction === 'left' || slide.direction === 'up' ? -1 : 1;
  const offset =
    presentationDirection === 'entering' ? presentationProgress - 1 : presentationProgress;
  const translate = `${sign * offset * 100}%`;
  const blur =
    Math.sin(Math.PI * presentationProgress) * slide.motionBlur * (horizontal ? width : height);

  return (
    <AbsoluteFill
      style={{
        transform: horizontal ? `translateX(${translate})` : `translateY(${translate})`,
        ...(blur > 0 && { filter: `url(#${filter})` }),
      }}
    >
      {blur > 0 && (
        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
          <filter id={filter} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur
              stdDeviation={horizontal ? `${blur} 0` : `0 ${blur}`}
              edgeMode="duplicate"
            />
          </filter>
        </svg>
      )}
      {children}
    </AbsoluteFill>
  );
}

/** How opaque each scene is partway through a dissolve, or a fade through the background. */
function opacity({ presentationDirection, presentationProgress, passedProps }: Props) {
  const entering = presentationDirection === 'entering';
  if (passedProps.transition.type === 'dissolve') return entering ? presentationProgress : 1;
  return entering
    ? Math.max(0, presentationProgress * 2 - 1)
    : Math.max(0, 1 - presentationProgress * 2);
}

function SceneTransition(props: Props) {
  const { transition } = props.passedProps;
  if (transition.type === 'slide') return <SlideScene {...props} slide={transition} />;
  return <AbsoluteFill style={{ opacity: opacity(props) }}>{props.children}</AbsoluteFill>;
}

/** The presentation for every transition except a cut, which has none. */
export function presentation(transition: Moving): TransitionPresentation<{ transition: Moving }> {
  return { component: SceneTransition, props: { transition } };
}
