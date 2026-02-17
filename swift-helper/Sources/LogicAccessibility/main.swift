import AppKit
import Foundation

// MARK: - Main Entry Point

let args = CommandLine.arguments
guard args.count >= 2 else {
    printUsage()
    exit(1)
}

let command = args[1]

switch command {
case "check-access":
    checkAccessibility()
case "list-tracks":
    listTracks()
case "get-params":
    guard args.count >= 4,
          let trackIdx = Int(args[2]),
          let slotIdx = Int(args[3]) else {
        printError("Usage: logic-ax get-params <trackIndex> <slotIndex>")
        exit(1)
    }
    getPluginParameters(trackIndex: trackIdx, slotIndex: slotIdx)
case "set-param":
    guard args.count >= 6,
          let trackIdx = Int(args[2]),
          let slotIdx = Int(args[3]) else {
        printError("Usage: logic-ax set-param <trackIndex> <slotIndex> <paramName> <value>")
        exit(1)
    }
    let paramName = args[4]
    let value = args[5]
    setPluginParameter(trackIndex: trackIdx, slotIndex: slotIdx, paramName: paramName, value: value)
case "query":
    let depth = args.count >= 3 ? (Int(args[2]) ?? 6) : 6
    queryElement(maxDepth: depth)
case "query-spuren":
    let depth = args.count >= 3 ? (Int(args[2]) ?? 10) : 10
    querySpuren(maxDepth: depth)
default:
    printError("Unknown command: \(command)")
    printUsage()
    exit(1)
}

// MARK: - Accessibility Helpers

func getLogicProPID() -> pid_t? {
    let apps = NSRunningApplication.runningApplications(
        withBundleIdentifier: "com.apple.logic10"
    )
    return apps.first?.processIdentifier
}

func getLogicProApp() -> AXUIElement? {
    guard let pid = getLogicProPID() else {
        printError("Logic Pro is not running")
        return nil
    }
    return AXUIElementCreateApplication(pid)
}

func getAttribute(_ element: AXUIElement, _ attribute: String) -> CFTypeRef? {
    var value: CFTypeRef?
    let result = AXUIElementCopyAttributeValue(element, attribute as CFString, &value)
    guard result == .success else { return nil }
    return value
}

func getStringAttribute(_ element: AXUIElement, _ attribute: String) -> String? {
    guard let value = getAttribute(element, attribute) else { return nil }
    return value as? String
}

func getChildren(_ element: AXUIElement) -> [AXUIElement] {
    guard let children = getAttribute(element, kAXChildrenAttribute) as? [AXUIElement] else {
        return []
    }
    return children
}

func getRole(_ element: AXUIElement) -> String? {
    return getStringAttribute(element, kAXRoleAttribute)
}

func getTitle(_ element: AXUIElement) -> String? {
    return getStringAttribute(element, kAXTitleAttribute)
}

func getDescription(_ element: AXUIElement) -> String? {
    return getStringAttribute(element, kAXDescriptionAttribute)
}

func getValue(_ element: AXUIElement) -> String? {
    guard let val = getAttribute(element, kAXValueAttribute) else { return nil }
    if let str = val as? String { return str }
    if let num = val as? NSNumber { return num.stringValue }
    return "\(val)"
}

// MARK: - Commands

func checkAccessibility() {
    let trusted = AXIsProcessTrustedWithOptions(
        [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
    )
    if trusted {
        print("accessibility: granted")
    } else {
        print("accessibility: denied – please grant access in System Settings → Privacy → Accessibility")
    }
}

func listTracks() {
    guard let app = getLogicProApp() else {
        print("[]")
        return
    }

    guard let mainWindow = getAttribute(app, kAXMainWindowAttribute) as! AXUIElement? else {
        print("[]")
        return
    }

    // Navigate: Window → find AXGroup with description "Spuren" → dive deep
    guard let spurenGroup = findElementByDescription(in: mainWindow, description: "Spuren", maxDepth: 4) else {
        // Fallback: try English "Tracks"
        guard let tracksGroup = findElementByDescription(in: mainWindow, description: "Tracks", maxDepth: 4) else {
            printError("Could not find tracks area in Logic Pro window")
            print("[]")
            return
        }
        let tracks = extractTracks(from: tracksGroup)
        outputJSON(tracks)
        return
    }

    let tracks = extractTracks(from: spurenGroup)
    outputJSON(tracks)
}

/// Find an element by its AX description, searching breadth-first
func findElementByDescription(in root: AXUIElement, description: String, maxDepth: Int) -> AXUIElement? {
    let children = getChildren(root)
    
    // Check direct children first
    for child in children {
        let desc = getDescription(child) ?? ""
        if desc == description {
            return child
        }
    }
    
    // Then recurse
    if maxDepth > 0 {
        for child in children {
            if let found = findElementByDescription(in: child, description: description, maxDepth: maxDepth - 1) {
                return found
            }
        }
    }
    return nil
}

/// Extract tracks from the Spuren/Tracks group area
func extractTracks(from spurenGroup: AXUIElement) -> [[String: Any]] {
    var tracks: [[String: Any]] = []
    
    // Collect all track-like elements by scanning deep
    collectTrackElements(in: getChildren(spurenGroup), tracks: &tracks, depth: 0, maxDepth: 12)
    
    return tracks
}

/// Recursively find track elements in the UI hierarchy
/// Tracks are AXLayoutItem elements with descriptions like: Spur 4 „Ioanna Mic Wet"
func collectTrackElements(in elements: [AXUIElement], tracks: inout [[String: Any]], depth: Int, maxDepth: Int) {
    guard depth < maxDepth else { return }
    
    for element in elements {
        let role = getRole(element) ?? ""
        let desc = getDescription(element) ?? ""
        
        // Logic Pro tracks are AXLayoutItem with description "Spur N „TrackName""
        // or in English: "Track N "TrackName""
        if role == "AXLayoutItem" && isTrackDescription(desc) {
            let trackName = extractTrackName(from: desc)
            let trackNumber = extractTrackNumber(from: desc)
            let children = getChildren(element)
            let trackMeta = extractTrackMeta(from: children)
            
            tracks.append([
                "index": tracks.count,
                "trackNumber": trackNumber,
                "name": trackName,
                "muted": trackMeta["muted"] ?? false,
                "solo": trackMeta["solo"] ?? false,
                "recordEnabled": trackMeta["recordEnabled"] ?? false,
                "volume": trackMeta["volume"] ?? 0,
                "plugins": findPluginNames(in: children)
            ])
        }
        
        // Recurse into children
        let children = getChildren(element)
        if !children.isEmpty {
            collectTrackElements(in: children, tracks: &tracks, depth: depth + 1, maxDepth: maxDepth)
        }
    }
}

/// Check if a description matches the track pattern: "Spur N „Name"" or "Track N "Name""
func isTrackDescription(_ desc: String) -> Bool {
    return desc.hasPrefix("Spur ") || desc.hasPrefix("Track ")
}

/// Extract the track name from description like: Spur 4 „Ioanna Mic Wet"
func extractTrackName(from desc: String) -> String {
    // Try German format: Spur N „Name"
    if let range = desc.range(of: "„") {
        var name = String(desc[range.upperBound...])
        // Remove closing quote
        name = name.replacingOccurrences(of: "\u{201C}", with: "")
        name = name.replacingOccurrences(of: "\u{201D}", with: "")
        name = name.replacingOccurrences(of: "\"", with: "")
        return name.trimmingCharacters(in: .whitespaces)
    }
    // Try English format: Track N "Name"
    if let range = desc.range(of: "\"") {
        var name = String(desc[range.upperBound...])
        if let endRange = name.range(of: "\"") {
            name = String(name[..<endRange.lowerBound])
        }
        return name.trimmingCharacters(in: .whitespaces)
    }
    // Fallback: everything after the number
    let parts = desc.split(separator: " ", maxSplits: 2)
    return parts.count >= 3 ? String(parts[2]) : desc
}

/// Extract track number from "Spur 4 „Name""
func extractTrackNumber(from desc: String) -> Int {
    let parts = desc.split(separator: " ")
    if parts.count >= 2, let num = Int(parts[1]) {
        return num
    }
    return -1
}

/// Extract mute/solo/volume/record status from track children
func extractTrackMeta(from children: [AXUIElement]) -> [String: Any] {
    var meta: [String: Any] = [
        "muted": false,
        "solo": false,
        "recordEnabled": false,
        "volume": 0
    ]
    
    for child in children {
        let role = getRole(child) ?? ""
        let desc = getDescription(child) ?? ""
        let value = getValue(child) ?? ""
        
        if role == "AXCheckBox" {
            if desc == "Mute" {
                meta["muted"] = value == "1"
            } else if desc == "Solo" {
                meta["solo"] = value == "1"
            } else if desc.contains("Aufnahme") || desc.contains("Record") {
                meta["recordEnabled"] = value == "1"
            }
        } else if role == "AXSlider" && desc == "Volume" {
            meta["volume"] = Int(value) ?? 0
        }
    }
    
    return meta
}

func findPluginNames(in elements: [AXUIElement]) -> [String] {
    var plugins: [String] = []
    for element in elements {
        let role = getRole(element) ?? ""
        let title = getTitle(element) ?? ""

        if role == "AXButton" && !title.isEmpty && title != "M" && title != "S" && title != "R" {
            plugins.append(title)
        }

        let children = getChildren(element)
        if !children.isEmpty {
            plugins.append(contentsOf: findPluginNames(in: children))
        }
    }
    return plugins
}

func getPluginParameters(trackIndex: Int, slotIndex: Int) {
    guard let app = getLogicProApp() else {
        print("[]")
        return
    }

    guard let mainWindow = getAttribute(app, kAXMainWindowAttribute) as! AXUIElement? else {
        print("[]")
        return
    }

    // Search for plugin windows or the controls view
    var params: [[String: String]] = []
    let windows = getChildren(app as AXUIElement)

    for window in windows {
        // Plugin windows have specific structure
        // Look for sliders, text fields, and popup buttons
        findParameters(in: getChildren(window), params: &params, depth: 0, maxDepth: 8)
    }

    let jsonData = try? JSONSerialization.data(
        withJSONObject: params,
        options: [.prettyPrinted, .sortedKeys]
    )
    if let data = jsonData, let str = String(data: data, encoding: .utf8) {
        print(str)
    } else {
        print("[]")
    }
}

func findParameters(in elements: [AXUIElement], params: inout [[String: String]], depth: Int, maxDepth: Int) {
    guard depth < maxDepth else { return }

    for element in elements {
        let role = getRole(element) ?? ""
        let title = getTitle(element) ?? ""
        let desc = getDescription(element) ?? ""
        let value = getValue(element) ?? ""

        // Parameters are typically sliders, text fields, or popup buttons
        if role == "AXSlider" || role == "AXTextField" || role == "AXPopUpButton" {
            let name = !desc.isEmpty ? desc : title
            if !name.isEmpty {
                params.append([
                    "name": name,
                    "value": value,
                    "role": role
                ])
            }
        }

        let children = getChildren(element)
        if !children.isEmpty {
            findParameters(in: children, params: &params, depth: depth + 1, maxDepth: maxDepth)
        }
    }
}

func setPluginParameter(trackIndex: Int, slotIndex: Int, paramName: String, value: String) {
    guard let app = getLogicProApp() else {
        printError("Logic Pro not running")
        return
    }

    let windows = getChildren(app as AXUIElement)

    for window in windows {
        if findAndSetParameter(in: getChildren(window), paramName: paramName, value: value, depth: 0, maxDepth: 8) {
            print("Parameter set successfully")
            return
        }
    }

    printError("Parameter '\(paramName)' not found. Ensure the plugin window is open in Controls view.")
}

func findAndSetParameter(in elements: [AXUIElement], paramName: String, value: String, depth: Int, maxDepth: Int) -> Bool {
    guard depth < maxDepth else { return false }

    for element in elements {
        let role = getRole(element) ?? ""
        let title = getTitle(element) ?? ""
        let desc = getDescription(element) ?? ""
        let name = !desc.isEmpty ? desc : title

        if name.lowercased() == paramName.lowercased() {
            if role == "AXSlider" {
                if let numValue = Float(value) {
                    AXUIElementSetAttributeValue(element, kAXValueAttribute as CFString, numValue as CFTypeRef)
                    return true
                }
            } else if role == "AXTextField" {
                AXUIElementSetAttributeValue(element, kAXValueAttribute as CFString, value as CFTypeRef)
                return true
            }
        }

        let children = getChildren(element)
        if !children.isEmpty {
            if findAndSetParameter(in: children, paramName: paramName, value: value, depth: depth + 1, maxDepth: maxDepth) {
                return true
            }
        }
    }
    return false
}

func queryElement(maxDepth: Int) {
    guard let app = getLogicProApp() else {
        print("{}")
        return
    }

    guard let mainWindow = getAttribute(app, kAXMainWindowAttribute) as! AXUIElement? else {
        print("{}")
        return
    }

    var result: [[String: String]] = []
    dumpElementInfo(mainWindow, into: &result, depth: 0, maxDepth: maxDepth)
    outputJSON(result)
}

func querySpuren(maxDepth: Int) {
    guard let app = getLogicProApp() else {
        print("{}")
        return
    }

    guard let mainWindow = getAttribute(app, kAXMainWindowAttribute) as! AXUIElement? else {
        print("{}")
        return
    }

    // Find the Spuren group and dump only that subtree
    if let spuren = findElementByDescription(in: mainWindow, description: "Spuren", maxDepth: 4) {
        var result: [[String: String]] = []
        dumpElementInfo(spuren, into: &result, depth: 0, maxDepth: maxDepth)
        outputJSON(result)
    } else if let tracks = findElementByDescription(in: mainWindow, description: "Tracks", maxDepth: 4) {
        var result: [[String: String]] = []
        dumpElementInfo(tracks, into: &result, depth: 0, maxDepth: maxDepth)
        outputJSON(result)
    } else {
        print("[]")
    }
}

func dumpElementInfo(_ element: AXUIElement, into result: inout [[String: String]], depth: Int, maxDepth: Int) {
    guard depth < maxDepth else { return }

    let role = getRole(element) ?? "unknown"
    let title = getTitle(element) ?? ""
    let desc = getDescription(element) ?? ""
    let value = getValue(element) ?? ""

    result.append([
        "depth": "\(depth)",
        "role": role,
        "title": title,
        "description": desc,
        "value": value
    ])

    for child in getChildren(element) {
        dumpElementInfo(child, into: &result, depth: depth + 1, maxDepth: maxDepth)
    }
}

// MARK: - Utilities

func printError(_ message: String) {
    FileHandle.standardError.write(Data("[logic-ax] \(message)\n".utf8))
}

func outputJSON(_ obj: Any) {
    let jsonData = try? JSONSerialization.data(
        withJSONObject: obj,
        options: [.prettyPrinted, .sortedKeys]
    )
    if let data = jsonData, let str = String(data: data, encoding: .utf8) {
        print(str)
    } else {
        print("[]")
    }
}

func printUsage() {
    print("""
    Usage: LogicAccessibility <command> [args...]

    Commands:
      check-access                             Check if accessibility access is granted
      list-tracks                              List all tracks with plugins
      get-params <trackIndex> <slotIndex>      Get plugin parameters
      set-param <trackIndex> <slotIndex> <p> <v>  Set a plugin parameter
      query [depth]                            Debug: dump main window UI tree
      query-spuren [depth]                     Debug: dump only the Spuren/Tracks area
    """)
}
