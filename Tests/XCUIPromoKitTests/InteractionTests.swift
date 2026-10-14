import CoreGraphics
import Testing

@testable import XCUIPromoKit

@Suite
struct `Tap positions` {
  @MainActor
  @Test
  func `marks a switch row where the switch sits, not at its label`() {
    let row = CGRect(x: 0, y: 100, width: 400, height: 44)
    #expect(PromoTake.switchPoint(in: row) == CGPoint(x: 375, y: 122))
  }

  @MainActor
  @Test
  func `marks a bare switch at its centre`() {
    let control = CGRect(x: 10, y: 10, width: 30, height: 20)
    #expect(PromoTake.switchPoint(in: control) == CGPoint(x: 25, y: 20))
  }
}

@Suite
struct `Typing cadence` {
  @Test
  func `types a text the same way every take`() {
    let text = "KSQL to KOAK"
    let cadence = TypingCadence(interval: 0.08, jitter: 0.4, wordPause: 0.1, seed: 3)
    let first = cadence.pauses(for: text), second = cadence.pauses(for: text)
    #expect(first == second)
  }

  @Test
  func `pauses within the jitter around the interval`() {
    let cadence = TypingCadence(interval: 0.1, jitter: 0.4, wordPause: 0, seed: 7)
    let pauses = cadence.pauses(for: "abcdefghijklmnopqrstuvwxyz")

    #expect(pauses.count == 26)
    #expect(pauses.allSatisfy { (0.06...0.14).contains($0) })
    #expect(Set(pauses).count > 1)
  }

  @Test
  func `breathes after a word`() {
    let cadence = TypingCadence(interval: 0.1, jitter: 0, wordPause: 0.2, seed: 1)
    let pauses = cadence.pauses(for: "a b.").map { ($0 * 1000).rounded() }
    #expect(pauses == [100, 300, 100, 300])
  }
}

@Suite
struct `Touch timing` {
  @Test
  func `reaches each point at an even speed after the press`() {
    let points = [CGPoint.zero, CGPoint(x: 30, y: 0), CGPoint(x: 30, y: 10)]
    let timing = TouchPath(through: points, press: 0.2, duration: 2, hold: 0.5)
    #expect(timing.offsets == [0, 1.7, 2.2])
    #expect(timing.lift == 2.7)
  }
}
