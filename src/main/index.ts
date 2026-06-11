import { app, shell, BrowserWindow, ipcMain, Menu } from "electron";
import { join, isAbsolute, resolve as resolvePath, dirname } from "path";
import { promises as fsp } from "fs";
import { homedir } from "os";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import icon from "../../resources/icon.png?asset";
import {
  setupTerminal,
  closeTerminal,
  storePassword,
  retrievePassword,
  removePassword,
} from "./terminal";
import { getModels, sendChat } from "./chat-api";
import { setupUpdater } from "./updater";
import { setupSFTPHandlers } from "./sftp";
import { setupSSHKeysHandlers } from "./ssh-keys";
import { setupSSHConfigHandlers } from "./ssh-config";
import { setupEnvVaultHandlers } from "./env-vault";
import { setupSecretProviderHandlers } from "./secret-providers";
import { setupRecordingHandlers } from "./recording";
import { setupAuditHandlers } from "./audit";
import { setupHostMetricsHandlers } from "./host-metrics";
import { setupAlertHandlers } from "./alerts";
import { setupWorkspaceHandlers } from "./workspaces";
import { setupGuardrailHandlers } from "./guardrails";
import { setupAgentHandlers } from "./agents";

// --- AI streaming controllers ---
const streamControllers = new Map<string, AbortController>();

// --- Detached (popped-out) terminal windows ---
interface DetachPayload {
  tabId: string;
  title: string;
  isSSH: boolean;
  connId?: string;
  agentId?: string;
  serialized: string;
}
// windowId -> the tab it hosts. `returning` guards the close handshake so the
// second close() (after the renderer hands back its scrollback) is allowed.
const detachedWindows = new Map<
  number,
  { tabId: string; returning?: boolean }
>();
// tabId -> the payload the detached renderer fetches on mount via handshake.
const detachPayloads = new Map<string, DetachPayload>();
// Set during app shutdown so detached close handlers skip the return dance.
let isQuitting = false;

function createContextMenu(): Menu {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Copy",
      accelerator: "CmdOrCtrl+C",
      role: "copy",
    },
    {
      label: "Paste",
      accelerator: "CmdOrCtrl+V",
      role: "paste",
    },
    {
      label: "Cut",
      accelerator: "CmdOrCtrl+X",
      role: "cut",
    },
    { type: "separator" },
    {
      label: "Select All",
      accelerator: "CmdOrCtrl+A",
      role: "selectAll",
    },
  ]);

  return contextMenu;
}

// Shared BrowserWindow constructor options (preload, sandbox, titlebar chrome).
// `extra` provides per-window sizing; it must not override webPreferences.
function buildWindowOptions(
  extra?: Electron.BrowserWindowConstructorOptions,
): Electron.BrowserWindowConstructorOptions {
  return {
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: "hidden",
    ...(process.platform === "linux" ? { icon } : {}),
    ...(process.platform === "win32"
      ? {
          titleBarOverlay: {
            color: "#0f172a",
            symbolColor: "#9ca3af",
            height: 36,
          },
        }
      : {}),
    ...extra,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      disableBlinkFeatures: "Auxclick",
    },
  };
}

// Wire the chrome/event handlers shared by every window (context menu,
// deferred show, crash logging, external-link handling).
function wireWindowChrome(win: BrowserWindow): void {
  const contextMenu = createContextMenu();

  win.webContents.on("context-menu", (_event, params) => {
    contextMenu.popup({ window: win, x: params.x, y: params.y });
  });

  win.once("ready-to-show", () => {
    win.show();
  });

  // Fallback: titleBarOverlay on Windows can prevent ready-to-show from firing.
  // If the window is still hidden after load completes, force show it.
  win.webContents.once("did-finish-load", () => {
    setTimeout(() => {
      if (!win.isDestroyed() && !win.isVisible()) win.show();
    }, 300);
  });

  win.webContents.on("render-process-gone", (_event, details) => {
    console.error("Renderer process gone:", details.reason, details.exitCode);
  });

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });
}

// HMR for renderer base on electron-vite cli.
// Load the remote URL for development or the local html file for production.
// `query` selects the renderer view (e.g. the detached single-terminal route).
function loadRenderer(
  win: BrowserWindow,
  query?: Record<string, string>,
): void {
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    const base = process.env["ELECTRON_RENDERER_URL"];
    const suffix = query ? "/?" + new URLSearchParams(query).toString() : "";
    win.loadURL(base + suffix);
  } else {
    win.loadFile(
      join(__dirname, "../renderer/index.html"),
      query ? { query } : undefined,
    );
  }
}

function createWindow(): void {
  const mainWindow = new BrowserWindow(
    buildWindowOptions({ width: 900, height: 670 }),
  );

  if (!is.dev) {
    Menu.setApplicationMenu(null); //! Caution
  }

  wireWindowChrome(mainWindow);
  loadRenderer(mainWindow);
}

// Find the main (non-detached) window to hand a returning tab back to.
function findMainWindow(): BrowserWindow | undefined {
  return BrowserWindow.getAllWindows().find(
    (w) => !w.isDestroyed() && !detachedWindows.has(w.id),
  );
}

// Re-adopt a popped-out tab into the main window with its accumulated
// scrollback. The PTY was never killed, so the shell resumes seamlessly.
function returnTabToMain(tabId: string, serialized: string): void {
  const meta = detachPayloads.get(tabId);
  findMainWindow()?.webContents.send("detach-returned", {
    tabId,
    serialized,
    title: meta?.title ?? "Terminal",
    isSSH: meta?.isSSH ?? false,
    connId: meta?.connId,
    agentId: meta?.agentId,
  });
}

// Open a popped-out window hosting a single live terminal (its PTY already
// runs in main, keyed by tabId; the detached renderer only attaches to it).
function createDetachedWindow(payload: DetachPayload): void {
  const win = new BrowserWindow(
    buildWindowOptions({ width: 760, height: 480 }),
  );

  detachedWindows.set(win.id, { tabId: payload.tabId });
  detachPayloads.set(payload.tabId, payload);

  wireWindowChrome(win);

  // Closing a detached window must NOT kill the PTY. Intercept the first close,
  // ask the renderer for its current scrollback, return the tab to the main
  // window, then let the window actually close. Skipped during app shutdown.
  win.on("close", (e) => {
    const entry = detachedWindows.get(win.id);
    if (!entry || entry.returning || isQuitting) return;
    e.preventDefault();
    entry.returning = true;
    win.webContents.send("detach-serialize-request");
    // Fallback: if the renderer never replies, force the close through.
    setTimeout(() => {
      if (!win.isDestroyed()) win.close();
    }, 500);
  });

  win.on("closed", () => {
    detachedWindows.delete(win.id);
    detachPayloads.delete(payload.tabId);
  });

  loadRenderer(win, { view: "detached", tabId: payload.tabId });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId("com.electron");

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on("browser-window-created", (_, window) => {
    if (is.dev) {
      // Open DevTools by default in development
      optimizer.watchWindowShortcuts(window);
    }
  });

  // --- AI API key (encrypted via safeStorage) ---
  ipcMain.handle("ai-apikey-set", (_event, plaintext: string) => {
    storePassword("ai-apikey", plaintext);
  });

  ipcMain.on("ai-apikey-delete", () => {
    removePassword("ai-apikey");
  });

  ipcMain.handle("ai-apikey-has", () => {
    return retrievePassword("ai-apikey") !== null;
  });

  // --- AI streaming chat ---
  ipcMain.on(
    "send-ai-message",
    async (
      event,
      streamId: string,
      basepath: string,
      selectedModel: string,
      messages,
      terminalContent: string | undefined,
      systemPrompt: string,
      temperature: number,
      maxTokens: number,
      provider:
        | "openai"
        | "anthropic"
        | "ollama"
        | "openai-compatible" = "openai",
      tools?: Array<{
        name: string;
        description: string;
        inputSchema: {
          type: "object";
          properties: Record<string, unknown>;
          required?: string[];
        };
      }>,
    ) => {
      const controller = new AbortController();
      streamControllers.set(streamId, controller);

      const apiKey = retrievePassword("ai-apikey") ?? "";

      try {
        const result = await sendChat(
          basepath,
          apiKey,
          selectedModel,
          messages,
          (delta) => event.sender.send("ai-stream-chunk", streamId, delta),
          controller.signal,
          terminalContent,
          systemPrompt,
          temperature,
          maxTokens,
          provider,
          tools,
          (call) => event.sender.send("ai-stream-tool-call", streamId, call),
        );
        event.sender.send(
          "ai-stream-done",
          streamId,
          result.usage ?? null,
          result.stopReason,
        );
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          const msg = error?.message ?? String(error);
          event.sender.send("ai-stream-error", streamId, msg);
        } else {
          event.sender.send("ai-stream-done", streamId, null, "aborted");
        }
      } finally {
        streamControllers.delete(streamId);
      }
    },
  );

  ipcMain.on("ai-stream-cancel", (_event, streamId: string) => {
    streamControllers.get(streamId)?.abort();
    streamControllers.delete(streamId);
  });

  // --- Agent filesystem tools (renderer cannot touch fs directly) ---
  const FS_MAX_READ = 256 * 1024;
  function resolveAgentPath(input: string): string {
    const raw = String(input ?? "");
    if (!raw) throw new Error("Empty path");
    const expanded =
      raw.startsWith("~/") || raw === "~" ? join(homedir(), raw.slice(1)) : raw;
    return isAbsolute(expanded) ? expanded : resolvePath(homedir(), expanded);
  }

  ipcMain.handle("agent-fs-read", async (_event, path: string) => {
    try {
      const full = resolveAgentPath(path);
      const stat = await fsp.stat(full);
      if (!stat.isFile()) return { error: `Not a file: ${full}` };
      const buf = await fsp.readFile(full);
      const truncated = buf.length > FS_MAX_READ;
      const slice = truncated ? buf.subarray(0, FS_MAX_READ) : buf;
      let content = slice.toString("utf-8");
      if (truncated)
        content += `\n…[truncated, ${buf.length - FS_MAX_READ} more bytes]`;
      return { path: full, content, size: buf.length, truncated };
    } catch (e: any) {
      return { error: e?.message ?? String(e) };
    }
  });

  ipcMain.handle(
    "agent-fs-write",
    async (_event, path: string, content: string) => {
      try {
        const full = resolveAgentPath(path);
        await fsp.mkdir(dirname(full), { recursive: true });
        await fsp.writeFile(full, String(content ?? ""), "utf-8");
        return { path: full };
      } catch (e: any) {
        return { error: e?.message ?? String(e) };
      }
    },
  );

  ipcMain.handle(
    "get-ai-models",
    async (
      _event,
      basepath,
      apiKey?: string,
      provider?: "openai" | "anthropic" | "ollama" | "openai-compatible",
    ) => {
      const key = apiKey?.trim() || retrievePassword("ai-apikey") || "";
      return await getModels(basepath, key, provider ?? "openai");
    },
  );

  // IPC test
  ipcMain.on("ping", () => console.log("pong"));

  if (!is.dev) {
    setupUpdater();
  }

  createWindow();

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  setupTerminal();
  setupSFTPHandlers();
  setupSSHKeysHandlers();
  setupSSHConfigHandlers();
  setupEnvVaultHandlers();
  setupSecretProviderHandlers();
  setupRecordingHandlers();
  setupAuditHandlers();
  setupHostMetricsHandlers();
  setupAlertHandlers();
  setupWorkspaceHandlers();
  setupGuardrailHandlers();
  setupAgentHandlers();
  ipcMain.on("app-close", () => {
    console.log("App close requested");
    app.quit();
  });
  // Window controls are scoped to the window that sent them so detached
  // windows control themselves (and never quit the whole app).
  ipcMain.on("win-minimize", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  ipcMain.on("win-maximize", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.on("win-close", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });

  // --- Detached terminal windows (pop-out) ---
  ipcMain.on("detach-tab", (_event, payload: DetachPayload) => {
    createDetachedWindow(payload);
  });
  ipcMain.handle("detach-get-payload", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;
    const entry = detachedWindows.get(win.id);
    if (!entry) return null;
    return detachPayloads.get(entry.tabId) ?? null;
  });
  // Reply to the close handshake: hand the tab (with up-to-date scrollback)
  // back to the main window, then let the detached window finish closing.
  ipcMain.on("detach-serialize-response", (event, serialized: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    const entry = detachedWindows.get(win.id);
    if (!entry) return;
    returnTabToMain(entry.tabId, serialized ?? "");
    if (!win.isDestroyed()) win.close();
  });

  app.once("before-quit", async (event) => {
    isQuitting = true;
    event.preventDefault();
    BrowserWindow.getAllWindows().forEach((w) => w.hide());
    await closeTerminal();
    app.quit();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
