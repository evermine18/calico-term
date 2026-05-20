import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";
import { clipboard } from "electron";

// Custom APIs for renderer
const api = {
  sftp: {
    connect: (sessionId: string, conn: unknown) =>
      ipcRenderer.invoke("sftp-connect", sessionId, conn),
    disconnect: (sessionId: string) =>
      ipcRenderer.send("sftp-disconnect", sessionId),
    list: (sessionId: string, dirPath: string) =>
      ipcRenderer.invoke("sftp-list", sessionId, dirPath),
    realpath: (sessionId: string, remotePath: string) =>
      ipcRenderer.invoke("sftp-realpath", sessionId, remotePath),
    download: (sessionId: string, remotePath: string) =>
      ipcRenderer.invoke("sftp-download", sessionId, remotePath),
    upload: (sessionId: string, remotePath: string) =>
      ipcRenderer.invoke("sftp-upload", sessionId, remotePath),
    delete: (sessionId: string, entryPath: string, isDirectory: boolean) =>
      ipcRenderer.invoke("sftp-delete", sessionId, entryPath, isDirectory),
    mkdir: (sessionId: string, dirPath: string) =>
      ipcRenderer.invoke("sftp-mkdir", sessionId, dirPath),
    rename: (sessionId: string, oldPath: string, newPath: string) =>
      ipcRenderer.invoke("sftp-rename", sessionId, oldPath, newPath),
    onProgress: (
      cb: (data: {
        sessionId: string;
        filename: string;
        bytes: number;
        total: number;
      }) => void,
    ): (() => void) => {
      const wrapped = (_e: unknown, data: unknown) => cb(data as any);
      ipcRenderer.on("sftp-progress", wrapped);
      return () => ipcRenderer.removeListener("sftp-progress", wrapped);
    },
  },
  clipboard: {
    writeText: (text: string) => clipboard.writeText(text),
    readText: () => clipboard.readText(),
  },
  sshKeys: {
    list: () => ipcRenderer.invoke("ssh-key-list"),
    generate: (opts: {
      name: string;
      type: "ed25519" | "rsa";
      bits?: number;
      passphrase?: string;
      comment?: string;
    }) => ipcRenderer.invoke("ssh-key-generate", opts),
    importKey: (opts: {
      name: string;
      privatePem: string;
      passphrase?: string;
    }) => ipcRenderer.invoke("ssh-key-import", opts),
    exportPublic: (id: string) =>
      ipcRenderer.invoke("ssh-key-export-public", id),
    delete: (id: string) => ipcRenderer.invoke("ssh-key-delete", id),
    setPassphrase: (id: string, passphrase: string) =>
      ipcRenderer.invoke("ssh-key-set-passphrase", id, passphrase),
  },
  sshConfig: {
    list: () => ipcRenderer.invoke("ssh-config-list"),
  },
  envVault: {
    listScopes: () => ipcRenderer.invoke("env-vault-list-scopes"),
    list: (scopeId: string) => ipcRenderer.invoke("env-vault-list", scopeId),
    listKeys: (scopeId: string) =>
      ipcRenderer.invoke("env-vault-list-keys", scopeId),
    set: (scopeId: string, key: string, value: string) =>
      ipcRenderer.invoke("env-vault-set", scopeId, key, value),
    delete: (scopeId: string, key: string) =>
      ipcRenderer.invoke("env-vault-delete", scopeId, key),
    clearScope: (scopeId: string) =>
      ipcRenderer.invoke("env-vault-clear-scope", scopeId),
    resolve: (scopeIds: string[]) =>
      ipcRenderer.invoke("env-vault-resolve", scopeIds),
  },
  secrets: {
    test: (provider: "op" | "bw" | "vault" | "aws", ref: string) =>
      ipcRenderer.invoke("secret-resolve", provider, ref),
    primeForSSHSession: (
      connId: string,
      provider: "op" | "bw" | "vault" | "aws",
      ref: string,
    ) => ipcRenderer.invoke("ssh-session-prime-secret", connId, provider, ref),
  },
  windowControls: {
    minimize: () => ipcRenderer.send("win-minimize"),
    maximize: () => ipcRenderer.send("win-maximize"),
    close: () => ipcRenderer.send("win-close"),
  },
  updater: {
    check: () => ipcRenderer.invoke("updater:check"),
    download: () => ipcRenderer.invoke("updater:download"),
    install: () => ipcRenderer.send("updater:install"),
    onUpdateAvailable: (cb: (info: UpdateInfo) => void) =>
      ipcRenderer.on("updater:update-available", (_e, info) => cb(info)),
    onUpToDate: (cb: (info: UpdateInfo) => void) =>
      ipcRenderer.on("updater:up-to-date", (_e, info) => cb(info)),
    onDownloadProgress: (cb: (progress: DownloadProgress) => void) =>
      ipcRenderer.on("updater:download-progress", (_e, progress) =>
        cb(progress),
      ),
    onUpdateDownloaded: (cb: (info: UpdateInfo) => void) =>
      ipcRenderer.on("updater:update-downloaded", (_e, info) => cb(info)),
    onError: (cb: (message: string) => void) =>
      ipcRenderer.on("updater:error", (_e, message) => cb(message)),
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners("updater:update-available");
      ipcRenderer.removeAllListeners("updater:up-to-date");
      ipcRenderer.removeAllListeners("updater:download-progress");
      ipcRenderer.removeAllListeners("updater:update-downloaded");
      ipcRenderer.removeAllListeners("updater:error");
    },
  },
};

interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseName?: string;
}

interface DownloadProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("api", api);
    contextBridge.exposeInMainWorld("platform", {
      os: process.platform,
    });
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
}
