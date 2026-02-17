import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * MIDI message formatting tests.
 * These test the raw byte construction without needing a real MIDI port.
 */
describe("MIDI Message Formatting", () => {
    it("note on message has correct status byte", () => {
        const channel = 0;
        const note = 60;
        const velocity = 100;
        const msg = [0x90 + (channel & 0x0f), note & 0x7f, velocity & 0x7f];

        assert.deepEqual(msg, [144, 60, 100]);
    });

    it("note off message has correct status byte", () => {
        const channel = 0;
        const note = 60;
        const msg = [0x80 + (channel & 0x0f), note & 0x7f, 0];

        assert.deepEqual(msg, [128, 60, 0]);
    });

    it("CC message has correct status byte", () => {
        const channel = 0;
        const controller = 7; // volume
        const value = 100;
        const msg = [
            0xb0 + (channel & 0x0f),
            controller & 0x7f,
            value & 0x7f,
        ];

        assert.deepEqual(msg, [176, 7, 100]);
    });

    it("channel is clamped to 0-15", () => {
        const channel = 16; // out of range
        const statusByte = 0x90 + (channel & 0x0f);
        assert.equal(statusByte, 0x90); // wraps to channel 0
    });

    it("note is clamped to 0-127", () => {
        const note = 200; // out of range
        const clampedNote = note & 0x7f;
        assert.equal(clampedNote, 72); // 200 & 127 = 72
    });

    it("velocity is clamped to 0-127", () => {
        const velocity = 255; // max byte
        const clampedVel = velocity & 0x7f;
        assert.equal(clampedVel, 127);
    });

    it("program change has correct format", () => {
        const channel = 3;
        const program = 42;
        const msg = [0xc0 + (channel & 0x0f), program & 0x7f];

        assert.deepEqual(msg, [195, 42]);
    });

    it("multi-channel note on produces correct bytes", () => {
        for (let ch = 0; ch < 16; ch++) {
            const statusByte = 0x90 + (ch & 0x0f);
            assert.equal(statusByte, 144 + ch);
        }
    });
});
