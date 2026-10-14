#if os(iOS)
  public import Foundation
  import UIKit
  public import XCTest
  import XCUIPromoKitTouch

  extension PromoTake {

    /// The interface orientation matching the device's, which the touch's points are laid out in.
    private static var interfaceOrientation: UIInterfaceOrientation {
      switch XCUIDevice.shared.orientation {
        case .portraitUpsideDown: .portraitUpsideDown
        case .landscapeLeft: .landscapeRight
        case .landscapeRight: .landscapeLeft
        default: .portrait
      }
    }

    static func velocity(from start: CGPoint, to end: CGPoint, duration: TimeInterval)
      -> XCUIGestureVelocity
    {
      XCUIGestureVelocity(hypot(end.x - start.x, end.y - start.y) / max(duration, .ulpOfOne))
    }

    /**
     Drags from `start` to `end` at an even pace and shows what it changes for `settle` seconds,
     keeping only that and the finger landing. The renderer can mark the finger along the drag.

     Unlike XCUITest's `adjust(toNormalizedSliderPosition:)`, which sets a slider in one jump,
     this moves the finger the way a person would, so the control follows it on camera.

     - Parameters:
       - start: Where the finger presses.
       - end: Where the finger lifts.
       - press: How long the finger rests at `start` before moving, in seconds.
       - duration: How long the finger takes to move from `start` to `end`, in seconds.
       - hold: How long the finger rests at `end` before lifting, in seconds.
       - settle: How long to show the result after the finger lifts.
     */
    public func drag(
      from start: XCUICoordinate,
      to end: XCUICoordinate,
      press: TimeInterval,
      duration: TimeInterval,
      hold: TimeInterval = 0,
      settle: TimeInterval
    ) {
      let from = start.screenPoint, to = end.screenPoint
      keepTail(settle: settle) {
        start.press(
          forDuration: press,
          thenDragTo: end,
          withVelocity: Self.velocity(from: from, to: to, duration: duration),
          thenHoldForDuration: hold
        )
        noteDrag(from: from, to: to, press: press, duration: duration, hold: hold)
        Thread.sleep(forTimeInterval: settle)
      }
    }

    /**
     Drags across `element` from `start` to `end` at an even pace and shows what it changes for
     `settle` seconds. See ``drag(from:to:press:duration:hold:settle:)``.

     - Parameters:
       - element: The element to drag across, such as a slider or a canvas.
       - start: Where the finger presses, from (0, 0) at `element`'s top-leading corner to (1, 1)
         at its bottom-trailing corner.
       - end: Where the finger lifts, in the same terms.
       - press: How long the finger rests at `start` before moving, in seconds.
       - duration: How long the finger takes to move from `start` to `end`, in seconds.
       - hold: How long the finger rests at `end` before lifting, in seconds.
       - settle: How long to show the result after the finger lifts.
     */
    public func drag(
      _ element: XCUIElement,
      from start: CGVector,
      to end: CGVector,
      press: TimeInterval,
      duration: TimeInterval,
      hold: TimeInterval = 0,
      settle: TimeInterval
    ) {
      drag(
        from: element.coordinate(withNormalizedOffset: start),
        to: element.coordinate(withNormalizedOffset: end),
        press: press,
        duration: duration,
        hold: hold,
        settle: settle
      )
    }

    /**
     Traces one continuous touch through `points` at an even speed and shows what it changes for
     `settle` seconds, keeping only that and the finger landing. The renderer can mark the
     finger along the path.

     Use it for strokes that curve or turn, which a straight ``drag(from:to:press:duration:hold:settle:)``
     can't draw. XCTest has no public API for this; the trace drives XCTest's own event
     synthesis, which UI-test tooling such as WebDriverAgent also relies on.

     - Parameters:
       - points: Where the finger presses, the points it moves through, and where it lifts.
       - press: How long the finger rests at the first point before moving, in seconds.
       - duration: How long the finger takes to move through every point, in seconds.
       - hold: How long the finger rests at the last point before lifting, in seconds.
       - settle: How long to show the result after the finger lifts.
     */
    public func trace(
      through points: [XCUICoordinate],
      press: TimeInterval,
      duration: TimeInterval,
      hold: TimeInterval = 0,
      settle: TimeInterval
    ) {
      let path = points.map(\.screenPoint)
      let timing = TouchPath(through: path, press: press, duration: duration, hold: hold)
      keepTail(settle: settle) {
        do {
          try synthesizeTouch(along: path, timing: timing)
          noteDrag(along: path, press: press, duration: duration, hold: hold)
        } catch {
          XCTFail("Couldn’t trace the touch: \(error.localizedDescription)")
        }
        Thread.sleep(forTimeInterval: settle)
      }
    }

    /**
     Traces one continuous touch across `element` through `points` at an even speed. See
     ``trace(through:press:duration:hold:settle:)``.

     - Parameters:
       - element: The element to trace across, such as a drawing canvas.
       - points: Where the finger presses, the points it moves through, and where it lifts, each
         from (0, 0) at `element`'s top-leading corner to (1, 1) at its bottom-trailing corner.
       - press: How long the finger rests at the first point before moving, in seconds.
       - duration: How long the finger takes to move through every point, in seconds.
       - hold: How long the finger rests at the last point before lifting, in seconds.
       - settle: How long to show the result after the finger lifts.
     */
    public func trace(
      _ element: XCUIElement,
      through points: [CGVector],
      press: TimeInterval,
      duration: TimeInterval,
      hold: TimeInterval = 0,
      settle: TimeInterval
    ) {
      trace(
        through: points.map { element.coordinate(withNormalizedOffset: $0) },
        press: press,
        duration: duration,
        hold: hold,
        settle: settle
      )
    }

    private func synthesizeTouch(along path: [CGPoint], timing: TouchPath) throws {
      var error: NSError?
      let synthesized = unsafe XCUIPromoKitSynthesizeTouch(
        path.map(XCUIPromoKitTouchPoint),
        timing.offsets.map { NSNumber(value: $0) },
        timing.lift,
        Self.interfaceOrientation.rawValue,
        &error
      )
      guard synthesized else { throw error ?? CocoaError(.featureUnsupported) }
    }
  }
#endif
