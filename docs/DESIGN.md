# Design notes

## Apple's rules

Checked against Apple's pages on 2026-10-14. Recheck them before relying on a
number here.

### App previews

- 15–30 s long, at most 30 fps, H.264 at 10–12 Mbps or ProRes 422 HQ, at most
  500 MB.
- A stereo AAC track is required; a silent one is fine. Previews autoplay muted
  on the product page and in search.
- Up to three per size and locale. iPhone is 886×1920, iPad 1200×1600, Mac
  1920×1080.
- The poster frame defaults to 5 s in. Changing it on an approved preview means
  resubmitting.
- Guideline 2.3.4: previews "may only use video screen captures of the app
  itself", with narration and "video or textual overlays" allowed.
- [App previews](https://developer.apple.com/app-store/app-previews/):
  - show only content from within the app, and never film people using a
    device;
  - touch hotspots may be added;
  - transitions must not "imply functionality that your app doesn't include";
  - text must stay legible and on screen long enough;
  - no prices, and no seasonal or dated references.
  - Apple recommends native resolution over zooming in. This is a
    recommendation, so the storyboard leaves zooms to the director.

### Screenshots

- iPhone 6.9" and 6.3": fastlane maps 1206×2622 to `APP_IPHONE_61`.
- iPad 13": 2064×2752.
- Mac: 16:10, at 2880×1800 and smaller sizes.
- iPhone Duo: outer 1398×2034 and inner 2007×2853. Required from April 2027 for
  builds with the 27.1 SDK. fastlane 2.241.0 has no Duo display type.
- No alpha channel.

### iOS and iPadOS 27 creative assets

Checked against Apple's
[creative asset specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications),
[asset best practices](https://developer.apple.com/app-store/asset-best-practices/)
and its templates on 2026-10-15, and against App Store Connect's reference
data on 2026-10-20.

- **Sizes:**
  - Header: 3840×1646 (21:9) or 5244×2950 (16:9), both PNG.
  - Search result: 3:2 from 1920×1280 to 3840×2560 (JPG or PNG), or 5244×2950
    PNG.
  - The 16:9 image is the universal asset: "Use header asset in search results"
    places it in both.
- **Video:** header 3840×1646 for 5–30 s, and search 3:2 for 15–30 s, at 30
  or 60 fps, as .mov, .m4v or .mp4. There's no 16:9 video. Search plays video muted with no
  way to unmute; the product page starts muted. Both loop. A video has a
  poster frame (`previewFrameTimeCode`). Apple publishes no codec, bitrate,
  audio or file-size rule for creative video; App Store Connect's reference
  data holds them. So the kit encodes H.264 High at a constant quality, not an
  app preview's 10–12 Mbps, and adds a silent stereo track in case the
  reference data asks for audio.
- **Images:** no alpha. Apple's templates are Display P3 at 16 bits, but no
  colour space is required.
- **Art safe areas,** from Apple's Sketch templates:
  - header 3840×1646: 1646×661 at (1097, 493), centred;
  - search 3840×2560: 2168×1030 at (836, 765), centred;
  - universal 5244×2950: 1402×962 at (1921, 660), centred across and set high.

  No crop or overlay geometry for the icon, title or Get button is published.
  App Store Connect's preview tool shows each device, orientation and Dark Mode.

- **Platforms:** iOS 27 and iPadOS 27 only.
- **Per locale:** each placement belongs to a version localization. A version
  takes one header per placement group.
- **Review:** creative assets go through App Review, with a version or as a
  standalone submission from Asset Library. Approved assets can replace a live
  version's without a new submission.
- **Content:**
  - "While you may depict content outside of your app or game in use, it must
    still relate to its general functionality." The in-use rule of Guidelines
    2.3.3 and 2.3.4 is for screenshots and previews.
  - No specific pricing, discounts, URLs or copyright symbols; no claims that
    can't be verified; no other platforms or marketplaces (2.3.10); none of
    Apple's recognitions, such as Editor's Choice, App of the Day, Game of the
    Day or an Apple Design Award.
  - A 4+ rating whatever the app's (2.3.8), which also reserves "For Kids" and
    "For Children" for the Kids Category. Violence may show action, but no gore
    and no weapons pointed at a person or the viewer.
  - The rights to every material, and fictional account data rather than a
    real person's (2.3.9).
  - Apple's Marketing Guidelines (device images used as is, one unmodified
    App Store badge) are written for marketing communications; Apple doesn't
    say they apply here.
- **Uploading:** App Store Connect's App Asset Library
  (`appAssetLibraryImages`, `appAssetLibraryVideos`,
  `appAssetLibraryPlacements`, with placement types
  `PRODUCT_PAGE_HEADER_ASSET` and `APP_STORE_SEARCH_RESULTS_ASSET`, each in
  the one placement group `DEFAULT_PROFILE`). fastlane PR #30442 adds
  `deliver`'s `creative_assets` option and Spaceship models for images, and
  PR #30457 extends them to video. Its entries are exactly `locale`, `path`,
  `placement_type` and `placement_group`, plus `preview_frame_time_code` for a
  video; unknown keys are an error.

## Capture pitfalls the tooling handles

- **The recorder loses time off camera.**
  - Over a take that switches apps or opens URLs between scenes, the
    recorder's clock fell more than 2 s behind the test's, a little more at
    each switch. No single correction fits every scene.
  - The host films each scene to its own file, starting when the scene begins
    and stopping when its steps finish, and `prepare` joins them. Nothing
    between scenes is filmed, so no drift carries from one scene to the next.
- **The recorder and the test's clock disagree.**
  - Measured gaps have ranged from about 0.2 s early to 1 s late, so `prepare`
    measures the gap for every take rather than assuming one.
  - The gap is the median, across scenes, between the tap that brings a scene on
    and the next frame ffmpeg's `scdet` scores above the threshold. A tab switch
    scores about 7; a toggle flip scores under 5.
  - `prepare` shifts every stretch and tap by that gap, then starts each scene on
    its own screen change.
- **The recording stops at the last change.**
  - `simctl io recordVideo` writes a frame only when the screen changes, so a
    closing held shot never reaches the file.
  - `prepare` holds the last frame out past the take's end.
  - The recorder can also miss the last change before a static screen and keep
    showing the screen before it. `holdOnScreenshot(_:)` saves a screenshot,
    and `prepare` shows it over the footage for the whole hold.
  - Each scene saves a screenshot as it finishes, and `prepare` warns when the
    scene's last kept frame differs from it. The comparison takes the largest
    mean luma difference over 8-pixel blocks: compression leaves about 10, and
    a stroke that missed its colour change measured 143. It leaves out the top
    7% of the screen, where the recording shows the Dynamic Island and
    XCUITest's screenshots don't.
- **Actions return long after they show.**
  - XCUITestKit's `setSwitch` holds its press for 0.9 s, then verifies the result
    before returning. Its flip is on screen about a second before the call ends.
  - A stretch timed back from the return would miss the flip entirely. Instead,
    the take records each action's window, and `prepare` keeps from just before
    the first frame that changed during it to its settle after the last.
  - A switch flip changes too few pixels for `scdet` (it scores under 0.3). The
    largest luma difference between consecutive frames catches it: about 2 for a
    still screen, tens for a flip.
- **Kept stretches overlap.**
  - A `keepTail` reaches back over the stretch before it.
  - The timeline keeps shared footage once, in the earlier stretch, so the
    scenes don't drift later and later.
- **Bitrate floor.**
  - A mostly still UI compresses below Apple's 10 Mbps minimum.
  - The final encode is all-intra H.264 at 10–12 Mbps, in two passes. A single
    pass aimed at 11 Mbps can still settle just under the floor.
  - Padding the bitrate with CBR filler doesn't work.
- **Zoom sharpness.** Renders scale from the take's native resolution, not from
  the downscaled output.
- **fastlane snapshot's cache.**
  - `~/Library/Caches/tools.fastlane/screenshots` is shared by every app on the
    machine. Simultaneous runs mix up their screenshots.
  - `TEST_RUNNER_SIMULATOR_HOST_HOME` doesn't redirect it.
  - `PromoStill` writes to a directory owned by the run instead.
  - snapshot can also exit 0 having captured nothing, so `promokit stills`
    counts what each run captured.
- **Simulators.** Each app owns its simulators, named
  `promokit-<app>-<device>` and targeted by UDID, with DerivedData under
  `.build/promo`. This keeps runs for different apps, or by different agents,
  apart.
- **Mac window captures.**
  - XCTest's capture is the window's bounding rectangle, opaque, with the screen
    in its corners. It loses the window's transparency: a transparent window
    becomes an opaque slab, and glass goes flat grey. The render masks it to the
    window's rounded corners, shaves its outermost half point and shadows it,
    scaled by the window's size in points, which the test records beside it; a
    fixed radius in `brand.css` misses the corners once the still is scaled.
  - ScreenCaptureKit captures the window on its own, with its transparency,
    corners and system shadow, but the test runner needs Screen Recording
    permission. The shadow spreads evenly left and right but further down
    than up, so a region to highlight is placed by matching the window's
    opaque pixels against a second, shadowless capture.
  - `-NSRequiresAquaSystemAppearance YES` forces light mode.
  - Don't pass `-ApplePersistenceIgnoreState`, or no windows open.
  - Don't capture the print panel: it shows the user's printer name.
- **Animations.** Apps often turn off UIKit animations for UI tests, with
  `UIView.setAnimationsEnabled(false)`. The camera films what the app does, so a
  take made that way shows each `UISwitch` as three still frames: off, pressed
  and on. A take needs the app to keep its animations; SwiftUI's own animations
  are unaffected either way.
- **XCUITest.**
  - Plain `tap()` on a SwiftUI toggle can miss. `PromoTake.setSwitch` goes
    through XCUITestKit's `setSwitch(to:in:)`.
  - On iPad, tapping the status bar pulls the app into a window.
  - The iPhone Duo's inner display can't be scripted: there's no way to open
    the simulator, and screenshots come back black.
