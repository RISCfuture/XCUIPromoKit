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
       - testCase: The test to attach the still to when there's no still directory.
       - environment: Where to look for ``directoryVariable``.
     - Throws: ``StillError`` if the name is invalid, the runner may not record the screen, no
       single window matches, the capture fails, or the file can't be written.
     */
    public static func captureWindow(
      _ name: String,
      of element: XCUIElement,
      ownedBy bundleIdentifier: String,
      in testCase: XCTestCase,
      environment: [String: String] = ProcessInfo.processInfo.environment
    ) async throws {
      let frame = element.frame
      try await captureWindow(name, in: testCase, environment: environment) {
        $0.owningApplication?.bundleIdentifier == bundleIdentifier
          && approximatelyEqual($0.frame, frame)
      }
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
      guard isValid(name: name) else { throw StillError.invalidName(name) }
      guard CGPreflightScreenCaptureAccess() else {
        throw StillError.noScreenRecordingPermission(
          Bundle.main.bundleIdentifier ?? "The test runner"
        )
      }
      let window = try await onScreenWindow(named: name, where: isWindow)
      let png = try await capture(window, named: name)

      if let directory = environment[directoryVariable] {
        try write(png, to: "\(name).png", for: name, in: directory)
      } else {
        attach(png, named: name, type: .png, to: testCase)
      }
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

    private static func capture(_ window: SCWindow, named name: String) async throws -> Data {
      let configuration = SCScreenshotConfiguration()
      configuration.showsCursor = false
      configuration.ignoreShadows = false
      do {
        let output = try await SCScreenshotManager.captureScreenshot(
          contentFilter: SCContentFilter(desktopIndependentWindow: window),
          configuration: configuration
        )
        guard let image = output.sdrImage, let png = pngData(image) else {
          throw CocoaError(.fileWriteUnknown)
        }
        return png
      } catch {
        throw StillError.couldNotCapture(name, error)
      }
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
#endif
