import { BrowserWindow, ipcMain } from "electron";
import { Client, ConnectConfig } from "ssh2";
import {
  buildAuthConfig,
  connectHop,
  forwardOut,
  SSHConnectionInfo,
} from "./sftp";
import { retrievePassword } from "./terminal";
import { resolveSecret } from "./secret-providers";

export type HostSample = {
  ts: number;
  cpuPct: number;
  memUsedPct: number;
  memTotalKb: number;
  memFreeKb: number;
  load1: number;
  load5: number;
  load15: number;
  diskRootPct: number;
};

type Poll = {
  sessionId: string;
  intervalMs: number;
  prevCpu?: { total: number; idle: number };
  timer: NodeJS.Timeout;
  clients: Client[];
};

const polls = new Map<string, Poll>();

const SNAPSHOT_CMD =
  "echo '---LOAD---'; cat /proc/loadavg 2>/dev/null; " +
  "echo '---MEM---'; cat /proc/meminfo 2>/dev/null; " +
  "echo '---STAT---'; head -n1 /proc/stat 2>/dev/null; " +
  "echo '---DISK---'; df -P / 2>/dev/null | tail -n1";

function execOnce(client: Client, cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    client.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "";
      stream.on("data", (c: Buffer) => (out += c.toString()));
      stream.stderr.on("data", () => {
        /* ignore */
      });
      stream.on("close", () => resolve(out));
    });
  });
}

async function establishClients(conn: SSHConnectionInfo): Promise<Client[]> {
  let password: string | undefined;
  if (conn.credentialId) {
    password = retrievePassword("vault-" + conn.credentialId) ?? undefined;
  } else if (conn.passwordRef) {
    try {
      password = await resolveSecret(
        conn.passwordRef.provider,
        conn.passwordRef.ref,
      );
    } catch {
      /* fall through */
    }
  }
  if (!password) password = retrievePassword(conn.id) ?? undefined;

  const clients: Client[] = [];
  let sock: (NodeJS.ReadableStream & NodeJS.WritableStream) | undefined;
  for (const hop of conn.jumpHosts ?? []) {
    const hopCfg = buildAuthConfig(hop);
    if (sock) (hopCfg as ConnectConfig).sock = sock as any;
    const hopClient = await connectHop(hopCfg);
    clients.push(hopClient);
    const nextTarget = conn.jumpHosts?.[clients.length];
    const target = nextTarget
      ? { host: nextTarget.host, port: nextTarget.port }
      : { host: conn.host, port: conn.port };
    sock = await forwardOut(hopClient, target.host, target.port);
  }
  const targetCfg = buildAuthConfig(conn, password);
  if (sock) (targetCfg as ConnectConfig).sock = sock as any;
  const targetClient = await connectHop(targetCfg);
  clients.unshift(targetClient);
  return clients;
}

function parseSnapshot(
  text: string,
  prev?: { total: number; idle: number },
): { sample: HostSample; prevCpu: { total: number; idle: number } } | null {
  const sections: Record<string, string[]> = {};
  let cur = "";
  for (const line of text.split("\n")) {
    if (line.startsWith("---") && line.endsWith("---")) {
      cur = line.replace(/-/g, "");
      sections[cur] = [];
    } else if (cur) {
      sections[cur].push(line);
    }
  }
  const load = (sections.LOAD?.[0] ?? "").trim().split(/\s+/);
  const load1 = parseFloat(load[0] || "0");
  const load5 = parseFloat(load[1] || "0");
  const load15 = parseFloat(load[2] || "0");

  let memTotal = 0;
  let memAvail = 0;
  let memFree = 0;
  for (const l of sections.MEM ?? []) {
    const m = l.match(/^(\w+):\s+(\d+)\s+kB/);
    if (!m) continue;
    if (m[1] === "MemTotal") memTotal = parseInt(m[2], 10);
    else if (m[1] === "MemAvailable") memAvail = parseInt(m[2], 10);
    else if (m[1] === "MemFree") memFree = parseInt(m[2], 10);
  }
  const usableFree = memAvail || memFree;
  const memUsedPct = memTotal > 0 ? ((memTotal - usableFree) / memTotal) * 100 : 0;

  let cpuPct = 0;
  let prevCpu = prev ?? { total: 0, idle: 0 };
  const statLine = sections.STAT?.[0] ?? "";
  const parts = statLine.trim().split(/\s+/);
  if (parts[0] === "cpu" && parts.length >= 8) {
    const nums = parts.slice(1).map((n) => parseInt(n, 10));
    const idle = (nums[3] || 0) + (nums[4] || 0);
    const total = nums.reduce((a, b) => a + b, 0);
    if (prev && total > prev.total) {
      const diffTotal = total - prev.total;
      const diffIdle = idle - prev.idle;
      cpuPct = ((diffTotal - diffIdle) / diffTotal) * 100;
    }
    prevCpu = { total, idle };
  }

  let diskRootPct = 0;
  const dfLine = sections.DISK?.[0] ?? "";
  const dfParts = dfLine.trim().split(/\s+/);
  if (dfParts.length >= 5) {
    diskRootPct = parseFloat((dfParts[4] || "0").replace("%", "")) || 0;
  }

  return {
    sample: {
      ts: Date.now(),
      cpuPct: Math.max(0, Math.min(100, cpuPct)),
      memUsedPct: Math.max(0, Math.min(100, memUsedPct)),
      memTotalKb: memTotal,
      memFreeKb: usableFree,
      load1,
      load5,
      load15,
      diskRootPct,
    },
    prevCpu,
  };
}

async function tick(sessionId: string): Promise<void> {
  const poll = polls.get(sessionId);
  if (!poll || poll.clients.length === 0) return;
  try {
    const out = await execOnce(poll.clients[0], SNAPSHOT_CMD);
    const parsed = parseSnapshot(out, poll.prevCpu);
    if (parsed) {
      poll.prevCpu = parsed.prevCpu;
      for (const w of BrowserWindow.getAllWindows()) {
        w.webContents.send("metrics-sample", { sessionId, sample: parsed.sample });
      }
    }
  } catch (err) {
    for (const w of BrowserWindow.getAllWindows()) {
      w.webContents.send("metrics-error", {
        sessionId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export async function startMetrics(
  sessionId: string,
  conn: SSHConnectionInfo,
  intervalMs: number = 2000,
): Promise<void> {
  stopMetrics(sessionId);
  const clients = await establishClients(conn);
  const timer = setInterval(() => tick(sessionId), Math.max(500, intervalMs));
  polls.set(sessionId, { sessionId, intervalMs, timer, clients });
  tick(sessionId);
}

export function stopMetrics(sessionId: string): void {
  const p = polls.get(sessionId);
  if (!p) return;
  clearInterval(p.timer);
  for (const c of p.clients) {
    try {
      c.end();
    } catch {
      /* ignore */
    }
  }
  polls.delete(sessionId);
}

export function setupHostMetricsHandlers(): void {
  ipcMain.handle(
    "metrics-start",
    async (_e, sessionId: string, conn: SSHConnectionInfo, intervalMs?: number) => {
      try {
        await startMetrics(sessionId, conn, intervalMs);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );
  ipcMain.on("metrics-stop", (_e, sessionId: string) => {
    stopMetrics(sessionId);
  });
}
