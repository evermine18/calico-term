import { Client, ConnectConfig, SFTPWrapper } from "ssh2";
import fs from "fs";
import path from "path";
import { BrowserWindow, dialog, ipcMain } from "electron";
import { retrievePassword } from "./terminal";
import { getKey, getKeyPassphrase } from "./ssh-keys";
import { resolveSecret, SecretProvider } from "./secret-providers";
import { resolveSSHConnection } from "./ssh-config";

export type SFTPFileEntry = {
  filename: string;
  attrs: {
    size: number;
    uid: number;
    gid: number;
    mode: number;
    atime: number;
    mtime: number;
  };
  isDirectory: boolean;
  isSymlink: boolean;
};

export type SSHHopInfo = {
  host: string;
  port: number;
  username: string;
  identityFile?: string;
  identityKeyId?: string;
};

export type SSHConnectionInfo = SSHHopInfo & {
  id: string;
  hasPassword?: boolean;
  credentialId?: string;
  passwordRef?: { provider: SecretProvider; ref: string };
  jumpHosts?: SSHHopInfo[];
};

type SFTPSession = {
  clients: Client[]; // first is target, rest are jump hops in reverse order
  sftp: SFTPWrapper;
};

const sessions = new Map<string, SFTPSession>();

type TailHandle = {
  sessionId: string;
  stream: NodeJS.ReadableStream & {
    signal?: (s: string) => void;
    close?: () => void;
  };
};
const tails = new Map<string, TailHandle>();

type SyncProgress = {
  sessionId: string;
  syncId: string;
  current: string;
  filesDone: number;
  filesTotal: number;
};

function sendProgress(
  sessionId: string,
  filename: string,
  bytes: number,
  total: number,
) {
  BrowserWindow.getAllWindows().forEach((w) => {
    w.webContents.send("sftp-progress", { sessionId, filename, bytes, total });
  });
}

function getSession(sessionId: string): SFTPSession {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`No SFTP session: ${sessionId}`);
  return session;
}

// Exposed so other modules (host metrics, etc.) can run exec channels on the
// existing SSH target client without opening another connection.
export function getSessionTargetClient(sessionId: string): Client | null {
  const s = sessions.get(sessionId);
  return s ? s.clients[0] : null;
}

export function buildAuthConfig(
  hop: SSHHopInfo,
  password?: string,
): ConnectConfig {
  const cfg: ConnectConfig = {
    host: hop.host,
    port: hop.port,
    username: hop.username,
    readyTimeout: 10_000,
    hostVerifier: () => true,
  };

  // Prefer managed key from the internal store, fall back to identityFile path.
  if (hop.identityKeyId) {
    const meta = getKey(hop.identityKeyId);
    if (meta) {
      try {
        cfg.privateKey = fs.readFileSync(meta.privatePath);
        const passphrase = getKeyPassphrase(hop.identityKeyId);
        if (passphrase) cfg.passphrase = passphrase;
      } catch {
        /* fall through */
      }
    }
  } else if (hop.identityFile) {
    try {
      cfg.privateKey = fs.readFileSync(hop.identityFile);
    } catch {
      /* fall through */
    }
  }

  if (password) cfg.password = password;
  return cfg;
}

export function connectHop(cfg: ConnectConfig): Promise<Client> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    client.on("ready", () => resolve(client));
    client.on("error", reject);
    client.connect(cfg);
  });
}

export function forwardOut(
  via: Client,
  dstHost: string,
  dstPort: number,
): Promise<NodeJS.ReadableStream & NodeJS.WritableStream> {
  return new Promise((resolve, reject) => {
    via.forwardOut("127.0.0.1", 0, dstHost, dstPort, (err, stream) => {
      if (err) return reject(err);
      resolve(
        stream as unknown as NodeJS.ReadableStream & NodeJS.WritableStream,
      );
    });
  });
}

async function connectSFTP(
  sessionId: string,
  conn: SSHConnectionInfo,
): Promise<void> {
  disconnectSFTP(sessionId);

  // Substitute Hostname/Port/User/IdentityFile from ~/.ssh/config when the
  // target (or any jump host) is given as an alias rather than a real host.
  conn = resolveSSHConnection(conn);

  // Resolve target password from (in priority): vault credential, external secret ref, stored password.
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
      /* fall through to stored or key-based auth */
    }
  }
  if (!password) {
    password = retrievePassword(conn.id) ?? undefined;
  }

  // Chain through jump hops, if any.
  const clients: Client[] = [];
  let sock: (NodeJS.ReadableStream & NodeJS.WritableStream) | undefined;
  for (const hop of conn.jumpHosts ?? []) {
    const hopCfg = buildAuthConfig(hop);
    if (sock) (hopCfg as ConnectConfig).sock = sock as any;
    const hopClient = await connectHop(hopCfg);
    clients.push(hopClient);
    // Next hop tunnels to the next host:port through this client
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

  const sftp = await new Promise<SFTPWrapper>((resolve, reject) => {
    targetClient.sftp((err, s) => (err ? reject(err) : resolve(s)));
  });

  sessions.set(sessionId, { clients, sftp });
}

function disconnectSFTP(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    for (const c of session.clients) {
      try {
        c.end();
      } catch {
        /* ignore */
      }
    }
    sessions.delete(sessionId);
  }
}

function listDirectory(
  sessionId: string,
  dirPath: string,
): Promise<SFTPFileEntry[]> {
  const { sftp } = getSession(sessionId);
  return new Promise((resolve, reject) => {
    sftp.readdir(dirPath, (err, list) => {
      if (err) return reject(err);
      const entries: SFTPFileEntry[] = list.map((item) => ({
        filename: item.filename,
        attrs: {
          size: (item.attrs as any).size ?? 0,
          uid: (item.attrs as any).uid ?? 0,
          gid: (item.attrs as any).gid ?? 0,
          mode: (item.attrs as any).mode ?? 0,
          atime: (item.attrs as any).atime ?? 0,
          mtime: (item.attrs as any).mtime ?? 0,
        },
        isDirectory:
          !!(item.attrs as any).mode &&
          ((item.attrs as any).mode & 0o170000) === 0o040000,
        isSymlink:
          !!(item.attrs as any).mode &&
          ((item.attrs as any).mode & 0o170000) === 0o120000,
      }));
      entries.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.filename.localeCompare(b.filename);
      });
      resolve(entries);
    });
  });
}

function realpath(sessionId: string, remotePath: string): Promise<string> {
  const { sftp } = getSession(sessionId);
  return new Promise((resolve, reject) => {
    sftp.realpath(remotePath, (err, resolved) => {
      if (err) return reject(err);
      resolve(resolved);
    });
  });
}

function downloadFile(
  sessionId: string,
  remotePath: string,
  localPath: string,
  filename: string,
): Promise<void> {
  const { sftp } = getSession(sessionId);
  return new Promise((resolve, reject) => {
    sftp.stat(remotePath, (err, stats) => {
      if (err) return reject(err);
      const total = (stats as any).size ?? 0;
      let transferred = 0;

      const readStream = sftp.createReadStream(remotePath);
      const writeStream = fs.createWriteStream(localPath);

      readStream.on("data", (chunk: Buffer) => {
        transferred += chunk.length;
        sendProgress(sessionId, filename, transferred, total);
      });
      readStream.on("error", (e) => {
        writeStream.destroy();
        reject(e);
      });
      writeStream.on("error", reject);
      writeStream.on("close", resolve);
      readStream.pipe(writeStream);
    });
  });
}

function uploadFile(
  sessionId: string,
  localPath: string,
  remotePath: string,
): Promise<void> {
  const { sftp } = getSession(sessionId);
  return new Promise((resolve, reject) => {
    let total = 0;
    try {
      total = fs.statSync(localPath).size;
    } catch {
      /* ignore */
    }
    let transferred = 0;
    const filename = localPath.split("/").pop() ?? localPath;

    const readStream = fs.createReadStream(localPath);
    const writeStream = sftp.createWriteStream(remotePath);

    readStream.on("data", (chunk: Buffer) => {
      transferred += chunk.length;
      sendProgress(sessionId, filename, transferred, total);
    });
    readStream.on("error", (e) => {
      writeStream.destroy();
      reject(e);
    });
    writeStream.on("error", reject);
    writeStream.on("close", resolve);
    readStream.pipe(writeStream);
  });
}

function deleteEntry(
  sessionId: string,
  entryPath: string,
  isDirectory: boolean,
): Promise<void> {
  const { sftp } = getSession(sessionId);
  return new Promise((resolve, reject) => {
    if (isDirectory) {
      sftp.rmdir(entryPath, (err) => (err ? reject(err) : resolve()));
    } else {
      sftp.unlink(entryPath, (err) => (err ? reject(err) : resolve()));
    }
  });
}

function makeDirectory(sessionId: string, dirPath: string): Promise<void> {
  const { sftp } = getSession(sessionId);
  return new Promise((resolve, reject) => {
    sftp.mkdir(dirPath, (err) => (err ? reject(err) : resolve()));
  });
}

const READ_TEXT_LIMIT = 5 * 1024 * 1024; // 5 MB

function readText(sessionId: string, remotePath: string): Promise<string> {
  const { sftp } = getSession(sessionId);
  return new Promise((resolve, reject) => {
    sftp.stat(remotePath, (err, stats) => {
      if (err) return reject(err);
      const size = (stats as any).size ?? 0;
      if (size > READ_TEXT_LIMIT) {
        return reject(
          new Error(
            `File too large to edit (${size} bytes, max ${READ_TEXT_LIMIT})`,
          ),
        );
      }
      const chunks: Buffer[] = [];
      const rs = sftp.createReadStream(remotePath);
      rs.on("data", (c: Buffer) => chunks.push(c));
      rs.on("error", reject);
      rs.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
  });
}

function writeText(
  sessionId: string,
  remotePath: string,
  content: string,
): Promise<void> {
  const { sftp } = getSession(sessionId);
  return new Promise((resolve, reject) => {
    const ws = sftp.createWriteStream(remotePath);
    ws.on("error", reject);
    ws.on("close", () => resolve());
    ws.end(Buffer.from(content, "utf8"));
  });
}

function startTail(
  sessionId: string,
  tailId: string,
  remotePath: string,
  lines: number,
): Promise<void> {
  const { clients } = getSession(sessionId);
  const target = clients[0];
  return new Promise((resolve, reject) => {
    const safe = remotePath.replace(/'/g, "'\\''");
    target.exec(
      `tail -n ${Math.max(1, Math.floor(lines))} -F '${safe}'`,
      (err, stream) => {
        if (err) return reject(err);
        tails.set(tailId, { sessionId, stream: stream as any });
        const send = (chunk: Buffer | string, isErr: boolean) => {
          BrowserWindow.getAllWindows().forEach((w) => {
            w.webContents.send("sftp-tail-data", {
              tailId,
              data: chunk.toString(),
              isErr,
            });
          });
        };
        stream.on("data", (c: Buffer) => send(c, false));
        stream.stderr.on("data", (c: Buffer) => send(c, true));
        stream.on("close", () => {
          tails.delete(tailId);
          BrowserWindow.getAllWindows().forEach((w) => {
            w.webContents.send("sftp-tail-end", { tailId });
          });
        });
        resolve();
      },
    );
  });
}

function stopTail(tailId: string): void {
  const t = tails.get(tailId);
  if (!t) return;
  try {
    t.stream.signal?.("INT");
    t.stream.close?.();
  } catch {
    /* ignore */
  }
  try {
    (t.stream as any).end?.();
  } catch {
    /* ignore */
  }
  tails.delete(tailId);
}

function sendSyncProgress(p: SyncProgress) {
  BrowserWindow.getAllWindows().forEach((w) => {
    w.webContents.send("sftp-sync-progress", p);
  });
}

async function walkRemote(
  sftp: SFTPWrapper,
  dir: string,
): Promise<{ files: string[]; dirs: string[] }> {
  const files: string[] = [];
  const dirs: string[] = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop()!;
    const list = await new Promise<any[]>((res, rej) =>
      sftp.readdir(cur, (e, l) => (e ? rej(e) : res(l))),
    );
    for (const item of list) {
      const full = cur.endsWith("/")
        ? cur + item.filename
        : `${cur}/${item.filename}`;
      const mode = (item.attrs as any).mode ?? 0;
      const isDir = (mode & 0o170000) === 0o040000;
      if (isDir) {
        dirs.push(full);
        stack.push(full);
      } else {
        files.push(full);
      }
    }
  }
  return { files, dirs };
}

function walkLocal(dir: string): { files: string[]; dirs: string[] } {
  const files: string[] = [];
  const dirs: string[] = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const name of fs.readdirSync(cur)) {
      const full = path.join(cur, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        dirs.push(full);
        stack.push(full);
      } else if (st.isFile()) {
        files.push(full);
      }
    }
  }
  return { files, dirs };
}

async function syncDirectory(
  sessionId: string,
  syncId: string,
  remoteDir: string,
  localDir: string,
  direction: "download" | "upload",
): Promise<{ filesTransferred: number }> {
  const { sftp } = getSession(sessionId);
  let transferred = 0;

  if (direction === "download") {
    const { files, dirs } = await walkRemote(sftp, remoteDir);
    fs.mkdirSync(localDir, { recursive: true });
    for (const d of dirs) {
      const rel = d.substring(remoteDir.length).replace(/^\/+/, "");
      fs.mkdirSync(path.join(localDir, rel), { recursive: true });
    }
    const total = files.length;
    for (const f of files) {
      const rel = f.substring(remoteDir.length).replace(/^\/+/, "");
      const local = path.join(localDir, rel);
      fs.mkdirSync(path.dirname(local), { recursive: true });
      const remoteStat = await new Promise<any>((res, rej) =>
        sftp.stat(f, (e, s) => (e ? rej(e) : res(s))),
      );
      const needsCopy =
        !fs.existsSync(local) ||
        fs.statSync(local).size !== ((remoteStat as any).size ?? 0) ||
        Math.floor(fs.statSync(local).mtimeMs / 1000) <
          ((remoteStat as any).mtime ?? 0);
      if (needsCopy) {
        await downloadFile(sessionId, f, local, path.basename(f));
        transferred++;
      }
      sendSyncProgress({
        sessionId,
        syncId,
        current: f,
        filesDone: transferred,
        filesTotal: total,
      });
    }
  } else {
    const { files } = walkLocal(localDir);
    const total = files.length;
    // Ensure remote root exists
    await new Promise<void>((res) => sftp.mkdir(remoteDir, (_e) => res()));
    for (const f of files) {
      const rel = path.relative(localDir, f).split(path.sep).join("/");
      const remote = remoteDir.endsWith("/")
        ? remoteDir + rel
        : `${remoteDir}/${rel}`;
      // Create remote parent dirs
      const parts = rel.split("/");
      parts.pop();
      let cur = remoteDir;
      for (const p of parts) {
        cur = cur.endsWith("/") ? cur + p : `${cur}/${p}`;
        await new Promise<void>((res) => sftp.mkdir(cur, (_e) => res()));
      }
      const localStat = fs.statSync(f);
      const remoteStat = await new Promise<any | null>((res) =>
        sftp.stat(remote, (e, s) => res(e ? null : s)),
      );
      const needsCopy =
        !remoteStat ||
        (remoteStat as any).size !== localStat.size ||
        ((remoteStat as any).mtime ?? 0) < Math.floor(localStat.mtimeMs / 1000);
      if (needsCopy) {
        await uploadFile(sessionId, f, remote);
        transferred++;
      }
      sendSyncProgress({
        sessionId,
        syncId,
        current: remote,
        filesDone: transferred,
        filesTotal: total,
      });
    }
  }
  return { filesTransferred: transferred };
}

function renameEntry(
  sessionId: string,
  oldPath: string,
  newPath: string,
): Promise<void> {
  const { sftp } = getSession(sessionId);
  return new Promise((resolve, reject) => {
    sftp.rename(oldPath, newPath, (err) => (err ? reject(err) : resolve()));
  });
}

export function setupSFTPHandlers(): void {
  ipcMain.handle(
    "sftp-connect",
    async (_event, sessionId: string, conn: SSHConnectionInfo) => {
      await connectSFTP(sessionId, conn);
    },
  );

  ipcMain.on("sftp-disconnect", (_event, sessionId: string) => {
    disconnectSFTP(sessionId);
  });

  ipcMain.handle(
    "sftp-list",
    async (_event, sessionId: string, dirPath: string) => {
      return await listDirectory(sessionId, dirPath);
    },
  );

  ipcMain.handle(
    "sftp-realpath",
    async (_event, sessionId: string, remotePath: string) => {
      return await realpath(sessionId, remotePath);
    },
  );

  ipcMain.handle(
    "sftp-download",
    async (_event, sessionId: string, remotePath: string) => {
      const filename = remotePath.split("/").pop() ?? "file";
      const win = BrowserWindow.getFocusedWindow();
      const result = await dialog.showSaveDialog(win!, {
        defaultPath: filename,
      });
      if (result.canceled || !result.filePath) return;
      await downloadFile(sessionId, remotePath, result.filePath, filename);
    },
  );

  ipcMain.handle(
    "sftp-upload",
    async (_event, sessionId: string, remotePath: string) => {
      const win = BrowserWindow.getFocusedWindow();
      const result = await dialog.showOpenDialog(win!, {
        properties: ["openFile"],
      });
      if (result.canceled || !result.filePaths[0]) return;
      const localPath = result.filePaths[0];
      const filename = localPath.split("/").pop() ?? "file";
      const dest = remotePath.endsWith("/")
        ? remotePath + filename
        : remotePath + "/" + filename;
      await uploadFile(sessionId, localPath, dest);
    },
  );

  // Upload a specific local file (by path) — used by drag-and-drop, which
  // already knows the dropped file's path and shouldn't open a dialog.
  ipcMain.handle(
    "sftp-upload-path",
    async (_event, sessionId: string, localPath: string, remoteDir: string) => {
      const filename = localPath.split(/[\\/]/).pop() ?? "file";
      const dest = remoteDir.endsWith("/")
        ? remoteDir + filename
        : remoteDir + "/" + filename;
      await uploadFile(sessionId, localPath, dest);
      return { filename };
    },
  );

  ipcMain.handle(
    "sftp-delete",
    async (
      _event,
      sessionId: string,
      entryPath: string,
      isDirectory: boolean,
    ) => {
      await deleteEntry(sessionId, entryPath, isDirectory);
    },
  );

  ipcMain.handle(
    "sftp-mkdir",
    async (_event, sessionId: string, dirPath: string) => {
      await makeDirectory(sessionId, dirPath);
    },
  );

  ipcMain.handle(
    "sftp-rename",
    async (_event, sessionId: string, oldPath: string, newPath: string) => {
      await renameEntry(sessionId, oldPath, newPath);
    },
  );

  ipcMain.handle(
    "sftp-read-text",
    async (_event, sessionId: string, remotePath: string) => {
      return await readText(sessionId, remotePath);
    },
  );

  ipcMain.handle(
    "sftp-write-text",
    async (_event, sessionId: string, remotePath: string, content: string) => {
      await writeText(sessionId, remotePath, content);
    },
  );

  ipcMain.handle(
    "sftp-tail-start",
    async (
      _event,
      sessionId: string,
      remotePath: string,
      lines: number = 200,
    ) => {
      const tailId = `tail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await startTail(sessionId, tailId, remotePath, lines);
      return tailId;
    },
  );

  ipcMain.on("sftp-tail-stop", (_event, tailId: string) => {
    stopTail(tailId);
  });

  ipcMain.handle(
    "sftp-sync-dir",
    async (
      _event,
      sessionId: string,
      remoteDir: string,
      localDir: string,
      direction: "download" | "upload",
    ) => {
      const syncId = `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const result = await syncDirectory(
        sessionId,
        syncId,
        remoteDir,
        localDir,
        direction,
      );
      return { syncId, ...result };
    },
  );

  ipcMain.handle("sftp-pick-local-dir", async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win!, {
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return result.filePaths[0];
  });
}
