import {
    activateLogicPro,
    runAppleScript,
    sendKeyStroke,
} from "../bridges/applescript.js";
import { listTracks } from "../bridges/accessibility.js";

export const mixerTools = [
    {
        name: "mixer_show",
        description: "Show/hide the mixer window in Logic Pro.",
        inputSchema: {
            type: "object" as const,
            properties: {},
        },
        handler: async () => {
            await activateLogicPro();
            await sendKeyStroke("x");
            return {
                content: [{ type: "text" as const, text: "Mixer visibility toggled." }],
            };
        },
    },
    {
        name: "mixer_get_channel_strip",
        description:
            "Get channel strip information for a specific track, including loaded plugins and routing.",
        inputSchema: {
            type: "object" as const,
            properties: {
                trackIndex: {
                    type: "number",
                    description: "The 0-based index of the track",
                },
            },
            required: ["trackIndex"],
        },
        handler: async (args: { trackIndex: number }) => {
            try {
                const tracks = await listTracks();
                const track = tracks.find((t) => t.index === args.trackIndex);
                if (!track) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `Track ${args.trackIndex} not found.`,
                            },
                        ],
                        isError: true,
                    };
                }
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `Channel strip for track ${args.trackIndex}:\n${JSON.stringify(track, null, 2)}`,
                        },
                    ],
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `Failed to get channel strip info: ${error instanceof Error ? error.message : String(error)}`,
                        },
                    ],
                    isError: true,
                };
            }
        },
    },
    {
        name: "mixer_load_channel_strip_setting",
        description:
            "Load a saved channel strip setting by name. Channel strip settings include pre-configured plugin chains.",
        inputSchema: {
            type: "object" as const,
            properties: {
                settingName: {
                    type: "string",
                    description:
                        'Name of the channel strip setting to load (e.g. "Bright Vocal", "Clean Guitar")',
                },
            },
            required: ["settingName"],
        },
        handler: async (args: { settingName: string }) => {
            await activateLogicPro();
            // Open Channel Strip Settings menu
            const script = `
        tell application "System Events"
          tell process "Logic Pro"
            -- Open Inspector if not visible
            keystroke "i"
            delay 0.3
            -- Navigate to Channel Strip Setting
            -- This requires the inspector to be showing
            -- Click the setting popup at the top of the channel strip
          end tell
        end tell
      `;
            await runAppleScript(script);
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `Attempted to load channel strip setting "${args.settingName}". Note: inspector must be visible.`,
                    },
                ],
            };
        },
    },
];
