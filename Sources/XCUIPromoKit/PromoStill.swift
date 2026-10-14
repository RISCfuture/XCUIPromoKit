public import Foundation
import UniformTypeIdentifiers
public import XCTest

/**
 Captures stills for App Store screenshots.

 Under `promokit stills`, which sets ``directoryVariable`` (as `TEST_RUNNER_PROMO_STILL_DIRECTORY`),
 each still is written straight to that directory as `<name>.png`. That directory belongs to the
 one run, so simultaneous runs for different apps can't mix up their stills, as they can in
 fastlane snapshot's shared cache. Without it, as on the Mac, where the host exports attachments
 from the result bundle, each still is attached to the test.

 ```swift
 try PromoStill.capture("0-results-moderate-risk", in: self)
 ```
 */
@MainActor
public enum PromoStill {

  /// The environment variable naming the directory stills are written to.
  public static let directoryVariable = "PROMO_STILL_DIRECTORY"

  nonisolated private static let allowedNameCharacters = CharacterSet.alphanumerics.union(
    .init(charactersIn: "._-")
  )

  /**
   Captures a still named `name`.

   - Parameters:
     - name: The still's name, which the storyboard refers to. Letters, digits, dots, hyphens and
       underscores only.
     - element: What to capture: a window on the Mac, say. The whole screen if `nil`.
     - regions: Parts of the still to highlight, each the union of its elements' frames. They
       may lie outside `element`, as an open menu does, and are clipped to the still. They're saved
       beside the still as `<name>.highlights.json`, in the still's pixels, for brand.css to style.
     - timeout: If set, captures again until two captures in a row are identical, so scrollbars
       and animations have come to rest, for at most this long.
     - testCase: The test to attach the still to when there's no still directory.
     - environment: Where to look for ``directoryVariable``.
   - Throws: ``StillError`` if the name is invalid, the screen doesn't settle in time, a region
     lies wholly off the still, or a file can't be written.
   */
  public static func capture(
    _ name: String,
    of element: XCUIElement? = nil,
    highlighting regions: [[XCUIElement]] = [],
    settlingWithin timeout: Duration? = nil,
    in testCase: XCTestCase,
    environment: [String: String] = ProcessInfo.processInfo.environment
  ) throws {
    guard isValid(name: name) else { throw StillError.invalidName(name) }
    let screenshot =
      if let timeout {
        try settledScreenshot(named: name, of: element, within: timeout)
      } else {
        self.screenshot(of: element)
      }
    let highlights =
      regions.isEmpty
      ? nil : try Highlights(named: name, regions: regions, in: screenshot, of: element)

    if let directory = environment[directoryVariable] {
      try write(screenshot.pngRepresentation, to: "\(name).png", for: name, in: directory)
      if let highlights {
        try write(highlights.json(), to: "\(name).\(Highlights.suffix)", for: name, in: directory)
      }
    } else {
      attach(screenshot.pngRepresentation, named: name, type: .png, to: testCase)
      if let highlights {
        attach(try highlights.json(), named: "\(name).highlights", type: .json, to: testCase)
      }
    }
  }

  nonisolated static func isValid(name: String) -> Bool {
    !name.isEmpty && !name.hasPrefix(".")
      && name.unicodeScalars.allSatisfy { allowedNameCharacters.contains($0) && $0.isASCII }
  }

  private static func screenshot(of element: XCUIElement?) -> XCUIScreenshot {
    element?.screenshot() ?? XCUIScreen.main.screenshot()
  }

  private static func settledScreenshot(
    named name: String,
    of element: XCUIElement?,
    within timeout: Duration
  ) throws -> XCUIScreenshot {
    let clock = ContinuousClock()
    let deadline = clock.now + timeout
    var previous = screenshot(of: element)
    repeat {
      let current = screenshot(of: element)
      if current.pngRepresentation == previous.pngRepresentation { return current }
      previous = current
    } while clock.now < deadline
    throw StillError.didNotSettle(name, timeout)
  }

  static func write(_ data: Data, to file: String, for name: String, in directory: String) throws {
    do {
      try data.write(
        to: URL(filePath: directory, directoryHint: .isDirectory).appending(path: file),
        options: .atomic
      )
    } catch {
      throw StillError.couldNotWrite(name, error)
    }
  }

  static func attach(_ data: Data, named name: String, type: UTType, to testCase: XCTestCase) {
    let attachment = XCTAttachment(data: data, uniformTypeIdentifier: type.identifier)
    attachment.name = name
    attachment.lifetime = .keepAlways
    testCase.add(attachment)
  }
}
