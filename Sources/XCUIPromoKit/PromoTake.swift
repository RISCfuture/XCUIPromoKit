public import Foundation
public import XCTest
public import XCUITestKit

/**
 Plays an App Store preview's script while `promokit record` films the simulator, noting which
 stretches to keep.

 XCUITest spends much of a run finding elements and waiting for the app to idle. A take marks
 the stretches to keep — a held shot, a tap and what it changes — and files each under a named
 scene. The host cuts the recording down to those stretches and frames each scene as the
 storyboard says.

 ```swift
 func testRecordPreview() throws {
   let app = XCUIApplication()
   let take = try PromoTake(app: app, tapLanding: 0.3)
   app.launch()
   setUpOpeningShot()

   try take.startRolling()
   take.scene("opening") { take.hold(2) }
   take.scene("questions") {
     take.tap(app.buttons["Questions"], settle: 1)
     take.setSwitch(app.switches["afterWorkToggle"], to: true, settle: 1)
   }
   try take.finish()
 }
 ```

 The host hands over a directory in ``markerDirectoryVariable`` (set it as
 `TEST_RUNNER_PROMO_MARKER_DIRECTORY`). Without it, as in an ordinary test run, the initializer
 throws `XCTSkip`. The host films each scene on its own, through files in that directory: the
 take touches `scene-<n>-ready`, the host starts recording and touches `scene-<n>-recording`, and
 once the scene's steps finish the take touches `scene-<n>-cut`. Whatever runs between scenes is
 never filmed. ``finish()`` writes `take.json`.
 */
@MainActor
public final class PromoTake {

  /// The environment variable naming the directory the host and the take signal through.
  public static let markerDirectoryVariable = "PROMO_MARKER_DIRECTORY"

  private static let pollInterval: TimeInterval = 0.05

  /// The app being filmed.
  public let app: XCUIApplication

  /// How long before an action first changes the screen a ``keepTail(settle:_:)`` keeps, in
  /// seconds.
  public let tapLanding: TimeInterval

  private let markers: URL
  private var log = TakeLog()
  private var rollingSince: ContinuousClock.Instant?
  private var handshakeTimeout: TimeInterval = ScaledTimeouts.launch
  private var handshakeError: RecordingError?
  private var scenesBegun = 0

  /**
   Prepares a take of `app`, skipping the test unless the host is recording.

   - Parameters:
     - app: The app being filmed. Taps are positioned against its frame.
     - tapLanding: How long before an action first changes the screen each
       ``keepTail(settle:_:)`` keeps, in seconds: how much of a tap's approach the take shows.
     - environment: Where to look for ``markerDirectoryVariable``.
   - Throws: `XCTSkip` when the test isn't running under `promokit record`.
   */
  public init(
    app: XCUIApplication,
    tapLanding: TimeInterval,
    environment: [String: String] = ProcessInfo.processInfo.environment
  ) throws {
    guard let path = environment[Self.markerDirectoryVariable] else {
      throw XCTSkip("Run through `promokit record` to record a take")
    }
    self.app = app
    self.tapLanding = tapLanding
    markers = URL(filePath: path, directoryHint: .isDirectory)
  }

  /**
   Starts the take's clock. Each ``scene(_:_:)`` is filmed from when it begins until its steps
   finish; nothing outside a scene is.

   - Parameter timeout: How long each scene waits for the host to start recording it.
   */
  public func startRolling(timeout: TimeInterval = ScaledTimeouts.launch) throws {
    handshakeTimeout = timeout
    rollingSince = .now
  }

  /**
   Films `steps` and files the stretches kept during them under the scene the storyboard knows
   as `name`. Set up the scene's opening shot first: the host starts recording when this begins
   and stops once `steps` finish. A screenshot of the screen as `steps` finish lets the host
   check that the footage reached it.

   If the host doesn't start recording, the scene's steps still run and ``finish()`` throws.
   */
  public func scene(_ name: String, _ steps: () throws -> Void) rethrows {
    let index = scenesBegun
    scenesBegun += 1
    log.begin(scene: name)
    if waitForHostToRecord(scene: index) { log.beganRecording(at: secondsRolling()) }
    defer { signalHost("scene-\(index)-cut") }
    try steps()
    saveClosingShot(of: index)
  }

  /// Keeps everything that happens during `action`.
  @discardableResult
  public func keep<Result>(_ action: () throws -> Result) rethrows -> Result {
    let start = secondsRolling()
    let result = try action()
    log.keep(from: start, to: secondsRolling())
    return result
  }

  /**
   Keeps the moments `action` changes the screen: from ``tapLanding`` seconds before its first
   change until `settle` after its last, without the time XCUITest spends finding the element,
   waiting for the app to idle, or checking the result.

   The take notes when `action` ran; `promokit prepare` finds in the footage what changed during
   it.

   - Parameters:
     - settle: How long `action` spends, at its end, showing what it changed. The action must
       actually wait this long; ``tap(_:settle:)`` and its siblings do.
     - action: The action to film.
   */
  @discardableResult
  public func keepTail<Result>(settle: TimeInterval, _ action: () throws -> Result) rethrows
    -> Result
  {
    let start = secondsRolling()
    let result = try action()
    log.keepTail(from: start, endingAt: secondsRolling(), settle: settle, landing: tapLanding)
    return result
  }

  /// Holds the shot for `seconds`, keeping all of it.
  public func hold(_ seconds: TimeInterval) {
    keep { Thread.sleep(forTimeInterval: seconds) }
  }

  /**
   Takes a screenshot and holds the shot on it for `seconds`, keeping all of it.

   The simulator's recorder writes a frame only when it notices the screen change, and can miss
   the last change before a static screen, filming the screen before it instead. The host shows
   this screenshot for the whole hold, so a closing shot shows what was really on screen.

   - Parameter seconds: How long to hold.
   - Throws: ``RecordingError/couldNotWriteHeldFrame(_:)`` if the screenshot can't be saved.
   */
  public func holdOnScreenshot(_ seconds: TimeInterval) throws {
    let file = log.nextHeldFrameFile
    do {
      try XCUIScreen.main.screenshot().pngRepresentation.write(to: marker(file), options: .atomic)
    } catch {
      throw RecordingError.couldNotWriteHeldFrame(error)
    }
    let start = secondsRolling()
    Thread.sleep(forTimeInterval: seconds)
    log.hold(file, from: start, to: secondsRolling())
  }

  /**
   Notes a tap at `point`, in the app's coordinates, so the renderer can mark it.

   The tap helpers on this type call this themselves. Call it directly only for a gesture they
   don't cover, right after the finger lifts.
   */
  public func noteTap(at point: CGPoint) {
    log.tap(at: TakeLog.normalized(point, in: app.frame), time: secondsRolling())
  }

  /**
   Notes a straight drag in the app's coordinates, so the renderer can mark the finger along it.
   See ``noteDrag(along:press:duration:hold:)``.
   */
  public func noteDrag(
    from start: CGPoint,
    to end: CGPoint,
    press: TimeInterval,
    duration: TimeInterval,
    hold: TimeInterval
  ) {
    noteDrag(along: [start, end], press: press, duration: duration, hold: hold)
  }

  /**
   Notes a drag along `path`, in the app's coordinates, so the renderer can mark the finger along
   it.

   The drag and trace helpers call this themselves. Call it directly only for a gesture they
   don't cover, right after the finger lifts.

   - Parameters:
     - path: Where the finger pressed, the points it moved through at an even speed, and where it
       lifted.
     - press: How long the finger rested at the start before moving, in seconds.
     - duration: How long the finger took to move along `path`, in seconds.
     - hold: How long the finger rested at the end before lifting, in seconds.
   */
  public func noteDrag(
    along path: [CGPoint],
    press: TimeInterval,
    duration: TimeInterval,
    hold: TimeInterval
  ) {
    log.drag(
      along: path.map { TakeLog.normalized($0, in: app.frame) },
      press: press,
      duration: duration,
      hold: hold,
      liftingAt: secondsRolling()
    )
  }

  /**
   Writes `take.json` for the host, which stops recording once it appears.

   - Throws: ``RecordingError/couldNotWriteTake(_:)`` if the file can't be written.
   */
  public func finish() throws {
    if let handshakeError { throw handshakeError }
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    do {
      let data = try encoder.encode(log.take(screen: app.frame.size))
      try data.write(to: marker("take.json"), options: .atomic)
    } catch {
      throw RecordingError.couldNotWriteTake(error)
    }
  }

  private func secondsRolling() -> Double {
    guard let rollingSince else {
      preconditionFailure("Call startRolling() before keeping footage")
    }
    return (ContinuousClock.now - rollingSince) / .seconds(1)
  }

  /// Asks the host to start filming scene `index`, and waits until it has. Returns whether it did.
  private func waitForHostToRecord(scene index: Int) -> Bool {
    guard handshakeError == nil else { return false }
    signalHost("scene-\(index)-ready")
    let deadline = Date.now.addingTimeInterval(handshakeTimeout)
    while !FileManager.default.fileExists(atPath: marker("scene-\(index)-recording").path) {
      guard Date.now < deadline else {
        handshakeError = .hostNeverStartedRecording
        return false
      }
      Thread.sleep(forTimeInterval: Self.pollInterval)
    }
    return true
  }

  /// Saves the screen for the host to check the scene's footage against. The check is advisory, so
  /// a screenshot that can't be saved is skipped.
  private func saveClosingShot(of index: Int) {
    let file = "scene-\(index)-closing.png",
      png = XCUIScreen.main.screenshot().pngRepresentation
    guard (try? png.write(to: marker(file), options: .atomic)) != nil else { return }
    log.closingShot(file)
  }

  private func signalHost(_ name: String) {
    guard handshakeError == nil else { return }
    do { try touch(name) } catch { handshakeError = error }
  }

  private func touch(_ name: String) throws(RecordingError) {
    guard FileManager.default.createFile(atPath: marker(name).path, contents: nil) else {
      throw RecordingError.couldNotSignalHost(name)
    }
  }

  private func marker(_ name: String) -> URL {
    markers.appending(path: name)
  }
}
