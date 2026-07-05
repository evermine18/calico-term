import { app, BrowserWindow, ipcMain } from "electron";
import { Client, ConnectConfig } from "ssh2";
import { spawn, ChildProcess } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
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
  conn?: SSHConnectionInfo; // the control node (absent for local runs)
  origin: "git" | "path" | "local";
  // git origin
  repoUrl?: string;
  branch?: string;
  deployKeyId?: string; // managed key installed on the node for git auth
  subdir?: string; // playbook root within the repo
  // path origin
  basePath?: string; // existing playbook root on the node
  // local origin (Calico's own machine acts as the control node)
  localPath?: string; // existing playbook root on the local machine
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
  child?: ChildProcess; // local runs spawn ansible-playbook directly
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

// ---- local run (Calico's own machine as the control node) -------------------

// GUI apps launched from Finder/Dock on macOS don't inherit the shell PATH, so
// pip/pipx/homebrew installs of ansible are invisible unless we add the common
// bin dirs ourselves. Also force color off to keep the console readable.
function localAnsibleEnv(): NodeJS.ProcessEnv {
  const extra = [
    "/opt/homebrew/bin",
    "/usr/local/bin",
    `${os.homedir()}/.local/bin`,
    `${os.homedir()}/.local/pipx/venvs/ansible/bin`,
  ];
  const current = process.env.PATH || "";
  const merged = [...extra, current].filter(Boolean).join(path.delimiter);
  return { ...process.env, PATH: merged, ANSIBLE_FORCE_COLOR: "0" };
}

// Directory where Calico keeps generated inventories for local runs.
function localStateDir(): string {
  return path.join(app.getPath("userData"), "ansible");
}

// Spawn ansible-playbook locally, streaming stdout/stderr line-by-line to the
// renderer. Stores the child on the handle so cancel() can kill it.
function spawnLocal(
  handle: RunHandle,
  runId: string,
  args: string[],
  cwd: string,
): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const child = spawn("ansible-playbook", args, {
      cwd,
      env: localAnsibleEnv(),
    });
    handle.child = child;
    let outBuf = "";
    let errBuf = "";
    const flush = (buf: string, kind: "stdout" | "stderr"): string => {
      const lines = buf.split("\n");
      const rest = lines.pop() ?? "";
      for (const l of lines) sendOutput(runId, l, kind);
      return rest;
    };
    child.stdout?.on("data", (c: Buffer) => {
      outBuf += c.toString();
      outBuf = flush(outBuf, "stdout");
    });
    child.stderr?.on("data", (c: Buffer) => {
      errBuf += c.toString();
      errBuf = flush(errBuf, "stderr");
    });
    child.on("error", (err: NodeJS.ErrnoException) => {
      handle.child = undefined;
      const msg =
        err.code === "ENOENT"
          ? "ansible-playbook not found on this machine. Install Ansible " +
            "(e.g. `brew install ansible` or `pipx install ansible`) and restart Calico."
          : err.message;
      reject(new Error(msg));
    });
    child.on("close", (code) => {
      if (outBuf) sendOutput(runId, outBuf, "stdout");
      if (errBuf) sendOutput(runId, errBuf, "stderr");
      handle.child = undefined;
      resolve(code);
    });
  });
}

async function runLocalPlaybook(
  handle: RunHandle,
  payload: AnsibleRunPayload,
): Promise<void> {
  const { runId } = payload;
  const runDir = payload.localPath;
  if (!runDir) throw new Error("Missing local path for local source.");
  if (!fs.existsSync(runDir))
    throw new Error(`Local path not found: ${runDir}`);

  sendStatus(runId, "preparing");

  // Resolve the inventory.
  let inventoryRef: string;
  if (payload.inventoryMode === "auto") {
    const ini = buildAnsibleInventory(payload.inventoryHosts ?? []);
    const dir = localStateDir();
    fs.mkdirSync(dir, { recursive: true });
    const invPath = path.join(dir, `inventory-${payload.sourceId}.ini`);
    fs.writeFileSync(invPath, ini, { mode: 0o644 });
    inventoryRef = invPath;
  } else {
    inventoryRef = payload.inventoryFile || "inventory";
  }

  if (handle.cancelled) return;

  const args = ["-i", inventoryRef, payload.playbook, "--diff"];
  if (payload.check) args.push("--check");
  if (payload.limit) args.push("--limit", payload.limit);
  if (payload.extraVars) args.push("-e", payload.extraVars);

  sendStatus(runId, "running");
  sendOutput(runId, `$ ansible-playbook ${args.join(" ")}`, "stdout");
  sendOutput(
    runId,
    `[local · run dir: ${runDir} · inventory: ${inventoryRef}${payload.check ? " · dry-run" : ""}]`,
    "stdout",
  );

  const code = await spawnLocal(handle, runId, args, runDir);
  if (handle.cancelled) return;
  sendStatus(runId, code === 0 ? "done" : "error");
  emit("ansible-run-done", { runId, code });
}

// Probe whether ansible-playbook is available on the local machine. Drives the
// "Local machine" option in the source form.
function checkLocalAnsible(): Promise<{
  available: boolean;
  version?: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    let child: ChildProcess;
    try {
      child = spawn("ansible-playbook", ["--version"], {
        env: localAnsibleEnv(),
      });
    } catch (err) {
      resolve({
        available: false,
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }
    let out = "";
    child.stdout?.on("data", (c: Buffer) => (out += c.toString()));
    child.on("error", (err: NodeJS.ErrnoException) => {
      resolve({
        available: false,
        error:
          err.code === "ENOENT"
            ? "ansible-playbook not found in PATH"
            : err.message,
      });
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ available: true, version: out.split("\n")[0]?.trim() });
      } else {
        resolve({ available: false });
      }
    });
  });
}

async function runPlaybook(payload: AnsibleRunPayload): Promise<void> {
  const { runId } = payload;
  const handle: RunHandle = { clients: [], cancelled: false };
  runs.set(runId, handle);
  try {
    if (payload.origin === "local") {
      await runLocalPlaybook(handle, payload);
      return;
    }
    if (!payload.conn) throw new Error("Missing control node for remote run.");
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
    handle.child?.kill("SIGKILL");
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

// ---- playbook discovery -----------------------------------------------------

export type AnsibleScanPayload = {
  sourceId: string;
  origin: "git" | "path" | "local";
  conn?: SSHConnectionInfo;
  subdir?: string;
  basePath?: string;
  localPath?: string;
};

// A file is treated as a playbook if it has a top-level `hosts:` (optionally as
// the first list item) or an `import_playbook:`. Cheap heuristic over the first
// few KB — good enough to separate plays from vars/inventory/role task files.
const PLAYBOOK_MARKER = /^[ \t]*(-[ \t]+)?(hosts|import_playbook)[ \t]*:/m;

// Directories that never contain top-level playbooks worth listing.
const SCAN_SKIP_DIRS = new Set([
  "roles",
  "group_vars",
  "host_vars",
  "molecule",
  "collections",
  "node_modules",
  "vars",
  "defaults",
  "tasks",
  "handlers",
]);

function scanLocalPlaybooks(root: string): string[] {
  const results: string[] = [];
  const walk = (dir: string, depth: number): void => {
    if (depth > 4) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (SCAN_SKIP_DIRS.has(e.name)) continue;
        walk(full, depth + 1);
      } else if (/\.ya?ml$/i.test(e.name)) {
        try {
          const content = fs.readFileSync(full, "utf8").slice(0, 4096);
          if (PLAYBOOK_MARKER.test(content)) {
            results.push(path.relative(root, full));
          }
        } catch {
          /* unreadable file — skip */
        }
      }
    }
  };
  walk(root, 0);
  return results.sort();
}

// Scan a directory on the control node with a single portable shell pipeline:
// grep for the playbook markers, strip the leading "./", and drop paths that
// live inside role/vars-style subdirs.
async function scanRemotePlaybooks(
  conn: SSHConnectionInfo,
  runDir: string,
): Promise<string[]> {
  const clients = await connectControlNode(conn);
  try {
    const skip = [...SCAN_SKIP_DIRS].join("|");
    const cmd =
      `cd ${shQuote(runDir)} 2>/dev/null && ` +
      `grep -rlE '^[[:space:]]*(-[[:space:]]+)?(hosts|import_playbook)[[:space:]]*:' ` +
      `--include='*.yml' --include='*.yaml' . 2>/dev/null ` +
      `| sed 's|^\\./||' ` +
      `| grep -vE '(^|/)(${skip})/' ` +
      `| sort`;
    const res = await execCapture(clients[0], cmd);
    return res.out
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } finally {
    closeClients(clients);
  }
}

async function scanPlaybooks(
  payload: AnsibleScanPayload,
): Promise<{ ok: boolean; playbooks: string[]; error?: string }> {
  try {
    if (payload.origin === "local") {
      if (!payload.localPath)
        return { ok: false, playbooks: [], error: "No local path set." };
      if (!fs.existsSync(payload.localPath))
        return {
          ok: false,
          playbooks: [],
          error: `Local path not found: ${payload.localPath}`,
        };
      return { ok: true, playbooks: scanLocalPlaybooks(payload.localPath) };
    }
    if (!payload.conn)
      return { ok: false, playbooks: [], error: "No control node." };
    let runDir: string;
    if (payload.origin === "git") {
      const repoDir = `${REMOTE_BASE}/repos/${payload.sourceId}`;
      runDir = payload.subdir ? `${repoDir}/${payload.subdir}` : repoDir;
    } else {
      if (!payload.basePath)
        return { ok: false, playbooks: [], error: "No base path set." };
      runDir = payload.basePath;
    }
    const playbooks = await scanRemotePlaybooks(payload.conn, runDir);
    return { ok: true, playbooks };
  } catch (err) {
    return {
      ok: false,
      playbooks: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---- inventory introspection (populates the --limit picker) -----------------

export type AnsibleInventoryQuery = {
  sourceId: string;
  origin: "git" | "path" | "local";
  conn?: SSHConnectionInfo;
  subdir?: string;
  basePath?: string;
  localPath?: string;
  inventoryMode: "auto" | "file";
  inventoryFile?: string;
  inventoryHosts?: AnsibleInventoryHost[];
};

// Extract selectable --limit targets from `ansible-inventory --list` JSON:
// every group name (minus the implicit all/ungrouped) and every host.
function parseInventoryJson(json: string): {
  groups: string[];
  hosts: string[];
} {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(json);
  } catch {
    return { groups: [], hosts: [] };
  }
  const keys = Object.keys(data).filter((k) => k !== "_meta");
  const hostSet = new Set<string>();
  const meta = data._meta as { hostvars?: Record<string, unknown> } | undefined;
  if (meta?.hostvars) for (const h of Object.keys(meta.hostvars)) hostSet.add(h);
  for (const k of keys) {
    const grp = data[k] as { hosts?: unknown };
    if (Array.isArray(grp?.hosts)) for (const h of grp.hosts) hostSet.add(h);
  }
  return {
    groups: keys.filter((g) => g !== "all" && g !== "ungrouped").sort(),
    hosts: [...hostSet].sort(),
  };
}

// Spawn a local command and capture its full output (no streaming).
function spawnCapture(
  cmd: string,
  args: string[],
  cwd: string,
): Promise<{ code: number | null; out: string; err: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env: localAnsibleEnv() });
    let out = "";
    let err = "";
    child.stdout?.on("data", (c: Buffer) => (out += c.toString()));
    child.stderr?.on("data", (c: Buffer) => (err += c.toString()));
    child.on("error", (e: Error) => resolve({ code: null, out, err: err || e.message }));
    child.on("close", (code) => resolve({ code, out, err }));
  });
}

async function listInventory(payload: AnsibleInventoryQuery): Promise<{
  ok: boolean;
  groups: string[];
  hosts: string[];
  error?: string;
}> {
  try {
    if (payload.origin === "local") {
      const runDir = payload.localPath;
      if (!runDir || !fs.existsSync(runDir))
        return { ok: false, groups: [], hosts: [], error: "Local path not found." };
      let inv: string;
      if (payload.inventoryMode === "auto") {
        const ini = buildAnsibleInventory(payload.inventoryHosts ?? []);
        const dir = localStateDir();
        fs.mkdirSync(dir, { recursive: true });
        inv = path.join(dir, `inventory-${payload.sourceId}.ini`);
        fs.writeFileSync(inv, ini, { mode: 0o644 });
      } else {
        inv = payload.inventoryFile || "inventory";
      }
      const res = await spawnCapture(
        "ansible-inventory",
        ["-i", inv, "--list"],
        runDir,
      );
      if (res.code !== 0)
        return {
          ok: false,
          groups: [],
          hosts: [],
          error: res.err.trim() || "ansible-inventory failed",
        };
      return { ok: true, ...parseInventoryJson(res.out) };
    }

    if (!payload.conn)
      return { ok: false, groups: [], hosts: [], error: "No control node." };
    let runDir: string;
    if (payload.origin === "git") {
      const repoDir = `${REMOTE_BASE}/repos/${payload.sourceId}`;
      runDir = payload.subdir ? `${repoDir}/${payload.subdir}` : repoDir;
    } else {
      if (!payload.basePath)
        return { ok: false, groups: [], hosts: [], error: "No base path set." };
      runDir = payload.basePath;
    }
    const clients = await connectControlNode(payload.conn);
    try {
      const client = clients[0];
      let invRef: string;
      if (payload.inventoryMode === "auto") {
        const ini = buildAnsibleInventory(payload.inventoryHosts ?? []);
        invRef = `${REMOTE_BASE}/inventory-${payload.sourceId}.ini`;
        await remoteWriteFile(client, invRef, ini, "644");
      } else {
        invRef = payload.inventoryFile || "inventory";
      }
      const cmd =
        `export PATH="$HOME/.local/bin:$PATH"; ` +
        `cd ${shQuote(runDir)} && ansible-inventory -i ${shQuote(invRef)} --list`;
      const res = await execCapture(client, cmd);
      if (res.code !== 0)
        return {
          ok: false,
          groups: [],
          hosts: [],
          error: res.out.trim() || "ansible-inventory failed",
        };
      return { ok: true, ...parseInventoryJson(res.out) };
    } finally {
      closeClients(clients);
    }
  } catch (err) {
    return {
      ok: false,
      groups: [],
      hosts: [],
      error: err instanceof Error ? err.message : String(err),
    };
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

  ipcMain.handle("ansible-check-local", async () => checkLocalAnsible());

  ipcMain.handle(
    "ansible-list-playbooks",
    async (_e, payload: AnsibleScanPayload) => scanPlaybooks(payload),
  );

  ipcMain.handle(
    "ansible-list-inventory",
    async (_e, payload: AnsibleInventoryQuery) => listInventory(payload),
  );

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
