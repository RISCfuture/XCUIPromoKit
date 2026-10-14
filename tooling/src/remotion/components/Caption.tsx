import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { Entrance } from '../../storyboard/schema.ts';
import type { Caption as CaptionProps } from '../props.ts';
import { CopyText } from './CopyText.tsx';
import { entranceStyle } from './entrance.ts';

/** Splits text into the units an entrance moves one at a time, keeping the spaces. */
function units(text: string, unit: Entrance['unit']): string[] {
  if (unit === 'caption') return [text];
  if (unit === 'word') return text.split(/(?<= )/);
  return Array.from(new Intl.Segmenter().segment(text), ({ segment }) => segment);
}

/**
 * A caption over the footage, its entrance timed from the scene's arrival. brand.css styles
 * `.promo-caption`, by its `data-copy` id if it likes, and `.promo-caption-em`; the storyboard
 * moves it.
 */
export function Caption({
  caption,
  arrivalFrames,
}: {
  caption: CaptionProps;
  arrivalFrames: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { entrance } = caption;
  const style = { top: `${caption.y * 100}%` };

  if (!entrance) {
    return (
      <h1 className="promo-caption" data-copy={caption.id} style={style}>
        <CopyText copy={caption.text} />
      </h1>
    );
  }
  const elapsed = (frame - arrivalFrames) / fps - entrance.delay;
  return (
    <h1 className="promo-caption" data-copy={caption.id} style={style}>
      <CopyText
        copy={caption.text}
        split={(text) => units(text, entrance.unit)}
        unit={(content, index) => (
          <span
            key={index}
            className="promo-caption-unit"
            style={entranceStyle(
              entrance,
              entrance.duration > 0 ? (elapsed - index * entrance.stagger) / entrance.duration : 1
            )}
          >
            {content}
          </span>
        )}
      />
    </h1>
  );
}
