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

@Suite
struct `Window in its shadow` {
  private static let shadow: [UInt8] = [0, 0, 0, 90]
  private static let clear: [UInt8] = [0, 0, 0, 0]

  /// A 3×2 window: opaque but for a clear corner, as a rounded window's is.
  private static let window = [
    [clear, [200, 10, 10, 255], [10, 200, 10, 255]],
    [[10, 10, 200, 255], [250, 250, 250, 255], [40, 40, 40, 255]]
  ]

  private static func bitmap(_ rows: [[[UInt8]]]) -> Bitmap {
    Bitmap(width: rows[0].count, height: rows.count, bytes: rows.flatMap { $0.flatMap(\.self) })
  }

  /// `window` laid over shadow `left` pixels in and `top` pixels down a `width`×`height` capture.
  private static func shadowed(width: Int, height: Int, left: Int, top: Int) -> Bitmap {
    bitmap(
      (0..<height).map { y in
        (0..<width).map { x in
          let inWindow = (left..<left + 3).contains(x) && (top..<top + 2).contains(y)
          guard inWindow else { return shadow }
          let pixel = window[y - top][x - left]
          return pixel == clear ? shadow : pixel
        }
      }
    )
  }

  @Test
  func `finds the window centred across, at the height its opaque pixels match`() {
    let capture = Self.shadowed(width: 7, height: 6, left: 2, top: 1)

    let offset = capture.offset(of: Self.bitmap(Self.window), sampling: 1)

    #expect(offset.x == 2)
    #expect(offset.y == 1)
  }
}
