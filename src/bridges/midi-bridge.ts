import midi from "midi";

let output: InstanceType<typeof midi.Output> | null = null;
const VIRTUAL_PORT_NAME = "Logic Pro MCP";

export function openMidiPort(): void {
    if (output) return;
    output = new midi.Output();
    output.openVirtualPort(VIRTUAL_PORT_NAME);
}

export function closeMidiPort(): void {
    if (!output) return;
    output.closePort();
    output = null;
}

export function isMidiPortOpen(): boolean {
    return output !== null;
}

export function sendNoteOn(
    channel: number,
    note: number,
    velocity: number,
): void {
    if (!output) throw new Error("MIDI port not open");
    output.sendMessage([0x90 + (channel & 0x0f), note & 0x7f, velocity & 0x7f]);
}

export function sendNoteOff(channel: number, note: number): void {
    if (!output) throw new Error("MIDI port not open");
    output.sendMessage([0x80 + (channel & 0x0f), note & 0x7f, 0]);
}

export function sendCC(
    channel: number,
    controller: number,
    value: number,
): void {
    if (!output) throw new Error("MIDI port not open");
    output.sendMessage([
        0xb0 + (channel & 0x0f),
        controller & 0x7f,
        value & 0x7f,
    ]);
}

export function sendProgramChange(channel: number, program: number): void {
    if (!output) throw new Error("MIDI port not open");
    output.sendMessage([0xc0 + (channel & 0x0f), program & 0x7f]);
}

interface NoteEvent {
    note: number;
    velocity: number;
    channel?: number;
    duration?: number;
    delay?: number;
}

export async function sendNotes(notes: NoteEvent[]): Promise<void> {
    if (!output) throw new Error("MIDI port not open");

    for (const event of notes) {
        const ch = event.channel ?? 0;
        const dur = event.duration ?? 500;
        const del = event.delay ?? 0;

        if (del > 0) {
            await sleep(del);
        }

        sendNoteOn(ch, event.note, event.velocity);
        await sleep(dur);
        sendNoteOff(ch, event.note);
    }
}

export async function sendPattern(
    notes: NoteEvent[],
    bpm: number = 120,
): Promise<void> {
    if (!output) throw new Error("MIDI port not open");

    const beatMs = 60_000 / bpm;

    for (const event of notes) {
        const ch = event.channel ?? 0;
        const dur = event.duration ? (event.duration / 4) * beatMs : beatMs / 2;
        const del = event.delay ? (event.delay / 4) * beatMs : 0;

        if (del > 0) {
            await sleep(del);
        }

        sendNoteOn(ch, event.note, event.velocity);
        await sleep(dur);
        sendNoteOff(ch, event.note);
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
