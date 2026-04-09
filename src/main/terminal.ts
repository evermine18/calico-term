import { spawn } from "node-pty";
import { ipcMain, safeStorage, app } from "electron";
import os from "os";
import fs from "fs";
import path from "path";

let terminals: Record<string, any> = {};

// --- Secure password storage via safeStorage + encrypted file in userData ---

function passwordsFilePath(): string {
  return path.join(app.getPath("userData"), "ssh-passwords.enc");
}

function loadEncryptedPasswords(): Record<string, string> {
  try {
    const file = passwordsFilePath();
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    }
  } catch {
    // Corrupt file — treat as empty
  }
  return {};
}

function saveEncryptedPasswords(store: Record<string, string>): void {
  fs.writeFileSync(passwordsFilePath(), JSON.stringify(store), {
    encoding: "utf8",
    mode: 0o600,
  });
}

function storePassword(connId: string, plaintext: string): void {
  if (!safeStorage.isEncryptionAvailable()) return;
  const encrypted = safeStorage.encryptString(plaintext).toString("base64");
  const store = loadEncryptedPasswords();
  store[connId] = encrypted;
  saveEncryptedPasswords(store);
}

function retrievePassword(connId: string): string | null {
  if (!safeStorage.isEncryptionAvailable()) return null;
  const store = loadEncryptedPasswords();
  if (!store[connId]) return null;
  try {
    return safeStorage.decryptString(Buffer.from(store[connId], "base64"));
  } catch {
    return null;
  }
}

function removePassword(connId: string): void {
  const store = loadEncryptedPasswords();
  delete store[connId];
  saveEncryptedPasswords(store);
}

// --- SSH session password-injection state ---
// Maps tabId -> connId for terminals awaiting a password prompt
const sshPasswordSessions: Record<string, string> = {};
// Tracks tabs that already injected the password (avoid re-injection on secondary prompts)
const sshPasswordInjected = new Set<string>();

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
  ipcMain.on(
    "terminal-create",
    (_event, tabId: string, opts?: { shell?: string; cwd?: string }) => {
      // If it already exists, ignore
      if (terminals[tabId]) {
        console.log(`terminal-create: ${tabId} already exists, skipping`);
        return;
      }

      const shell =
        opts?.shell && opts.shell.trim()
          ? opts.shell.trim()
          : getDefaultShell();
      const cwd =
        opts?.cwd && opts.cwd.trim() ? opts.cwd.trim() : getInitialCwd();
      const args = getShellArgs(shell);
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

          // Auto-inject SSH password when the remote prompts for it
          if (sshPasswordSessions[tabId] && !sshPasswordInjected.has(tabId)) {
            // Match common SSH/sudo password prompts
            if (
              /password\s*:/i.test(data) ||
              /passphrase for key/i.test(data)
            ) {
              const connId = sshPasswordSessions[tabId];
              const pwd = retrievePassword(connId);
              if (pwd) {
                sshPasswordInjected.add(tabId);
                // Small delay so the prompt is fully rendered before sending
                setTimeout(() => terminals[tabId]?.write(pwd + "\r"), 80);
              }
            }
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
          delete sshPasswordSessions[tabId];
          sshPasswordInjected.delete(tabId);
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
    },
  );

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
    delete sshPasswordSessions[tabId];
    sshPasswordInjected.delete(tabId);
  });

  // Associate a terminal with an SSH connection so the password is auto-injected
  ipcMain.on("ssh-session-init", (_event, tabId: string, connId: string) => {
    sshPasswordSessions[tabId] = connId;
    sshPasswordInjected.delete(tabId); // allow fresh injection
  });

  // Securely store a password for an SSH connection (encrypted via safeStorage)
  ipcMain.handle(
    "ssh-password-set",
    (_event, connId: string, plaintext: string) => {
      storePassword(connId, plaintext);
    },
  );

  // Remove a stored password
  ipcMain.on("ssh-password-delete", (_event, connId: string) => {
    removePassword(connId);
  });

  // Check whether a stored password exists for a connection
  ipcMain.handle("ssh-password-has", (_event, connId: string): boolean => {
    const store = loadEncryptedPasswords();
    return !!store[connId];
  });

  // Vault credential password management (stored with "vault-" prefix in the same encrypted store)
  ipcMain.handle(
    "vault-password-set",
    (_event, credentialId: string, plaintext: string) => {
      storePassword("vault-" + credentialId, plaintext);
    },
  );

  ipcMain.on("vault-password-delete", (_event, credentialId: string) => {
    removePassword("vault-" + credentialId);
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
