import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";
import { clipboard } from "electron";

// Custom APIs for renderer
const api = {
  clipboard: {
    writeText: (text: string) => clipboard.writeText(text),
    readText: () => clipboard.readText(),
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
      ipcRenderer.on("updater:download-progress", (_e, progress) => cb(progress)),
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
