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
    readText: (sessionId: string, remotePath: string) =>
      ipcRenderer.invoke("sftp-read-text", sessionId, remotePath),
    writeText: (sessionId: string, remotePath: string, content: string) =>
      ipcRenderer.invoke("sftp-write-text", sessionId, remotePath, content),
    tailStart: (sessionId: string, remotePath: string, lines?: number) =>
      ipcRenderer.invoke(
        "sftp-tail-start",
        sessionId,
        remotePath,
        lines ?? 200,
      ),
    tailStop: (tailId: string) => ipcRenderer.send("sftp-tail-stop", tailId),
    onTailData: (
      cb: (data: { tailId: string; data: string; isErr: boolean }) => void,
    ): (() => void) => {
      const wrapped = (_e: unknown, d: unknown) => cb(d as any);
      ipcRenderer.on("sftp-tail-data", wrapped);
      return () => ipcRenderer.removeListener("sftp-tail-data", wrapped);
    },
    onTailEnd: (cb: (data: { tailId: string }) => void): (() => void) => {
      const wrapped = (_e: unknown, d: unknown) => cb(d as any);
      ipcRenderer.on("sftp-tail-end", wrapped);
      return () => ipcRenderer.removeListener("sftp-tail-end", wrapped);
    },
    syncDir: (
      sessionId: string,
      remoteDir: string,
      localDir: string,
      direction: "download" | "upload",
    ) =>
      ipcRenderer.invoke(
        "sftp-sync-dir",
        sessionId,
        remoteDir,
        localDir,
        direction,
      ),
    onSyncProgress: (
      cb: (data: {
        sessionId: string;
        syncId: string;
        current: string;
        filesDone: number;
        filesTotal: number;
      }) => void,
    ): (() => void) => {
      const wrapped = (_e: unknown, d: unknown) => cb(d as any);
      ipcRenderer.on("sftp-sync-progress", wrapped);
      return () => ipcRenderer.removeListener("sftp-sync-progress", wrapped);
    },
    pickLocalDir: () => ipcRenderer.invoke("sftp-pick-local-dir"),
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
  recording: {
    start: (tabId: string, title: string, cols: number, rows: number) =>
      ipcRenderer.invoke("recording-start", tabId, title, cols, rows),
    stop: (tabId: string) => ipcRenderer.invoke("recording-stop", tabId),
    isActive: (tabId: string) =>
      ipcRenderer.invoke("recording-is-active", tabId),
    list: () => ipcRenderer.invoke("recording-list"),
    load: (id: string) => ipcRenderer.invoke("recording-load", id),
    delete: (id: string) => ipcRenderer.invoke("recording-delete", id),
    exportPath: (id: string) => ipcRenderer.invoke("recording-export-path", id),
  },
  audit: {
    append: (entry: AuditEntry) => ipcRenderer.send("audit-append", entry),
    list: (limit?: number) => ipcRenderer.invoke("audit-list", limit),
    clear: () => ipcRenderer.invoke("audit-clear"),
    publicKey: () => ipcRenderer.invoke("audit-public-key"),
    exportSigned: () => ipcRenderer.invoke("audit-export-signed"),
  },
  metrics: {
    start: (sessionId: string, conn: unknown, intervalMs?: number) =>
      ipcRenderer.invoke("metrics-start", sessionId, conn, intervalMs ?? 2000),
    stop: (sessionId: string) => ipcRenderer.send("metrics-stop", sessionId),
    onSample: (
      cb: (data: { sessionId: string; sample: HostSample }) => void,
    ): (() => void) => {
      const wrapped = (_e: unknown, d: unknown) => cb(d as any);
      ipcRenderer.on("metrics-sample", wrapped);
      return () => ipcRenderer.removeListener("metrics-sample", wrapped);
    },
    onError: (
      cb: (data: { sessionId: string; error: string }) => void,
    ): (() => void) => {
      const wrapped = (_e: unknown, d: unknown) => cb(d as any);
      ipcRenderer.on("metrics-error", wrapped);
      return () => ipcRenderer.removeListener("metrics-error", wrapped);
    },
  },
  alerts: {
    setRules: (rules: AlertRule[]) =>
      ipcRenderer.send("alert-rules-set", rules),
    setWorkspaceMap: (map: Record<string, string[]>) =>
      ipcRenderer.send("alert-workspace-map-set", map),
    setTabConn: (tabId: string, connId: string | null) =>
      ipcRenderer.send("alert-tab-conn-set", tabId, connId),
    onMatch: (
      cb: (data: {
        ruleId: string;
        tabId: string;
        severity: "info" | "warning" | "critical";
        message: string;
        ts: number;
      }) => void,
    ): (() => void) => {
      const wrapped = (_e: unknown, d: unknown) => cb(d as any);
      ipcRenderer.on("alert-match", wrapped);
      return () => ipcRenderer.removeListener("alert-match", wrapped);
    },
  },
  guardrails: {
    list: () => ipcRenderer.invoke("guardrails-list"),
    set: (rules: GuardrailRuleEntry[]) =>
      ipcRenderer.invoke("guardrails-set", rules),
    resetDefaults: () => ipcRenderer.invoke("guardrails-reset-defaults"),
    setProdTabs: (tabIds: string[]) =>
      ipcRenderer.send("guardrails-set-prod-tabs", tabIds),
    setTabConn: (tabId: string, connId: string | null) =>
      ipcRenderer.send("terminal-set-conn", tabId, connId),
    resolve: (tabId: string, confirmed: boolean) =>
      ipcRenderer.send("terminal-guardrail-resolve", tabId, confirmed),
    onPrompt: (
      cb: (data: {
        tabId: string;
        command: string;
        ruleId: string;
        description: string;
      }) => void,
    ): (() => void) => {
      const wrapped = (_e: unknown, d: unknown) => cb(d as any);
      ipcRenderer.on("terminal-guardrail-prompt", wrapped);
      return () =>
        ipcRenderer.removeListener("terminal-guardrail-prompt", wrapped);
    },
  },
  workspaces: {
    exportFile: (payload: {
      defaultName: string;
      body: string;
      signaturePayload: string;
    }) => ipcRenderer.invoke("workspace-export", payload),
    importFile: () => ipcRenderer.invoke("workspace-import"),
    verify: (payload: {
      signaturePayload: string;
      signature: string;
      publicKey: string;
    }) => ipcRenderer.invoke("workspace-verify", payload),
  },
  ssh: {
    onDisconnected: (cb: (tabId: string) => void): (() => void) => {
      const wrapped = (_e: unknown, tabId: string) => cb(tabId);
      ipcRenderer.on("ssh-disconnected", wrapped);
      return () => ipcRenderer.removeListener("ssh-disconnected", wrapped);
    },
  },
  agents: {
    detect: (commands: string[]): Promise<Record<string, boolean>> =>
      ipcRenderer.invoke("agents-detect", commands),
  },
  mcp: {
    getConfig: (): Promise<McpStatus> => ipcRenderer.invoke("mcp-get-config"),
    setConfig: (patch: {
      enabled?: boolean;
      allowAcceptAll?: boolean;
      port?: number;
    }): Promise<McpStatus> => ipcRenderer.invoke("mcp-set-config", patch),
    regenerateToken: (): Promise<McpStatus> =>
      ipcRenderer.invoke("mcp-regenerate-token"),
    // Push the current tab metadata snapshot so list_terminals can name tabs.
    setTabsMeta: (
      metas: {
        tabId: string;
        title?: string;
        isSSH?: boolean;
        connId?: string | null;
      }[],
    ) => ipcRenderer.send("terminal-meta-set", metas),
    onApprovalPrompt: (
      cb: (data: {
        id: string;
        tool: string;
        tabId: string;
        title: string;
        detail: string;
        allowAcceptAll: boolean;
      }) => void,
    ): (() => void) => {
      const wrapped = (_e: unknown, d: unknown) => cb(d as any);
      ipcRenderer.on("mcp-approval-prompt", wrapped);
      return () => ipcRenderer.removeListener("mcp-approval-prompt", wrapped);
    },
    resolveApproval: (id: string, decision: "allow" | "deny" | "allow-all") =>
      ipcRenderer.send("mcp-approval-resolve", id, decision),
  },
  windowControls: {
    minimize: () => ipcRenderer.send("win-minimize"),
    maximize: () => ipcRenderer.send("win-maximize"),
    close: () => ipcRenderer.send("win-close"),
  },
  detach: {
    // Pop a tab out into its own window. The PTY keeps running in main.
    open: (payload: DetachPayload) => ipcRenderer.send("detach-tab", payload),
    // Detached window fetches its hosted tab's metadata + scrollback on mount.
    getPayload: (): Promise<DetachPayload | null> =>
      ipcRenderer.invoke("detach-get-payload"),
    // Main asks the detached renderer to serialize before the window closes.
    onSerializeRequest: (cb: () => void): (() => void) => {
      const wrapped = () => cb();
      ipcRenderer.on("detach-serialize-request", wrapped);
      return () =>
        ipcRenderer.removeListener("detach-serialize-request", wrapped);
    },
    sendSerialized: (serialized: string) =>
      ipcRenderer.send("detach-serialize-response", serialized),
    // Main window is notified when a detached tab should be re-adopted.
    onReturned: (
      cb: (data: {
        tabId: string;
        serialized: string;
        title: string;
        isSSH: boolean;
        connId?: string;
        agentId?: string;
      }) => void,
    ): (() => void) => {
      const wrapped = (_e: unknown, d: unknown) => cb(d as any);
      ipcRenderer.on("detach-returned", wrapped);
      return () => ipcRenderer.removeListener("detach-returned", wrapped);
    },
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

interface McpStatus {
  enabled: boolean;
  allowAcceptAll: boolean;
  port: number;
  token: string;
  running: boolean;
  url: string;
}

interface DetachPayload {
  tabId: string;
  title: string;
  isSSH: boolean;
  connId?: string;
  agentId?: string;
  serialized: string;
}

interface AuditEntry {
  ts: number;
  command: string;
  hostId?: string;
  workspaceId?: string;
  cwd?: string;
  exitCode?: number;
  tabId?: string;
}

interface HostSample {
  ts: number;
  cpuPct: number;
  memUsedPct: number;
  memTotalKb: number;
  memFreeKb: number;
  load1: number;
  load5: number;
  load15: number;
  diskRootPct: number;
}

interface AlertRule {
  id: string;
  pattern: string;
  flags: string;
  severity: "info" | "warning" | "critical";
  message?: string;
  enabled: boolean;
  scope?: "global" | { workspaceId: string };
}

interface GuardrailRuleEntry {
  id: string;
  pattern: string;
  flags?: string;
  description: string;
  enabled: boolean;
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
