// swift-tools-version: 6.2

import PackageDescription

let upcomingFeatures: [SwiftSetting] = [
  .enableUpcomingFeature("NonisolatedNonsendingByDefault"),
  .enableUpcomingFeature("InferIsolatedConformances"),
  .enableUpcomingFeature("ImmutableWeakCaptures"),
  .enableUpcomingFeature("MemberImportVisibility"),
  .enableUpcomingFeature("ExistentialAny"),
  .enableUpcomingFeature("InternalImportsByDefault"),
  .strictMemorySafety()
]

// XCUIPromoKit links XCTest, which on Apple platforms vends the XCUI* automation
// types. It is meant to be added to an app's UI-test bundle and built with
// Xcode's toolchain. The host side, which records, renders and checks, is the
// pnpm package in tooling/.
let package = Package(
  name: "XCUIPromoKit",
  platforms: [
    .iOS(.v16),
    .macOS(.v13)
  ],
  products: [
    .library(
      name: "XCUIPromoKit",
      targets: ["XCUIPromoKit"]
    )
  ],
  dependencies: [
    .package(url: "https://github.com/RISCfuture/XCUITestKit", from: "1.0.0"),
    .package(url: "https://github.com/swiftlang/swift-docc-plugin", from: "1.5.0")
  ],
  targets: [
    .target(
      name: "XCUIPromoKit",
      dependencies: [
        "XCUIPromoKitTouch",
        .product(name: "XCUITestKit", package: "XCUITestKit")
      ],
      swiftSettings: upcomingFeatures
    ),
    .target(name: "XCUIPromoKitTouch"),
    .testTarget(
      name: "XCUIPromoKitTests",
      dependencies: ["XCUIPromoKit"],
      swiftSettings: upcomingFeatures
    )
  ],
  swiftLanguageModes: [.v5, .v6]
)
