import { BrowserWindow, ipcMain, Notification } from "electron";

export type AlertSeverity = "info" | "warning" | "critical";

// scope: "global" (default) → matches any tab.
// scope: { workspaceId } → only matches tabs whose SSH connection belongs to
// that workspace. Local terminals never match workspace-scoped rules.
export type AlertScope = "global" | { workspaceId: string };

export type AlertRule = {
  id: string;
  pattern: string;
  flags: string;
  severity: AlertSeverity;
  message?: string;
  enabled: boolean;
  scope?: AlertScope;
};

type CompiledRule = AlertRule & { regex: RegExp };

let rules: CompiledRule[] = [];
const recentlyFired = new Map<string, number>(); // ruleId -> ts; rate-limit
const FIRE_COOLDOWN_MS = 4000;
const BUFFER_LINES = 10;
const tabBuffers = new Map<string, string[]>();

// Maps maintained by the renderer to translate tabId → workspaceIds.
// tabConnMap: tabId → connId (only set for SSH tabs).
// workspaceConnMap: workspaceId → list of connIds belonging to that workspace.
const tabConnMap = new Map<string, string>();
let workspaceConnMap: Record<string, string[]> = {};

function compile(r: AlertRule): CompiledRule | null {
  try {
    return { ...r, regex: new RegExp(r.pattern, r.flags || "") };
  } catch {
    return null;
  }
}

export function setAlertRules(input: AlertRule[]): void {
  rules = input.map(compile).filter((r): r is CompiledRule => !!r);
}

export function setTabConn(tabId: string, connId: string | null): void {
  if (connId) tabConnMap.set(tabId, connId);
  else tabConnMap.delete(tabId);
}

export function setWorkspaceConnMap(map: Record<string, string[]>): void {
  workspaceConnMap = map ?? {};
}

function workspacesForTab(tabId: string): Set<string> {
  const out = new Set<string>();
  const connId = tabConnMap.get(tabId);
  if (!connId) return out;
  for (const [wsId, connIds] of Object.entries(workspaceConnMap)) {
    if (connIds.includes(connId)) out.add(wsId);
  }
  return out;
}

function ruleMatchesTab(rule: CompiledRule, tabId: string): boolean {
  const scope = rule.scope;
  if (!scope || scope === "global") return true;
  if (typeof scope === "object" && "workspaceId" in scope) {
    return workspacesForTab(tabId).has(scope.workspaceId);
  }
  return true;
}

export function checkData(tabId: string, data: string): void {
  if (rules.length === 0) return;
  let buf = tabBuffers.get(tabId) ?? [];
  const combined = (buf.join("") + data).split("\n");
  buf = combined.slice(-BUFFER_LINES);
  tabBuffers.set(tabId, buf);
  const haystack = buf.join("\n");
  const now = Date.now();
  for (const r of rules) {
    if (!r.enabled) continue;
    if (!ruleMatchesTab(r, tabId)) continue;
    const lastFired = recentlyFired.get(r.id) ?? 0;
    if (now - lastFired < FIRE_COOLDOWN_MS) continue;
    if (r.regex.test(haystack)) {
      recentlyFired.set(r.id, now);
      const message = r.message ?? `Match: ${r.pattern}`;
      const title =
        r.severity === "critical"
          ? "Critical alert"
          : r.severity === "warning"
            ? "Warning"
            : "Info";
      if (Notification.isSupported()) {
        new Notification({
          title,
          body: message,
          urgency: r.severity === "critical" ? "critical" : "normal",
        }).show();
      }
      for (const w of BrowserWindow.getAllWindows()) {
        w.webContents.send("alert-match", {
          ruleId: r.id,
          tabId,
          severity: r.severity,
          message,
          ts: now,
        });
      }
    }
  }
}

export function clearTabBuffer(tabId: string): void {
  tabBuffers.delete(tabId);
}

export function setupAlertHandlers(): void {
  ipcMain.on("alert-rules-set", (_e, list: AlertRule[]) => {
    setAlertRules(list);
  });
  ipcMain.on(
    "alert-workspace-map-set",
    (_e, map: Record<string, string[]>) => {
      setWorkspaceConnMap(map);
    },
  );
  ipcMain.on("alert-tab-conn-set", (_e, tabId: string, connId: string | null) => {
    setTabConn(tabId, connId);
  });
}
