import { ElectronAPI } from "@electron-toolkit/preload";

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

declare global {
  type SecretProvider = "op" | "bw" | "vault" | "aws";

  interface SSHKeyMetadata {
    id: string;
    name: string;
    type: "ed25519" | "rsa";
    bits?: number;
    publicKey: string;
    fingerprint: string;
    hasPassphrase: boolean;
    createdAt: number;
    privatePath: string;
    publicPath: string;
  }

  interface SSHConfigHost {
    alias: string;
    host: string;
    port: number;
    user?: string;
    identityFile?: string;
    proxyJump?: string;
  }

  interface RecordingMeta {
    id: string;
    tabId: string;
    title: string;
    createdAt: number;
    durationMs: number;
    cols: number;
    rows: number;
    bytes: number;
    path: string;
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

  type AlertSeverity = "info" | "warning" | "critical";

  interface AlertRule {
    id: string;
    pattern: string;
    flags: string;
    severity: AlertSeverity;
    message?: string;
    enabled: boolean;
  }

  interface Window {
    electron: ElectronAPI;
    platform: {
      os: string;
    };
    api: {
      sftp: {
        connect: (
          sessionId: string,
          conn: {
            id: string;
            host: string;
            port: number;
            username: string;
            identityFile?: string;
            hasPassword?: boolean;
            credentialId?: string;
          },
        ) => Promise<void>;
        disconnect: (sessionId: string) => void;
        list: (
          sessionId: string,
          dirPath: string,
        ) => Promise<
          {
            filename: string;
            attrs: {
              size: number;
              uid: number;
              gid: number;
              mode: number;
              atime: number;
              mtime: number;
            };
            isDirectory: boolean;
            isSymlink: boolean;
          }[]
        >;
        realpath: (sessionId: string, remotePath: string) => Promise<string>;
        download: (sessionId: string, remotePath: string) => Promise<void>;
        upload: (sessionId: string, remotePath: string) => Promise<void>;
        delete: (
          sessionId: string,
          entryPath: string,
          isDirectory: boolean,
        ) => Promise<void>;
        mkdir: (sessionId: string, dirPath: string) => Promise<void>;
        rename: (
          sessionId: string,
          oldPath: string,
          newPath: string,
        ) => Promise<void>;
        onProgress: (
          cb: (data: {
            sessionId: string;
            filename: string;
            bytes: number;
            total: number;
          }) => void,
        ) => () => void;
        readText: (sessionId: string, remotePath: string) => Promise<string>;
        writeText: (
          sessionId: string,
          remotePath: string,
          content: string,
        ) => Promise<void>;
        tailStart: (
          sessionId: string,
          remotePath: string,
          lines?: number,
        ) => Promise<string>;
        tailStop: (tailId: string) => void;
        onTailData: (
          cb: (data: { tailId: string; data: string; isErr: boolean }) => void,
        ) => () => void;
        onTailEnd: (cb: (data: { tailId: string }) => void) => () => void;
        syncDir: (
          sessionId: string,
          remoteDir: string,
          localDir: string,
          direction: "download" | "upload",
        ) => Promise<{ syncId: string; filesTransferred: number }>;
        onSyncProgress: (
          cb: (data: {
            sessionId: string;
            syncId: string;
            current: string;
            filesDone: number;
            filesTotal: number;
          }) => void,
        ) => () => void;
        pickLocalDir: () => Promise<string | null>;
      };
      clipboard: {
        writeText: (text: string) => void;
        readText: () => string;
      };
      sshKeys: {
        list: () => Promise<SSHKeyMetadata[]>;
        generate: (opts: {
          name: string;
          type: "ed25519" | "rsa";
          bits?: number;
          passphrase?: string;
          comment?: string;
        }) => Promise<SSHKeyMetadata>;
        importKey: (opts: {
          name: string;
          privatePem: string;
          passphrase?: string;
        }) => Promise<SSHKeyMetadata>;
        exportPublic: (id: string) => Promise<string | null>;
        delete: (id: string) => Promise<void>;
        setPassphrase: (id: string, passphrase: string) => Promise<void>;
      };
      sshConfig: {
        list: () => Promise<SSHConfigHost[]>;
      };
      envVault: {
        listScopes: () => Promise<string[]>;
        list: (
          scopeId: string,
        ) => Promise<{ key: string; value: string }[]>;
        listKeys: (scopeId: string) => Promise<string[]>;
        set: (scopeId: string, key: string, value: string) => Promise<void>;
        delete: (scopeId: string, key: string) => Promise<void>;
        clearScope: (scopeId: string) => Promise<void>;
        resolve: (scopeIds: string[]) => Promise<Record<string, string>>;
      };
      secrets: {
        test: (
          provider: SecretProvider,
          ref: string,
        ) => Promise<{ ok: boolean; hasValue?: boolean; error?: string }>;
        primeForSSHSession: (
          connId: string,
          provider: SecretProvider,
          ref: string,
        ) => Promise<boolean>;
      };
      updater: {
        check: () => Promise<unknown>;
        download: () => Promise<unknown>;
        install: () => void;
        onUpdateAvailable: (cb: (info: UpdateInfo) => void) => void;
        onUpToDate: (cb: (info: UpdateInfo) => void) => void;
        onDownloadProgress: (cb: (progress: DownloadProgress) => void) => void;
        onUpdateDownloaded: (cb: (info: UpdateInfo) => void) => void;
        onError: (cb: (message: string) => void) => void;
        removeAllListeners: () => void;
      };
      recording: {
        start: (
          tabId: string,
          title: string,
          cols: number,
          rows: number,
        ) => Promise<RecordingMeta>;
        stop: (tabId: string) => Promise<RecordingMeta | null>;
        isActive: (tabId: string) => Promise<boolean>;
        list: () => Promise<RecordingMeta[]>;
        load: (id: string) => Promise<string | null>;
        delete: (id: string) => Promise<boolean>;
        exportPath: (id: string) => Promise<string | null>;
      };
      audit: {
        append: (entry: AuditEntry) => void;
        list: (limit?: number) => Promise<AuditEntry[]>;
        clear: () => Promise<boolean>;
        publicKey: () => Promise<string>;
        exportSigned: () => Promise<{
          ok: boolean;
          path?: string;
          error?: string;
          canceled?: boolean;
        }>;
      };
      metrics: {
        start: (sessionId: string, intervalMs?: number) => void;
        stop: (sessionId: string) => void;
        onSample: (
          cb: (data: { sessionId: string; sample: HostSample }) => void,
        ) => () => void;
        onError: (
          cb: (data: { sessionId: string; error: string }) => void,
        ) => () => void;
      };
      alerts: {
        setRules: (rules: AlertRule[]) => void;
        onMatch: (
          cb: (data: {
            ruleId: string;
            tabId: string;
            severity: AlertSeverity;
            message: string;
            ts: number;
          }) => void,
        ) => () => void;
      };
      windowControls: {
        minimize: () => void;
        maximize: () => void;
        close: () => void;
      };
    };
  }
}
