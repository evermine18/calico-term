import { spawn } from "node-pty";
import { ipcMain } from "electron";
import os from "os";
import fs from "fs";

let terminals: Record<string, any> = {};

/**
 * Detect the user's default shell on macOS
 */
function getDefaultShell(): string {
  if (process.platform === "win32") {
    return "powershell.exe";
  }

  // On macOS, try to get the user's shell from $SHELL
  // or from /etc/passwd
  if (process.env.SHELL) {
    return process.env.SHELL;
  }

  // Fallback: zsh is the default on macOS Catalina+
  if (process.platform === "darwin") {
    return "/bin/zsh";
  }

  return "/bin/bash";
}

/**
 * Get the initial working directory
 */
function getInitialCwd(): string {
  // Priority: current project directory > HOME
  if (process.env.PWD && fs.existsSync(process.env.PWD)) {
    return process.env.PWD;
  }

  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

/**
 * Prepare environment variables for the terminal
 */
function prepareEnvironment(): Record<string, string> {
  const env = { ...process.env } as Record<string, string>;

  // Ensure TERM is set correctly
  env.TERM = env.TERM || "xterm-256color";

  // On macOS, ensure LANG is set to UTF-8
  if (process.platform === "darwin") {
    env.LANG = env.LANG || "en_US.UTF-8";
    env.LC_ALL = env.LC_ALL || "en_US.UTF-8";
  }

  // Add common macOS PATHs if missing
  if (process.platform === "darwin" && env.PATH) {
    const commonPaths = [
      "/usr/local/bin",
      "/opt/homebrew/bin", // Apple Silicon Macs
      "/usr/bin",
      "/bin",
      "/usr/sbin",
      "/sbin",
    ];

    const pathArray = env.PATH.split(":");
    for (const p of commonPaths) {
      if (!pathArray.includes(p)) {
        pathArray.unshift(p);
      }
    }
    env.PATH = pathArray.join(":");
  }

  return env;
}

/**
 * Get shell arguments according to the platform
 */
function getShellArgs(shell: string): string[] {
  if (process.platform === "win32") {
    return [
      "-NoExit",
      "-Command",
      "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; chcp 65001 > $null",
    ];
  }

  // For Unix shells, use login mode so shell config files are loaded
  // (e.g. .zshrc, .bashrc)
  if (shell.includes("zsh")) {
    return ["-l"]; // Login shell
  }

  if (shell.includes("bash")) {
    return ["-l"]; // Login shell
  }

  // For other shells, use no arguments
  return [];
}

export function setupTerminal() {
  // Creating a PTY process for the terminal
  ipcMain.on("terminal-create", (_event, tabId: string) => {
    // If it already exists, ignore
    if (terminals[tabId]) {
      console.log(`terminal-create: ${tabId} already exists, skipping`);
      return;
    }

    const shell = getDefaultShell();
    const args = getShellArgs(shell);
    const cwd = getInitialCwd();
    const env = prepareEnvironment();

    console.log(`Creating terminal ${tabId} with shell: ${shell} in ${cwd}`);

    try {
      const ptyProcess = spawn(shell, args, {
        name: "xterm-256color",
        cols: 80,
        rows: 24,
        cwd,
        env,
      });

      terminals[tabId] = ptyProcess;

      ptyProcess.onData((data: string) => {
        for (const w of require("electron").BrowserWindow.getAllWindows()) {
          w.webContents.send("terminal-output", tabId, data);
        }
        // Check for common error patterns in the output
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

      ptyProcess.onExit(({ exitCode, signal }) => {
        console.log(
          `Terminal ${tabId} exited with code ${exitCode}, signal ${signal}`,
        );
        delete terminals[tabId];
        // Notify the renderer that the terminal was closed
        for (const w of require("electron").BrowserWindow.getAllWindows()) {
          w.webContents.send("terminal-closed", tabId, exitCode);
        }
      });
    } catch (error) {
      console.error(`Failed to create terminal ${tabId}:`, error);
      // Notify the renderer of the error
      for (const w of require("electron").BrowserWindow.getAllWindows()) {
        w.webContents.send("terminal-creation-failed", tabId, error.message);
      }
    }
  });

  ipcMain.on("terminal-input", (_event, { tabId, data }) => {
    terminals[tabId]?.write(data);
  });

  ipcMain.on("terminal-resize", (_event, { tabId, cols, rows }) => {
    terminals[tabId]?.resize(cols, rows);
  });

  ipcMain.on("terminal-kill", (_event, tabId: string) => {
    if (!terminals[tabId]) {
      console.log(`terminal-kill: ${tabId} does not exist, skipping`);
      return;
    }
    console.log(`Killing terminal: ${tabId}`);
    terminals[tabId].kill();
    delete terminals[tabId];
  });

  // Execute command in the active terminal
  ipcMain.on("execute-command", (_event, command: string) => {
    // Find the active terminal (the last used one)
    const terminalIds = Object.keys(terminals);
    if (terminalIds.length > 0) {
      const lastTerminal = terminals[terminalIds[terminalIds.length - 1]];
      lastTerminal?.write(command + "\r");
    }
  });
}

export async function closeTerminal(): Promise<void> {
  const promises = Object.values(terminals).map((proc) => {
    return new Promise<void>((resolve) => {
      proc.onExit(resolve);
      proc.kill();
    });
  });
  await Promise.all(promises);
  terminals = {};
}
