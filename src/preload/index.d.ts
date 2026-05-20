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
      windowControls: {
        minimize: () => void;
        maximize: () => void;
        close: () => void;
      };
    };
  }
}
