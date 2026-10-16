import CoreGraphics
import Foundation

/// An image's pixels, each premultiplied RGBA packed red-first, row by row from the top.
struct Bitmap: Equatable {
  private static let bytesPerPixel = 4
  private static let bitsPerComponent = 8
  private static let opaqueAlpha = UInt32(UInt8.max)
  private static let defaultSpacing = 8

  let width: Int
  let height: Int
  let pixels: [UInt32]

  /// A bitmap of RGBA `bytes`.
  init(width: Int, height: Int, bytes: [UInt8]) {
    precondition(bytes.count == width * height * Self.bytesPerPixel, "Not one RGBA pixel per point")
    self.width = width
    self.height = height
    pixels = stride(from: 0, to: bytes.count, by: Self.bytesPerPixel).map { start in
      bytes[start..<start + Self.bytesPerPixel].reduce(0) { $0 << 8 | UInt32($1) }
    }
  }

  init(_ image: CGImage) {
    guard
      let space = CGColorSpace(name: CGColorSpace.sRGB),
      let context = unsafe CGContext(
        data: nil,
        width: image.width,
        height: image.height,
        bitsPerComponent: Self.bitsPerComponent,
        bytesPerRow: image.width * Self.bytesPerPixel,
        space: space,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
      )
    else {
      preconditionFailure(
        "Couldn’t make an RGBA context for a \(image.width)×\(image.height) image"
      )
    }
    context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
    guard let data = context.makeImage()?.dataProvider?.data as Data? else {
      preconditionFailure("Couldn’t read back an RGBA context’s pixels")
    }
    self.init(width: image.width, height: image.height, bytes: Array(data))
  }

  /**
   Where `window`, the window this bitmap shows captured without its shadow, lies in this bitmap.

   A window's shadow is never opaque and spreads as far left as right, so the window is centred
   across, at the height where the most of its opaque pixels, sampled every `spacing` pixels, match.
   */
  func offset(of window: Self, sampling spacing: Int = defaultSpacing) -> (x: Int, y: Int) {
    let samples = window.opaquePoints(spacing: spacing)
    let x = (width - window.width) / 2
    let y = (0...height - window.height)
      .map { (y: $0, matches: matches(of: samples, in: window, at: (x, $0))) }
      .max { $0.matches < $1.matches }?.y
    return (x, y ?? 0)
  }

  private func opaquePoints(spacing: Int) -> [(x: Int, y: Int)] {
    stride(from: 0, to: height, by: spacing).flatMap { y in
      stride(from: 0, to: width, by: spacing).compactMap { x in
        pixel(x, y) & Self.opaqueAlpha == Self.opaqueAlpha ? (x, y) : nil
      }
    }
  }

  private func matches(
    of samples: [(x: Int, y: Int)],
    in window: Self,
    at offset: (x: Int, y: Int)
  ) -> Int {
    samples.count { pixel(offset.x + $0.x, offset.y + $0.y) == window.pixel($0.x, $0.y) }
  }

  private func pixel(_ x: Int, _ y: Int) -> UInt32 {
    pixels[y * width + x]
  }
}
