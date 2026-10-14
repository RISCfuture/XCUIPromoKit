# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
