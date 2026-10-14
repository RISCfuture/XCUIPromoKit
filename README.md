# XCUIPromoKit

[![CI](https://github.com/RISCfuture/XCUIPromoKit/actions/workflows/ci.yml/badge.svg)](https://github.com/RISCfuture/XCUIPromoKit/actions/workflows/ci.yml)

Tooling for App Store promotional media made from an app's own UI tests. It has
three parts:

- **Capture.** A Swift library, linked from a UI-test target, marks which
  stretches of a scripted run to keep, logs touches and captures stills.
- **Render.** A command-line tool, `promokit`, records those runs on simulators
  the app owns. It renders app previews, captioned screenshots and App Store
  creative assets from a JSON storyboard with
  [Remotion](https://www.remotion.dev), styled by the app's own CSS.
- **Check.** `promokit check` tests the copy, the storyboard and the rendered
  media against Apple's requirements before anything is uploaded.

The kit has no look of its own. Every transition, caption entrance, zoom, tap
mark and layout is a parameter in the storyboard or a rule in the app's
`brand.css`. Anything left unspecified falls back to the plainest choice: a cut,
a linear pace, a caption that is simply there. Uploading stays with fastlane's
`deliver`.

## Requirements

- An app with a UI-test target on iOS 16+ or macOS 13+, built with Xcode's
  toolchain.
- Node 26.7+ with pnpm, and `ffmpeg` and `ffprobe` on the `PATH`.
- Remotion downloads its own headless Chrome the first time it renders.

## Installation

Link `XCUIPromoKit` from the UI-test target that plays the promo scripts:

```swift
.package(url: "https://github.com/RISCfuture/XCUIPromoKit", from: "1.0.0")
```

Then add a `promo/` folder to the app with a `package.json` that depends on the
tooling at the same tag:

```json
{
  "private": true,
  "dependencies": {
    "xcuipromokit": "github:RISCfuture/XCUIPromoKit#1.0.0&path:/tooling"
  }
}
```

Approve `esbuild`'s install script, which Remotion's bundler needs, in a
`pnpm-workspace.yaml` beside it:

```yaml
allowBuilds:
  esbuild: true
```

Then `pnpm install` in `promo/` installs the `promokit` command.

## Capturing

### Recording a take

A take is one UI test, played while `promokit record` films the simulator.
`PromoTake` files the stretches worth keeping under named scenes. The host cuts
the recording down to those stretches, so the time XCUITest spends finding
elements never reaches the preview.

```swift
import XCTest
import XCUIPromoKit

@MainActor
final class PreviewRecording: XCTestCase {
  func testRecordPreview() throws {
    let app = XCUIApplication()
    let take = try PromoTake(app: app, tapLanding: 0.3)
    app.launchArguments = PromoLaunch(flags: ["UI-TESTING"], defaults: ["hasCompletedWelcome": true]).arguments
    app.launch()
    // Set up each scene's opening shot before the scene, off camera.

    try take.startRolling()
    take.scene("opening") { take.hold(1.5) }
    take.scene("questions") {
      take.tap(app.buttons["Questions"], settle: 1.2)
      take.setSwitch(app.switches["afterWorkToggle"], to: true, settle: 0.6)
    }
    try take.finish()
  }
}
```

Outside `promokit record`, `PromoTake` skips the test.

| API | Purpose |
| ----- | --------- |
| `PromoTake` | Runs the handshake with the host. `scene(_:_:)` names a scene, which the host films on its own: from when it begins until its steps finish, so nothing between scenes is filmed; `keep(_:)` keeps everything an action does; `keepTail(settle:_:)` keeps only what an action changes on screen, from `tapLanding` seconds before its first change to `settle` after its last, which `promokit prepare` finds in the footage. `hold(_:)` keeps a held shot, and `holdOnScreenshot(_:)` holds on a screenshot instead of the footage, for a static screen the recorder misses. `finish()` writes `take.json`. |
| `PromoTake` interactions | `tap(_:settle:)`, `setSwitch(_:to:settle:)` (through XCUITestKit), `type(_:into:cadence:settle:)` (one character at a time, at a `TypingCadence`), `openAndHold(_:revealing:for:)` (menus, pickers and dropdowns) and, on iOS, `scroll(_:by:speed:rest:)` and `drag(from:to:press:duration:hold:settle:)` (an evenly paced drag between coordinates, or across an element by normalized offsets) and `trace(through:press:duration:hold:settle:)` (one continuous touch through any number of points at an even speed, for strokes that curve or turn; it drives XCTest's own event synthesis, which has no public API). Each logs its touches' positions and times, for touch marks. `noteTap(at:)`, `noteDrag(from:to:press:duration:hold:)` and `noteDrag(along:press:duration:hold:)` log any other gesture. |
| `TypingCadence` | The interval between keystrokes, its jitter, an extra pause after a word, and a seed so every take types identically. |
| `PromoStill` | `capture(_:of:highlighting:settlingWithin:in:)` writes a still to the directory `promokit stills` hands over, never to fastlane's shared cache. Without one, as on the Mac, it attaches the still to the test. Given a time to settle, it captures until two captures in a row match, so scrollbars and animations have come to rest. `highlighting` takes regions to highlight, each the union of some elements' frames, even outside the captured element, and saves them beside the still. On macOS 26 and later, `captureWindow(_:of:ownedBy:in:)` captures one window with its transparency and real shadow (though a window drawn in a material, such as a menu, comes out flat grey, so capture that one over a staged backdrop), and `captureWindow(_:in:where:)` picks any on-screen window, such as a menu bar extra's panel; the test runner needs Screen Recording permission, which macOS doesn't prompt for during a test: add the runner app under System Settings › Privacy & Security › Screen & System Audio Recording. |
| `PromoLaunch` | Launch arguments: bare flags, argument-domain defaults, and the locale `promokit` asks for. |

### The promo folder

```text
promo/
  promokit.json         the app, its scheme, takes, still devices and brand files
  storyboard.json       what to render
  copy.en-US.json       caption and headline text, per locale, by id
  brand.css             every visual decision
  creative/             creative-asset templates and their CSS, if any
```

JSON Schemas for all three JSON files are in [`tooling/schema`](tooling/schema).

### Commands

| Command | Does |
| --------- | ------ |
| `promokit record <take>` | Builds the tests, boots the app's own simulator (`promokit-<app>-<device>`), films each scene of the take and prepares it. |
| `promokit prepare <take>` | Joins the scenes' recordings and normalizes them to 30 fps at native resolution and measures how far the recorder ran behind the test's clock. It narrows each action to the frames it changed, and snaps each scene's start to the frame its screen appears. It warns where the recorder dropped frames: an action that changed nothing, or a scene whose footage ends before the screenshot the take saved as the scene finished. |
| `promokit stills` | Captures stills on each configured device, appearance and locale, and fails if a run captures none. |
| `promokit mac-stills` | Captures Mac stills from the test's attachments. It drives the real Mac, so take care not to run it alongside other UI automation. |
| `promokit render [--only previews\|screenshots\|creatives]` | Renders into the folders `output` names, one per locale (by default `../fastlane/previews`, `../fastlane/screenshots`, `../fastlane/screenshots_mac` and `../fastlane/creative_assets`), where `deliver` finds them. Once every render succeeds, it replaces the files it rendered there last time and leaves anything else alone. |
| `promokit check [--json]` | Runs the compliance checks below. |
| `promokit studio [preview] [--creative <id>]` | Opens Remotion Studio on a preview, to scrub through it while editing the storyboard, or on a creative asset with Apple's art safe area outlined. |
| `promokit clean` | Deletes the simulators the app owns. |

Takes, stills and renders live in the repository's `.build/promo`. Every build
and test run uses the scheme's `testPlan` and the `buildSettings` overrides from
`promokit.json`, when it names them. A take or the stills can name a simulator
`runtime`, such as `"iOS 27.0"`; otherwise simulators get the newest installed.

## The storyboard

A preview lists the take's scenes in order. Each scene can set:

- **`stretches`**: which of the take's kept stretches to use, in order, each
  with an optional `trim` and `speed`. A speed plays the stretch at a `rate`
  times real time, reaching it from real time over `ramp` seconds and
  returning over `ramp` seconds at the end. `promokit prepare` lists each scene's stretches by
  number. All of them, if left out.
- **`trim`**: seconds of footage to leave out from the start or end of the scene
  as edited.
- **`transition`**: how the scene arrives. Choose `cut`, `dissolve`, `fade`
  (through the background) or `slide`. A slide takes a direction, an easing and
  an optional `motionBlur`.
- **`caption`**: a copy id, and where its centre sits. A caption's `entrance`,
  or the preview's `captionEntrance`, is a set of CSS-like keyframes (`opacity`,
  `x`, `y`, `scale`, `rotate`, `skew`, `blur`). The keyframes play over the whole
  caption, each word or each character, with a delay, a duration, a stagger and
  an easing.
- **`zoom`**: a scale, a point, a start, a duration and an easing. The point
  stays where it is, or with `"aim": "center"` moves as near the centre as the
  frame's edges allow; or a list of zooms, each moving the camera on from where the one
  before left it. A zoom to 1 returns to the full frame.
- **`taps`**: whether to mark taps and drags. The preview's `taps` sets how long
  each mark shows before the finger lands and after it lifts.

A screenshot shows a `still` the test captured, or a `file` relative to
`promokit.json`, such as a window photographed by hand. A file is used on every
device. `"highlights": false` renders a still without the regions its test
highlighted.

A preview's `poster` names a scene and a moment `at` seconds after it
arrives. `promokit render` writes its App Store Connect time code
(`HH:MM:SS:FF`) beside the preview as `<name>-poster.txt`, and the frame as
`<name>-poster.png`; `promokit check` warns if it falls during a transition.

A caption's delay and a zoom's start count from the scene's arrival, once its
transition has finished. Easings are `linear` or a cubic Bézier's four control
points.

## Creative assets

iOS 27 and iPadOS 27 product pages can carry a **header** asset, and search
results a **search** asset. A 5244×2950 **universal** image can fill both.
There's nothing equivalent for the Mac or visionOS.

The app designs each one as an HTML template with its own CSS. The kit fills in
three hooks and renders the template at exactly the asset's size:

- `data-copy="<id>"` on any element: the copy for the locale, set like a
  caption, with `*emphasis*` and the stroke and fill layers.
- `<img data-still="<name>">`: a captured still from the creative's `device` in
  its `appearance`. Crop it with CSS, such as `object-view-box`.
- `data-footage` on one element, in a video: the take's footage plays inside
  it, sized and shaped by the template's CSS. Its value sets how the footage
  fills the element, as `object-fit`: `cover` (or blank), `contain`, `fill`,
  `none` or `scale-down`.
- Other images with relative URLs resolve against the template's folder.

The canvas is `.promo-creative`, with `data-slot`, `data-locale`,
`data-theme`, and `--promo-width` and `--promo-height` set to the asset's size,
so one template can serve several sizes. Style the canvas, not `body`.

```json
{
  "creatives": [
    {
      "id": "header-a",
      "slot": "header",
      "size": "3840x1646",
      "template": "creative/header.html",
      "css": ["creative/shared.css", "creative/header.css"],
      "device": "iPhone 18 Pro Max"
    }
  ]
}
```

The storyboard accepts only the sizes and formats Apple does. A header is
3840×1646 (PNG or JPG) or 5244×2950 (PNG); search is 3:2 from 1920×1280 to
3840×2560, or 5244×2950; universal is 5244×2950. A universal image also fills
search unless it says `"search": false`.

A creative with `footage` is a video: a 3840×1646 header, or a 3:2 search
asset. `footage` names a take and its scenes, edited exactly as a preview's
(stretches, trims, speed, transitions, captions, zooms, taps and a `poster`).
The video runs at the take's 30 fps, for 5–30 s, and is written as H.264 with a
silent stereo track, since the store plays it muted. A `poster` is written
beside it as `<name>-poster.txt`, with its frame as `<name>-poster.png`.

`promokit render` writes each asset to `output.creatives`, one folder per
locale, named by `creativeNames` (by default `{id}`; `{slot}`, `{width}` and
`{height}` also work). Beside the folders, `creative_assets.json` lists every
image's placements as `{locale, path, placement_type}`, with `path` relative
to it. That
is the shape of `deliver`'s `creative_assets` option, less the placement group,
which the Fastfile adds:

```ruby
directory = File.expand_path('creative_assets', __dir__)
listing = File.read(File.join(directory, 'creative_assets.json'))
creative_assets = JSON.parse(listing).map do |entry|
  group = ENV.fetch("ASC_#{entry['placement_type']}_GROUP")
  entry.merge('path' => File.join(directory, entry['path']),
              'placement_group' => group)
end
```

`deliver` gains that option with fastlane PR #30442, which uploads images only,
so `creative_assets.json` lists no videos. Upload creative video by hand until
fastlane supports it.

Apple's templates mark an art safe area: the part every device's crop keeps.
`promokit studio --creative <id>` outlines it; renders never include it.

Apple's rules for these assets differ from screenshots'. A creative asset may
show content from outside the app, if it relates to what the app does. It must
suit a 4+ rating, with no gore, and no weapons pointed at the viewer. It can't
include prices, URLs, legal symbols, Apple's recognitions, awards it hasn't
won, or other platforms (App Review Guidelines 2.3, 2.3.8 and 2.3.10). The
copy checks catch what text can show; the imagery is the designer's to judge.

## brand.css

The renderer loads the app's `brand.css` and the fonts it declares. The kit's
own CSS only places things, under `:where()`, so any rule in `brand.css`
overrides it. The hooks are:

- `.promo-root[data-theme]`: the frame.
- `.promo-caption` and `.promo-caption-unit`: a preview caption, and each word
  or character of it. Captions and headlines carry their copy's id as
  `data-copy`, and copy written `*like this*` is set in an
  `em.promo-caption-em` inside its units, so marking a phrase never splits a
  unit.
- `.promo-text-stroke` and `.promo-text-fill`: caption and headline text is
  laid out twice in the same place, the stroke layer under the fill layer. A
  `-webkit-text-stroke` set on the caption or headline draws only in the stroke
  layer, so no outline covers another letter.
- `.promo-tap`: a touch mark, with `data-gesture` set to `tap` or `drag`.
  Animate it with `--promo-tap-in`, which runs 0 to 1 as the finger lands, and
  `--promo-tap-out`, 0 to 1 after it lifts. A drag's mark follows the finger,
  and `--promo-drag-progress` runs 0 to 1 as it moves.
- `.promo-screenshot[data-layout]` (`phone`, `tablet` or `mac`): a screenshot,
  with `.promo-headline`, `.promo-screen` and, on the Mac, `.promo-window`. A
  phone or tablet screenshot is the size of its still. A Mac still is a window,
  laid out at its own pixel size on the canvas `mac.size` in `promokit.json`
  names: `2880x1800` unless it's `2560x1600`, `1440x900` or `1280x800`.
- `.promo-highlights`: laid exactly over `.promo-screen` when the test
  highlighted regions. It holds `.promo-dim`, an SVG whose `fill` dims the
  still outside every region, and a `.promo-highlight` box per region, with
  `data-index`, for an outline or a glow. `--promo-highlight-pad` grows every
  region and `--promo-highlight-radius` rounds it, in the dim layer's holes and
  the boxes alike. None of it shows until brand.css styles it.

## Compliance checks

`promokit check` reports errors and warnings, and exits non-zero on any error.
It checks:

- **Previews:** 15–30 s, at most 30 fps, H.264 at 10–12 Mbps or ProRes 422 HQ,
  at most 500 MB, a stereo AAC track, an app preview size, and at most three
  previews of any one size.
- **Screenshots:** an accepted display size, and no alpha channel.
- **Creative assets:** the storyboard's size, one the slot accepts, PNG or (for
  a 3840×1646 header only) JPG, and no alpha channel. A video must be a size
  its slot accepts, at 30 or 60 fps, for 5–30 s. A creative not yet rendered
  in some locale is a warning.
- **Copy:** prices, URLs, legal symbols, other platforms and marketplaces,
  Apple's recognitions (Editor's Choice, App of the Day and the like) and the
  reserved "For Kids" and "For Children" are errors. "Free", superlatives,
  claimed awards and dated references are warnings, for a person to judge.
- **Storyboard:** everything it names must exist: takes, their scenes, copy in
  every locale, stills, and each creative's template, device and the stills and
  copy its template names. A video's template needs exactly one
  `data-footage`, an image's none. Creatives that fill the same placement get a
  warning, since each needs its own placement group.
- **Stills:** a highlights file render can't read is an error, and any other
  file that's neither a still nor its highlights is a warning.

Creative choices are never checked. [docs/DESIGN.md](docs/DESIGN.md) records
Apple's rules and the capture pitfalls the tooling handles.

## License

MIT; see [LICENSE.md](LICENSE.md). Remotion has its own licence: it is free for
individuals and companies of up to three people, and larger companies need a
[company licence](https://www.remotion.dev/license).
