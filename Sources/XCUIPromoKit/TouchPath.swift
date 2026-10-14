import CoreGraphics
import Foundation

/// The timing of one touch through several points at an even speed.
struct TouchPath: Equatable, Sendable {

  /// Seconds after the press at which the finger reaches each point.
  let offsets: [TimeInterval]

  /// Seconds after the press at which the finger lifts.
  let lift: TimeInterval

  /**
   Times a touch that rests at the first of `points` for `press` seconds, moves through the rest
   at an even speed over `duration`, and rests at the last for `hold` before lifting.
   */
  init(through points: [CGPoint], press: TimeInterval, duration: TimeInterval, hold: TimeInterval) {
    let lengths = zip(points, points.dropFirst()).map { hypot($1.x - $0.x, $1.y - $0.y) }
    let total = lengths.reduce(0, +)
    var travelled = 0.0
    var offsets: [TimeInterval] = points.isEmpty ? [] : [0]
    for length in lengths {
      travelled += length
      let share = total > 0 ? travelled / total : 1
      offsets.append(press + duration * share)
    }
    self.offsets = offsets
    lift = press + duration + hold
  }
}
