import type { CSSProperties } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TapMarks as TapTiming } from '../../storyboard/schema.ts';
import type { DragMark, TapMark } from '../props.ts';
import { dragMarkState, tapMarkState, type TouchMarkState } from './touch.ts';

/**
 * Marks each touch: a touch hotspot, which Apple allows in previews. Each mark is a `.promo-tap`
 * with `--promo-tap-in` and `--promo-tap-out` for brand.css to animate it by, and a
 * `data-gesture` of `tap` or `drag`. A drag's mark follows the finger, with
 * `--promo-drag-progress` running from 0 as it starts moving to 1 as it stops.
 */
export function TapMarks({
  taps,
  drags,
  timing,
}: {
  taps: TapMark[];
  drags: DragMark[];
  timing?: TapTiming;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!timing) return null;

  const marks = [
    ...taps.map((tap) => tapMarkState(tap, (frame - tap.frame) / fps, timing)),
    ...drags.map((drag) => dragMarkState(drag, (frame - drag.frame) / fps, timing)),
  ];
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {marks.map((mark, index) => mark && <Mark key={index} {...mark} />)}
    </AbsoluteFill>
  );
}

function Mark({ gesture, x, y, landing, lifting, progress }: TouchMarkState) {
  return (
    <div
      className="promo-tap"
      data-gesture={gesture}
      style={
        {
          left: `${x * 100}%`,
          top: `${y * 100}%`,
          '--promo-tap-in': landing,
          '--promo-tap-out': lifting,
          ...(progress !== undefined && { '--promo-drag-progress': progress }),
        } as CSSProperties
      }
    />
  );
}
