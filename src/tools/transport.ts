import {
    sendKeyStroke,
    sendKeyCode,
    runAppleScript,
    isLogicProRunning,
} from "../bridges/applescript.js";

export const transportTools = [
    {
        name: "transport_play",
        description:
            "Start playback in Logic Pro. If already playing, this will restart from the current position.",
        inputSchema: {
            type: "object" as const,
            properties: {},
        },
        handler: async () => {
            await ensureLogicPro();
            await sendKeyCode(49); // space bar
            return { content: [{ type: "text" as const, text: "Playback started." }] };
        },
    },
    {
        name: "transport_stop",
        description: "Stop playback in Logic Pro.",
        inputSchema: {
            type: "object" as const,
            properties: {},
        },
        handler: async () => {
            await ensureLogicPro();
            await sendKeyCode(49); // space bar toggles
            return { content: [{ type: "text" as const, text: "Playback stopped." }] };
        },
    },
    {
        name: "transport_record",
        description:
            "Toggle recording in Logic Pro. Make sure a track is armed for recording first.",
        inputSchema: {
            type: "object" as const,
            properties: {},
        },
        handler: async () => {
            await ensureLogicPro();
            await sendKeyStroke("r");
            return {
                content: [{ type: "text" as const, text: "Recording toggled." }],
            };
        },
    },
    {
        name: "transport_set_tempo",
        description: "Set the project tempo (BPM) in Logic Pro.",
        inputSchema: {
            type: "object" as const,
            properties: {
                bpm: {
                    type: "number",
                    description: "Tempo in beats per minute (e.g. 120)",
                    minimum: 20,
                    maximum: 990,
                },
            },
            required: ["bpm"],
        },
        handler: async (args: { bpm: number }) => {
            await ensureLogicPro();
            // Use AppleScript to click the tempo field and type the value
            const script = `
        tell application "System Events"
          tell process "Logic Pro"
            -- Double-click tempo display to enter edit mode
            -- Then type the new tempo value
            keystroke "t" using {option down, command down}
            delay 0.3
            keystroke "a" using {command down}
            keystroke "${args.bpm}"
            key code 36 -- Enter
          end tell
        end tell
      `;
            await runAppleScript(script);
            return {
                content: [
                    { type: "text" as const, text: `Tempo set to ${args.bpm} BPM.` },
                ],
            };
        },
    },
    {
        name: "transport_goto_beginning",
        description: "Move the playhead to the beginning of the project.",
        inputSchema: {
            type: "object" as const,
            properties: {},
        },
        handler: async () => {
            await ensureLogicPro();
            await sendKeyCode(36, ["command"]); // Enter key = go to beginning
            return {
                content: [
                    { type: "text" as const, text: "Playhead moved to beginning." },
                ],
            };
        },
    },
    {
        name: "transport_cycle",
        description: "Toggle cycle (loop) mode in Logic Pro.",
        inputSchema: {
            type: "object" as const,
            properties: {},
        },
        handler: async () => {
            await ensureLogicPro();
            await sendKeyStroke("c");
            return {
                content: [{ type: "text" as const, text: "Cycle mode toggled." }],
            };
        },
    },
    {
        name: "transport_metronome",
        description: "Toggle the metronome (click track) in Logic Pro.",
        inputSchema: {
            type: "object" as const,
            properties: {},
        },
        handler: async () => {
            await ensureLogicPro();
            await sendKeyStroke("k");
            return {
                content: [{ type: "text" as const, text: "Metronome toggled." }],
            };
        },
    },
];

async function ensureLogicPro(): Promise<void> {
    const running = await isLogicProRunning();
    if (!running) {
        throw new Error(
            "Logic Pro is not running. Please open Logic Pro and load a project first.",
        );
    }
}
