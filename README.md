# Logic Pro MCP Server

> AI-powered control for Apple Logic Pro via the Model Context Protocol.

An MCP server that lets AI assistants (Claude, etc.) control Logic Pro through AppleScript, macOS Accessibility API, and virtual MIDI.

## Features

| Category | Tools | Method |
|----------|-------|--------|
| **Transport** | Play, Stop, Record, Tempo, Cycle, Metronome | AppleScript/Key Commands |
| **Tracks** | List, Create, Select, Rename, Delete, Mute, Solo | Accessibility + AppleScript |
| **Plugins** | List installed, Load, Read/Write parameters, Presets | `auval` + Accessibility API |
| **MIDI** | Send notes, Chords, CC, Patterns | Virtual MIDI Port (node-midi) |
| **Project** | Open, Save, Close, Bounce, Undo/Redo | AppleScript |
| **Mixer** | Show, Channel strip info, Load strip settings | Accessibility |

**35 tools total** for comprehensive Logic Pro control.

## Prerequisites

- **macOS** (Sonoma 14+ recommended)
- **Node.js** 18+
- **Swift** 5.9+ (included with Xcode/Command Line Tools)
- **Logic Pro** installed and running

## Installation

```bash
# Clone and install
git clone <repo-url>
cd logic-pro-mcp
npm install

# Build TypeScript
npm run build

# Build Swift accessibility helper
npm run build:swift
```

## macOS Setup

### 1. Grant Accessibility Access

**System Settings → Privacy & Security → Accessibility**

Add your terminal app (Terminal.app, iTerm2, or the Claude Desktop app) to the allowed list.

### 2. Logic Pro Settings

Open Logic Pro → Settings → Accessibility → Enable **"Open plug-in windows in Controls view by default"**

This exposes plugin parameters to the Accessibility API.

## Claude Desktop Configuration

Add this to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "logic-pro": {
      "command": "node",
      "args": ["/absolute/path/to/logic-pro-mcp/dist/index.js"]
    }
  }
}
```

## Usage Examples

Once connected, you can ask Claude things like:

- *"List all tracks in my project"*
- *"Create a new software instrument track"*
- *"Load a Channel EQ on the selected track"*
- *"What are the compressor parameters on track 2?"*
- *"Set the tempo to 128 BPM"*
- *"Send a C major chord via MIDI"*
- *"Bounce my project"*

## Architecture

```
Claude AI ←→ MCP Server (stdio) ←→ Logic Pro
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
AppleScript   Accessibility   Virtual MIDI
(osascript)   (Swift Helper)  (node-midi)
```

## Project Structure

```
logic-pro-mcp/
├── src/
│   ├── index.ts                  # MCP server entry
│   ├── bridges/
│   │   ├── applescript.ts        # osascript wrapper
│   │   ├── accessibility.ts      # Swift helper wrapper
│   │   └── midi-bridge.ts        # node-midi virtual port
│   └── tools/
│       ├── transport.ts          # Play, Stop, Record, Tempo
│       ├── tracks.ts             # Track management
│       ├── plugins.ts            # Plugin listing & control
│       ├── midi.ts               # MIDI note/CC sending
│       ├── project.ts            # Project management
│       └── mixer.ts              # Mixer controls
├── swift-helper/
│   ├── Package.swift
│   └── Sources/LogicAccessibility/
│       └── main.swift            # AXUIElement interaction
├── package.json
├── tsconfig.json
└── README.md
```

## Limitations

- Logic Pro has no public API – this MCP uses system-level automation
- Some UI scripting operations are **timing-sensitive** (short delays are used)
- Plugin parameter access requires the **Controls view** to be enabled
- The Swift accessibility helper must be **compiled** before first use
- Accessibility permissions must be explicitly **granted** by the user

## License

MIT
