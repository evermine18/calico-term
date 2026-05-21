// Encrypted workspace import/export.
// Format `.calico-workspace.json` (v1):
//   {
//     version: 1,
//     createdAt: ISO,
//     encrypted: boolean,
//     workspace?: WorkspaceEntry,        // when not encrypted
//     connections?: SSHConnectionEntry[],
//     cipher?: { algorithm, salt, iv, ct } // when encrypted
//     signature: base64,                    // ed25519 over signaturePayload
//     publicKey: PEM,
//   }
// signaturePayload = canonical JSON of { workspace, connections, encrypted }.
// Secrets (passwords, identity passphrases) are NEVER included.

const SUBTLE = globalThis.crypto.subtle;

export type WorkspaceBundle = {
  workspace: WorkspaceEntry;
  connections: SSHConnectionEntry[];
};

function toB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const baseKey = await SUBTLE.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return SUBTLE.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations: 200_000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function sanitizeConnections(conns: SSHConnectionEntry[]): SSHConnectionEntry[] {
  return conns.map((c) => ({
    ...c,
    // strip secret material — only metadata travels
    hasPassword: false,
    credentialId: undefined,
    passwordRef: undefined,
  }));
}

export async function exportWorkspaceFile(
  ws: WorkspaceEntry,
  conns: SSHConnectionEntry[],
  passphrase: string | null,
): Promise<string | null> {
  const bundle: WorkspaceBundle = {
    workspace: ws,
    connections: sanitizeConnections(conns),
  };
  const payloadJson = JSON.stringify(bundle);
  const encrypted = !!passphrase;

  let body: Record<string, unknown> = {
    version: 1,
    createdAt: new Date().toISOString(),
    encrypted,
  };

  if (passphrase) {
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(passphrase, salt);
    const ct = await SUBTLE.encrypt(
      { name: "AES-GCM", iv: iv as unknown as BufferSource },
      key,
      new TextEncoder().encode(payloadJson),
    );
    body.cipher = {
      algorithm: "AES-GCM",
      kdf: "PBKDF2-SHA256-200k",
      salt: toB64(salt.buffer as ArrayBuffer),
      iv: toB64(iv.buffer as ArrayBuffer),
      ct: toB64(ct),
    };
  } else {
    body.workspace = bundle.workspace;
    body.connections = bundle.connections;
  }

  // Sign the same payload regardless of encryption status.
  const signaturePayload = JSON.stringify({
    workspace: bundle.workspace,
    connections: bundle.connections,
    encrypted,
  });

  const result = await window.api.workspaces.exportFile({
    defaultName: ws.name.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase(),
    body: JSON.stringify(body),
    signaturePayload,
  });
  return result.ok && result.path ? result.path : null;
}

export async function importWorkspaceFile(
  passphrase: string | null,
): Promise<WorkspaceBundle | null> {
  const res = await window.api.workspaces.importFile();
  if (!res.ok || !res.content) return null;
  const parsed = JSON.parse(res.content);
  if (parsed.version !== 1) {
    throw new Error(`Unsupported workspace format v${parsed.version}`);
  }

  let bundle: WorkspaceBundle;
  if (parsed.encrypted) {
    if (!passphrase) throw new Error("Passphrase required for encrypted file");
    const cipher = parsed.cipher;
    if (!cipher) throw new Error("Missing cipher block");
    const salt = fromB64(cipher.salt);
    const iv = fromB64(cipher.iv);
    const ct = fromB64(cipher.ct);
    const key = await deriveKey(passphrase, salt);
    let pt: ArrayBuffer;
    try {
      pt = await SUBTLE.decrypt(
        { name: "AES-GCM", iv: iv as unknown as BufferSource },
        key,
        ct as unknown as BufferSource,
      );
    } catch {
      throw new Error("Decryption failed — wrong passphrase?");
    }
    bundle = JSON.parse(new TextDecoder().decode(pt));
  } else {
    bundle = {
      workspace: parsed.workspace,
      connections: parsed.connections ?? [],
    };
  }

  // Verify signature when present
  if (parsed.signature && parsed.publicKey) {
    const signaturePayload = JSON.stringify({
      workspace: bundle.workspace,
      connections: bundle.connections,
      encrypted: !!parsed.encrypted,
    });
    const ok = await window.api.workspaces.verify({
      signaturePayload,
      signature: parsed.signature,
      publicKey: parsed.publicKey,
    });
    if (!ok) {
      console.warn(
        "[workspaces] signature verification failed — file from unknown signer",
      );
    }
  }

  return bundle;
}
