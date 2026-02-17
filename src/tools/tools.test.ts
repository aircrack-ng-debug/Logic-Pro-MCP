import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { transportTools } from "./transport.js";
import { trackTools } from "./tracks.js";
import { pluginTools } from "./plugins.js";
import { midiTools } from "./midi.js";
import { projectTools } from "./project.js";
import { mixerTools } from "./mixer.js";

const ALL_TOOLS = [
    ...transportTools,
    ...trackTools,
    ...pluginTools,
    ...midiTools,
    ...projectTools,
    ...mixerTools,
];

describe("Tool Registration", () => {
    it("has the expected number of tools", () => {
        assert.equal(ALL_TOOLS.length, 35);
    });

    it("all tools have unique names", () => {
        const names = ALL_TOOLS.map((t) => t.name);
        const unique = new Set(names);
        assert.equal(
            unique.size,
            names.length,
            `Duplicate tool names found: ${names.filter((n, i) => names.indexOf(n) !== i)}`,
        );
    });

    it("all tools have required properties", () => {
        for (const tool of ALL_TOOLS) {
            assert.ok(tool.name, `Tool missing name`);
            assert.ok(tool.description, `Tool ${tool.name} missing description`);
            assert.ok(tool.inputSchema, `Tool ${tool.name} missing inputSchema`);
            assert.equal(
                tool.inputSchema.type,
                "object",
                `Tool ${tool.name} inputSchema.type must be 'object'`,
            );
            assert.ok(
                tool.inputSchema.properties !== undefined,
                `Tool ${tool.name} missing inputSchema.properties`,
            );
            assert.equal(
                typeof tool.handler,
                "function",
                `Tool ${tool.name} missing handler function`,
            );
        }
    });

    it("tool names follow naming convention (category_action)", () => {
        const validPrefixes = [
            "transport_",
            "track_",
            "plugin_",
            "midi_",
            "project_",
            "mixer_",
        ];
        for (const tool of ALL_TOOLS) {
            const hasValidPrefix = validPrefixes.some((p) => tool.name.startsWith(p));
            assert.ok(
                hasValidPrefix,
                `Tool "${tool.name}" does not follow naming convention (expected prefix: ${validPrefixes.join(", ")})`,
            );
        }
    });

    it("tools with required params have them defined in properties", () => {
        for (const tool of ALL_TOOLS) {
            const required = (tool.inputSchema as { required?: string[] }).required;
            if (required) {
                for (const param of required) {
                    assert.ok(
                        param in tool.inputSchema.properties,
                        `Tool "${tool.name}" has required param "${param}" not in properties`,
                    );
                }
            }
        }
    });

    it("descriptions are meaningful (more than 10 chars)", () => {
        for (const tool of ALL_TOOLS) {
            assert.ok(
                tool.description.length > 10,
                `Tool "${tool.name}" description too short: "${tool.description}"`,
            );
        }
    });
});

describe("Tool Categories", () => {
    it("transport tools count is correct", () => {
        assert.equal(transportTools.length, 7);
    });

    it("track tools count is correct", () => {
        assert.equal(trackTools.length, 8);
    });

    it("plugin tools count is correct", () => {
        assert.equal(pluginTools.length, 6);
    });

    it("midi tools count is correct", () => {
        assert.equal(midiTools.length, 4);
    });

    it("project tools count is correct", () => {
        assert.equal(projectTools.length, 7);
    });

    it("mixer tools count is correct", () => {
        assert.equal(mixerTools.length, 3);
    });
});
