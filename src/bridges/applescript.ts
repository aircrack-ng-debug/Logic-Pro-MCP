import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const OSASCRIPT_TIMEOUT = 10_000;

export async function runAppleScript(script: string): Promise<string> {
    const { stdout } = await execFileAsync("osascript", ["-e", script], {
        timeout: OSASCRIPT_TIMEOUT,
    });
    return stdout.trim();
}

export async function runJXA(script: string): Promise<string> {
    const { stdout } = await execFileAsync(
        "osascript",
        ["-l", "JavaScript", "-e", script],
        { timeout: OSASCRIPT_TIMEOUT },
    );
    return stdout.trim();
}

export async function sendKeyStroke(
    key: string,
    modifiers: string[] = [],
): Promise<void> {
    const modPart =
        modifiers.length > 0
            ? ` using {${modifiers.map((m) => `${m} down`).join(", ")}}`
            : "";

    const script = `
    tell application "Logic Pro" to activate
    delay 0.3
    tell application "System Events"
      tell process "Logic Pro"
        keystroke "${key}"${modPart}
      end tell
    end tell
  `;
    await runAppleScript(script);
}

export async function sendKeyCode(
    keyCode: number,
    modifiers: string[] = [],
): Promise<void> {
    const modPart =
        modifiers.length > 0
            ? ` using {${modifiers.map((m) => `${m} down`).join(", ")}}`
            : "";

    const script = `
    tell application "Logic Pro" to activate
    delay 0.3
    tell application "System Events"
      tell process "Logic Pro"
        key code ${keyCode}${modPart}
      end tell
    end tell
  `;
    await runAppleScript(script);
}

export async function isLogicProRunning(): Promise<boolean> {
    const script = `
    tell application "System Events"
      return (name of processes) contains "Logic Pro"
    end tell
  `;
    const result = await runAppleScript(script);
    return result === "true";
}

export async function activateLogicPro(): Promise<void> {
    await runAppleScript('tell application "Logic Pro" to activate');
}
