# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-10-28

### Changed

- **Breaking:** a scene's stretches are numbered by the test alone: each
  action the test keeps in the scene (a `keep`, `keepTail`, `hold`,
  `holdOnScreenshot` or interaction; `type` keeps two, the tap that focuses
  the field and the typing) is one stretch, numbered from 0 in the order kept.
  Stretches are no longer joined when the footage puts them within a frame of
  each other, or dropped when an earlier stretch or the end of their recording
  covers them, so a storyboard's `stretches` pick the same actions in every
  recording of the take. Before, two recordings of one take could number a
  scene's stretches differently, and a storyboard that rendered one failed
  with “has no stretch” on the next.
- A stretch an earlier one covers, or one outside its recording, is kept
  empty. `promokit prepare` lists it as `empty`, and the render leaves it out.
- The render plays stretches that run on from one another at the same speed as
  one clip, so a scene that uses all of its stretches looks exactly as it did.

### Migration

- Bump both pins to `2.0.0`: the Swift package and `xcuipromokit` in
  `promo/package.json`.
- Run `promokit prepare <take>` on each recorded take. It rebuilds the
  manifest from `take.json` and the scene recordings already in
  `.build/promo/takes/<take>`, with no new recording, and lists each scene's
  stretches by their new numbers.
- Renumber every `stretches` list that picked a joined stretch. A 1.x stretch
  that covered several actions is now that many stretches in a row: pick each
  of them, moving the old `trim.start` to the first and `trim.end` to the last,
  and giving each the old `speed`, which then still ramps once over the run.
  Scenes without `stretches`, and lists whose stretches were never joined,
  need no change.
- Workarounds that kept actions apart, such as a pause between two kept
  actions or one `keep` around several, are no longer needed.

## [1.2.0] - 2026-10-28

### Added

- `creative_assets.json` lists creative videos too, each with
  `preview_frame_time_code` from its `poster`, for `deliver`'s video support
  (fastlane PR #30457).
- Every `creative_assets.json` entry carries `placement_group`
  (`DEFAULT_PROFILE`), so the listing is exactly what `deliver`'s
  `creative_assets` option takes.

### Fixed

- A JPG creative is accepted only as a 3:2 search image; the header and the
  universal size are PNG only, as App Store Connect requires.
- `promokit check` holds a search video to 15–30 s; a header video stays
  5–30 s.

## [1.1.0] - 2026-10-15

### Added

- `mac.capture` in `promokit.json` chooses how the Mac test captures windows:
  `"screen"` (the default) grabs the window's rectangle of screen through
  XCTest, and `"window"` captures it on its own through ScreenCaptureKit, with
  its transparency and system shadow, which needs Screen Recording permission.
  `promokit mac-stills` passes the mode to the test as `PROMO_MAC_CAPTURE`.
- `PromoStill.capture(_:of:ownedBy:highlighting:settlingWithin:in:)`, one call
  for a Mac window in either mode. In `"screen"` mode it saves the window's
  size in points beside the still.
- `PromoStill.captureWindow(_:of:ownedBy:)` can highlight regions and wait for
  the window to settle.
- The render clips a `"screen"` still to the window's rounded corners and
  shadows it like the system does, scaled to the window as laid out, marking
  its `.promo-screenshot` with `data-capture`. `--promo-window-radius`,
  `--promo-window-inset` and `--promo-window-shadow` restyle them.

## [1.0.0] - 2026-10-15

### Added

- `XCUIPromoKit`, a Swift library for UI-test targets:
  - `PromoTake` records a scripted take in named scenes and logs taps, through a
    marker-file handshake with the host. Each action records when it ran, so
    the host can keep exactly what it changed on screen.
  - Interaction helpers: tapping, switches, typing at a seeded
    `TypingCadence`, holding on an open menu, scrolling at a set speed, and
    dragging or tracing a path through any number of points at an even pace.
    A take can hold on a screenshot where the recorder misses a static
    screen.
  - `PromoStill` captures stills into a directory owned by the run, optionally
    waiting for the screen to settle, and records regions to highlight. On the
    Mac it can capture one window with its transparency and shadow.
  - `PromoLaunch` builds launch arguments.
- `promokit`, a command-line tool in `tooling/`:
  - records takes scene by scene on simulators each app owns, and captures
    iOS and Mac stills, with the scheme's test plan, build settings and
    simulator runtime the app chooses;
  - corrects takes for the recorder's lag, narrows each action to the frames it
    changed, and snaps scenes to screen changes, warning where the recorder
    dropped frames;
  - renders app previews and captioned screenshots with Remotion, from a JSON
    storyboard and the app's `brand.css`. Scenes choose, trim and pace the
    stretches they use, and captions and zooms are timed from each scene's arrival.
    A scene can zoom any number of times, and a preview names its poster
    frame.
    Touch marks follow the finger along drags. Copy can set `*emphasis*`,
    and each caption carries its copy's id for brand.css. A Mac screenshot lays
    its window out on a 16:10 canvas the app chooses. A screenshot can use an
    image file in place of a captured still, and lays the regions its test
    highlighted over the still for brand.css to dim around or outline;
  - renders App Store creative assets (the product page header, search-result
    and universal images, and header and search videos) from the app's own
    HTML templates, filling in copy, captured stills and a take's footage, and
    lists every image placement in `creative_assets.json` for `deliver`.
    Studio outlines Apple's art safe areas;
  - checks copy, the storyboard and rendered media against Apple's
    requirements;
  - publishes renders only once a whole batch succeeds, replacing just the
    files it rendered before;
  - installs from git with no build step.
