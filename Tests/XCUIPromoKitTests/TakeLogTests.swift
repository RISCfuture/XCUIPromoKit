import CoreGraphics
import Foundation
import Testing

@testable import XCUIPromoKit

@Suite
struct `Take log` {
  @Test
  func `files each kept stretch under the current scene`() {
    var log = TakeLog()
    log.begin(scene: "opening")
    log.keep(from: 0, to: 1.5)
    log.begin(scene: "climb")
    log.keep(from: 4, to: 5)

    #expect(
      log.segments == [
        .init(scene: "opening", start: 0, end: 1.5),
        .init(scene: "climb", start: 4, end: 5)
      ]
    )
  }

  @Test
  func `notes when an action ran, keeping its return until the host narrows it`() throws {
    var log = TakeLog()
    log.begin(scene: "climb")
    log.keepTail(from: 7, endingAt: 10, settle: 0.6, landing: 0.3)

    let segment = try #require(log.segments.first)
    #expect(abs(segment.start - 9.1) < 1e-9)
    #expect(segment.end == 10)
    #expect(segment.activity == .init(start: 7, end: 9.4, landing: 0.3, settle: 0.6))
  }

  @Test
  func `never keeps from before recording began`() {
    var log = TakeLog()
    log.begin(scene: "opening")
    log.keepTail(from: 0, endingAt: 0.5, settle: 0.6, landing: 0.3)

    #expect(log.segments.first?.start == 0)
  }

  @Test
  func `writes the keys the host reads`() throws {
    var log = TakeLog()
    log.begin(scene: "climb")
    log.beganRecording(at: 0.9)
    log.keep(from: 1, to: 2)
    log.keepTail(from: 2, endingAt: 4, settle: 0.5, landing: 0.25)
    log.tap(at: CGPoint(x: 0.25, y: 0.75), time: 1.8)
    log.drag(
      along: [CGPoint(x: 0.2, y: 0.5), CGPoint(x: 0.8, y: 0.5)],
      press: 0.1,
      duration: 1,
      hold: 0.25,
      liftingAt: 3.5
    )
    log.hold(log.nextHeldFrameFile, from: 4, to: 6)
    log.closingShot("scene-0-closing.png")

    let data = try JSONEncoder().encode(log.take(screen: CGSize(width: 440, height: 956)))
    let json = try #require(try JSONSerialization.jsonObject(with: data) as? [String: Any])

    #expect(json["version"] as? Int == 1)
    #expect((json["screen"] as? [String: Double])?["height"] == 956)
    let tap = try #require((json["taps"] as? [[String: Any]])?.first)
    #expect(tap["scene"] as? String == "climb")
    #expect(tap["time"] as? Double == 1.8)
    #expect(tap["x"] as? Double == 0.25)
    #expect(tap["y"] as? Double == 0.75)
    let drag = try #require((json["drags"] as? [[String: Any]])?.first)
    #expect(drag["start"] as? Double == 2.25)
    #expect(drag["press"] as? Double == 0.1)
    #expect(drag["duration"] as? Double == 1)
    #expect(drag["hold"] as? Double == 0.25)
    #expect((drag["path"] as? [[String: Double]])?.last == ["x": 0.8, "y": 0.5])
    let recording = try #require((json["recordings"] as? [[String: Any]])?.first)
    #expect(recording["scene"] as? String == "climb")
    #expect(recording["start"] as? Double == 0.9)
    let held = try #require((json["heldFrames"] as? [[String: Any]])?.first)
    #expect(held["file"] as? String == "held-0.png")
    #expect(held["start"] as? Double == 4)
    #expect(held["end"] as? Double == 6)
    let closing = try #require((json["closingShots"] as? [[String: String]])?.first)
    #expect(closing == ["scene": "climb", "file": "scene-0-closing.png"])
    let segments = try #require(json["segments"] as? [[String: Any]])
    #expect(segments.first?["start"] as? Double == 1)
    #expect(segments.first?["end"] as? Double == 2)
    let activity = try #require(segments[1]["activity"] as? [String: Double])
    #expect(activity == ["start": 2, "end": 3.5, "landing": 0.25, "settle": 0.5])
  }

  @Test
  func `normalizes a point against the app's frame`() {
    let point = TakeLog.normalized(
      CGPoint(x: 110, y: 717),
      in: CGRect(x: 0, y: 0, width: 440, height: 956)
    )
    #expect(point == CGPoint(x: 0.25, y: 0.75))
  }
}
