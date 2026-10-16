#if os(macOS)
  public import Foundation
  public import XCTest

  extension PromoStill {
    /// The environment variable naming how a Mac window is captured: `screen` or `window`.
    nonisolated public static let windowCaptureVariable = "PROMO_MAC_CAPTURE"
  }

  @available(macOS 26, *)
  extension PromoStill {

    /**
     Captures a Mac window the way `promokit.json`'s `mac.capture` asks, which `promokit mac-stills`
     passes in ``windowCaptureVariable``.

     - `screen`, the default, grabs the window's rectangle of screen with
       ``capture(_:of:highlighting:settlingWithin:in:environment:)``: opaque, with the screen behind
       its corners, so `promokit render` rounds its corners and shadows it. Beside the still it saves
       `<name>.window.json`, the window's size in points, which the render scales the corners and
       shadow by.
     - `window` captures the window on its own with
       ``captureWindow(_:of:ownedBy:highlighting:settlingWithin:in:environment:)``, with its
       transparency and its real corners and shadow. The test runner needs Screen Recording
       permission.

     ```swift
     try await PromoStill.capture(
       "settings", of: app.windows["Settings"], ownedBy: "com.example.app", in: self)
     ```

     - Parameters:
       - name: The still's name, which the storyboard refers to. Letters, digits, dots, hyphens
         and underscores only.
       - window: The window to capture.
       - bundleIdentifier: The app that owns the window.
       - regions: Parts of the still to highlight, each the union of its elements' frames.
       - timeout: If set, captures again until two captures in a row are identical, for at most
         this long.
       - testCase: The test to attach the still to when there's no still directory.
       - environment: Where to look for ``windowCaptureVariable`` and ``directoryVariable``.
     - Throws: ``StillError`` for any reason the capture it chooses throws.
     */
    public static func capture(
      _ name: String,
      of window: XCUIElement,
      ownedBy bundleIdentifier: String,
      highlighting regions: [[XCUIElement]] = [],
      settlingWithin timeout: Duration? = nil,
      in testCase: XCTestCase,
      environment: [String: String] = ProcessInfo.processInfo.environment
    ) async throws {
      switch WindowCapture(environment: environment) {
        case .screen:
          try capture(
            name,
            of: window,
            highlighting: regions,
            settlingWithin: timeout,
            in: testCase,
            environment: environment
          )
          try save(
            WindowSize(window.frame.size).json(),
            as: WindowSize.suffix,
            for: name,
            in: testCase,
            environment: environment
          )
        case .window:
          try await captureWindow(
            name,
            of: window,
            ownedBy: bundleIdentifier,
            highlighting: regions,
            settlingWithin: timeout,
            in: testCase,
            environment: environment
          )
      }
    }
  }

  /// How a Mac window is captured.
  enum WindowCapture: String {
    /// The window's rectangle of screen, through XCTest.
    case screen
    /// The window on its own, through ScreenCaptureKit.
    case window

    /// The capture `environment` names, or `screen` if it names none.
    init(environment: [String: String]) {
      guard let value = environment[PromoStill.windowCaptureVariable] else {
        self = .screen
        return
      }
      guard let capture = Self(rawValue: value) else {
        preconditionFailure(
          "\(PromoStill.windowCaptureVariable) is “\(value)”, not “screen” or “window”"
        )
      }
      self = capture
    }
  }

  /// A window's size in points, which `promokit render` scales its corners and shadow by.
  struct WindowSize: Encodable {
    static let suffix = "window.json"

    let width: Double
    let height: Double

    init(_ size: CGSize) {
      width = size.width
      height = size.height
    }

    func json() throws -> Data {
      let encoder = JSONEncoder()
      encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
      return try encoder.encode(self)
    }
  }
#endif
