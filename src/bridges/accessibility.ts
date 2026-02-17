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
    trackNumber?: number;
    muted?: boolean;
    solo?: boolean;
    recordEnabled?: boolean;
    volume?: number;
    plugins: string[];
}

export interface PluginParameter {
    name: string;
    value: string;
    role: string;
}

// ── Swift helper (direct AX API) ──────────────────────────────────

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
        throw new Error(`Accessibility helper error: ${msg}`);
    }
}

// ── JXA fallback (uses osascript, inherits parent process permissions) ──

async function runJXA(script: string): Promise<string> {
    const { stdout } = await execFileAsync(
        "osascript",
        ["-l", "JavaScript", "-e", script],
        { timeout: AX_TIMEOUT },
    );
    return stdout.trim();
}

/**
 * List tracks using JXA + System Events Accessibility.
 * This approach inherits Accessibility permissions from the parent process
 * (e.g. Claude Desktop) because osascript is a system binary.
 */
async function listTracksJXA(): Promise<TrackInfo[]> {
    const script = `
        const se = Application("System Events");
        const lp = se.processes.byName("Logic Pro");

        // Find the main window
        const win = lp.windows[0];

        // Navigate: window → find groups with description "Spuren" or "Tracks"
        function findSpurenGroup(element, depth) {
            if (depth > 5) return null;
            try {
                const groups = element.groups();
                for (let i = 0; i < groups.length; i++) {
                    const g = groups[i];
                    try {
                        const desc = g.description();
                        if (desc === "Spuren" || desc === "Tracks") return g;
                    } catch(e) {}
                    const found = findSpurenGroup(g, depth + 1);
                    if (found) return found;
                }
            } catch(e) {}
            return null;
        }

        // Find track layout items inside scroll areas
        function findTracks(element, depth, tracks) {
            if (depth > 12) return;
            try {
                // Check all UI elements at this level
                const uiElems = element.uiElements();
                for (let i = 0; i < uiElems.length; i++) {
                    const el = uiElems[i];
                    try {
                        const role = el.role();
                        const desc = el.description();

                        if (role === "AXLayoutItem" && desc &&
                            (desc.startsWith("Spur ") || desc.startsWith("Track "))) {

                            // Extract track name from description like: Spur 4 \\u201eIoanna Mic Wet\\u201c
                            let name = desc;
                            const qStart = desc.indexOf("\\u201e");
                            if (qStart >= 0) {
                                name = desc.substring(qStart + 1)
                                    .replace(/[\\u201c\\u201d"]/g, "")
                                    .trim();
                            } else {
                                const dqStart = desc.indexOf('"');
                                if (dqStart >= 0) {
                                    name = desc.substring(dqStart + 1);
                                    const dqEnd = name.lastIndexOf('"');
                                    if (dqEnd >= 0) name = name.substring(0, dqEnd);
                                }
                            }

                            // Extract track number
                            const parts = desc.split(" ");
                            const trackNum = parts.length >= 2 ? parseInt(parts[1]) : -1;

                            // Read mute/solo/volume from children
                            let muted = false, solo = false, recordEnabled = false, volume = 0;
                            try {
                                const children = el.uiElements();
                                for (let c = 0; c < children.length; c++) {
                                    try {
                                        const cr = children[c].role();
                                        const cd = children[c].description();
                                        const cv = children[c].value();
                                        if (cr === "AXCheckBox") {
                                            if (cd === "Mute") muted = (cv == 1);
                                            else if (cd === "Solo") solo = (cv == 1);
                                            else if (cd && (cd.includes("Aufnahme") || cd.includes("Record")))
                                                recordEnabled = (cv == 1);
                                        } else if (cr === "AXSlider" && cd === "Volume") {
                                            volume = parseInt(cv) || 0;
                                        }
                                    } catch(e2) {}
                                }
                            } catch(e2) {}

                            tracks.push({
                                index: tracks.length,
                                trackNumber: trackNum,
                                name: name,
                                muted: muted,
                                solo: solo,
                                recordEnabled: recordEnabled,
                                volume: volume,
                                plugins: []
                            });
                        }
                    } catch(e) {}

                    // Recurse
                    findTracks(el, depth + 1, tracks);
                }
            } catch(e) {}
        }

        const spurenGroup = findSpurenGroup(win, 0);
        if (!spurenGroup) {
            JSON.stringify([]);
        } else {
            const tracks = [];
            findTracks(spurenGroup, 0, tracks);
            JSON.stringify(tracks);
        }
    `;

    const result = await runJXA(script);
    try {
        return JSON.parse(result) as TrackInfo[];
    } catch {
        return [];
    }
}

// ── Public API ─────────────────────────────────────────────────────

export async function checkAccessibility(): Promise<boolean> {
    try {
        const result = await runAxHelper(["check-access"]);
        return result.includes("granted");
    } catch {
        return false;
    }
}

/**
 * List tracks with automatic fallback:
 * 1. Try Swift helper (fastest, richest data)
 * 2. Fall back to JXA/osascript (inherits parent Accessibility permissions)
 */
export async function listTracks(): Promise<TrackInfo[]> {
    // Try Swift helper first
    try {
        const result = await runAxHelper(["list-tracks"]);
        const tracks = JSON.parse(result) as TrackInfo[];
        if (tracks.length > 0) return tracks;
    } catch {
        // Swift helper failed, fall through to JXA
    }

    // Fallback: JXA via osascript
    try {
        return await listTracksJXA();
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(
            `Could not list tracks. Ensure Logic Pro is open and Accessibility is granted. Details: ${msg}`,
        );
    }
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
