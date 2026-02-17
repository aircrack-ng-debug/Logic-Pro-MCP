import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const SWIFT_HELPER_PATH = resolve(
    __dirname,
    "../../swift-helper/.build/release/LogicAccessibility",
);

const AX_TIMEOUT = 15_000;

export interface TrackInfo {
    index: number;
    name: string;
    plugins: string[];
}

export interface PluginParameter {
    name: string;
    value: string;
    role: string;
}

async function runAxHelper(args: string[]): Promise<string> {
    try {
        const { stdout } = await execFileAsync(SWIFT_HELPER_PATH, args, {
            timeout: AX_TIMEOUT,
        });
        return stdout.trim();
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("ENOENT")) {
            throw new Error(
                "Swift accessibility helper not found. Run: cd swift-helper && swift build -c release",
            );
        }
        if (msg.includes("accessibility")) {
            throw new Error(
                "Accessibility access denied. Grant permission in System Settings → Privacy → Accessibility.",
            );
        }
        throw new Error(`Accessibility helper error: ${msg}`);
    }
}

export async function checkAccessibility(): Promise<boolean> {
    try {
        const result = await runAxHelper(["check-access"]);
        return result.includes("granted");
    } catch {
        return false;
    }
}

export async function listTracks(): Promise<TrackInfo[]> {
    const result = await runAxHelper(["list-tracks"]);
    return JSON.parse(result) as TrackInfo[];
}

export async function getPluginParameters(
    trackIndex: number,
    slotIndex: number,
): Promise<PluginParameter[]> {
    const result = await runAxHelper([
        "get-params",
        String(trackIndex),
        String(slotIndex),
    ]);
    return JSON.parse(result) as PluginParameter[];
}

export async function setPluginParameter(
    trackIndex: number,
    slotIndex: number,
    paramName: string,
    value: string,
): Promise<string> {
    return runAxHelper([
        "set-param",
        String(trackIndex),
        String(slotIndex),
        paramName,
        value,
    ]);
}

export async function getUIElement(query: string): Promise<string> {
    return runAxHelper(["query", query]);
}
