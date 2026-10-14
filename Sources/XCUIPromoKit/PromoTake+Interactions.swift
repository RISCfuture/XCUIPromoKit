public import Foundation
public import XCTest
import XCUITestKit

extension PromoTake {

  /// How far in from a switch's trailing edge XCUITestKit presses it, in points.
  private static let switchInsetFromTrailingEdge: CGFloat = 25

  static func switchPoint(in frame: CGRect) -> CGPoint {
    let inset = min(switchInsetFromTrailingEdge, frame.width / 2)
    return CGPoint(x: frame.maxX - inset, y: frame.midY)
  }

  /**
   Taps `element` and shows what it changes for `settle` seconds, keeping only that and the tap
   landing.

   - Parameters:
     - element: The element to tap.
     - settle: How long to show the result.
   */
  public func tap(_ element: XCUIElement, settle: TimeInterval) {
    keepTail(settle: settle) {
      let point = element.frame.center
      element.tap()
      noteTap(at: point)
      Thread.sleep(forTimeInterval: settle)
    }
  }

  /**
   Sets a switch with XCUITestKit's `setSwitch(to:in:)` and shows the result for `settle` seconds.

   - Parameters:
     - element: The switch, checkbox or SwiftUI `Toggle`.
     - value: Whether it should end up on.
     - settle: How long to show the result.
   - Returns: Whether the switch ended up in the wanted state.
   */
  @discardableResult
  public func setSwitch(
    _ element: XCUIElement,
    to value: Bool,
    settle: TimeInterval
  ) -> Bool {
    keepTail(settle: settle) {
      let point = Self.switchPoint(in: element.frame)
      let switched = element.setSwitch(to: value, in: app)
      noteTap(at: point)
      Thread.sleep(forTimeInterval: settle)
      return switched
    }
  }

  /**
   Types `text` into `element` a character at a time, keeping all of it.

   - Parameters:
     - text: What to type.
     - element: The field to type into. It is tapped first to focus it.
     - cadence: How quickly and unevenly to type.
     - settle: How long to show the field after tapping it, before typing.
   */
  public func type(
    _ text: String,
    into element: XCUIElement,
    cadence: TypingCadence,
    settle: TimeInterval
  ) {
    tap(element, settle: settle)
    keep {
      for (character, pause) in zip(text, cadence.pauses(for: text)) {
        element.typeText(String(character))
        Thread.sleep(forTimeInterval: pause)
      }
    }
  }

  /**
   Opens a menu, picker or dropdown and holds on it while it's open.

   - Parameters:
     - control: The control that opens it.
     - option: An element that appears once it's open.
     - seconds: How long to hold on it.
   - Returns: Whether `option` appeared.
   */
  @discardableResult
  public func openAndHold(
    _ control: XCUIElement,
    revealing option: XCUIElement,
    for seconds: TimeInterval
  ) -> Bool {
    keepTail(settle: seconds) {
      let point = control.frame.center
      control.tap()
      noteTap(at: point)
      let opened = option.waitForExistence(timeout: ScaledTimeouts.short)
      Thread.sleep(forTimeInterval: seconds)
      return opened
    }
  }
}

extension CGRect {
  var center: CGPoint { CGPoint(x: midX, y: midY) }
}
