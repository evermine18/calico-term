import { ipcMain } from "electron";
import { execFile } from "child_process";

/**
 * Best-effort local install detection for the external CLI agents the renderer
 * offers to launch (Claude Code, Codex, …). Returns a `command -> installed`
 * map. Used purely to decorate the home-panel cards — launching never depends
 * on it. Remote (SSH) availability is intentionally out of scope here.
 */
function isInstalled(command: string): Promise<boolean> {
  // Guard against anything but a bare binary name so we never shell-inject.
  if (!/^[A-Za-z0-9._-]+$/.test(command)) return Promise.resolve(false);

  const finder = process.platform === "win32" ? "where" : "which";
  return new Promise((resolve) => {
    execFile(finder, [command], { timeout: 5000 }, (err) => {
      resolve(!err);
    });
  });
}

export async function detectAgents(
  commands: string[],
): Promise<Record<string, boolean>> {
  const unique = Array.from(new Set(commands));
  const results = await Promise.all(
    unique.map(async (cmd) => [cmd, await isInstalled(cmd)] as const),
  );
  return Object.fromEntries(results);
}

export function setupAgentHandlers(): void {
  ipcMain.handle("agents-detect", (_event, commands: string[]) =>
    detectAgents(Array.isArray(commands) ? commands : []),
  );
}
