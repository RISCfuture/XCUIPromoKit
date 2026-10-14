import Foundation

/**
 What a recorded take keeps: the stretches worth showing, each filed under a scene, and every tap
 the camera saw.

 Times are seconds since the host started recording, by the test's clock. The host corrects them
 for the recorder's lag before cutting, so they are written exactly as measured. The take is
 encoded as `take.json` in the marker directory, which `promokit record` reads.
 */
struct Take: Codable, Equatable, Sendable {

  /// The format version written to `take.json`.
  static let currentVersion = 1

  let version: Int

  /// The app's frame in points, which tap positions are normalized against.
  let screen: Size

  let segments: [Segment]
  let taps: [Tap]
  let drags: [Drag]
  let heldFrames: [HeldFrame]

  /// The screen as each scene finished, which the host checks the footage against.
  let closingShots: [ClosingShot]

  /// When the host started filming each scene, in order. The host films each to its own file.
  let recordings: [Recording]

  init(
    screen: Size,
    segments: [Segment],
    taps: [Tap],
    drags: [Drag],
    heldFrames: [HeldFrame],
    closingShots: [ClosingShot],
    recordings: [Recording]
  ) {
    version = Self.currentVersion
    self.screen = screen
    self.segments = segments
    self.recordings = recordings
    self.taps = taps
    self.drags = drags
    self.heldFrames = heldFrames
    self.closingShots = closingShots
  }

  /**
   A stretch of the recording to keep, filed under the scene it belongs to.

   A stretch kept around an action also carries the action's ``Activity``. The host narrows the
   stretch to the moments the screen actually changed during it, and uses `start` and `end` only
   if it finds none.
   */
  struct Segment: Codable, Equatable, Sendable {
    let scene: String
    let start: Double
    let end: Double
    var activity: Activity?
  }

  /// When an action ran, and how much to keep either side of what it changed on screen.
  struct Activity: Codable, Equatable, Sendable {

    /// When the action began, including XCUITest's search for the element.
    let start: Double

    /// When the action returned, before its settle.
    let end: Double

    /// How long to keep before the screen first changes.
    let landing: Double

    /// How long to keep after the screen last changes.
    let settle: Double
  }

  /// A tap the renderer can mark, at the moment the finger lifts.
  struct Tap: Codable, Equatable, Sendable {
    let scene: String
    let time: Double

    /// Horizontal position, from 0 at the app's leading edge to 1 at its trailing edge.
    let x: Double

    /// Vertical position, from 0 at the app's top edge to 1 at its bottom edge.
    let y: Double
  }

  /**
   A drag the renderer can mark: the finger presses at the first point of `path`, moves through
   the rest at an even speed, and holds at the last before lifting.
   */
  struct Drag: Codable, Equatable, Sendable {
    let scene: String

    /// When the finger starts moving.
    let start: Double

    /// How long the finger rests at the start of `path` before moving, in seconds.
    let press: Double

    /// How long the finger takes to move along `path`, in seconds.
    let duration: Double

    /// How long the finger rests at the end of `path` before lifting, in seconds.
    let hold: Double

    let path: [Point]
  }

  /// A position, from (0, 0) at the app's top-leading corner to (1, 1) at its bottom-trailing
  /// corner.
  struct Point: Codable, Equatable, Sendable {
    let x: Double
    let y: Double
  }

  /// When the host started filming a scene.
  struct Recording: Codable, Equatable, Sendable {
    let scene: String
    let start: Double
  }

  /// A screenshot, saved beside `take.json`, that the host shows in place of the footage from
  /// `start` to `end`.
  struct HeldFrame: Codable, Equatable, Sendable {
    let file: String
    let start: Double
    let end: Double
  }

  /// A screenshot, saved beside `take.json`, of the screen as `scene` finished.
  struct ClosingShot: Codable, Equatable, Sendable {
    let scene: String
    let file: String
  }

  /// A size in points.
  struct Size: Codable, Equatable, Sendable {
    let width: Double
    let height: Double
  }
}
