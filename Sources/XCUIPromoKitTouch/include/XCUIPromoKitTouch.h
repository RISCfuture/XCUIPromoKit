#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>

NS_ASSUME_NONNULL_BEGIN

/**
 Synthesizes one touch that presses at the first of `points`, moves through each of the rest at
 the matching entry in `offsets`, and lifts at `liftOffset`. Offsets are seconds from the press.
 Points are in screen coordinates.

 XCTest has no public way to drag through more than two points in one touch, so this drives its
 event synthesis directly. Returns NO with `error` set if XCTest's event synthesis isn't
 available or fails.
 */
BOOL XCUIPromoKitSynthesizeTouch(NSArray<NSValue *> *points,
                                 NSArray<NSNumber *> *offsets,
                                 NSTimeInterval liftOffset,
                                 NSInteger interfaceOrientation,
                                 NSError **error);

/** Wraps a point for ``XCUIPromoKitSynthesizeTouch``. */
NSValue *XCUIPromoKitTouchPoint(CGPoint point);

NS_ASSUME_NONNULL_END
