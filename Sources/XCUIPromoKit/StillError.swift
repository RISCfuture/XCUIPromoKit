public import Foundation

/// An error capturing a still with ``PromoStill``.
public enum StillError: LocalizedError {

  /// The name can't be used as a file name.
  case invalidName(String)

  /// Consecutive captures still differed when the time to settle ran out.
  case didNotSettle(String, Duration)

  /// Not exactly one on-screen window matched; each match is described by its app and layer.
  case windowNotFound(String, matches: [String])

  /// ScreenCaptureKit couldn't capture the window.
  case couldNotCapture(String, any Error)

  /// A region to highlight lies wholly outside the still.
  case highlightOffStill(String, region: Int)

  /// The test runner, by bundle identifier, may not record the screen.
  case noScreenRecordingPermission(String)

  /// The PNG couldn't be written.
  case couldNotWrite(String, any Error)

  public var errorDescription: String? {
    String(localized: "Couldn’t capture the still.")
  }

  public var recoverySuggestion: String? {
    switch self {
      case .noScreenRecordingPermission:
        String(
          localized:
            "Add the test runner app from DerivedData’s Build/Products folder under System Settings › Privacy & Security › Screen & System Audio Recording."
        )
      default: nil
    }
  }

  public var failureReason: String? {
    switch self {
      case .invalidName(let name):
        String(localized: "“\(name)” must be letters, digits, dots, hyphens and underscores.")
      case let .didNotSettle(name, timeout):
        String(localized: "“\(name)” was still changing after \(timeout.formatted(.units())).")
      case let .windowNotFound(name, matches):
        if matches.isEmpty {
          String(localized: "“\(name)” matched no on-screen window.")
        } else {
          String(
            localized:
              "“\(name)” matched \(matches.count) on-screen windows, not one: \(matches.formatted())."
          )
        }
      case let .couldNotCapture(name, error):
        String(localized: "Couldn’t capture “\(name)”: \(error.localizedDescription)")
      case let .highlightOffStill(name, region):
        String(localized: "Region \(region, format: .number) of “\(name)” lies outside the still.")
      case .noScreenRecordingPermission(let runner):
        String(localized: "\(runner) may not record the screen.")
      case let .couldNotWrite(name, error):
        String(localized: "Couldn’t write “\(name)”: \(error.localizedDescription)")
    }
  }
}
