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
 * - `data-capture` on a Mac still's `.promo-screenshot`: `screen` or `window`, as promokit.json's
 *   `mac.capture` says. A `screen` still is a window's rectangle of screen, which the kit clips to
 *   the window's corners and shadows with `.promo-window-shadow`, laid exactly under
 *   `.promo-screen`. Both scale with the window, by `--promo-window-width` and
 *   `--promo-window-height`, its size in points; `--promo-window-pt` is one of its points as
 *   rendered. `--promo-window-radius` and `--promo-window-inset` (in points; the inset shaves the
 *   window's edge, where its antialiasing holds the screen behind it) and `--promo-window-shadow`
 *   (a `box-shadow`) restyle them. A `window` still comes with its own corners and shadow.
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
:where([data-capture='screen']) {
  --promo-window-radius: 15.5;
  --promo-window-inset: 0.5;
  --promo-window-pt: calc(100cqw / var(--promo-window-width));
  --promo-window-shadow: 0 calc(20 * var(--promo-window-pt)) calc(42 * var(--promo-window-pt))
    rgb(0 0 0 / 38%);
}
:where([data-capture='screen'] .promo-screen) {
  position: relative;
  clip-path: inset(
    calc(var(--promo-window-inset) / var(--promo-window-height) * 100%)
      calc(var(--promo-window-inset) / var(--promo-window-width) * 100%) round
      calc(var(--promo-window-radius) / var(--promo-window-width) * 100%) /
      calc(var(--promo-window-radius) / var(--promo-window-height) * 100%)
  );
}
:where(.promo-window-shadow) {
  position: absolute;
  position-anchor: --promo-still;
  top: anchor(top);
  left: anchor(left);
  width: anchor-size(width);
  height: anchor-size(height);
  container-type: size;
  pointer-events: none;
}
:where(.promo-window-shadow)::before {
  content: '';
  position: absolute;
  inset: calc(var(--promo-window-inset) * var(--promo-window-pt));
  border-radius: calc(var(--promo-window-radius) * var(--promo-window-pt));
  box-shadow: var(--promo-window-shadow);
}
:where(.promo-dim) { position: absolute; inset: 0; overflow: visible; fill: transparent; }
:where(.promo-highlight) { position: absolute; border-radius: var(--promo-highlight-radius, 0px); }
`;
