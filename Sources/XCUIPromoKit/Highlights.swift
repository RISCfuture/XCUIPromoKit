import CoreGraphics
import Foundation
import ImageIO
import XCTest

#if os(macOS)
  import AppKit
#endif

/// The regions of a still to highlight, in the still's pixels, as `promokit render` reads them.
struct Highlights: Encodable {
  static let suffix = "highlights.json"

  let width: Int
  let height: Int
  let regions: [Region]

  init(width: Int, height: Int, regions: [Region]) {
    self.width = width
    self.height = height
    self.regions = regions
  }

  /**
   Measures each region of `screenshot`: the union of its elements' frames, from screen points to
   the still's pixels, clipped to the still.
   */
  @MainActor
  init(
    named name: String,
    regions: [[XCUIElement]],
    in screenshot: XCUIScreenshot,
    of element: XCUIElement?
  ) throws {
    guard let pixels = Self.pixelSize(of: screenshot.pngRepresentation) else {
      preconditionFailure("XCTest's screenshot isn't a readable PNG")
    }
    try self.init(
      named: name,
      frames: regions.map { $0.map(\.frame) },
      origin: element?.frame.origin ?? .zero,
      scale: pixels.width / (element?.frame.width ?? Self.screenWidth(of: screenshot)),
      pixels: pixels
    )
  }

  /// Measures regions given as frames in screen points, for a still at `origin` and `scale`.
  init(
    named name: String,
    frames: [[CGRect]],
    origin: CGPoint,
    scale: CGFloat,
    pixels: CGSize
  ) throws {
    let still = CGRect(origin: .zero, size: pixels)
    let regions = try frames.enumerated().map { index, frames in
      let union = frames.reduce(CGRect.null) { $0.union($1) }
      let region = CGRect(
        x: (union.minX - origin.x) * scale,
        y: (union.minY - origin.y) * scale,
        width: union.width * scale,
        height: union.height * scale
      )
      .intersection(still)
      guard !region.isEmpty else { throw StillError.highlightOffStill(name, region: index) }
      return Region(region)
    }
    self.init(width: Int(pixels.width), height: Int(pixels.height), regions: regions)
  }

  /// The captured screen's width in points.
  @MainActor
  private static func screenWidth(of screenshot: XCUIScreenshot) -> CGFloat {
    #if os(macOS)
      NSScreen.main?.frame.width ?? screenshot.image.size.width
    #else
      screenshot.image.size.width
    #endif
  }

  private static func pixelSize(of png: Data) -> CGSize? {
    guard let source = CGImageSourceCreateWithData(png as CFData, nil),
      let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
      let width = properties[kCGImagePropertyPixelWidth] as? Int,
      let height = properties[kCGImagePropertyPixelHeight] as? Int
    else { return nil }
    return CGSize(width: width, height: height)
  }

  func json() throws -> Data {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    return try encoder.encode(self)
  }

  struct Region: Encodable, Equatable {
    let x, y, width, height: Double

    init(x: Double, y: Double, width: Double, height: Double) {
      self.x = x
      self.y = y
      self.width = width
      self.height = height
    }

    init(_ rect: CGRect) {
      self.init(x: rect.minX, y: rect.minY, width: rect.width, height: rect.height)
    }
  }
}
