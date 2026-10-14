public import Foundation

/// An error recording a take with ``PromoTake``.
public enum RecordingError: LocalizedError {

  /// The host never touched the `recording` marker.
  case hostNeverStartedRecording

  /// The take couldn't create the named marker file.
  case couldNotSignalHost(String)

  /// `take.json` couldn't be written.
  case couldNotWriteTake(any Error)

  /// A screenshot for ``PromoTake/holdOnScreenshot(_:)`` couldn't be saved.
  case couldNotWriteHeldFrame(any Error)

  public var errorDescription: String? {
    String(localized: "Couldn’t record the take.")
  }

  public var failureReason: String? {
    switch self {
      case .hostNeverStartedRecording:
        String(localized: "The host never started recording.")
      case .couldNotSignalHost(let marker):
        String(localized: "Couldn’t create the “\(marker)” marker.")
      case .couldNotWriteTake(let error):
        String(localized: "Couldn’t write take.json: \(error.localizedDescription)")
      case .couldNotWriteHeldFrame(let error):
        String(localized: "Couldn’t save a screenshot to hold on: \(error.localizedDescription)")
    }
  }

  public var recoverySuggestion: String? {
    switch self {
      case .hostNeverStartedRecording, .couldNotSignalHost:
        String(localized: "Run the test through `promokit record`.")
      case .couldNotWriteTake, .couldNotWriteHeldFrame: nil
    }
  }
}
