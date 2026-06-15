import http from "http";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { app, BrowserWindow, ipcMain } from "electron";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  listManagedTerminals,
  getTerminalOutput,
  writeToTerminal,
  runCapturedCommand,
} from "./terminal";

// ---------------------------------------------------------------------------
// Config (persisted to userData/mcp-config.json)
// ---------------------------------------------------------------------------

export interface McpConfig {
  /** Whether the local MCP server is running. */
  enabled: boolean;
  /** Whether the approval dialog may offer an "Allow all this session" button. */
  allowAcceptAll: boolean;
  /** Localhost port the server binds to. */
  port: number;
  /** Bearer token a client must present. */
  token: string;
}

function configPath(): string {
  return path.join(app.getPath("userData"), "mcp-config.json");
}

function genToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

function loadConfig(): McpConfig {
  try {
    const raw = JSON.parse(fs.readFileSync(configPath(), "utf8"));
    return {
      enabled: !!raw.enabled,
      allowAcceptAll: !!raw.allowAcceptAll,
      port:
        typeof raw.port === "number" && raw.port >= 1024 && raw.port <= 65535
          ? raw.port
          : 8765,
      token: typeof raw.token === "string" && raw.token ? raw.token : genToken(),
    };
  } catch {
    return { enabled: false, allowAcceptAll: false, port: 8765, token: genToken() };
  }
}

function saveConfig(c: McpConfig): void {
  fs.writeFileSync(configPath(), JSON.stringify(c), {
    encoding: "utf8",
    mode: 0o600,
  });
}

let config: McpConfig;

// ---------------------------------------------------------------------------
// Approval flow — mirrors the guardrail prompt: main asks the renderer, the
// user clicks Allow / Deny / Allow-all, the renderer resolves by id.
// ---------------------------------------------------------------------------

type Decision = "allow" | "deny" | "allow-all";

const pending = new Map<string, (d: Decision) => void>();
// Set once the user clicks "Allow all this session" (only offered when
// config.allowAcceptAll is on). Reset whenever the server stops.
let sessionAllowAll = false;

const APPROVAL_TIMEOUT_MS = 120_000;

function broadcast(channel: string, payload: unknown): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send(channel, payload);
  }
}

function requestApproval(input: {
  tool: string;
  tabId: string;
  title: string;
  detail: string;
}): Promise<boolean> {
  if (sessionAllowAll) return Promise.resolve(true);
  if (BrowserWindow.getAllWindows().length === 0) return Promise.resolve(false);

  const id = crypto.randomBytes(8).toString("hex");
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve(false);
    }, APPROVAL_TIMEOUT_MS);

    pending.set(id, (decision) => {
      clearTimeout(timer);
      if (decision === "allow-all") {
        if (config.allowAcceptAll) sessionAllowAll = true;
        resolve(true);
      } else {
        resolve(decision === "allow");
      }
    });

    broadcast("mcp-approval-prompt", {
      id,
      tool: input.tool,
      tabId: input.tabId,
      title: input.title,
      detail: input.detail,
      allowAcceptAll: config.allowAcceptAll,
    });
  });
}

// ---------------------------------------------------------------------------
// Tool result helpers
// ---------------------------------------------------------------------------

function text(t: string) {
  return { content: [{ type: "text" as const, text: t }] };
}
function errorText(t: string) {
  return { content: [{ type: "text" as const, text: t }], isError: true };
}
const DENIED = () => errorText("Denied by the user in Calico Term.");

function titleFor(tabId: string): string {
  return listManagedTerminals().find((t) => t.tabId === tabId)?.title ?? tabId;
}

// ---------------------------------------------------------------------------
// MCP server (stateless — a fresh instance per request)
// ---------------------------------------------------------------------------

function buildServer(): McpServer {
  const mcp = new McpServer({ name: "calico-term", version: app.getVersion() });

  mcp.registerTool(
    "list_terminals",
    {
      title: "List terminals",
      description:
        "List the open terminal tabs in Calico Term (id, title, whether it is an SSH session). Use a tabId from here with the other tools.",
    },
    async () => text(JSON.stringify(listManagedTerminals(), null, 2)),
  );

  mcp.registerTool(
    "read_terminal",
    {
      title: "Read terminal output",
      description:
        "Read recent output (plain text, ANSI stripped) from a terminal tab. Requires user approval in Calico Term.",
      inputSchema: {
        tabId: z.string().describe("Tab id from list_terminals"),
        maxChars: z
          .number()
          .int()
          .positive()
          .max(50000)
          .optional()
          .describe("Max characters to return (default 8000)"),
      },
    },
    async ({ tabId, maxChars }) => {
      const ok = await requestApproval({
        tool: "read_terminal",
        tabId,
        title: titleFor(tabId),
        detail: "Read recent terminal output",
      });
      if (!ok) return DENIED();
      const out = getTerminalOutput(tabId, maxChars ?? 8000);
      if (out === null) return errorText(`No terminal with id ${tabId}`);
      return text(out || "(no output captured yet)");
    },
  );

  mcp.registerTool(
    "execute_command",
    {
      title: "Execute command",
      description:
        "Run a shell command in a terminal tab and return its output and exit code. The command runs in the tab's live shell (including the remote side of an SSH session). Supports POSIX shells (bash/zsh/sh) and Windows PowerShell; do NOT use for interactive/TUI programs — use send_keys for those. Requires user approval in Calico Term.",
      inputSchema: {
        tabId: z.string().describe("Tab id from list_terminals"),
        command: z.string().describe("Shell command to run"),
        timeoutMs: z
          .number()
          .int()
          .positive()
          .max(120000)
          .optional()
          .describe("Max ms to wait for completion (default 20000)"),
      },
    },
    async ({ tabId, command, timeoutMs }) => {
      const ok = await requestApproval({
        tool: "execute_command",
        tabId,
        title: titleFor(tabId),
        detail: command,
      });
      if (!ok) return DENIED();
      const res = await runCapturedCommand(tabId, command, timeoutMs ?? 20000);
      if (res === null) return errorText(`No terminal with id ${tabId}`);
      if (res.busy)
        return errorText(`Terminal ${tabId} is busy running another command.`);
      const header = res.timedOut
        ? `(timed out after ${timeoutMs ?? 20000}ms — partial output; the command may still be running)`
        : `(exit code: ${res.exitCode ?? "unknown"})`;
      return text(`${header}\n${res.output}`);
    },
  );

  mcp.registerTool(
    "send_keys",
    {
      title: "Send keystrokes",
      description:
        "Send raw keystrokes/input to a terminal tab without waiting for completion. Use for interactive prompts and TUIs (answering a prompt, sending Ctrl-C as \\u0003, navigating k9s/vim, etc.). Append \\r to submit a line. Requires user approval in Calico Term.",
      inputSchema: {
        tabId: z.string().describe("Tab id from list_terminals"),
        keys: z
          .string()
          .describe("Raw bytes to write to the PTY (e.g. 'y\\r', or '\\u0003' for Ctrl-C)"),
      },
    },
    async ({ tabId, keys }) => {
      const ok = await requestApproval({
        tool: "send_keys",
        tabId,
        title: titleFor(tabId),
        detail: JSON.stringify(keys),
      });
      if (!ok) return DENIED();
      const wrote = writeToTerminal(tabId, keys);
      if (!wrote)
        return errorText(
          `No terminal with id ${tabId} (or it is awaiting a guardrail confirmation).`,
        );
      return text("ok");
    },
  );

  return mcp;
}

// ---------------------------------------------------------------------------
// HTTP server (localhost only, bearer auth, Origin-checked)
// ---------------------------------------------------------------------------

let httpServer: http.Server | null = null;

function isLocalOrigin(origin?: string): boolean {
  // Non-browser clients (e.g. Claude Code) send no Origin header — allow those.
  if (!origin) return true;
  try {
    const u = new URL(origin);
    return (
      u.hostname === "127.0.0.1" ||
      u.hostname === "localhost" ||
      u.hostname === "::1"
    );
  } catch {
    return false;
  }
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return undefined;
  return JSON.parse(raw);
}

function startServer(): void {
  if (httpServer) return;
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (url.pathname !== "/mcp") {
        res.writeHead(404).end();
        return;
      }
      if (!isLocalOrigin(req.headers.origin)) {
        res.writeHead(403).end();
        return;
      }
      if (req.headers["authorization"] !== `Bearer ${config.token}`) {
        res
          .writeHead(401, { "content-type": "application/json" })
          .end(
            JSON.stringify({
              jsonrpc: "2.0",
              error: { code: -32001, message: "Unauthorized" },
              id: null,
            }),
          );
        return;
      }
      if (req.method !== "POST") {
        // Stateless server: only POST is supported (no server-initiated SSE).
        res.writeHead(405, { allow: "POST" }).end();
        return;
      }

      const body = await readJsonBody(req);
      const mcp = buildServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      res.on("close", () => {
        void transport.close();
        void mcp.close();
      });
      await mcp.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (err) {
      console.error("[mcp] request error", err);
      if (!res.headersSent) res.writeHead(500).end();
    }
  });
  server.on("error", (err) => console.error("[mcp] server error", err));
  server.listen(config.port, "127.0.0.1", () =>
    console.log(`[mcp] listening on 127.0.0.1:${config.port}`),
  );
  httpServer = server;
}

function stopServer(): void {
  httpServer?.close();
  httpServer = null;
  sessionAllowAll = false;
}

function status(): McpConfig & { running: boolean; url: string } {
  return {
    ...config,
    running: !!httpServer,
    url: `http://127.0.0.1:${config.port}/mcp`,
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

export function setupMcp(): void {
  config = loadConfig();
  if (config.enabled) startServer();

  ipcMain.handle("mcp-get-config", () => status());

  ipcMain.handle("mcp-set-config", (_e, patch: Partial<McpConfig>) => {
    const wasEnabled = config.enabled;
    const prevPort = config.port;
    if (typeof patch.enabled === "boolean") config.enabled = patch.enabled;
    if (typeof patch.allowAcceptAll === "boolean")
      config.allowAcceptAll = patch.allowAcceptAll;
    if (
      typeof patch.port === "number" &&
      patch.port >= 1024 &&
      patch.port <= 65535
    )
      config.port = patch.port;
    saveConfig(config);

    if (!config.allowAcceptAll) sessionAllowAll = false;

    if (!config.enabled) {
      stopServer();
    } else if (!wasEnabled || prevPort !== config.port) {
      stopServer();
      startServer();
    }
    return status();
  });

  ipcMain.handle("mcp-regenerate-token", () => {
    config.token = genToken();
    saveConfig(config);
    if (config.enabled) {
      stopServer();
      startServer();
    }
    return status();
  });

  ipcMain.on("mcp-approval-resolve", (_e, id: string, decision: Decision) => {
    const fn = pending.get(id);
    if (fn) {
      pending.delete(id);
      fn(decision);
    }
  });
}

export function stopMcp(): void {
  stopServer();
}
