import { BrowserWindow, ipcMain } from "electron";
import { Client, ConnectConfig } from "ssh2";
import fs from "fs";
import {
  buildAuthConfig,
  connectHop,
  forwardOut,
  SSHConnectionInfo,
} from "./sftp";
import { retrievePassword } from "./terminal";
import { resolveSecret } from "./secret-providers";
import { resolveSSHConnection } from "./ssh-config";
import { getKey } from "./ssh-keys";

// Minimal SSH host shape used to generate an Ansible inventory from the user's
// saved connections.
export type AnsibleInventoryHost = {
  name: string;
  host: string;
  port: number;
  username: string;
  tags?: string[];
};

export type AnsibleRunPayload = {
  runId: string;
  sourceId: string; // stable id → stable checkout/inventory paths on the node
  conn: SSHConnectionInfo; // the control node
  origin: "git" | "path";
  // git origin
  repoUrl?: string;
  branch?: string;
  deployKeyId?: string; // managed key installed on the node for git auth
  subdir?: string; // playbook root within the repo
  // path origin
  basePath?: string; // existing playbook root on the node
  // common
  playbook: string; // path relative to the run dir
  inventoryMode: "auto" | "file";
  inventoryFile?: string; // relative to run dir when mode === "file"
  inventoryHosts?: AnsibleInventoryHost[]; // source for mode === "auto"
  limit?: string;
  extraVars?: string; // raw value for -e
  check?: boolean; // dry-run
};

// Base directory on the control node where Calico keeps its working state.
const REMOTE_BASE = "$HOME/.calico/ansible";

type RunHandle = {
  clients: Client[];
  stream?: NodeJS.ReadableStream & {
    close?: () => void;
    signal?: (s: string) => void;
  };
  cancelled: boolean;
};

const runs = new Map<string, RunHandle>();

// ---- connection (mirrors host-metrics/sftp; the codebase duplicates this) ---

async function establishClients(conn: SSHConnectionInfo): Promise<Client[]> {
  let password: string | undefined;
  if (conn.credentialId) {
    password = retrievePassword("vault-" + conn.credentialId) ?? undefined;
  } else if (conn.passwordRef) {
    try {
      password = await resolveSecret(
        conn.passwordRef.provider,
        conn.passwordRef.ref,
      );
    } catch {
      /* fall through */
    }
  }
  if (!password) password = retrievePassword(conn.id) ?? undefined;

  const clients: Client[] = [];
  let sock: (NodeJS.ReadableStream & NodeJS.WritableStream) | undefined;
  for (const hop of conn.jumpHosts ?? []) {
    const hopCfg = buildAuthConfig(hop);
    if (sock) (hopCfg as ConnectConfig).sock = sock as any;
    const hopClient = await connectHop(hopCfg);
    clients.push(hopClient);
    const nextTarget = conn.jumpHosts?.[clients.length];
    const target = nextTarget
      ? { host: nextTarget.host, port: nextTarget.port }
      : { host: conn.host, port: conn.port };
    sock = await forwardOut(hopClient, target.host, target.port);
  }
  const targetCfg = buildAuthConfig(conn, password);
  if (sock) (targetCfg as ConnectConfig).sock = sock as any;
  const targetClient = await connectHop(targetCfg);
  clients.unshift(targetClient);
  return clients;
}

function connectControlNode(conn: SSHConnectionInfo): Promise<Client[]> {
  return establishClients(resolveSSHConnection(conn));
}

function closeClients(clients: Client[]): void {
  for (const c of clients) {
    try {
      c.end();
    } catch {
      /* ignore */
    }
  }
}

// ---- exec helpers -----------------------------------------------------------

// Run a command and resolve with combined output + exit code (no streaming).
function execCapture(
  client: Client,
  cmd: string,
): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve, reject) => {
    client.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "";
      stream.on("data", (c: Buffer) => (out += c.toString()));
      stream.stderr.on("data", (c: Buffer) => (out += c.toString()));
      stream.on("close", (code: number | null) => resolve({ code, out }));
    });
  });
}

// Single-quote a value for safe interpolation into a POSIX shell command.
function shQuote(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

// Write text to a remote path via a quoted heredoc (no shell expansion of the
// body). Creates the parent directory and chmods the file.
async function remoteWriteFile(
  client: Client,
  remotePath: string,
  content: string,
  mode = "644",
): Promise<void> {
  const delim = "CALICO_EOF_" + Math.abs(hashString(remotePath + content));
  const dir = remotePath.replace(/\/[^/]*$/, "");
  const cmd =
    `mkdir -p ${dir} && cat > ${remotePath} <<'${delim}'\n` +
    content +
    (content.endsWith("\n") ? "" : "\n") +
    `${delim}\n` +
    `chmod ${mode} ${remotePath}`;
  const res = await execCapture(client, cmd);
  if (res.code !== 0)
    throw new Error(`Failed writing ${remotePath}: ${res.out.trim()}`);
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

// ---- inventory generation ---------------------------------------------------

function sanitizeAnsibleGroup(tag: string): string {
  return tag
    .trim()
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/^(\d)/, "_$1");
}

function ansibleHostAlias(h: AnsibleInventoryHost): string {
  const base = (h.name || h.host || "host")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9._-]/g, "");
  return base || h.host || "host";
}

// Build an INI inventory from saved SSH connections. Untagged hosts go at the
// top (Ansible's implicit "ungrouped"); each tag becomes a [group]. Private-key
// paths are NOT emitted — they live on the local machine, not the control node.
export function buildAnsibleInventory(hosts: AnsibleInventoryHost[]): string {
  const line = (h: AnsibleInventoryHost): string => {
    const fields = [`ansible_host=${h.host}`, `ansible_port=${h.port || 22}`];
    if (h.username) fields.push(`ansible_user=${h.username}`);
    return `${ansibleHostAlias(h)} ${fields.join(" ")}`;
  };
  const groups = new Map<string, AnsibleInventoryHost[]>();
  for (const h of hosts) {
    for (const t of h.tags ?? []) {
      const g = sanitizeAnsibleGroup(t);
      if (!g) continue;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(h);
    }
  }
  const out = ["# Generated by Calico Term from your saved SSH connections."];
  const untagged = hosts.filter((h) => !h.tags || h.tags.length === 0);
  for (const h of untagged) out.push(line(h));
  if (untagged.length) out.push("");
  for (const [group, members] of groups) {
    out.push(`[${group}]`);
    for (const h of members) out.push(line(h));
    out.push("");
  }
  return out.join("\n").trim() + "\n";
}

// ---- deploy key install -----------------------------------------------------

// Install a managed private key onto the control node and return the remote
// path plus a GIT_SSH_COMMAND that uses it. Used so the control node can clone
// private repos with a key the user has registered on their git host.
async function installDeployKey(
  client: Client,
  keyId: string,
): Promise<{ remoteKeyPath: string; gitSshCommand: string }> {
  const meta = getKey(keyId);
  if (!meta) throw new Error(`Deploy key not found: ${keyId}`);
  const privatePem = fs.readFileSync(meta.privatePath, "utf8");
  const remoteKeyPath = `${REMOTE_BASE}/keys/${keyId}`;
  await remoteWriteFile(client, `${REMOTE_BASE}/keys/.keep`, "", "644");
  await remoteWriteFile(client, remoteKeyPath, privatePem, "600");
  const knownHosts = `${REMOTE_BASE}/known_hosts`;
  const gitSshCommand =
    `ssh -i ${remoteKeyPath} -o StrictHostKeyChecking=accept-new ` +
    `-o UserKnownHostsFile=${knownHosts}`;
  return { remoteKeyPath, gitSshCommand };
}

// ---- streaming run ----------------------------------------------------------

function emit(channel: string, payload: unknown): void {
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send(channel, payload);
  }
}

function sendOutput(
  runId: string,
  line: string,
  stream: "stdout" | "stderr",
): void {
  emit("ansible-run-output", { runId, line, stream });
}

function sendStatus(runId: string, phase: string): void {
  emit("ansible-run-status", { runId, phase });
}

// Stream a command's stdout/stderr line-by-line to the renderer, resolving with
// the exit code. Stores the live stream on the run handle so cancel() can kill it.
function streamExec(
  handle: RunHandle,
  client: Client,
  runId: string,
  cmd: string,
): Promise<number | null> {
  return new Promise((resolve, reject) => {
    client.exec(cmd, { pty: true }, (err, stream) => {
      if (err) return reject(err);
      handle.stream = stream as any;
      let outBuf = "";
      let errBuf = "";
      const flush = (buf: string, kind: "stdout" | "stderr"): string => {
        const lines = buf.split("\n");
        const rest = lines.pop() ?? "";
        for (const l of lines) sendOutput(runId, l, kind);
        return rest;
      };
      stream.on("data", (c: Buffer) => {
        outBuf += c.toString();
        outBuf = flush(outBuf, "stdout");
      });
      stream.stderr.on("data", (c: Buffer) => {
        errBuf += c.toString();
        errBuf = flush(errBuf, "stderr");
      });
      stream.on("close", (code: number | null) => {
        if (outBuf) sendOutput(runId, outBuf, "stdout");
        if (errBuf) sendOutput(runId, errBuf, "stderr");
        handle.stream = undefined;
        resolve(code);
      });
    });
  });
}

// Build the git prepare command: clone on first run, otherwise fetch + hard
// reset to the requested branch.
function gitPrepareCmd(
  repoDir: string,
  repoUrl: string,
  branch: string,
  gitSshCommand?: string,
): string {
  const env = gitSshCommand
    ? `export GIT_SSH_COMMAND=${shQuote(gitSshCommand)}; `
    : "";
  const b = shQuote(branch);
  const url = shQuote(repoUrl);
  return (
    env +
    `if [ -d ${repoDir}/.git ]; then ` +
    `cd ${repoDir} && git fetch --all --prune && git checkout ${b} && ` +
    `git reset --hard origin/${b}; ` +
    `else git clone --branch ${b} ${url} ${repoDir} || git clone ${url} ${repoDir}; fi`
  );
}

async function runPlaybook(payload: AnsibleRunPayload): Promise<void> {
  const { runId } = payload;
  const handle: RunHandle = { clients: [], cancelled: false };
  runs.set(runId, handle);
  try {
    sendStatus(runId, "connecting");
    const clients = await connectControlNode(payload.conn);
    handle.clients = clients;
    if (handle.cancelled) return;
    const client = clients[0];

    let gitSshCommand: string | undefined;
    if (payload.origin === "git" && payload.deployKeyId) {
      sendStatus(runId, "installing-key");
      const dk = await installDeployKey(client, payload.deployKeyId);
      gitSshCommand = dk.gitSshCommand;
    }

    // Resolve the directory the playbook runs from.
    let runDir: string;
    if (payload.origin === "git") {
      if (!payload.repoUrl) throw new Error("Missing repoUrl for git source.");
      const repoDir = `${REMOTE_BASE}/repos/${payload.sourceId}`;
      sendStatus(runId, "syncing-repo");
      const prep = await streamExec(
        handle,
        client,
        runId,
        gitPrepareCmd(
          repoDir,
          payload.repoUrl,
          payload.branch || "main",
          gitSshCommand,
        ),
      );
      if (handle.cancelled) return;
      if (prep !== 0) {
        sendStatus(runId, "error");
        emit("ansible-run-done", {
          runId,
          code: prep,
          error: "git clone/update failed",
        });
        return;
      }
      runDir = payload.subdir ? `${repoDir}/${payload.subdir}` : repoDir;
    } else {
      if (!payload.basePath)
        throw new Error("Missing basePath for path source.");
      runDir = payload.basePath;
    }

    // Resolve the inventory.
    let inventoryRef: string;
    if (payload.inventoryMode === "auto") {
      const ini = buildAnsibleInventory(payload.inventoryHosts ?? []);
      const invPath = `${REMOTE_BASE}/inventory-${payload.sourceId}.ini`;
      await remoteWriteFile(client, invPath, ini, "644");
      inventoryRef = invPath;
    } else {
      inventoryRef = payload.inventoryFile || "inventory";
    }

    if (handle.cancelled) return;

    // Assemble the ansible-playbook command.
    const parts = [
      "ansible-playbook",
      "-i",
      shQuote(inventoryRef),
      shQuote(payload.playbook),
      "--diff",
    ];
    if (payload.check) parts.push("--check");
    if (payload.limit) parts.push("--limit", shQuote(payload.limit));
    if (payload.extraVars) parts.push("-e", shQuote(payload.extraVars));
    // Prepend ~/.local/bin so pip-installed ansible is found; force color off.
    const cmd =
      `export PATH="$HOME/.local/bin:$PATH"; export ANSIBLE_FORCE_COLOR=0; ` +
      `cd ${runDir} && ${parts.join(" ")}`;

    sendStatus(runId, "running");
    sendOutput(runId, `$ ${parts.join(" ")}`, "stdout");
    sendOutput(
      runId,
      `[run dir: ${runDir} · inventory: ${inventoryRef}${payload.check ? " · dry-run" : ""}]`,
      "stdout",
    );
    const code = await streamExec(handle, client, runId, cmd);
    if (handle.cancelled) return;
    sendStatus(runId, code === 0 ? "done" : "error");
    emit("ansible-run-done", { runId, code });
  } catch (err) {
    sendStatus(runId, "error");
    emit("ansible-run-done", {
      runId,
      code: null,
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    closeClients(handle.clients);
    runs.delete(runId);
  }
}

function cancelRun(runId: string): void {
  const handle = runs.get(runId);
  if (!handle) return;
  handle.cancelled = true;
  try {
    handle.stream?.signal?.("KILL");
    handle.stream?.close?.();
  } catch {
    /* ignore */
  }
  closeClients(handle.clients);
  runs.delete(runId);
  emit("ansible-run-done", { runId, code: null, error: "cancelled" });
}

// Connect, optionally install the deploy key, and `git ls-remote` to confirm
// the control node can reach the repo. Used by the "Test access" UI action.
async function testGitAccess(
  conn: SSHConnectionInfo,
  repoUrl: string,
  deployKeyId?: string,
): Promise<{ ok: boolean; output: string }> {
  const clients = await connectControlNode(conn);
  try {
    const client = clients[0];
    let gitSshCommand: string | undefined;
    if (deployKeyId) {
      const dk = await installDeployKey(client, deployKeyId);
      gitSshCommand = dk.gitSshCommand;
    }
    const env = gitSshCommand
      ? `export GIT_SSH_COMMAND=${shQuote(gitSshCommand)}; `
      : "";
    const res = await execCapture(
      client,
      `${env}git ls-remote ${shQuote(repoUrl)} HEAD`,
    );
    return { ok: res.code === 0, output: res.out.trim() };
  } finally {
    closeClients(clients);
  }
}

export function setupAnsibleHandlers(): void {
  ipcMain.handle(
    "ansible-run-start",
    async (_e, payload: AnsibleRunPayload) => {
      // Fire-and-forget; progress streams over ansible-run-* events.
      runPlaybook(payload);
      return { ok: true };
    },
  );

  ipcMain.on("ansible-run-cancel", (_e, runId: string) => {
    cancelRun(runId);
  });

  ipcMain.handle(
    "ansible-test-git",
    async (
      _e,
      conn: SSHConnectionInfo,
      repoUrl: string,
      deployKeyId?: string,
    ) => {
      try {
        return await testGitAccess(conn, repoUrl, deployKeyId);
      } catch (err) {
        return {
          ok: false,
          output: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );
}
