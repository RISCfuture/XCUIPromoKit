import type { CSSProperties } from 'react';
import { AbsoluteFill } from 'remotion';
import { Brand } from '../components/Brand.tsx';
import { Hydrate } from '../components/Hydrate.tsx';
import { Timeline } from '../components/Timeline.tsx';
import type { CreativeProps } from '../props.ts';

/**
 * An App Store creative asset: the app's template on a canvas of exactly the asset's size, with
 * `--promo-width` and `--promo-height` set so one template can serve several sizes. A video plays
 * its footage in the template's `data-footage` box.
 */
export function Creative(props: CreativeProps) {
  const canvas = {
    '--promo-width': `${String(props.width)}px`,
    '--promo-height': `${String(props.height)}px`,
  } as CSSProperties;
  return (
    <Brand css={[props.brandCSS, ...props.css]} theme={props.theme}>
      <div
        className="promo-creative"
        data-slot={props.slot}
        data-locale={props.locale}
        style={canvas}
      >
        <Hydrate
          template={props.template}
          copy={props.copy}
          stills={props.stills}
          base={props.templateBase}
          footage={(fit) => props.footage && <Timeline timeline={props.footage} fit={fit} />}
        />
      </div>
      {props.safeArea && <SafeArea {...props.safeArea} />}
    </Brand>
  );
}

/** Outlines Apple's art safe area. Studio shows it; renders never set it. */
function SafeArea({ x, y, width, height }: CreativeProps['safeArea'] & {}) {
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width,
          height,
          outline: '6px dashed rgb(0 160 255 / 0.85)',
          outlineOffset: -6,
        }}
      />
    </AbsoluteFill>
  );
}
