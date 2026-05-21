import { app, ipcMain } from "electron";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import os from "os";
import { EncryptedStore } from "./lib/encrypted-store";

export type SSHKeyType = "ed25519" | "rsa";

export type SSHKeyMetadata = {
  id: string;
  name: string;
  type: SSHKeyType;
  bits?: number;
  publicKey: string;
  fingerprint: string;
  hasPassphrase: boolean;
  createdAt: number;
  privatePath: string;
  publicPath: string;
};

const passphraseStore = new EncryptedStore<string>("ssh-key-passphrases.enc");

function keysDir(): string {
  return path.join(app.getPath("userData"), "keys");
}

function metadataFile(): string {
  return path.join(app.getPath("userData"), "ssh-keys.json");
}

function loadMetadata(): SSHKeyMetadata[] {
  try {
    const file = metadataFile();
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    }
  } catch {
    /* ignore */
  }
  return [];
}

function saveMetadata(list: SSHKeyMetadata[]): void {
  fs.writeFileSync(metadataFile(), JSON.stringify(list, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
}

function ensureKeysDir(): void {
  if (!fs.existsSync(keysDir())) {
    fs.mkdirSync(keysDir(), { recursive: true, mode: 0o700 });
  }
}

function fingerprintSha256(openSshPublicKey: string): string {
  // openSshPublicKey format: "<type> <base64> [comment]"
  const parts = openSshPublicKey.trim().split(/\s+/);
  if (parts.length < 2) return "";
  const blob = Buffer.from(parts[1], "base64");
  const hash = crypto.createHash("sha256").update(blob).digest("base64");
  // Strip trailing "=" padding the way ssh-keygen does
  return "SHA256:" + hash.replace(/=+$/, "");
}

function publicKeyToOpenSSH(
  publicKey: crypto.KeyObject,
  type: SSHKeyType,
  comment: string,
): string {
  // Use the JWK form for easy field extraction
  const jwk = publicKey.export({ format: "jwk" }) as Record<string, string>;

  function encString(s: string): Buffer {
    const data = Buffer.from(s, "utf8");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    return Buffer.concat([len, data]);
  }
  function encBuffer(buf: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(buf.length, 0);
    return Buffer.concat([len, buf]);
  }
  function b64urlToBuf(b: string): Buffer {
    const pad = "=".repeat((4 - (b.length % 4)) % 4);
    return Buffer.from(b.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
  }

  if (type === "ed25519") {
    const x = b64urlToBuf(jwk.x);
    const blob = Buffer.concat([encString("ssh-ed25519"), encBuffer(x)]);
    return `ssh-ed25519 ${blob.toString("base64")} ${comment}`;
  }

  // RSA
  const n = b64urlToBuf(jwk.n);
  const e = b64urlToBuf(jwk.e);
  // OpenSSH uses two's complement big-int — prepend 0x00 byte if high bit set
  const nMpint = n[0] & 0x80 ? Buffer.concat([Buffer.from([0]), n]) : n;
  const eMpint = e[0] & 0x80 ? Buffer.concat([Buffer.from([0]), e]) : e;
  const blob = Buffer.concat([
    encString("ssh-rsa"),
    encBuffer(eMpint),
    encBuffer(nMpint),
  ]);
  return `ssh-rsa ${blob.toString("base64")} ${comment}`;
}

export function generateKey(opts: {
  name: string;
  type: SSHKeyType;
  bits?: number;
  passphrase?: string;
  comment?: string;
}): SSHKeyMetadata {
  ensureKeysDir();

  const id = crypto.randomUUID();
  const comment = opts.comment?.trim() || `${os.userInfo().username}@calico`;
  const bits = opts.type === "rsa" ? (opts.bits ?? 4096) : undefined;

  let keyPair: crypto.KeyPairKeyObjectResult;
  if (opts.type === "ed25519") {
    keyPair = crypto.generateKeyPairSync("ed25519");
  } else {
    keyPair = crypto.generateKeyPairSync("rsa", { modulusLength: bits! });
  }

  // OpenSSH private-key format. node:crypto supports it directly.
  const privateExportOptions: crypto.KeyExportOptions<"pem"> & {
    cipher?: string;
    passphrase?: string;
  } = {
    format: "pem",
    type: "pkcs8",
  };
  if (opts.passphrase) {
    privateExportOptions.cipher = "aes-256-cbc";
    privateExportOptions.passphrase = opts.passphrase;
  }
  const privatePem = keyPair.privateKey.export(privateExportOptions) as string;
  const publicSsh = publicKeyToOpenSSH(keyPair.publicKey, opts.type, comment);

  const privatePath = path.join(keysDir(), `${id}`);
  const publicPath = path.join(keysDir(), `${id}.pub`);
  fs.writeFileSync(privatePath, privatePem, { encoding: "utf8", mode: 0o600 });
  fs.writeFileSync(publicPath, publicSsh + "\n", {
    encoding: "utf8",
    mode: 0o644,
  });

  if (opts.passphrase) {
    passphraseStore.set(id, opts.passphrase);
  }

  const meta: SSHKeyMetadata = {
    id,
    name: opts.name.trim() || `key-${id.slice(0, 8)}`,
    type: opts.type,
    bits,
    publicKey: publicSsh,
    fingerprint: fingerprintSha256(publicSsh),
    hasPassphrase: !!opts.passphrase,
    createdAt: Date.now(),
    privatePath,
    publicPath,
  };

  const list = loadMetadata();
  list.push(meta);
  saveMetadata(list);
  return meta;
}

export function importKey(opts: {
  name: string;
  privatePem: string;
  passphrase?: string;
}): SSHKeyMetadata {
  ensureKeysDir();

  // Validate by attempting to parse
  const privateKey = crypto.createPrivateKey({
    key: opts.privatePem,
    passphrase: opts.passphrase,
  });

  const asym = (privateKey as any).asymmetricKeyType as string;
  let type: SSHKeyType;
  let bits: number | undefined;
  if (asym === "ed25519") {
    type = "ed25519";
  } else if (asym === "rsa") {
    type = "rsa";
    bits = (privateKey as any).asymmetricKeyDetails?.modulusLength;
  } else {
    throw new Error(`Unsupported key type: ${asym}`);
  }

  const publicKey = crypto.createPublicKey(privateKey);
  const comment = `${os.userInfo().username}@calico-imported`;
  const publicSsh = publicKeyToOpenSSH(publicKey, type, comment);

  const id = crypto.randomUUID();
  const privatePath = path.join(keysDir(), `${id}`);
  const publicPath = path.join(keysDir(), `${id}.pub`);
  fs.writeFileSync(privatePath, opts.privatePem, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.writeFileSync(publicPath, publicSsh + "\n", {
    encoding: "utf8",
    mode: 0o644,
  });
  if (opts.passphrase) {
    passphraseStore.set(id, opts.passphrase);
  }

  const meta: SSHKeyMetadata = {
    id,
    name: opts.name.trim() || `imported-${id.slice(0, 8)}`,
    type,
    bits,
    publicKey: publicSsh,
    fingerprint: fingerprintSha256(publicSsh),
    hasPassphrase: !!opts.passphrase,
    createdAt: Date.now(),
    privatePath,
    publicPath,
  };
  const list = loadMetadata();
  list.push(meta);
  saveMetadata(list);
  return meta;
}

export function listKeys(): SSHKeyMetadata[] {
  return loadMetadata();
}

export function getKey(id: string): SSHKeyMetadata | null {
  return loadMetadata().find((k) => k.id === id) ?? null;
}

export function getKeyPassphrase(id: string): string | null {
  return passphraseStore.get(id);
}

export function deleteKey(id: string): void {
  const list = loadMetadata();
  const meta = list.find((k) => k.id === id);
  if (!meta) return;
  for (const p of [meta.privatePath, meta.publicPath]) {
    try {
      fs.unlinkSync(p);
    } catch {
      /* ignore */
    }
  }
  passphraseStore.delete(id);
  saveMetadata(list.filter((k) => k.id !== id));
}

export function setupSSHKeysHandlers(): void {
  ipcMain.handle("ssh-key-list", () => listKeys());

  ipcMain.handle(
    "ssh-key-generate",
    (
      _event,
      opts: {
        name: string;
        type: SSHKeyType;
        bits?: number;
        passphrase?: string;
        comment?: string;
      },
    ) => generateKey(opts),
  );

  ipcMain.handle(
    "ssh-key-import",
    (_event, opts: { name: string; privatePem: string; passphrase?: string }) =>
      importKey(opts),
  );

  ipcMain.handle("ssh-key-export-public", (_event, id: string) => {
    const k = getKey(id);
    return k?.publicKey ?? null;
  });

  ipcMain.handle("ssh-key-delete", (_event, id: string) => {
    deleteKey(id);
  });

  ipcMain.handle(
    "ssh-key-set-passphrase",
    (_event, id: string, passphrase: string) => {
      if (!passphrase) {
        passphraseStore.delete(id);
        const list = loadMetadata();
        const idx = list.findIndex((k) => k.id === id);
        if (idx >= 0) {
          list[idx].hasPassphrase = false;
          saveMetadata(list);
        }
        return;
      }
      passphraseStore.set(id, passphrase);
      const list = loadMetadata();
      const idx = list.findIndex((k) => k.id === id);
      if (idx >= 0) {
        list[idx].hasPassphrase = true;
        saveMetadata(list);
      }
    },
  );
}
