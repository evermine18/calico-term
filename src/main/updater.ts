import { autoUpdater } from "electron-updater";
import { BrowserWindow, ipcMain } from "electron";

function getMainWindow(): BrowserWindow | undefined {
  return BrowserWindow.getAllWindows()[0];
}

export function setupUpdater(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("update-available", (info) => {
    getMainWindow()?.webContents.send("updater:update-available", info);
  });

  autoUpdater.on("update-not-available", (info) => {
    getMainWindow()?.webContents.send("updater:up-to-date", info);
  });

  autoUpdater.on("download-progress", (progress) => {
    getMainWindow()?.webContents.send("updater:download-progress", progress);
  });

  autoUpdater.on("update-downloaded", (info) => {
    getMainWindow()?.webContents.send("updater:update-downloaded", info);
  });

  autoUpdater.on("error", (err) => {
    getMainWindow()?.webContents.send("updater:error", err.message);
  });

  ipcMain.handle("updater:check", () => autoUpdater.checkForUpdates());
  ipcMain.handle("updater:download", () => autoUpdater.downloadUpdate());
  ipcMain.on("updater:install", () => autoUpdater.quitAndInstall());
}
