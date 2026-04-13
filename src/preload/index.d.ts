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
