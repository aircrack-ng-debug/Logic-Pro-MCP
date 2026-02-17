import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseAuvalOutput } from "./plugins.js";

describe("parseAuvalOutput", () => {
    it("parses standard auval output lines", () => {
        const input = `
    AU Validation Tool
    Version: 1.7.0
    Copyright 2003-2023, Apple Inc. - All Rights Reserved.
    Available Audio Unit Components:

    aufx    AUBa    appl    -  AUBandpass
    aufx    AUDy    appl    -  AUDynamicsProcessor
    aufx    AUNb    appl    -  AUNBandEQ
    aumu    dlss    appl    -  DLSMusicDevice
    aumf    CEQu    appl    -  Channel EQ
    `;

        const result = parseAuvalOutput(input);

        assert.equal(result.length, 5);
        assert.deepEqual(result[0], {
            type: "aufx",
            subtype: "AUBa",
            manufacturer: "appl",
            name: "AUBandpass",
        });
        assert.deepEqual(result[4], {
            type: "aumf",
            subtype: "CEQu",
            manufacturer: "appl",
            name: "Channel EQ",
        });
    });

    it("returns empty array for no plugins", () => {
        const result = parseAuvalOutput("");
        assert.equal(result.length, 0);
    });

    it("ignores non-plugin lines", () => {
        const input = `
    AU Validation Tool
    Version: 1.7.0
    Some random text
    `;
        const result = parseAuvalOutput(input);
        assert.equal(result.length, 0);
    });

    it("handles third-party plugins with longer names", () => {
        const input = `    aufx    FQ03    FabF    -  FabFilter Pro-Q 3`;
        const result = parseAuvalOutput(input);

        assert.equal(result.length, 1);
        assert.deepEqual(result[0], {
            type: "aufx",
            subtype: "FQ03",
            manufacturer: "FabF",
            name: "FabFilter Pro-Q 3",
        });
    });
});
