/**
 * The kit's structural CSS: where things sit, and nothing about how they look. Every selector is
 * wrapped in `:where()`, so it has no specificity and brand.css overrides any of it freely.
 *
 * brand.css styles these hooks:
 *
 * - `.promo-root`: the frame, with `data-theme` from the storyboard.
 * - `.promo-caption`: a preview caption; `.promo-caption-unit` for each word or character, and
 *   `.promo-caption-em` for emphasis. Caption and headline text is laid out twice, as
 *   `.promo-text-stroke` under `.promo-text-fill`; only the stroke layer draws a text stroke.
 * - `.promo-tap`: a tap mark, given `--promo-tap-in` (0 to 1 as the finger lands) and
 *   `--promo-tap-out` (0 to 1 after it lifts).
 * - `.promo-creative`: a creative asset's canvas, holding the app's template, with `data-slot`
 *   (`header`, `search` or `universal`), `data-locale`, and `--promo-width` and `--promo-height`
 *   set to its size in pixels. In a video, the template's `[data-footage]` box plays the take.
 * - `.promo-screenshot` with `data-layout` (`phone`, `tablet` or `mac`), `.promo-headline`,
 *   `.promo-screen` (the still) and, on the Mac, `.promo-window` around it. A Mac screenshot's
 *   canvas is promokit.json's `mac.size`; any other is its still's size.
 * - `.promo-highlights`, laid exactly over `.promo-screen` when the test highlighted regions:
 *   `.promo-dim`, an SVG whose `fill` dims the still outside every region, and a `.promo-highlight`
 *   box per region, with `data-index`. `--promo-highlight-pad` grows each region and
 *   `--promo-highlight-radius` rounds it, in the hole and the box alike.
 */
export const structure = `
:where(.promo-creative) { position: absolute; inset: 0; overflow: hidden; }
:where([data-footage]) { position: relative; overflow: hidden; }
:where(.promo-caption) {
  position: absolute;
  left: 0;
  right: 0;
  margin: 0;
  transform: translateY(-50%);
}
:where(.promo-caption-unit) { display: inline-block; white-space: pre; }
:where(.promo-text) { display: grid; }
:where(.promo-text-stroke, .promo-text-fill) { grid-area: 1 / 1; }
:where(.promo-text-fill) { -webkit-text-stroke: 0; }
:where(.promo-tap) {
  position: absolute;
  width: 10vmin;
  aspect-ratio: 1;
  border-radius: 50%;
  background: rgb(128 128 128 / 0.5);
  translate: -50% -50%;
  opacity: calc(var(--promo-tap-in) * (1 - var(--promo-tap-out)));
}
:where(.promo-screenshot) {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}
:where(.promo-headline) { margin: 0; }
:where(.promo-screen) { display: block; min-height: 0; max-width: 100%; object-fit: contain; }
:where(.promo-window) { display: flex; justify-content: center; min-height: 0; max-width: 100%; }
:where(.promo-screen) { anchor-name: --promo-still; }
:where(.promo-highlights) {
  position: absolute;
  position-anchor: --promo-still;
  top: anchor(top);
  left: anchor(left);
  width: anchor-size(width);
  height: anchor-size(height);
  pointer-events: none;
}
:where(.promo-dim) { position: absolute; inset: 0; overflow: visible; fill: transparent; }
:where(.promo-highlight) { position: absolute; border-radius: var(--promo-highlight-radius, 0px); }
`;
