// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "LogicAccessibility",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "LogicAccessibility",
            path: "Sources/LogicAccessibility"
        )
    ]
)
