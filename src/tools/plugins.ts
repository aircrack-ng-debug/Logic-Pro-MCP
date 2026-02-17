import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
    runAppleScript,
    sendKeyStroke,
    activateLogicPro,
} from "../bridges/applescript.js";
import {
    getPluginParameters,
    setPluginParameter,
    listTracks,
} from "../bridges/accessibility.js";

const execFileAsync = promisify(execFile);

interface AudioUnit {
    type: string;
    subtype: string;
    manufacturer: string;
    name: string;
}

export const pluginTools = [
    {
        name: "plugin_list_installed",
        description:
            "List all Audio Unit plugins installed on this Mac. Returns manufacturer, name, and type.",
        inputSchema: {
            type: "object" as const,
            properties: {
                filter: {
                    type: "string",
                    description:
                        "Optional: filter plugins by name or manufacturer (case-insensitive)",
                },
            },
        },
        handler: async (args: { filter?: string }) => {
            try {
                const { stdout } = await execFileAsync("auval", ["-l"], {
                    timeout: 10_000,
                });

                const plugins = parseAuvalOutput(stdout);
                const filtered = args.filter
                    ? plugins.filter(
                        (p) =>
                            p.name.toLowerCase().includes(args.filter!.toLowerCase()) ||
                            p.manufacturer
                                .toLowerCase()
                                .includes(args.filter!.toLowerCase()),
                    )
                    : plugins;

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `Found ${filtered.length} Audio Unit plugins:\n${JSON.stringify(filtered, null, 2)}`,
                        },
                    ],
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `Failed to list plugins: ${error instanceof Error ? error.message : String(error)}`,
                        },
                    ],
                    isError: true,
                };
            }
        },
    },
    {
        name: "plugin_list_on_track",
        description:
            "List all plugins loaded on a specific track in the current Logic Pro project.",
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
                            text: `Plugins on track ${args.trackIndex} (${track.name}):\n${JSON.stringify(track.plugins, null, 2)}`,
                        },
                    ],
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `Failed to list track plugins: ${error instanceof Error ? error.message : String(error)}`,
                        },
                    ],
                    isError: true,
                };
            }
        },
    },
    {
        name: "plugin_load",
        description:
            "Load a Logic Pro built-in Audio Unit plugin onto the currently selected track. Uses the plugin search dialog (⌃⌘P).",
        inputSchema: {
            type: "object" as const,
            properties: {
                pluginName: {
                    type: "string",
                    description:
                        'The name of the plugin to load (e.g. "Channel EQ", "Compressor", "Space Designer", "Alchemy")',
                },
            },
            required: ["pluginName"],
        },
        handler: async (args: { pluginName: string }) => {
            await activateLogicPro();
            const escapedName = args.pluginName.replace(/"/g, '\\"');

            // Use Ctrl+Cmd+P to open plugin search, type name, press Enter
            const script = `
        tell application "System Events"
          tell process "Logic Pro"
            keystroke "p" using {control down, command down}
            delay 0.5
            keystroke "${escapedName}"
            delay 0.5
            key code 36 -- Enter to select first result
          end tell
        end tell
      `;
            await runAppleScript(script);
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `Loaded plugin "${args.pluginName}" on the selected track.`,
                    },
                ],
            };
        },
    },
    {
        name: "plugin_get_parameters",
        description:
            "Read all parameter names and current values for a plugin on a specific track and slot. Requires Accessibility access and Controls view enabled in Logic Pro.",
        inputSchema: {
            type: "object" as const,
            properties: {
                trackIndex: {
                    type: "number",
                    description: "The 0-based index of the track",
                },
                slotIndex: {
                    type: "number",
                    description:
                        "The 0-based index of the plugin slot on the channel strip (0 = first insert)",
                },
            },
            required: ["trackIndex", "slotIndex"],
        },
        handler: async (args: { trackIndex: number; slotIndex: number }) => {
            try {
                const params = await getPluginParameters(
                    args.trackIndex,
                    args.slotIndex,
                );
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `Plugin parameters (track ${args.trackIndex}, slot ${args.slotIndex}):\n${JSON.stringify(params, null, 2)}`,
                        },
                    ],
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `Failed to read plugin parameters: ${error instanceof Error ? error.message : String(error)}`,
                        },
                    ],
                    isError: true,
                };
            }
        },
    },
    {
        name: "plugin_set_parameter",
        description:
            "Set a specific parameter value on a plugin. Requires Accessibility access.",
        inputSchema: {
            type: "object" as const,
            properties: {
                trackIndex: {
                    type: "number",
                    description: "The 0-based index of the track",
                },
                slotIndex: {
                    type: "number",
                    description: "The 0-based index of the plugin slot",
                },
                parameterName: {
                    type: "string",
                    description: "The name of the parameter to set (as returned by plugin_get_parameters)",
                },
                value: {
                    type: "string",
                    description:
                        "The new value to set (as a string, will be matched to the parameter type)",
                },
            },
            required: ["trackIndex", "slotIndex", "parameterName", "value"],
        },
        handler: async (args: {
            trackIndex: number;
            slotIndex: number;
            parameterName: string;
            value: string;
        }) => {
            try {
                const result = await setPluginParameter(
                    args.trackIndex,
                    args.slotIndex,
                    args.parameterName,
                    args.value,
                );
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `Parameter "${args.parameterName}" set to "${args.value}". ${result}`,
                        },
                    ],
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `Failed to set parameter: ${error instanceof Error ? error.message : String(error)}`,
                        },
                    ],
                    isError: true,
                };
            }
        },
    },
    {
        name: "plugin_load_preset",
        description:
            "Load a preset for the currently open plugin by navigating the preset menu.",
        inputSchema: {
            type: "object" as const,
            properties: {
                presetName: {
                    type: "string",
                    description: "The name of the preset to load",
                },
            },
            required: ["presetName"],
        },
        handler: async (args: { presetName: string }) => {
            await activateLogicPro();
            // Navigate to preset menu in the plugin window
            const script = `
        tell application "System Events"
          tell process "Logic Pro"
            -- Click the preset popup in the plugin window header
            -- This is fragile and depends on plugin window being open
            keystroke "p" using {control down}
            delay 0.3
            keystroke "${args.presetName.replace(/"/g, '\\"')}"
            delay 0.3
            key code 36 -- Enter
          end tell
        end tell
      `;
            await runAppleScript(script);
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `Attempted to load preset "${args.presetName}". Note: plugin window must be open.`,
                    },
                ],
            };
        },
    },
];

export function parseAuvalOutput(output: string): AudioUnit[] {
    const plugins: AudioUnit[] = [];
    const lines = output.split("\n");

    for (const line of lines) {
        // Lines look like: aufx    AUBa    appl    -  AUBandpass
        const match = line.match(
            /^\s*(\w{4})\s+(\w{4})\s+(\w{4})\s+-\s+(.+)$/,
        );
        if (match) {
            plugins.push({
                type: match[1],
                subtype: match[2],
                manufacturer: match[3],
                name: match[4].trim(),
            });
        }
    }

    return plugins;
}
