public import Foundation

/**
 How quickly, and how unevenly, ``PromoTake/type(_:into:cadence:settle:)`` types.

 XCUITest's `typeText` enters a whole string at once. A cadence types one character at a time,
 pausing between them for ``interval`` give or take ``jitter``, and for ``wordPause`` more after
 a space or punctuation. The pauses come from a generator seeded with ``seed``, so every take of a
 script types identically.
 */
public struct TypingCadence: Sendable, Equatable {

  /// The mean pause after each character, in seconds, on top of XCUITest's own per-keystroke time.
  public var interval: TimeInterval

  /// How far each pause may stray from ``interval``, as a fraction of it.
  public var jitter: Double

  /// The extra pause after a space or punctuation, in seconds.
  public var wordPause: TimeInterval

  /// Seeds the pauses, so the same text always types the same way.
  public var seed: UInt64

  /// Creates a cadence.
  public init(
    interval: TimeInterval,
    jitter: Double = 0,
    wordPause: TimeInterval = 0,
    seed: UInt64 = 0
  ) {
    self.interval = interval
    self.jitter = jitter
    self.wordPause = wordPause
    self.seed = seed
  }

  /// The pause after each character of `text`, in seconds.
  func pauses(for text: String) -> [TimeInterval] {
    var generator = SplitMix64(seed: seed)
    return text.map { character in
      let spread = Double.random(in: -jitter...jitter, using: &generator)
      let breather = character.isWhitespace || character.isPunctuation ? wordPause : 0
      return max(0, interval * (1 + spread)) + breather
    }
  }
}

/// A small, fast, seedable generator (Steele, Lea and Flood's SplitMix64).
struct SplitMix64: RandomNumberGenerator {
  private var state: UInt64

  init(seed: UInt64) {
    state = seed
  }

  mutating func next() -> UInt64 {
    state &+= 0x9E37_79B9_7F4A_7C15
    var mixed = state
    mixed = (mixed ^ (mixed >> 30)) &* 0xBF58_476D_1CE4_E5B9
    mixed = (mixed ^ (mixed >> 27)) &* 0x94D0_49BB_1331_11EB
    return mixed ^ (mixed >> 31)
  }
}
