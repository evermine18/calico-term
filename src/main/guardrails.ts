import { ipcMain, app } from "electron";
import fs from "fs";
import path from "path";

export type GuardrailRule = {
  id: string;
  pattern: string; // JS regex source
  flags?: string;
  description: string;
  enabled: boolean;
};

type Compiled = GuardrailRule & { regex: RegExp };

const DEFAULTS: GuardrailRule[] = [
  {
    id: "rm-rf-root",
    pattern: "\\brm\\s+(-[a-zA-Z]*r[a-zA-Z]*\\s+)?-?[a-zA-Z]*f[a-zA-Z]*\\s+/(\\s|$)",
    flags: "",
    description: "rm -rf / (recursive delete from root)",
    enabled: true,
  },
  {
    id: "rm-rf",
    pattern: "\\brm\\s+(-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*|-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*)\\b",
    flags: "",
    description: "rm -rf (recursive force delete)",
    enabled: true,
  },
  {
    id: "dd-if",
    pattern: "\\bdd\\s+(if|of)=",
    flags: "",
    description: "dd (raw disk write)",
    enabled: true,
  },
  {
    id: "mkfs",
    pattern: "\\bmkfs(\\.\\w+)?\\b",
    flags: "",
    description: "mkfs (filesystem format)",
    enabled: true,
  },
  {
    id: "fork-bomb",
    pattern: ":\\(\\)\\s*\\{\\s*:\\s*\\|\\s*:\\s*&\\s*\\}\\s*;\\s*:",
    flags: "",
    description: "fork bomb",
    enabled: true,
  },
  {
    id: "shutdown",
    pattern: "\\b(shutdown|halt|poweroff|reboot)\\b",
    flags: "i",
    description: "shutdown / reboot",
    enabled: true,
  },
  {
    id: "drop-database",
    pattern: "\\bDROP\\s+(DATABASE|TABLE|SCHEMA)\\b",
    flags: "i",
    description: "SQL DROP DATABASE/TABLE/SCHEMA",
    enabled: true,
  },
  {
    id: "truncate-table",
    pattern: "\\bTRUNCATE\\s+TABLE\\b",
    flags: "i",
    description: "SQL TRUNCATE TABLE",
    enabled: true,
  },
  {
    id: "write-block-device",
    pattern: ">\\s*/dev/(sd[a-z]|nvme\\d|hd[a-z])",
    flags: "",
    description: "redirect to block device",
    enabled: true,
  },
  {
    id: "chmod-recursive",
    pattern: "\\bchmod\\s+-R\\s+777\\b",
    flags: "",
    description: "chmod -R 777",
    enabled: true,
  },
];

let rules: Compiled[] = [];

function rulesFilePath(): string {
  return path.join(app.getPath("userData"), "guardrails.json");
}

function compile(r: GuardrailRule): Compiled | null {
  try {
    return { ...r, regex: new RegExp(r.pattern, r.flags ?? "") };
  } catch {
    return null;
  }
}

function loadFromDisk(): GuardrailRule[] {
  try {
    const p = rulesFilePath();
    if (fs.existsSync(p)) {
      const raw = JSON.parse(fs.readFileSync(p, "utf8"));
      if (Array.isArray(raw)) return raw;
    }
  } catch {
    /* ignore */
  }
  return DEFAULTS;
}

function saveToDisk(list: GuardrailRule[]): void {
  fs.writeFileSync(rulesFilePath(), JSON.stringify(list, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
}

function recompile(list: GuardrailRule[]): void {
  rules = list.map(compile).filter((r): r is Compiled => !!r);
}

export function matchGuardrail(
  command: string,
): { id: string; description: string } | null {
  for (const r of rules) {
    if (!r.enabled) continue;
    if (r.regex.test(command)) {
      return { id: r.id, description: r.description };
    }
  }
  return null;
}

// Renderer pushes the set of tabIds that are currently in a "prod" workspace.
let prodTabs = new Set<string>();

export function setProdTabs(ids: string[]): void {
  prodTabs = new Set(ids);
}

export function isProdTab(tabId: string): boolean {
  return prodTabs.has(tabId);
}

export function setupGuardrailHandlers(): void {
  recompile(loadFromDisk());

  ipcMain.handle("guardrails-list", () => loadFromDisk());

  ipcMain.handle("guardrails-set", (_e, list: GuardrailRule[]) => {
    saveToDisk(list);
    recompile(list);
  });

  ipcMain.handle("guardrails-reset-defaults", () => {
    saveToDisk(DEFAULTS);
    recompile(DEFAULTS);
    return DEFAULTS;
  });

  ipcMain.on("guardrails-set-prod-tabs", (_e, ids: string[]) => {
    setProdTabs(Array.isArray(ids) ? ids : []);
  });
}
