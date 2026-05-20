import { ipcMain } from "electron";
import fs from "fs";
import os from "os";
import path from "path";

export type SSHConfigHost = {
  alias: string;
  host: string;
  port: number;
  user?: string;
  identityFile?: string;
  proxyJump?: string;
};

function defaultConfigPath(): string {
  return path.join(os.homedir(), ".ssh", "config");
}

function expandHome(p: string): string {
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

/**
 * Minimal ~/.ssh/config parser. Supports:
 *  - Host <alias>
 *  - Hostname / HostName
 *  - User
 *  - Port
 *  - IdentityFile
 *  - ProxyJump
 *
 * Skips wildcard hosts (`Host *`, `Host *.example.com`) — those are templates,
 * not concrete connections.
 */
export function parseSSHConfig(text: string): SSHConfigHost[] {
  const hosts: SSHConfigHost[] = [];
  let current: SSHConfigHost | null = null;

  const flush = () => {
    if (current && !current.alias.includes("*") && !current.alias.includes("?")) {
      hosts.push(current);
    }
    current = null;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const [keyword, ...rest] = line.split(/\s+/);
    const value = rest.join(" ").replace(/^["']|["']$/g, "");
    const key = keyword.toLowerCase();

    if (key === "host") {
      flush();
      // First non-wildcard alias wins for the metadata; if all are wildcards we drop the block.
      const aliases = rest.flatMap((r) => r.split(/\s+/));
      const concrete = aliases.find((a) => !a.includes("*") && !a.includes("?"));
      current = {
        alias: concrete ?? aliases[0] ?? "",
        host: "",
        port: 22,
      };
      continue;
    }

    if (!current) continue;

    switch (key) {
      case "hostname":
        current.host = value;
        break;
      case "user":
        current.user = value;
        break;
      case "port": {
        const n = parseInt(value, 10);
        if (!isNaN(n)) current.port = n;
        break;
      }
      case "identityfile":
        current.identityFile = expandHome(value);
        break;
      case "proxyjump":
        current.proxyJump = value;
        break;
    }
  }
  flush();

  // For hosts without explicit Hostname, default it to the alias.
  return hosts
    .filter((h) => h.alias)
    .map((h) => ({ ...h, host: h.host || h.alias }));
}

export function readSSHConfig(filePath?: string): SSHConfigHost[] {
  const target = filePath ?? defaultConfigPath();
  try {
    if (!fs.existsSync(target)) return [];
    const text = fs.readFileSync(target, "utf8");
    return parseSSHConfig(text);
  } catch {
    return [];
  }
}

export function setupSSHConfigHandlers(): void {
  ipcMain.handle("ssh-config-list", () => readSSHConfig());
}
