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

    const ptyProcess = spawn(
      process.platform === "win32" ? "powershell.exe" : "bash",
      [],
      {
        name: "xterm-color",
        cols: 80,
        rows: 24,
        cwd: process.env.HOME || process.env.USERPROFILE,
        env: process.env,
      }
    );

    terminals[tabId] = ptyProcess;

    ptyProcess.onData((data: string) => {
      for (const w of require("electron").BrowserWindow.getAllWindows()) {
        w.webContents.send("terminal-output", tabId, data);
      }
    });

    ptyProcess.onExit(() => {
      delete terminals[tabId];
    });
  });

  ipcMain.on("terminal-input", (_event, { tabId, data }) => {
    console.log(`Sending data to terminal ${tabId}: ${data}`);
    console.log(`Terminals: ${Object.keys(terminals)}`);

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
