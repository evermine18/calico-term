import { app, safeStorage } from "electron";
import fs from "fs";
import path from "path";

/**
 * Generic JSON-on-disk store, with every leaf value encrypted at rest via
 * Electron's safeStorage (keychain on macOS, libsecret on Linux, DPAPI on Win).
 *
 * Layout of the file: { [key]: base64(encrypt(jsonString(value))) }.
 * The keys themselves are not encrypted — keep them non-sensitive.
 */
export class EncryptedStore<T> {
  private readonly filename: string;

  constructor(filename: string) {
    this.filename = filename;
  }

  private filePath(): string {
    return path.join(app.getPath("userData"), this.filename);
  }

  private loadRaw(): Record<string, string> {
    try {
      const file = this.filePath();
      if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, "utf8"));
      }
    } catch {
      // Corrupt file — treat as empty
    }
    return {};
  }

  private saveRaw(raw: Record<string, string>): void {
    fs.writeFileSync(this.filePath(), JSON.stringify(raw), {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  available(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  set(key: string, value: T): void {
    if (!safeStorage.isEncryptionAvailable()) return;
    const raw = this.loadRaw();
    raw[key] = safeStorage
      .encryptString(JSON.stringify(value))
      .toString("base64");
    this.saveRaw(raw);
  }

  get(key: string): T | null {
    if (!safeStorage.isEncryptionAvailable()) return null;
    const raw = this.loadRaw();
    if (!raw[key]) return null;
    try {
      const decoded = safeStorage.decryptString(Buffer.from(raw[key], "base64"));
      return JSON.parse(decoded) as T;
    } catch {
      return null;
    }
  }

  has(key: string): boolean {
    return !!this.loadRaw()[key];
  }

  delete(key: string): void {
    const raw = this.loadRaw();
    delete raw[key];
    this.saveRaw(raw);
  }

  keys(): string[] {
    return Object.keys(this.loadRaw());
  }
}
