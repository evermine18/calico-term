import { Client, SFTPWrapper } from "ssh2";
import fs from "fs";
import { BrowserWindow, dialog, ipcMain } from "electron";
import { retrievePassword } from "./terminal";

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

type SSHConnectionInfo = {
  id: string;
  host: string;
  port: number;
  username: string;
  identityFile?: string;
  hasPassword?: boolean;
  credentialId?: string;
};

type SFTPSession = {
  client: Client;
  sftp: SFTPWrapper;
};

const sessions = new Map<string, SFTPSession>();

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

function connectSFTP(
  sessionId: string,
  conn: SSHConnectionInfo,
): Promise<void> {
  disconnectSFTP(sessionId);

  const password = conn.credentialId
    ? retrievePassword("vault-" + conn.credentialId)
    : retrievePassword(conn.id);

  return new Promise((resolve, reject) => {
    const client = new Client();

    client.on("ready", () => {
      client.sftp((err, sftp) => {
        if (err) {
          client.end();
          reject(err);
          return;
        }
        sessions.set(sessionId, { client, sftp });
        resolve();
      });
    });

    client.on("error", (err) => reject(err));

    const config: Parameters<Client["connect"]>[0] = {
      host: conn.host,
      port: conn.port,
      username: conn.username,
      readyTimeout: 10000,
      hostVerifier: () => true,
    };

    if (conn.identityFile) {
      try {
        (config as any).privateKey = fs.readFileSync(conn.identityFile);
      } catch {
        // fall through to password auth
      }
    }
    if (password) {
      config.password = password;
    }

    client.connect(config);
  });
}

function disconnectSFTP(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    try {
      session.client.end();
    } catch {}
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
          !!((item.attrs as any).mode) &&
          ((item.attrs as any).mode & 0o170000) === 0o040000,
        isSymlink:
          !!((item.attrs as any).mode) &&
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
    } catch {}
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
    async (
      _event,
      sessionId: string,
      oldPath: string,
      newPath: string,
    ) => {
      await renameEntry(sessionId, oldPath, newPath);
    },
  );
}
