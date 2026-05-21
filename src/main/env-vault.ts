import { ipcMain } from "electron";
import { EncryptedStore } from "./lib/encrypted-store";

/**
 * Scoped environment variables.
 *  - "global"             → injected into every PTY
 *  - "workspace:<id>"     → injected when terminal belongs to workspace <id>
 *  - "host:<id>"          → injected for terminals tied to SSH host <id>
 *
 * Values are encrypted at rest via safeStorage. Keys (variable names) are not.
 */
export type EnvScopeId = string; // "global" | `workspace:${string}` | `host:${string}`

type EnvBag = Record<string, string>;

const store = new EncryptedStore<EnvBag>("env-vault.enc");

export function listEnv(scopeId: EnvScopeId): { key: string; value: string }[] {
  const bag = store.get(scopeId) ?? {};
  return Object.entries(bag)
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function listEnvKeys(scopeId: EnvScopeId): string[] {
  const bag = store.get(scopeId) ?? {};
  return Object.keys(bag).sort();
}

export function listScopes(): EnvScopeId[] {
  return store.keys();
}

export function setEnvVar(
  scopeId: EnvScopeId,
  key: string,
  value: string,
): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    throw new Error(`Invalid env var name: ${key}`);
  }
  const bag = store.get(scopeId) ?? {};
  bag[key] = value;
  store.set(scopeId, bag);
}

export function deleteEnvVar(scopeId: EnvScopeId, key: string): void {
  const bag = store.get(scopeId) ?? {};
  delete bag[key];
  if (Object.keys(bag).length === 0) {
    store.delete(scopeId);
  } else {
    store.set(scopeId, bag);
  }
}

export function clearScope(scopeId: EnvScopeId): void {
  store.delete(scopeId);
}

/**
 * Merge env from multiple scopes in priority order (later scopes override earlier).
 * Always seeds with "global" at the lowest priority.
 */
export function resolveEnv(scopeIds: EnvScopeId[]): EnvBag {
  const ordered = ["global", ...scopeIds.filter((s) => s !== "global")];
  const out: EnvBag = {};
  for (const scope of ordered) {
    const bag = store.get(scope);
    if (bag) Object.assign(out, bag);
  }
  return out;
}

export function setupEnvVaultHandlers(): void {
  ipcMain.handle("env-vault-list-scopes", () => listScopes());

  ipcMain.handle("env-vault-list", (_event, scopeId: EnvScopeId) =>
    listEnv(scopeId),
  );

  ipcMain.handle("env-vault-list-keys", (_event, scopeId: EnvScopeId) =>
    listEnvKeys(scopeId),
  );

  ipcMain.handle(
    "env-vault-set",
    (_event, scopeId: EnvScopeId, key: string, value: string) => {
      setEnvVar(scopeId, key, value);
    },
  );

  ipcMain.handle(
    "env-vault-delete",
    (_event, scopeId: EnvScopeId, key: string) => {
      deleteEnvVar(scopeId, key);
    },
  );

  ipcMain.handle("env-vault-clear-scope", (_event, scopeId: EnvScopeId) => {
    clearScope(scopeId);
  });

  ipcMain.handle("env-vault-resolve", (_event, scopeIds: EnvScopeId[]) =>
    resolveEnv(scopeIds ?? []),
  );
}
