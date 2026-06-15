import { spawn } from "node-pty";
import { ipcMain, safeStorage, app } from "electron";
import os from "os";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { resolveEnv } from "./env-vault";
import { resolveSecret, SecretProvider } from "./secret-providers";
import { recordOutput } from "./recording";
import { checkData, clearTabBuffer, setTabConn } from "./alerts";
import { matchGuardrail, isProdTab } from "./guardrails";

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

export function storePassword(connId: string, plaintext: string): void {
  if (!safeStorage.isEncryptionAvailable()) return;
  const encrypted = safeStorage.encryptString(plaintext).toString("base64");
  const store = loadEncryptedPasswords();
  store[connId] = encrypted;
  saveEncryptedPasswords(store);
}

export function retrievePassword(connId: string): string | null {
  if (!safeStorage.isEncryptionAvailable()) return null;
  const store = loadEncryptedPasswords();
  if (!store[connId]) return null;
  try {
    return safeStorage.decryptString(Buffer.from(store[connId], "base64"));
  } catch {
    return null;
  }
}

export function removePassword(connId: string): void {
  const store = loadEncryptedPasswords();
  delete store[connId];
  saveEncryptedPasswords(store);
}

// --- Guardrail input buffering ---
// For prod tabs we accumulate the typed line (per tab) so that, on Enter, we
// can match against a dangerous-command list before forwarding \r to the PTY.
const guardrailLineBuf: Record<string, string> = {};
// When a guardrail prompt is awaiting user confirmation, the input handler
// short-circuits all further keystrokes for that tab.
const guardrailPending = new Set<string>();

// --- SSH session password-injection state ---
// Maps tabId -> connId for terminals awaiting a password prompt
const sshPasswordSessions: Record<string, string> = {};
// Tracks tabs that already injected the password (avoid re-injection on secondary prompts)
const sshPasswordInjected = new Set<string>();
// Out-of-band password overrides (for secret-ref auth) keyed by connId
const oneShotPasswords = new Map<string, string>();
// Rolling tail of recent PTY output per tab. Lets us match prompts that arrive
// split across multiple onData chunks (common after a reconnect where the PTY
// is in a different buffering state than on initial connect).
const sshOutputTail: Record<string, string> = {};
const SSH_TAIL_MAX = 512;
// Timestamp at which an SSH session was last armed (via ssh-session-init).
// Within this grace window we skip disconnect-pattern detection: on Windows
// ConPTY the local shell may repaint scrollback (which still contains the
// previous "Connection to host closed" line) when the new ssh command is
// typed, producing a false disconnect right after a Reconnect.
const sshSessionArmedAt: Record<string, number> = {};
const SSH_DISCONNECT_GRACE_MS = 2500;

// Tabs currently considered SSH-active. Used to gate disconnect-pattern
// detection so we don't fire `ssh-disconnected` on plain local shells.
const sshActiveTabs = new Set<string>();

// --- Output ring buffer (powers the MCP read_terminal tool) ---
// Per-tab rolling capture of recent raw PTY output. Lets external agents (and
// runCapturedCommand) read what a terminal has produced without depending on
// the renderer/xterm being mounted.
const outputBuffers: Record<string, string> = {};
const OUTPUT_BUFFER_MAX = 200_000;

// --- Tab metadata mirror (pushed from the renderer) ---
// The main process only knows tabIds; the renderer owns titles/SSH info. It
// pushes a snapshot via `terminal-meta-set` so list_terminals can describe tabs.
interface TabMeta {
  title?: string;
  isSSH?: boolean;
  connId?: string | null;
}
let tabMeta: Record<string, TabMeta> = {};

// Tabs with an in-flight runCapturedCommand. Prevents two captures racing on
// the same PTY (their marker streams would interleave).
const captureBusy = new Set<string>();

// Which shell family a local tab was spawned with — decides how
// runCapturedCommand brackets a command (printf/$? vs Write-Output/$LASTEXITCODE).
// SSH tabs ignore this and assume POSIX (the remote shell, usually Linux).
type ShellKind = "posix" | "powershell";
const shellKind: Record<string, ShellKind> = {};

function detectShellKind(shell: string): ShellKind {
  return /powershell|pwsh/i.test(shell) ? "powershell" : "posix";
}

/**
 * Build the wrapped command that brackets `command` with unique start/end
 * markers (and captures the exit code). Markers are emitted via string
 * concatenation so the shell's echo of this line never contains the literal
 * marker we scan for — only the command's real output does.
 *
 * Supported shells: POSIX (bash/zsh/sh) and Windows PowerShell. SSH tabs are
 * always treated as POSIX (the remote shell is assumed to be Linux).
 *
 * NOT supported: cmd.exe and fish. Their syntax differs (`printf`/`$?` and the
 * adjacent-string anti-echo trick don't work the same), so they silently fall
 * through to the POSIX wrapper here — the end marker never appears and
 * runCapturedCommand returns partial output with `timedOut: true` once the
 * timeout elapses. For those shells use the send_keys + read_terminal tools
 * instead. To add real support, branch a new wrapper variant below.
 */
function buildCaptureWrapper(
  kind: ShellKind,
  nonce: string,
  command: string,
): string {
  if (kind === "powershell") {
    return (
      `Write-Output ("__CCS"+"_${nonce}__"); ` +
      `${command}; ` +
      `$__cc=$LASTEXITCODE; if($null -eq $__cc){if($?){$__cc=0}else{$__cc=1}}; ` +
      `Write-Output ("__CCE"+"_${nonce}__:"+$__cc)\r`
    );
  }
  // POSIX shells (bash/zsh/sh).
  return (
    `printf '%s\\n' "__CCS""_${nonce}__"; ` +
    `${command}; ` +
    `__cc=$?; printf '%s:%s\\n' "__CCE""_${nonce}__" "$__cc"\r`
  );
}

/** Strip ANSI/control noise so captured output is readable plain text. */
function stripAnsi(s: string): string {
  return s
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "") // CSI sequences
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "") // OSC sequences
    .replace(/\x1b[=>]/g, "")
    .replace(/\x1b[()][AB0]/g, "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "") // other control chars
    .replace(/\r/g, "");
}

export interface ManagedTerminal {
  tabId: string;
  title: string;
  isSSH: boolean;
  connId: string | null;
}

/** List the live PTYs with whatever metadata the renderer last reported. */
export function listManagedTerminals(): ManagedTerminal[] {
  return Object.keys(terminals).map((id) => ({
    tabId: id,
    title: tabMeta[id]?.title ?? "Terminal",
    isSSH: !!tabMeta[id]?.isSSH,
    connId: tabMeta[id]?.connId ?? null,
  }));
}

/**
 * Recent plain-text output for a tab (ANSI stripped, last `maxChars`).
 * Returns null when no such terminal exists.
 */
export function getTerminalOutput(tabId: string, maxChars = 8000): string | null {
  if (!terminals[tabId]) return null;
  const buf = outputBuffers[tabId] ?? "";
  return stripAnsi(buf).slice(-maxChars);
}

/** Write raw data to a tab's PTY. Returns false if the tab is gone or gated. */
export function writeToTerminal(tabId: string, data: string): boolean {
  const pty = terminals[tabId];
  if (!pty) return false;
  if (guardrailPending.has(tabId)) return false;
  pty.write(data);
  return true;
}

export interface CapturedResult {
  output: string;
  exitCode: number | null;
  timedOut: boolean;
  busy?: boolean;
}

/**
 * Run a command on a tab's PTY and capture just that command's output by
 * bracketing it with unique markers. Assumes a POSIX shell (bash/zsh/sh) on
 * the target — including the remote end of an SSH session. Not for TUIs:
 * interactive programs never reach the end marker (use send_keys + read instead).
 *
 * The markers are written split (`"__CCS""_<nonce>__"`) so the shell's own echo
 * of this command line never contains the literal marker we scan for — only the
 * printf *output* does.
 */
export function runCapturedCommand(
  tabId: string,
  command: string,
  timeoutMs = 20000,
): Promise<CapturedResult | null> {
  const pty = terminals[tabId];
  if (!pty) return Promise.resolve(null);
  if (captureBusy.has(tabId)) {
    return Promise.resolve({
      output: "",
      exitCode: null,
      timedOut: false,
      busy: true,
    });
  }
  captureBusy.add(tabId);

  return new Promise<CapturedResult>((resolve) => {
    const nonce = crypto.randomBytes(6).toString("hex");
    const sMark = `__CCS_${nonce}__`;
    const eMark = `__CCE_${nonce}__`;
    const endNeedle = eMark + ":";
    let raw = "";
    let settled = false;

    const finish = (timedOut: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      disp.dispose();
      captureBusy.delete(tabId);

      const clean = stripAnsi(raw);
      const startIdx = clean.indexOf(sMark);
      const endIdx = clean.indexOf(endNeedle);
      let output = "";
      let exitCode: number | null = null;
      if (startIdx >= 0 && endIdx >= 0 && endIdx > startIdx) {
        output = clean.slice(startIdx + sMark.length, endIdx);
        const m = clean.slice(endIdx + endNeedle.length).match(/^(\d+)/);
        if (m) exitCode = parseInt(m[1], 10);
      } else if (startIdx >= 0) {
        output = clean.slice(startIdx + sMark.length);
      } else {
        output = clean;
      }
      output = output.replace(/^\r?\n/, "").replace(/[\r\n]+$/, "");
      resolve({ output, exitCode, timedOut });
    };

    const disp = pty.onData((d: string) => {
      raw += d;
      if (raw.length > OUTPUT_BUFFER_MAX * 2) raw = raw.slice(-OUTPUT_BUFFER_MAX);
      if (stripAnsi(raw).includes(endNeedle)) finish(false);
    });
    const timer = setTimeout(() => finish(true), timeoutMs);

    // SSH tabs run a remote shell (assume POSIX); local tabs use whatever
    // shell we spawned them with.
    const isRemote = sshActiveTabs.has(tabId) || !!tabMeta[tabId]?.isSSH;
    const kind: ShellKind = isRemote ? "posix" : (shellKind[tabId] ?? "posix");
    pty.write(buildCaptureWrapper(kind, nonce, command));
  });
}

// Common patterns that indicate the remote SSH session has ended.
const sshDisconnectPatterns: RegExp[] = [
  /Connection to [^\s]+ closed/i,
  /Connection (?:reset|closed) by [^\s]+/i,
  /Connection timed out/i,
  /client_loop: send disconnect/i,
  /Write failed: Broken pipe/i,
  /ssh_exchange_identification: (?:Connection closed|read: Connection reset)/i,
];

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
 * Prepare environment variables for the terminal.
 * `extra` is overlaid on top of the base process env.
 */
function prepareEnvironment(
  extra?: Record<string, string>,
): Record<string, string> {
  const env = { ...process.env } as Record<string, string>;

  // Ensure TERM is set correctly
  env.TERM = env.TERM || "xterm-256color";
  env.TERM_PROGRAM = env.TERM_PROGRAM || "Calico Terminal";
  env.TERM_PROGRAM_VERSION = env.TERM_PROGRAM_VERSION || app.getVersion();
  env.COLORTERM = env.COLORTERM || "truecolor";

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

  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      env[k] = v;
    }
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
    return ["-i", "-l"]; // Interactive login shell
  }

  if (shell.includes("bash")) {
    return ["-i", "-l"]; // Interactive login shell
  }

  // For other shells, use no arguments
  return [];
}

export function setupTerminal() {
  // Creating a PTY process for the terminal
  ipcMain.on(
    "terminal-create",
    (
      _event,
      tabId: string,
      opts?: {
        shell?: string;
        cwd?: string;
        envScopes?: string[];
      },
    ) => {
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
      const extraEnv = opts?.envScopes?.length
        ? resolveEnv(opts.envScopes)
        : resolveEnv(["global"]);
      const env = prepareEnvironment(extraEnv);

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
        shellKind[tabId] = detectShellKind(shell);

        ptyProcess.onData((data: string) => {
          for (const w of require("electron").BrowserWindow.getAllWindows()) {
            w.webContents.send("terminal-output", tabId, data);
          }
          // Keep a rolling buffer for the MCP read_terminal tool.
          outputBuffers[tabId] = ((outputBuffers[tabId] ?? "") + data).slice(
            -OUTPUT_BUFFER_MAX,
          );
          recordOutput(tabId, data);
          checkData(tabId, data);

          // Detect remote SSH session closure and notify the renderer so it
          // can offer a reconnect action. We only run this when the tab is
          // marked SSH-active to avoid false positives in local shells.
          if (sshActiveTabs.has(tabId)) {
            const armedAt = sshSessionArmedAt[tabId] ?? 0;
            const inGrace = Date.now() - armedAt < SSH_DISCONNECT_GRACE_MS;
            if (!inGrace) for (const pat of sshDisconnectPatterns) {
              if (pat.test(data)) {
                console.log(
                  `[ssh-debug] disconnect detected tab=${tabId} pattern=${pat}`,
                );
                sshActiveTabs.delete(tabId);
                sshPasswordInjected.delete(tabId);
                // Disarm password auto-injection until the user explicitly
                // reconnects (armSSHSession re-sets sshPasswordSessions[tabId]).
                // Otherwise any later "password:" string in local-shell output
                // would cause the stored password to be typed into the shell.
                const connId = sshPasswordSessions[tabId];
                delete sshPasswordSessions[tabId];
                if (connId) oneShotPasswords.delete(connId);
                delete sshOutputTail[tabId];
                delete sshSessionArmedAt[tabId];
                for (const w of require("electron").BrowserWindow.getAllWindows()) {
                  w.webContents.send("ssh-disconnected", tabId);
                }
                break;
              }
            }
          }

          // Auto-inject SSH password when the remote prompts for it
          if (sshPasswordSessions[tabId] && !sshPasswordInjected.has(tabId)) {
            const prev = sshOutputTail[tabId] ?? "";
            const tail = (prev + data).slice(-SSH_TAIL_MAX);
            sshOutputTail[tabId] = tail;
            // Match the prompt at the END of the rolling tail (the remote is
            // waiting for input → no further output after the colon). This
            // avoids false matches from ConPTY repainting the scrollback,
            // which re-emits the previous "password:" line in the middle of
            // a chunk.
            const stripped = tail
              .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "") // CSI sequences
              .replace(/\x1b\][^\x07]*\x07/g, "") // OSC sequences
              .replace(/\r/g, "");
            const lastLine = stripped.split("\n").pop() ?? "";
            if (
              /password\s*:\s*$/i.test(lastLine) ||
              /passphrase for key[^\n]*:\s*$/i.test(lastLine)
            ) {
              const connId = sshPasswordSessions[tabId];
              const pwd =
                oneShotPasswords.get(connId) ?? retrievePassword(connId);
              oneShotPasswords.delete(connId);
              console.log(
                `[ssh-debug] prompt detected tab=${tabId} connId=${connId} hasPwd=${!!pwd}`,
              );
              if (pwd) {
                sshPasswordInjected.add(tabId);
                sshOutputTail[tabId] = "";
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
          sshActiveTabs.delete(tabId);
          delete sshOutputTail[tabId];
          delete sshSessionArmedAt[tabId];
          delete guardrailLineBuf[tabId];
          guardrailPending.delete(tabId);
          delete outputBuffers[tabId];
          delete tabMeta[tabId];
          delete shellKind[tabId];
          captureBusy.delete(tabId);
          setTabConn(tabId, null);
          clearTabBuffer(tabId);
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
    const pty = terminals[tabId];
    if (!pty) return;

    // While a guardrail modal is open for this tab, swallow all input until
    // the renderer resolves it.
    if (guardrailPending.has(tabId)) return;

    if (!isProdTab(tabId)) {
      pty.write(data);
      return;
    }

    // Prod tab: walk through each byte tracking the in-progress command line.
    let line = guardrailLineBuf[tabId] ?? "";
    for (let i = 0; i < data.length; i++) {
      const ch = data[i];
      if (ch === "\r" || ch === "\n") {
        const matched = matchGuardrail(line);
        if (matched) {
          // Hold the rest of the data (including the \r) — emit a prompt.
          guardrailPending.add(tabId);
          guardrailLineBuf[tabId] = line;
          for (const w of require("electron").BrowserWindow.getAllWindows()) {
            w.webContents.send("terminal-guardrail-prompt", {
              tabId,
              command: line,
              ruleId: matched.id,
              description: matched.description,
            });
          }
          return;
        }
        pty.write(ch);
        line = "";
      } else if (ch === "\x7f" || ch === "\b") {
        pty.write(ch);
        line = line.slice(0, -1);
      } else if (ch === "\x03" || ch === "\x15") {
        // Ctrl-C / Ctrl-U cancels the current line
        pty.write(ch);
        line = "";
      } else if (ch >= " ") {
        pty.write(ch);
        line += ch;
      } else {
        // Other control codes: pass through, don't try to track.
        pty.write(ch);
      }
    }
    guardrailLineBuf[tabId] = line;
  });

  ipcMain.on(
    "terminal-guardrail-resolve",
    (_event, tabId: string, confirmed: boolean) => {
      const pty = terminals[tabId];
      guardrailPending.delete(tabId);
      const heldLine = guardrailLineBuf[tabId] ?? "";
      guardrailLineBuf[tabId] = "";
      if (!pty) return;
      if (confirmed) {
        // Send \r to execute the command that's already on the prompt.
        pty.write("\r");
      } else {
        // Cancel: clear the current line in the remote shell so the user
        // doesn't accidentally execute it later by pressing Enter.
        pty.write("\x15");
      }
      void heldLine; // currently unused, retained for potential audit hook
    },
  );

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
    sshActiveTabs.delete(tabId);
    delete guardrailLineBuf[tabId];
    guardrailPending.delete(tabId);
    delete outputBuffers[tabId];
    delete tabMeta[tabId];
    delete shellKind[tabId];
    captureBusy.delete(tabId);
    setTabConn(tabId, null);
  });

  // Renderer pushes a snapshot of tab metadata (title/SSH/connId) so the MCP
  // list_terminals tool can describe tabs by something other than a raw UUID.
  ipcMain.on(
    "terminal-meta-set",
    (_event, metas: Array<{ tabId: string } & TabMeta>) => {
      const next: Record<string, TabMeta> = {};
      for (const m of metas ?? []) {
        next[m.tabId] = {
          title: m.title,
          isSSH: m.isSSH,
          connId: m.connId ?? null,
        };
      }
      tabMeta = next;
    },
  );

  // Associate a terminal with an SSH connection so the password is auto-injected
  ipcMain.on("ssh-session-init", (_event, tabId: string, connId: string) => {
    sshPasswordSessions[tabId] = connId;
    sshPasswordInjected.delete(tabId); // allow fresh injection
    sshSessionArmedAt[tabId] = Date.now();
    delete sshOutputTail[tabId];
    console.log(
      `[ssh-debug] ssh-session-init tab=${tabId} connId=${connId} hasStoredPwd=${!!loadEncryptedPasswords()[connId]}`,
    );
  });

  // Register the SSH connection a tab is tied to (regardless of password use).
  // Drives alert-rule scoping and prod-guardrail evaluation by host. Also
  // arms SSH-disconnect detection for the tab.
  ipcMain.on(
    "terminal-set-conn",
    (_event, tabId: string, connId: string | null) => {
      setTabConn(tabId, connId);
      if (connId) sshActiveTabs.add(tabId);
      else sshActiveTabs.delete(tabId);
    },
  );

  // Resolve a secret reference and arm it as a one-shot password for the next
  // SSH prompt on `connId`. Returns true if a value was successfully fetched.
  ipcMain.handle(
    "ssh-session-prime-secret",
    async (
      _event,
      connId: string,
      provider: SecretProvider,
      ref: string,
    ): Promise<boolean> => {
      try {
        const value = await resolveSecret(provider, ref);
        if (!value) return false;
        oneShotPasswords.set(connId, value);
        return true;
      } catch (err) {
        console.error(`Failed to resolve secret for ${connId}:`, err);
        return false;
      }
    },
  );

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
