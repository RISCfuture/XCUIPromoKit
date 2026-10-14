#import "XCUIPromoKitTouch.h"

@interface NSObject (XCUIPromoKitPointerEventPath)
- (instancetype)initForTouchAtPoint:(CGPoint)point offset:(NSTimeInterval)offset;
- (void)moveToPoint:(CGPoint)point atOffset:(NSTimeInterval)offset;
- (void)liftUpAtOffset:(NSTimeInterval)offset;
@end

@interface NSObject (XCUIPromoKitSynthesizedEventRecord)
- (instancetype)initWithName:(NSString *)name interfaceOrientation:(NSInteger)orientation;
- (void)addPointerEventPath:(id)path;
- (BOOL)synthesizeWithError:(NSError **)error;
@end

static NSString *const XCUIPromoKitTouchErrorDomain = @"XCUIPromoKitTouch";

NSValue *XCUIPromoKitTouchPoint(CGPoint point) {
  return [NSValue valueWithBytes:&point objCType:@encode(CGPoint)];
}

static CGPoint pointAt(NSArray<NSValue *> *points, NSUInteger index) {
  CGPoint point;
  [points[index] getValue:&point size:sizeof(point)];
  return point;
}

BOOL XCUIPromoKitSynthesizeTouch(NSArray<NSValue *> *points,
                                 NSArray<NSNumber *> *offsets,
                                 NSTimeInterval liftOffset,
                                 NSInteger interfaceOrientation,
                                 NSError **error) {
  Class pathClass = NSClassFromString(@"XCPointerEventPath");
  Class recordClass = NSClassFromString(@"XCSynthesizedEventRecord");
  if (pathClass == nil || recordClass == nil || points.count == 0 ||
      points.count != offsets.count) {
    if (error) {
      *error = [NSError errorWithDomain:XCUIPromoKitTouchErrorDomain
                                   code:1
                               userInfo:@{
                                 NSLocalizedDescriptionKey :
                                     @"XCTest’s event synthesis isn’t available in this runtime."
                               }];
    }
    return NO;
  }

  id path = [[pathClass alloc] initForTouchAtPoint:pointAt(points, 0)
                                            offset:offsets[0].doubleValue];
  for (NSUInteger index = 1; index < points.count; index++) {
    [path moveToPoint:pointAt(points, index) atOffset:offsets[index].doubleValue];
  }
  [path liftUpAtOffset:liftOffset];

  id record = [[recordClass alloc] initWithName:@"XCUIPromoKit trace"
                           interfaceOrientation:interfaceOrientation];
  [record addPointerEventPath:path];
  return [record synthesizeWithError:error];
}
