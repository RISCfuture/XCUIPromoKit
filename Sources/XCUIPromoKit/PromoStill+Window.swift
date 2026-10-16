#if os(macOS)
  public import Foundation
  import ImageIO
  // Weak-linked so the library loads on macOS versions without the screenshot classes, whichever SDK
  // builds it.
  @_weakLinked public import ScreenCaptureKit
  import UniformTypeIdentifiers
  public import XCTest

  @available(macOS 26, *)
  extension PromoStill {

    private static let frameTolerance: CGFloat = 1

    /**
     Captures one Mac window on its own, with its transparency and its real shadow, as
     `screencapture -l` does, rather than the rectangle of screen behind it.

     The test runner needs Screen Recording permission, which macOS doesn't prompt for during a
     test run: add the runner app under System Settings › Privacy & Security.

     A window drawn in a material, such as a menu or a menu bar extra's panel, has nothing behind it
     to sample once it's captured on its own, and comes out flat grey. Capture such a window as part
     of the screen, over a backdrop the test stages, with ``capture(_:of:highlighting:settlingWithin:in:environment:)``.

     ```swift
     try await PromoStill.captureWindow(
       "settings", of: app.windows["Settings"], ownedBy: "com.example.app", in: self)
     ```

     - Parameters:
       - name: The still's name, which the storyboard refers to. Letters, digits, dots, hyphens
         and underscores only.
       - element: The window, found on screen by its frame.
       - bundleIdentifier: The app that owns the window, since other processes' windows can share
         its frame.
       - regions: Parts of the still to highlight, each the union of its elements' frames, saved
         beside the still as `<name>.highlights.json` in the still's pixels, shadow included.
       - timeout: If set, captures again until two captures in a row are identical, for at most
         this long.
       - testCase: The test to attach the still to when there's no still directory.
       - environment: Where to look for ``directoryVariable``.
     - Throws: ``StillError`` if the name is invalid, the runner may not record the screen, no
       single window matches, the window doesn't settle in time, a region lies wholly off the
       still, the capture fails, or a file can't be written.
     */
    public static func captureWindow(
      _ name: String,
      of element: XCUIElement,
      ownedBy bundleIdentifier: String,
      highlighting regions: [[XCUIElement]] = [],
      settlingWithin timeout: Duration? = nil,
      in testCase: XCTestCase,
      environment: [String: String] = ProcessInfo.processInfo.environment
    ) async throws {
      let frame = element.frame
      try checkCanCapture(name)
      let window = try await onScreenWindow(named: name) {
        $0.owningApplication?.bundleIdentifier == bundleIdentifier
          && approximatelyEqual($0.frame, frame)
      }
      let image = try await settledImage(of: window, named: name, within: timeout)
      try save(
        png(image, named: name),
        as: "png",
        for: name,
        in: testCase,
        environment: environment
      )
      guard !regions.isEmpty else { return }

      let bare = try await capture(window, named: name, withShadow: false)
      let highlights = try Highlights(
        named: name,
        regions: regions,
        in: image,
        windowedAt: frame,
        bare: bare
      )
      try save(
        highlights.json(),
        as: Highlights.suffix,
        for: name,
        in: testCase,
        environment: environment
      )
    }

    /**
     Captures the one on-screen window `isWindow` picks, with its transparency and its real shadow.
     This reaches windows outside the accessibility tree, such as a menu bar extra's panel.

     The test runner needs Screen Recording permission.

     ```swift
     try await PromoStill.captureWindow("panel", in: self) {
       $0.owningApplication?.bundleIdentifier == "com.example.app" && $0.windowLayer > 0
     }
     ```

     - Parameters:
       - name: The still's name, which the storyboard refers to.
       - testCase: The test to attach the still to when there's no still directory.
       - environment: Where to look for ``directoryVariable``.
       - isWindow: Whether a window is the one to capture. Exactly one on-screen window must match.
     - Throws: ``StillError`` if the name is invalid, no single window matches, the capture fails,
       or the file can't be written.
     */
    public static func captureWindow(
      _ name: String,
      in testCase: XCTestCase,
      environment: [String: String] = ProcessInfo.processInfo.environment,
      where isWindow: (SCWindow) -> Bool
    ) async throws {
      try checkCanCapture(name)
      let window = try await onScreenWindow(named: name, where: isWindow)
      let image = try await capture(window, named: name)
      try save(
        png(image, named: name),
        as: "png",
        for: name,
        in: testCase,
        environment: environment
      )
    }

    private static func checkCanCapture(_ name: String) throws {
      guard isValid(name: name) else { throw StillError.invalidName(name) }
      guard CGPreflightScreenCaptureAccess() else {
        throw StillError.noScreenRecordingPermission(
          Bundle.main.bundleIdentifier ?? "The test runner"
        )
      }
    }

    private static func settledImage(
      of window: SCWindow,
      named name: String,
      within timeout: Duration?
    ) async throws -> CGImage {
      guard let timeout else { return try await capture(window, named: name) }
      let clock = ContinuousClock()
      let deadline = clock.now + timeout
      var previous = try await capture(window, named: name)
      repeat {
        let current = try await capture(window, named: name)
        if Bitmap(current) == Bitmap(previous) { return current }
        previous = current
      } while clock.now < deadline
      throw StillError.didNotSettle(name, timeout)
    }

    private static func onScreenWindow(
      named name: String,
      where isWindow: (SCWindow) -> Bool
    ) async throws -> SCWindow {
      let content: SCShareableContent
      do {
        content = try await .excludingDesktopWindows(true, onScreenWindowsOnly: true)
      } catch {
        throw StillError.couldNotCapture(name, error)
      }
      let matches = content.windows.filter(isWindow)
      guard matches.count == 1, let window = matches.first else {
        throw StillError.windowNotFound(name, matches: matches.map(description))
      }
      return window
    }

    private static func description(of window: SCWindow) -> String {
      "\(window.owningApplication?.bundleIdentifier ?? "no app") at layer \(window.windowLayer)"
    }

    private static func capture(
      _ window: SCWindow,
      named name: String,
      withShadow shadow: Bool = true
    ) async throws -> CGImage {
      let configuration = SCScreenshotConfiguration()
      configuration.showsCursor = false
      configuration.ignoreShadows = !shadow
      do {
        let output = try await SCScreenshotManager.captureScreenshot(
          contentFilter: SCContentFilter(desktopIndependentWindow: window),
          configuration: configuration
        )
        guard let image = output.sdrImage else { throw CocoaError(.fileReadUnknown) }
        return image
      } catch {
        throw StillError.couldNotCapture(name, error)
      }
    }

    private static func png(_ image: CGImage, named name: String) throws -> Data {
      guard let png = pngData(image) else {
        throw StillError.couldNotCapture(name, CocoaError(.fileWriteUnknown))
      }
      return png
    }

    private static func pngData(_ image: CGImage) -> Data? {
      let data = NSMutableData()
      guard
        let destination = CGImageDestinationCreateWithData(
          data,
          UTType.png.identifier as CFString,
          1,
          nil
        )
      else { return nil }
      CGImageDestinationAddImage(destination, image, nil)
      return CGImageDestinationFinalize(destination) ? data as Data : nil
    }

    private static func approximatelyEqual(_ first: CGRect, _ second: CGRect) -> Bool {
      [
        (first.minX, second.minX), (first.minY, second.minY),
        (first.width, second.width), (first.height, second.height)
      ]
      .allSatisfy { abs($0 - $1) <= frameTolerance }
    }
  }

  extension Highlights {
    /**
     Measures each region of `image`, a window captured with its shadow, given the window's `frame`
     on screen and `bare`, the same window captured without its shadow.
     */
    @MainActor
    init(
      named name: String,
      regions: [[XCUIElement]],
      in image: CGImage,
      windowedAt frame: CGRect,
      bare: CGImage
    ) throws {
      let shadowed = Bitmap(image)
      let offset = shadowed.offset(of: Bitmap(bare))
      let scale = CGFloat(bare.width) / frame.width
      try self.init(
        named: name,
        frames: regions.map { $0.map(\.frame) },
        origin: CGPoint(
          x: frame.minX - CGFloat(offset.x) / scale,
          y: frame.minY - CGFloat(offset.y) / scale
        ),
        scale: scale,
        pixels: CGSize(width: shadowed.width, height: shadowed.height)
      )
    }
  }
#endif
