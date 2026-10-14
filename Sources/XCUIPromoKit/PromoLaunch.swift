public import Foundation

/**
 Launch arguments that put an app into a known state for the camera.

 Defaults are passed through the argument domain, so they override whatever the app has stored
 without touching it, and the locale comes from ``localeVariable``, which `promokit stills` sets
 per run.

 ```swift
 app.launchArguments = PromoLaunch(
   flags: ["UI-TESTING"],
   defaults: ["hours": "over100", "hasCompletedWelcome": true]
 ).arguments
 ```

 On the Mac, `defaults: ["NSRequiresAquaSystemAppearance": true]` forces light mode. Leave out
 `-ApplePersistenceIgnoreState`, or the app may open no windows.
 */
public struct PromoLaunch: Sendable, Equatable {

  /// The environment variable naming the locale to launch in, such as `en-US`.
  public static let localeVariable = "PROMO_LOCALE"

  /// Bare arguments the app looks for, such as `UI-TESTING`.
  public var flags: [String]

  /// Values for the argument domain, overriding the app's stored defaults.
  public var defaults: [String: DefaultsValue]

  /// The locale to launch in, as a BCP 47 tag such as `en-US`, or `nil` for the device's.
  public var locale: String?

  /// The launch arguments, in a stable order.
  public var arguments: [String] {
    flags + defaultsArguments + localeArguments
  }

  private var defaultsArguments: [String] {
    defaults.sorted { $0.key < $1.key }.flatMap { ["-\($0.key)", $0.value.argument] }
  }

  private var localeArguments: [String] {
    guard let locale else { return [] }
    return [
      "-AppleLanguages", "(\(locale))",
      "-AppleLocale", locale.replacing("-", with: "_")
    ]
  }

  /**
   Creates launch arguments.

   - Parameters:
     - flags: Bare arguments the app looks for.
     - defaults: Values for the argument domain.
     - environment: Where to look for ``localeVariable``.
   */
  public init(
    flags: [String] = [],
    defaults: [String: DefaultsValue] = [:],
    environment: [String: String] = ProcessInfo.processInfo.environment
  ) {
    self.flags = flags
    self.defaults = defaults
    locale = environment[Self.localeVariable]
  }
}

/// A value passed through the argument domain.
public enum DefaultsValue: Sendable, Equatable, ExpressibleByBooleanLiteral,
  ExpressibleByIntegerLiteral, ExpressibleByFloatLiteral, ExpressibleByStringLiteral
{
  case bool(Bool)
  case integer(Int)
  case double(Double)
  case string(String)

  /// The value as the argument domain parses it.
  var argument: String {
    switch self {
      case .bool(let value): value ? "YES" : "NO"
      case .integer(let value): String(value)
      case .double(let value): String(value)
      case .string(let value): value
    }
  }

  public init(booleanLiteral value: Bool) { self = .bool(value) }
  public init(integerLiteral value: Int) { self = .integer(value) }
  public init(floatLiteral value: Double) { self = .double(value) }
  public init(stringLiteral value: String) { self = .string(value) }
}
