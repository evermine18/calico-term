import { ElectronAPI } from "@electron-toolkit/preload";

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
    };
  }
}
