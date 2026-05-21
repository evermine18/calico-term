import { ipcMain, dialog, BrowserWindow } from "electron";
import fs from "fs";
import crypto from "crypto";
import { readPrivateKeyPem, readPublicKeyPem } from "./audit";

function sign(payload: Buffer): string {
  const key = crypto.createPrivateKey(readPrivateKeyPem());
  return crypto.sign(null, payload, key).toString("base64");
}

function verify(payload: Buffer, sigB64: string, pubPem: string): boolean {
  try {
    const key = crypto.createPublicKey(pubPem);
    return crypto.verify(null, payload, key, Buffer.from(sigB64, "base64"));
  } catch {
    return false;
  }
}

export function setupWorkspaceHandlers(): void {
  ipcMain.handle(
    "workspace-export",
    async (
      _e,
      payload: { defaultName: string; body: string; signaturePayload: string },
    ) => {
      const win = BrowserWindow.getFocusedWindow();
      const result = await dialog.showSaveDialog(win!, {
        defaultPath: `${payload.defaultName}.calico-workspace.json`,
        filters: [{ name: "Calico Workspace", extensions: ["json"] }],
      });
      if (result.canceled || !result.filePath) return { ok: false };
      const signature = sign(Buffer.from(payload.signaturePayload, "utf8"));
      const publicKey = readPublicKeyPem();
      const wrapped = JSON.parse(payload.body);
      wrapped.signature = signature;
      wrapped.publicKey = publicKey;
      fs.writeFileSync(result.filePath, JSON.stringify(wrapped, null, 2), {
        mode: 0o600,
      });
      return { ok: true, path: result.filePath };
    },
  );

  ipcMain.handle("workspace-import", async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win!, {
      filters: [{ name: "Calico Workspace", extensions: ["json"] }],
      properties: ["openFile"],
    });
    if (result.canceled || result.filePaths.length === 0) return { ok: false };
    const raw = fs.readFileSync(result.filePaths[0], "utf8");
    return { ok: true, content: raw };
  });

  ipcMain.handle(
    "workspace-verify",
    (
      _e,
      payload: { signaturePayload: string; signature: string; publicKey: string },
    ) => {
      return verify(
        Buffer.from(payload.signaturePayload, "utf8"),
        payload.signature,
        payload.publicKey,
      );
    },
  );
}
