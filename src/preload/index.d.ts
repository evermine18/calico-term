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
  interface Window {
    electron: ElectronAPI;
    platform: {
      os: string;
    };
    api: {
      sftp: {
        connect: (sessionId: string, conn: {
          id: string;
          host: string;
          port: number;
          username: string;
          identityFile?: string;
          hasPassword?: boolean;
          credentialId?: string;
        }) => Promise<void>;
        disconnect: (sessionId: string) => void;
        list: (sessionId: string, dirPath: string) => Promise<{
          filename: string;
          attrs: { size: number; uid: number; gid: number; mode: number; atime: number; mtime: number };
          isDirectory: boolean;
          isSymlink: boolean;
        }[]>;
        realpath: (sessionId: string, remotePath: string) => Promise<string>;
        download: (sessionId: string, remotePath: string) => Promise<void>;
        upload: (sessionId: string, remotePath: string) => Promise<void>;
        delete: (sessionId: string, entryPath: string, isDirectory: boolean) => Promise<void>;
        mkdir: (sessionId: string, dirPath: string) => Promise<void>;
        rename: (sessionId: string, oldPath: string, newPath: string) => Promise<void>;
        onProgress: (cb: (data: { sessionId: string; filename: string; bytes: number; total: number }) => void) => (() => void);
      };
      clipboard: {
        writeText: (text: string) => void;
        readText: () => string;
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
    };
  }
}
