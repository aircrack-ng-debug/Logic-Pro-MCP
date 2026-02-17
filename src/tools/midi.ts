import {
    sendNotes as bridgeSendNotes,
    sendPattern as bridgeSendPattern,
    sendCC,
    sendNoteOn,
    sendNoteOff,
    isMidiPortOpen,
} from "../bridges/midi-bridge.js";

interface NoteInput {
    note: number;
    velocity: number;
    channel?: number;
    duration?: number;
    delay?: number;
}

export const midiTools = [
    {
        name: "midi_send_notes",
        description:
            "Send MIDI notes to Logic Pro through the virtual MIDI port 'Logic Pro MCP'. The receiving track in Logic must have this port selected as input. Notes are played sequentially with specified durations.",
        inputSchema: {
            type: "object" as const,
            properties: {
                notes: {
                    type: "array",
                    description: "Array of note events to send",
                    items: {
                        type: "object",
                        properties: {
                            note: {
                                type: "number",
                                description:
                                    "MIDI note number (0-127). Middle C = 60, C3 = 48, A4 = 69",
                            },
                            velocity: {
                                type: "number",
                                description: "Note velocity (0-127). 64 = medium, 100 = strong",
                            },
                            channel: {
                                type: "number",
                                description: "MIDI channel (0-15). Default: 0",
                            },
                            duration: {
                                type: "number",
                                description: "Note duration in milliseconds. Default: 500",
                            },
                            delay: {
                                type: "number",
                                description:
                                    "Delay before this note in milliseconds. Default: 0",
                            },
                        },
                        required: ["note", "velocity"],
                    },
                },
            },
            required: ["notes"],
        },
        handler: async (args: { notes: NoteInput[] }) => {
            ensureMidiPort();
            await bridgeSendNotes(args.notes);
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `Sent ${args.notes.length} MIDI note(s) to Logic Pro.`,
                    },
                ],
            };
        },
    },
    {
        name: "midi_send_chord",
        description:
            "Send a chord (multiple simultaneous notes) to Logic Pro via MIDI.",
        inputSchema: {
            type: "object" as const,
            properties: {
                notes: {
                    type: "array",
                    description:
                        "Array of MIDI note numbers to play simultaneously (e.g. [60, 64, 67] for C major)",
                    items: { type: "number" },
                },
                velocity: {
                    type: "number",
                    description: "Note velocity (0-127). Default: 80",
                },
                duration: {
                    type: "number",
                    description: "Chord duration in milliseconds. Default: 1000",
                },
                channel: {
                    type: "number",
                    description: "MIDI channel (0-15). Default: 0",
                },
            },
            required: ["notes"],
        },
        handler: async (args: {
            notes: number[];
            velocity?: number;
            duration?: number;
            channel?: number;
        }) => {
            ensureMidiPort();
            const vel = args.velocity ?? 80;
            const dur = args.duration ?? 1000;
            const ch = args.channel ?? 0;

            // Note on for all notes
            for (const note of args.notes) {
                sendNoteOn(ch, note, vel);
            }

            // Wait for duration
            await new Promise((r) => setTimeout(r, dur));

            // Note off for all notes
            for (const note of args.notes) {
                sendNoteOff(ch, note);
            }

            return {
                content: [
                    {
                        type: "text" as const,
                        text: `Sent chord [${args.notes.join(", ")}] with velocity ${vel} for ${dur}ms.`,
                    },
                ],
            };
        },
    },
    {
        name: "midi_send_cc",
        description:
            "Send a MIDI Control Change message to Logic Pro. Useful for controlling parameters mapped to MIDI CC.",
        inputSchema: {
            type: "object" as const,
            properties: {
                controller: {
                    type: "number",
                    description:
                        "CC number (0-127). Common: 1=Mod Wheel, 7=Volume, 10=Pan, 11=Expression, 64=Sustain",
                },
                value: {
                    type: "number",
                    description: "CC value (0-127)",
                },
                channel: {
                    type: "number",
                    description: "MIDI channel (0-15). Default: 0",
                },
            },
            required: ["controller", "value"],
        },
        handler: async (args: {
            controller: number;
            value: number;
            channel?: number;
        }) => {
            ensureMidiPort();
            sendCC(args.channel ?? 0, args.controller, args.value);
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `Sent CC${args.controller} = ${args.value} on channel ${args.channel ?? 0}.`,
                    },
                ],
            };
        },
    },
    {
        name: "midi_send_pattern",
        description:
            "Send a musical pattern/sequence to Logic Pro, timed to a specific BPM. Note durations and delays are specified in beats (1 = quarter note, 0.5 = eighth note, etc.).",
        inputSchema: {
            type: "object" as const,
            properties: {
                notes: {
                    type: "array",
                    description: "Array of note events with beat-based timing",
                    items: {
                        type: "object",
                        properties: {
                            note: { type: "number", description: "MIDI note number (0-127)" },
                            velocity: { type: "number", description: "Velocity (0-127)" },
                            channel: { type: "number", description: "MIDI channel (0-15)" },
                            duration: {
                                type: "number",
                                description: "Duration in beats (1 = quarter note). Default: 0.5",
                            },
                            delay: {
                                type: "number",
                                description: "Delay before this note in beats. Default: 0",
                            },
                        },
                        required: ["note", "velocity"],
                    },
                },
                bpm: {
                    type: "number",
                    description: "Tempo in BPM for timing the pattern. Default: 120",
                },
            },
            required: ["notes"],
        },
        handler: async (args: { notes: NoteInput[]; bpm?: number }) => {
            ensureMidiPort();
            await bridgeSendPattern(args.notes, args.bpm ?? 120);
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `Sent ${args.notes.length} note pattern at ${args.bpm ?? 120} BPM.`,
                    },
                ],
            };
        },
    },
];

function ensureMidiPort(): void {
    if (!isMidiPortOpen()) {
        throw new Error(
            "MIDI port is not open. The server should have opened it on startup.",
        );
    }
}
