import { ipcMain } from "electron";
import { execFile } from "child_process";
import { promisify } from "util";

const exec = promisify(execFile);

export type SecretProvider = "op" | "bw" | "vault" | "aws";

export type SecretRef = {
  provider: SecretProvider;
  ref: string;
};

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { value: string; expires: number }>();

function cacheKey(p: SecretProvider, ref: string): string {
  return `${p}::${ref}`;
}

async function resolve1Password(ref: string): Promise<string> {
  // ref: "op://Vault/Item/field" — `op read` returns the field value
  const { stdout } = await exec("op", ["read", ref], { timeout: 15_000 });
  return stdout.trim();
}

async function resolveBitwarden(ref: string): Promise<string> {
  // Conventions:
  //   "<itemId-or-name>"             → return .login.password
  //   "<itemId-or-name>#<field>"     → return matching custom field value, or .login.<field>
  const [target, field] = ref.split("#");
  const { stdout } = await exec("bw", ["get", "item", target], {
    timeout: 15_000,
  });
  const item = JSON.parse(stdout);
  if (!field) return item?.login?.password ?? "";
  if (field === "username") return item?.login?.username ?? "";
  const custom = (item?.fields ?? []).find(
    (f: { name: string }) => f.name === field,
  );
  if (custom) return custom.value ?? "";
  return item?.login?.[field] ?? "";
}

async function resolveVault(ref: string): Promise<string> {
  // Conventions:
  //   "<path>"           → returns .data.data.password (KVv2 default)
  //   "<path>#<field>"   → returns .data.data.<field>
  const [secretPath, field] = ref.split("#");
  const { stdout } = await exec(
    "vault",
    ["kv", "get", "-format=json", secretPath],
    { timeout: 15_000 },
  );
  const parsed = JSON.parse(stdout);
  const data = parsed?.data?.data ?? parsed?.data ?? {};
  return data[field ?? "password"] ?? "";
}

async function resolveAWS(ref: string): Promise<string> {
  // Conventions:
  //   "<secretId>"           → returns SecretString verbatim (or JSON .password if JSON)
  //   "<secretId>#<field>"   → returns parsed-JSON SecretString[field]
  const [secretId, field] = ref.split("#");
  const { stdout } = await exec(
    "aws",
    [
      "secretsmanager",
      "get-secret-value",
      "--secret-id",
      secretId,
      "--query",
      "SecretString",
      "--output",
      "text",
    ],
    { timeout: 15_000 },
  );
  const raw = stdout.trim();
  if (!field) {
    try {
      const j = JSON.parse(raw);
      return j.password ?? raw;
    } catch {
      return raw;
    }
  }
  try {
    return JSON.parse(raw)[field] ?? "";
  } catch {
    return "";
  }
}

export async function resolveSecret(
  provider: SecretProvider,
  ref: string,
): Promise<string> {
  const key = cacheKey(provider, ref);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;

  let value = "";
  switch (provider) {
    case "op":
      value = await resolve1Password(ref);
      break;
    case "bw":
      value = await resolveBitwarden(ref);
      break;
    case "vault":
      value = await resolveVault(ref);
      break;
    case "aws":
      value = await resolveAWS(ref);
      break;
  }
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
}

export function setupSecretProviderHandlers(): void {
  ipcMain.handle(
    "secret-resolve",
    async (_event, provider: SecretProvider, ref: string) => {
      try {
        const value = await resolveSecret(provider, ref);
        return { ok: true, hasValue: value.length > 0 };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: message };
      }
    },
  );
}
