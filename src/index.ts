#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { openMidiPort, closeMidiPort } from "./bridges/midi-bridge.js";
import { transportTools } from "./tools/transport.js";
import { trackTools } from "./tools/tracks.js";
import { pluginTools } from "./tools/plugins.js";
import { midiTools } from "./tools/midi.js";
import { projectTools } from "./tools/project.js";
import { mixerTools } from "./tools/mixer.js";

const ALL_TOOLS = [
    ...transportTools,
    ...trackTools,
    ...pluginTools,
    ...midiTools,
    ...projectTools,
    ...mixerTools,
];

const toolMap = new Map(ALL_TOOLS.map((t) => [t.name, t]));

const server = new Server(
    {
        name: "logic-pro-mcp",
        version: "0.1.0",
    },
    {
        capabilities: {
            tools: {},
        },
    },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: ALL_TOOLS.map(({ name, description, inputSchema }) => ({
        name,
        description,
        inputSchema,
    })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = toolMap.get(name);

    if (!tool) {
        return {
            content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
            isError: true,
        };
    }

    try {
        return await tool.handler(args as never);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: "text" as const, text: `Error: ${message}` }],
            isError: true,
        };
    }
});

async function main(): Promise<void> {
    // Open virtual MIDI port
    try {
        openMidiPort();
        process.stderr.write("[logic-pro-mcp] Virtual MIDI port opened: 'Logic Pro MCP'\n");
    } catch (error) {
        process.stderr.write(
            `[logic-pro-mcp] Warning: Could not open MIDI port: ${error}\n`,
        );
    }

    // Clean up on exit
    process.on("SIGINT", () => {
        closeMidiPort();
        process.exit(0);
    });
    process.on("SIGTERM", () => {
        closeMidiPort();
        process.exit(0);
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);
    process.stderr.write(
        `[logic-pro-mcp] Server started with ${ALL_TOOLS.length} tools\n`,
    );
}

main().catch((error) => {
    process.stderr.write(`[logic-pro-mcp] Fatal error: ${error}\n`);
    closeMidiPort();
    process.exit(1);
});
