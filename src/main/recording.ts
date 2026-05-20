import { app, ipcMain } from "electron";
import fs from "fs";
import path from "path";

export type RecordingMeta = {
  id: string;
  tabId: string;
  title: string;
  createdAt: number;
  durationMs: number;
  cols: number;
  rows: number;
  bytes: number;
  path: string;
};

type ActiveRecording = {
  id: string;
  tabId: string;
  title: string;
  startedAt: number;
  cols: number;
  rows: number;
  stream: fs.WriteStream;
  filePath: string;
  bytes: number;
};

const active = new Map<string, ActiveRecording>(); // keyed by tabId
const META_FILE = () => path.join(recordingsDir(), "_index.json");

function recordingsDir(): string {
  const dir = path.join(app.getPath("userData"), "recordings");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

function loadIndex(): RecordingMeta[] {
  try {
    const f = META_FILE();
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    /* corrupt */
  }
  return [];
}

function saveIndex(list: RecordingMeta[]): void {
  fs.writeFileSync(META_FILE(), JSON.stringify(list, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
}

export function isRecording(tabId: string): boolean {
  return active.has(tabId);
}

export function startRecording(
  tabId: string,
  title: string,
  cols: number,
  rows: number,
): RecordingMeta {
  if (active.has(tabId)) {
    throw new Error("Recording already in progress for this tab");
  }
  const id = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const filePath = path.join(recordingsDir(), `${id}.cast`);
  const stream = fs.createWriteStream(filePath, {
    encoding: "utf8",
    mode: 0o600,
  });
  const startedAt = Date.now();
  // asciinema v2 header
  const header = {
    version: 2,
    width: cols,
    height: rows,
    timestamp: Math.floor(startedAt / 1000),
    title,
    env: { TERM: process.env.TERM ?? "xterm-256color", SHELL: process.env.SHELL ?? "" },
  };
  stream.write(JSON.stringify(header) + "\n");
  active.set(tabId, {
    id,
    tabId,
    title,
    startedAt,
    cols,
    rows,
    stream,
    filePath,
    bytes: 0,
  });
  return {
    id,
    tabId,
    title,
    createdAt: startedAt,
    durationMs: 0,
    cols,
    rows,
    bytes: 0,
    path: filePath,
  };
}

export function recordOutput(tabId: string, data: string): void {
  const rec = active.get(tabId);
  if (!rec) return;
  const elapsed = (Date.now() - rec.startedAt) / 1000;
  const line = JSON.stringify([elapsed, "o", data]) + "\n";
  rec.stream.write(line);
  rec.bytes += Buffer.byteLength(data, "utf8");
}

export function stopRecording(tabId: string): RecordingMeta | null {
  const rec = active.get(tabId);
  if (!rec) return null;
  active.delete(tabId);
  rec.stream.end();
  const meta: RecordingMeta = {
    id: rec.id,
    tabId: rec.tabId,
    title: rec.title,
    createdAt: rec.startedAt,
    durationMs: Date.now() - rec.startedAt,
    cols: rec.cols,
    rows: rec.rows,
    bytes: rec.bytes,
    path: rec.filePath,
  };
  const list = loadIndex();
  list.unshift(meta);
  saveIndex(list);
  return meta;
}

export function listRecordings(): RecordingMeta[] {
  return loadIndex();
}

export function loadRecording(id: string): string | null {
  const meta = loadIndex().find((m) => m.id === id);
  if (!meta) return null;
  try {
    return fs.readFileSync(meta.path, "utf8");
  } catch {
    return null;
  }
}

export function deleteRecording(id: string): boolean {
  const list = loadIndex();
  const idx = list.findIndex((m) => m.id === id);
  if (idx < 0) return false;
  const [meta] = list.splice(idx, 1);
  try {
    fs.unlinkSync(meta.path);
  } catch {
    /* ignore */
  }
  saveIndex(list);
  return true;
}

export function setupRecordingHandlers(): void {
  ipcMain.handle(
    "recording-start",
    (_e, tabId: string, title: string, cols: number, rows: number) =>
      startRecording(tabId, title, cols, rows),
  );
  ipcMain.handle("recording-stop", (_e, tabId: string) =>
    stopRecording(tabId),
  );
  ipcMain.handle("recording-is-active", (_e, tabId: string) =>
    isRecording(tabId),
  );
  ipcMain.handle("recording-list", () => listRecordings());
  ipcMain.handle("recording-load", (_e, id: string) => loadRecording(id));
  ipcMain.handle("recording-delete", (_e, id: string) => deleteRecording(id));
  ipcMain.handle("recording-export-path", (_e, id: string) => {
    const meta = listRecordings().find((m) => m.id === id);
    return meta?.path ?? null;
  });
}
