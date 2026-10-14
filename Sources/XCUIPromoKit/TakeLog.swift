import CoreGraphics
import Foundation

/// The bookkeeping behind a ``PromoTake``, apart from the clock and the simulator so it can be
/// exercised on its own.
struct TakeLog: Equatable, Sendable {
  private(set) var currentScene: String?
  private(set) var segments: [Take.Segment] = []
  private(set) var taps: [Take.Tap] = []
  private(set) var drags: [Take.Drag] = []
  private(set) var heldFrames: [Take.HeldFrame] = []
  private(set) var closingShots: [Take.ClosingShot] = []
  private(set) var recordings: [Take.Recording] = []

  /// The file name for the next held frame's screenshot.
  var nextHeldFrameFile: String { "held-\(heldFrames.count).png" }

  /// Files everything kept from now on under `name`.
  mutating func begin(scene name: String) {
    currentScene = name
  }

  /// Keeps the stretch from `start` to `end`.
  mutating func keep(from start: Double, to end: Double) {
    segments.append(.init(scene: requireScene(), start: start, end: max(start, end)))
  }

  /**
   Keeps the moments an action took effect. The action ran from `start` until `end` less its
   `settle`; the host narrows that to what changed on screen. Until it does, the stretch is the
   `landing` and `settle` around the action's return.
   */
  mutating func keepTail(from start: Double, endingAt end: Double, settle: Double, landing: Double)
  {
    let activity = Take.Activity(
      start: start,
      end: max(start, end - settle),
      landing: landing,
      settle: settle
    )
    segments.append(
      .init(
        scene: requireScene(),
        start: max(0, end - settle - landing),
        end: end,
        activity: activity
      )
    )
  }

  /// Notes a tap at `point`, normalized to the app's frame, lifting at `time`.
  mutating func tap(at point: CGPoint, time: Double) {
    taps.append(.init(scene: requireScene(), time: time, x: point.x, y: point.y))
  }

  /**
   Notes a drag along `path`, normalized to the app's frame, whose finger lifts at `time`, having
   pressed for `press` seconds, moved for `duration` and held for `hold`.
   */
  mutating func drag(
    along path: [CGPoint],
    press: Double,
    duration: Double,
    hold: Double,
    liftingAt time: Double
  ) {
    drags.append(
      .init(
        scene: requireScene(),
        start: time - hold - duration,
        press: press,
        duration: duration,
        hold: hold,
        path: path.map { .init(x: $0.x, y: $0.y) }
      )
    )
  }

  /// Notes that the host started filming the current scene at `time`.
  mutating func beganRecording(at time: Double) {
    recordings.append(.init(scene: requireScene(), start: time))
  }

  /// Keeps the stretch from `start` to `end`, showing the screenshot in `file` throughout.
  mutating func hold(_ file: String, from start: Double, to end: Double) {
    keep(from: start, to: end)
    heldFrames.append(.init(file: file, start: start, end: max(start, end)))
  }

  /// Notes that `file` shows the screen as the current scene finished.
  mutating func closingShot(_ file: String) {
    closingShots.append(.init(scene: requireScene(), file: file))
  }

  /// The take as written to `take.json`.
  func take(screen: CGSize) -> Take {
    .init(
      screen: .init(width: screen.width, height: screen.height),
      segments: segments,
      taps: taps,
      drags: drags,
      heldFrames: heldFrames,
      closingShots: closingShots,
      recordings: recordings
    )
  }

  private func requireScene() -> String {
    guard let currentScene else {
      preconditionFailure("Keep footage inside scene(_:_:), so the storyboard knows where it goes")
    }
    return currentScene
  }
}

extension TakeLog {

  /// Where `point`, in the app's coordinates, falls within `frame`, from (0, 0) at its top-leading
  /// corner to (1, 1) at its bottom-trailing corner.
  static func normalized(_ point: CGPoint, in frame: CGRect) -> CGPoint {
    guard frame.width > 0, frame.height > 0 else { return .zero }
    return CGPoint(
      x: (point.x - frame.minX) / frame.width,
      y: (point.y - frame.minY) / frame.height
    )
  }
}
