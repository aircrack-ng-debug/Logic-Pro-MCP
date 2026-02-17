import {
    runAppleScript,
    sendKeyStroke,
    sendKeyCode,
    activateLogicPro,
} from "../bridges/applescript.js";

export const projectTools = [
    {
        name: "project_get_info",
        description:
            "Get information about the currently open Logic Pro project (name, path).",
        inputSchema: {
            type: "object" as const,
            properties: {},
        },
        handler: async () => {
            try {
                const nameScript = `
          tell application "Logic Pro"
            if (count of documents) > 0 then
              set docName to name of front document
              return docName
            else
              return "No project open"
            end if
          end tell
        `;
                const name = await runAppleScript(nameScript);
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `Current project: ${name}`,
                        },
                    ],
                };
            } catch {
                // Fallback: read window title
                const titleScript = `
          tell application "System Events"
            tell process "Logic Pro"
              return name of front window
            end tell
          end tell
        `;
                try {
                    const title = await runAppleScript(titleScript);
                    return {
                        content: [
                            { type: "text" as const, text: `Current project: ${title}` },
                        ],
                    };
                } catch {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: "Could not determine project info. Is Logic Pro running with a project open?",
                            },
                        ],
                        isError: true,
                    };
                }
            }
        },
    },
    {
        name: "project_save",
        description: "Save the current Logic Pro project.",
        inputSchema: {
            type: "object" as const,
            properties: {},
        },
        handler: async () => {
            await activateLogicPro();
            await sendKeyStroke("s", ["command"]);
            return {
                content: [{ type: "text" as const, text: "Project saved." }],
            };
        },
    },
    {
        name: "project_open",
        description: "Open a Logic Pro project file by path.",
        inputSchema: {
            type: "object" as const,
            properties: {
                path: {
                    type: "string",
                    description:
                        "Absolute path to the .logicx project file or folder",
                },
            },
            required: ["path"],
        },
        handler: async (args: { path: string }) => {
            const script = `
        tell application "Logic Pro"
          activate
          open POSIX file "${args.path.replace(/"/g, '\\"')}"
        end tell
      `;
            await runAppleScript(script);
            return {
                content: [
                    { type: "text" as const, text: `Opened project: ${args.path}` },
                ],
            };
        },
    },
    {
        name: "project_close",
        description:
            "Close the current Logic Pro project. Will prompt to save if there are unsaved changes.",
        inputSchema: {
            type: "object" as const,
            properties: {},
        },
        handler: async () => {
            await activateLogicPro();
            await sendKeyStroke("w", ["command"]);
            return {
                content: [
                    {
                        type: "text" as const,
                        text: "Project close requested. Check Logic Pro for save dialog.",
                    },
                ],
            };
        },
    },
    {
        name: "project_bounce",
        description:
            "Open the Bounce dialog in Logic Pro to export/mixdown the project. You may need to configure settings in the dialog.",
        inputSchema: {
            type: "object" as const,
            properties: {},
        },
        handler: async () => {
            await activateLogicPro();
            await sendKeyStroke("b", ["command"]);
            return {
                content: [
                    {
                        type: "text" as const,
                        text: "Bounce dialog opened. Configure output settings in Logic Pro.",
                    },
                ],
            };
        },
    },
    {
        name: "project_undo",
        description: "Undo the last action in Logic Pro.",
        inputSchema: {
            type: "object" as const,
            properties: {},
        },
        handler: async () => {
            await activateLogicPro();
            await sendKeyStroke("z", ["command"]);
            return {
                content: [{ type: "text" as const, text: "Undo performed." }],
            };
        },
    },
    {
        name: "project_redo",
        description: "Redo the last undone action in Logic Pro.",
        inputSchema: {
            type: "object" as const,
            properties: {},
        },
        handler: async () => {
            await activateLogicPro();
            await sendKeyStroke("z", ["command", "shift"]);
            return {
                content: [{ type: "text" as const, text: "Redo performed." }],
            };
        },
    },
];
