import type { CSSProperties } from 'react';
import type { Highlight } from '../props.ts';

const pad = 'var(--promo-highlight-pad, 0px)';
const radius = 'var(--promo-highlight-radius, 0px)';

/** A region's box over the still, grown by `--promo-highlight-pad` on every side. */
function box({ x, y, width, height }: Highlight) {
  return {
    left: `calc(${x * 100}% - ${pad})`,
    top: `calc(${y * 100}% - ${pad})`,
    width: `calc(${width * 100}% + 2 * ${pad})`,
    height: `calc(${height * 100}% + 2 * ${pad})`,
  };
}

/** The same box as an SVG rectangle's geometry, rounded by `--promo-highlight-radius`. */
function hole(region: Highlight): CSSProperties {
  const { left, top, width, height } = box(region);
  return { x: left, y: top, width, height, rx: radius };
}

/**
 * The regions the test highlighted, laid over the still: a `.promo-dim` layer with a hole for each,
 * and a `.promo-highlight` box for each, with `data-index`. They have no look until brand.css gives
 * them one.
 */
export function Highlights({ regions }: { regions: Highlight[] }) {
  return (
    <div className="promo-highlights">
      <svg className="promo-dim" width="100%" height="100%">
        <mask id="promo-highlight-holes">
          <rect width="100%" height="100%" fill="white" />
          {regions.map((region, index) => (
            <rect key={index} style={hole(region)} fill="black" />
          ))}
        </mask>
        <rect width="100%" height="100%" mask="url(#promo-highlight-holes)" />
      </svg>
      {regions.map((region, index) => (
        <div key={index} className="promo-highlight" data-index={index} style={box(region)} />
      ))}
    </div>
  );
}
