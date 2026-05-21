import { app, ipcMain, safeStorage, dialog, BrowserWindow } from "electron";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export type AuditEntry = {
  ts: number;
  command: string;
  hostId?: string;
  workspaceId?: string;
  cwd?: string;
  exitCode?: number;
  tabId?: string;
};

function auditFile(): string {
  return path.join(app.getPath("userData"), "audit.log");
}

function signingKeyPath(): string {
  return path.join(app.getPath("userData"), "audit-signing.key");
}

function publicKeyPath(): string {
  return path.join(app.getPath("userData"), "audit-signing.pub");
}

function ensureSigningKey(): { privatePem: string; publicPem: string } {
  if (fs.existsSync(signingKeyPath()) && fs.existsSync(publicKeyPath())) {
    return {
      privatePem: fs.readFileSync(signingKeyPath(), "utf8"),
      publicPem: fs.readFileSync(publicKeyPath(), "utf8"),
    };
  }
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const privatePem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  const publicPem = publicKey.export({ format: "pem", type: "spki" }).toString();
  // Encrypt private key at rest via safeStorage when available
  if (safeStorage.isEncryptionAvailable()) {
    fs.writeFileSync(
      signingKeyPath(),
      safeStorage.encryptString(privatePem),
      { mode: 0o600 },
    );
  } else {
    fs.writeFileSync(signingKeyPath(), privatePem, { mode: 0o600 });
  }
  fs.writeFileSync(publicKeyPath(), publicPem, { mode: 0o644 });
  return { privatePem, publicPem };
}

export function readPrivateKeyPem(): string {
  return readPrivateKey();
}

export function readPublicKeyPem(): string {
  return ensureSigningKey().publicPem;
}

function readPrivateKey(): string {
  ensureSigningKey();
  const raw = fs.readFileSync(signingKeyPath());
  if (safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(raw);
    } catch {
      /* not encrypted */
    }
  }
  return raw.toString("utf8");
}

export function appendEntry(entry: AuditEntry): void {
  const line = JSON.stringify(entry) + "\n";
  fs.appendFileSync(auditFile(), line, { encoding: "utf8", mode: 0o600 });
}

export function readEntries(limit: number = 1000): AuditEntry[] {
  const file = auditFile();
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
  const last = lines.slice(-limit);
  const out: AuditEntry[] = [];
  for (const l of last) {
    try {
      out.push(JSON.parse(l));
    } catch {
      /* skip corrupt */
    }
  }
  return out;
}

export function clearAudit(): void {
  if (fs.existsSync(auditFile())) fs.unlinkSync(auditFile());
}

function signFile(filePath: string): Buffer {
  const data = fs.readFileSync(filePath);
  const privatePem = readPrivateKey();
  const key = crypto.createPrivateKey(privatePem);
  return crypto.sign(null, data, key);
}

export function setupAuditHandlers(): void {
  ensureSigningKey();

  ipcMain.on("audit-append", (_e, entry: AuditEntry) => {
    appendEntry(entry);
  });

  ipcMain.handle("audit-list", (_e, limit?: number) =>
    readEntries(limit ?? 1000),
  );

  ipcMain.handle("audit-clear", () => {
    clearAudit();
    return true;
  });

  ipcMain.handle("audit-public-key", () => {
    return ensureSigningKey().publicPem;
  });

  ipcMain.handle("audit-export-signed", async () => {
    const file = auditFile();
    if (!fs.existsSync(file)) return { ok: false, error: "No audit log yet" };
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showSaveDialog(win!, {
      defaultPath: `audit-${Date.now()}.jsonl`,
      filters: [{ name: "JSONL", extensions: ["jsonl"] }],
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    fs.copyFileSync(file, result.filePath);
    const sig = signFile(result.filePath);
    fs.writeFileSync(result.filePath + ".sig", sig);
    fs.writeFileSync(result.filePath + ".pub", ensureSigningKey().publicPem);
    return { ok: true, path: result.filePath };
  });
}
