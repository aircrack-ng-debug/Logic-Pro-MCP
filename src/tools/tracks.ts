import {
    sendKeyStroke,
    sendKeyCode,
    runAppleScript,
    activateLogicPro,
} from "../bridges/applescript.js";
import { listTracks as axListTracks } from "../bridges/accessibility.js";

export const trackTools = [
    {
        name: "track_list",
        description:
            "List all tracks in the current Logic Pro project with their names, indices, and loaded plugins.",
        inputSchema: {
            type: "object" as const,
            properties: {},
        },
        handler: async () => {
            try {
                const tracks = await axListTracks();
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(tracks, null, 2),
                        },
                    ],
                };
            } catch {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: "Could not list tracks via Accessibility API. Ensure Logic Pro is open and Accessibility access is granted.",
                        },
                    ],
                    isError: true,
                };
            }
        },
    },
    {
        name: "track_create_audio",
        description: "Create a new audio track in Logic Pro.",
        inputSchema: {
            type: "object" as const,
            properties: {},
        },
        handler: async () => {
            await activateLogicPro();
            // Option+Cmd+N opens new track dialog, but we use the menu approach
            const script = `
        tell application "System Events"
          tell process "Logic Pro"
            click menu item "New Audio Track" of menu "Track" of menu bar 1
          end tell
        end tell
      `;
            try {
                await runAppleScript(script);
            } catch {
                // Fallback: key shortcut
                await sendKeyStroke("a", ["option", "command"]);
            }
            return {
                content: [{ type: "text" as const, text: "Audio track created." }],
            };
        },
    },
    {
        name: "track_create_midi",
        description:
            "Create a new software instrument (MIDI) track in Logic Pro.",
        inputSchema: {
            type: "object" as const,
            properties: {},
        },
        handler: async () => {
            await activateLogicPro();
            const script = `
        tell application "System Events"
          tell process "Logic Pro"
            click menu item "New Software Instrument Track" of menu "Track" of menu bar 1
          end tell
        end tell
      `;
            try {
                await runAppleScript(script);
            } catch {
                await sendKeyStroke("s", ["option", "command"]);
            }
            return {
                content: [
                    { type: "text" as const, text: "Software instrument track created." },
                ],
            };
        },
    },
    {
        name: "track_select",
        description: "Select a track by its index (0-based).",
        inputSchema: {
            type: "object" as const,
            properties: {
                index: {
                    type: "number",
                    description: "The 0-based index of the track to select",
                },
            },
            required: ["index"],
        },
        handler: async (args: { index: number }) => {
            await activateLogicPro();
            // Navigate to track using arrow keys from top
            const script = `
        tell application "System Events"
          tell process "Logic Pro"
            -- First go to track 1
            keystroke "1" using {control down}
            delay 0.1
            -- Then arrow down to desired track
            repeat ${args.index} times
              key code 125 -- down arrow
              delay 0.05
            end repeat
          end tell
        end tell
      `;
            await runAppleScript(script);
            return {
                content: [
                    { type: "text" as const, text: `Selected track ${args.index}.` },
                ],
            };
        },
    },
    {
        name: "track_rename",
        description: "Rename the currently selected track.",
        inputSchema: {
            type: "object" as const,
            properties: {
                name: {
                    type: "string",
                    description: "The new name for the track",
                },
            },
            required: ["name"],
        },
        handler: async (args: { name: string }) => {
            await activateLogicPro();
            const script = `
        tell application "System Events"
          tell process "Logic Pro"
            -- Double-click track header to rename
            keystroke "r" using {shift down}
            delay 0.3
            keystroke "a" using {command down}
            keystroke "${args.name.replace(/"/g, '\\"')}"
            key code 36 -- Enter
          end tell
        end tell
      `;
            await runAppleScript(script);
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `Track renamed to "${args.name}".`,
                    },
                ],
            };
        },
    },
    {
        name: "track_delete",
        description:
            "Delete the currently selected track in Logic Pro. Use with caution!",
        inputSchema: {
            type: "object" as const,
            properties: {},
        },
        handler: async () => {
            await activateLogicPro();
            await sendKeyCode(51, ["command"]); // Cmd+Backspace
            return {
                content: [
                    { type: "text" as const, text: "Selected track deleted." },
                ],
            };
        },
    },
    {
        name: "track_mute",
        description: "Toggle mute on the currently selected track.",
        inputSchema: {
            type: "object" as const,
            properties: {},
        },
        handler: async () => {
            await activateLogicPro();
            await sendKeyStroke("m");
            return {
                content: [{ type: "text" as const, text: "Track mute toggled." }],
            };
        },
    },
    {
        name: "track_solo",
        description: "Toggle solo on the currently selected track.",
        inputSchema: {
            type: "object" as const,
            properties: {},
        },
        handler: async () => {
            await activateLogicPro();
            await sendKeyStroke("s");
            return {
                content: [{ type: "text" as const, text: "Track solo toggled." }],
            };
        },
    },
];
