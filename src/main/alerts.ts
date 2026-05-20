import { BrowserWindow, ipcMain, Notification } from "electron";

export type AlertSeverity = "info" | "warning" | "critical";

export type AlertRule = {
  id: string;
  pattern: string;
  flags: string;
  severity: AlertSeverity;
  message?: string;
  enabled: boolean;
};

type CompiledRule = AlertRule & { regex: RegExp };

let rules: CompiledRule[] = [];
const recentlyFired = new Map<string, number>(); // ruleId -> ts; rate-limit
const FIRE_COOLDOWN_MS = 4000;
const BUFFER_LINES = 10;
const tabBuffers = new Map<string, string[]>();

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
}
