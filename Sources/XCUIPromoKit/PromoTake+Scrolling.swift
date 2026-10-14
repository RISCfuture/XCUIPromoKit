#if os(iOS)
  public import Foundation
  public import XCTest

  extension PromoTake {

    /// How long the finger rests before a scroll starts moving, in seconds.
    private static let scrollPressDuration: TimeInterval = 0.05

    /**
     Drags `element`'s content at `speed`, keeping all of it.

     Unlike XCUITest's `swipeUp()`, whose speed XCUITest chooses, this drags at `speed` and rests
     the finger for `rest` before lifting. A rest long enough for the drag to stop leaves the content
     where the finger left it; none lets it coast on.

     - Parameters:
       - element: The scroll view, list or form to scroll.
       - distance: How far to drag, as a fraction of `element`'s height. Positive moves the content
         up, revealing what's below.
       - speed: How fast to drag.
       - rest: How long the finger stays down after the drag, in seconds.
     */
    public func scroll(
      _ element: XCUIElement,
      by distance: Double,
      speed: XCUIGestureVelocity = .default,
      rest: TimeInterval
    ) {
      let start = element.coordinate(
        withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5 + distance / 2)
      )
      let end = element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5 - distance / 2))
      keep {
        start.press(
          forDuration: Self.scrollPressDuration,
          thenDragTo: end,
          withVelocity: speed,
          thenHoldForDuration: rest
        )
      }
    }
  }
#endif
