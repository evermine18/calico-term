import { spawn } from "node-pty";
import { ipcMain } from "electron";

let ptyProcess: any = null;
let terminals: Record<string, any> = {};

export function setupTerminal() {
  // Creating a PTY process for the terminal
  ipcMain.on("terminal-create", (_event, tabId: string) => {
    // If it already exists, ignore
    if (terminals[tabId]) {
      console.log(`terminal-create: ${tabId} already exists, skipping`);
      return;
    }

    const shell = process.platform === "win32" ? "powershell.exe" : "bash";
    const args =
      process.platform === "win32"
        ? [
            "-NoExit",
            "-Command",
            "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; chcp 65001 > $null",
          ]
        : [];

    const ptyProcess = spawn(shell, args, {
      name: "xterm-color",
      cols: 80,
      rows: 24,
      cwd: process.env.HOME || process.env.USERPROFILE,
      env: process.env,
    });

    terminals[tabId] = ptyProcess;

    ptyProcess.onData((data: string) => {
      for (const w of require("electron").BrowserWindow.getAllWindows()) {
        w.webContents.send("terminal-output", tabId, data);
      }
      // Detecta errores comunes en la salida
      const errorPatterns = [
        /error/i,
        /failed/i,
        /denied/i,
        /not found/i,
        /no such file/i,
        /permission/i,
        /command not found/i,
        /could not/i,
        /fatal/i,
        /segmentation fault/i,
        /connection refused/i,
        /connection timed out/i,
        /unknown host/i,
      ];
      if (errorPatterns.some((pat) => pat.test(data))) {
        for (const w of require("electron").BrowserWindow.getAllWindows()) {
          w.webContents.send("terminal-error", tabId, data);
        }
        console.error(`Error detected in terminal ${tabId}: ${data}`);
      }
    });

    ptyProcess.onExit(() => {
      delete terminals[tabId];
    });
  });

  ipcMain.on("terminal-input", (_event, { tabId, data }) => {
    terminals[tabId]?.write(data);
  });

  ipcMain.on("terminal-resize", (_event, { tabId, cols, rows }) => {
    terminals[tabId]?.resize(cols, rows);
  });

  ipcMain.on("terminal-kill", (_event, tabId: string) => {
    if (!terminals[tabId]) {
      console.log(`terminal-kill: ${tabId} no existe, saltando`);
      return;
    }
    console.log(`Killing terminal: ${tabId}`);
    terminals[tabId].kill();
    delete terminals[tabId];
  });
}

export function closeTerminal() {
  if (ptyProcess) {
    ptyProcess.kill();
  }
}
