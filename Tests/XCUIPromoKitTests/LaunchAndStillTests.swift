import CoreGraphics
import Testing

@testable import XCUIPromoKit

@Suite
struct `Launch arguments` {
  @Test
  func `passes flags, then defaults in key order, then the locale`() {
    let launch = PromoLaunch(
      flags: ["UI-TESTING"],
      defaults: ["hours": "over100", "hasCompletedWelcome": true, "rating": 2],
      environment: [PromoLaunch.localeVariable: "de-DE"]
    )

    #expect(
      launch.arguments == [
        "UI-TESTING",
        "-hasCompletedWelcome", "YES",
        "-hours", "over100",
        "-rating", "2",
        "-AppleLanguages", "(de-DE)",
        "-AppleLocale", "de_DE"
      ]
    )
  }

  @Test
  func `leaves the locale to the device when the host names none`() {
    #expect(PromoLaunch(flags: ["UI-TESTING"], environment: [:]).arguments == ["UI-TESTING"])
  }
}

@Suite
struct `Still names` {
  @Test(arguments: ["0-results-moderate-risk", "pilot", "iPad_split.dark"])
  func `accepts a plain file name`(_ name: String) {
    #expect(PromoStill.isValid(name: name))
  }

  @Test(arguments: ["", "../escape", "a/b", ".hidden", "café"])
  func `rejects a name that isn't a plain file name`(_ name: String) {
    #expect(!PromoStill.isValid(name: name))
  }
}

@Suite
struct `Highlighted regions` {
  @Test
  func `unites each region's frames in the still's pixels, clipped to the still`() throws {
    let highlights = try Highlights(
      named: "rules",
      frames: [
        [
          CGRect(x: 110, y: 120, width: 50, height: 10),
          CGRect(x: 130, y: 140, width: 40, height: 20)
        ],
        [CGRect(x: 1250, y: 700, width: 100, height: 100)]
      ],
      origin: CGPoint(x: 100, y: 100),
      scale: 2,
      pixels: CGSize(width: 2400, height: 1260)
    )

    #expect(
      highlights.regions == [
        .init(x: 20, y: 40, width: 120, height: 80),
        .init(x: 2300, y: 1200, width: 100, height: 60)
      ]
    )
  }

  @Test
  func `throws for a region wholly off the still`() {
    #expect(throws: StillError.self) {
      try Highlights(
        named: "rules",
        frames: [[CGRect(x: 0, y: 0, width: 10, height: 10)]],
        origin: CGPoint(x: 100, y: 100),
        scale: 2,
        pixels: CGSize(width: 2400, height: 1260)
      )
    }
  }
}
