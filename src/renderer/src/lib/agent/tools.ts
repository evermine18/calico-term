// Agent tool registry. Tools execute in the renderer because they call
// window.api.* IPC bridges and the active TerminalAPI. Schemas are sent
// to the main process which forwards them to the LLM provider.

import type { ToolCall } from "@renderer/components/ai/chat/conversation-types";

export type RiskLevel = "safe" | "risky";

export interface ToolSpec {
  name: string;
  description: string;
  riskLevel: RiskLevel;
  // JSON Schema for the input. Loose typing — providers all accept JSON Schema.
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// Active terminal accessor (injected at loop start so the renderer's
// terminal context can be used without circular imports).
export interface AgentRuntime {
  getActiveTerminal: () => {
    getVisibleText: () => string;
    getAllBufferText: () => string;
    sendInput: (cmd: string) => void;
  } | null;
}

export const AGENT_TOOLS: ToolSpec[] = [
  {
    name: "read_terminal",
    description:
      "Read text from the user's active terminal. Use 'visible' for what's on screen or 'scrollback' for the full buffer including history.",
    riskLevel: "safe",
    inputSchema: {
      type: "object",
      properties: {
        scope: {
          type: "string",
          enum: ["visible", "scrollback"],
          description: "Which portion of the terminal to read.",
        },
      },
      required: ["scope"],
    },
  },
  {
    name: "run_command",
    description:
      "Send a shell command to the user's active terminal. The command is written to the PTY followed by Enter. Output is NOT returned by this tool — call read_terminal afterwards (you may need to wait briefly) to see the result. Dangerous commands trigger a user confirmation dialog via the existing guardrails.",
    riskLevel: "risky",
    inputSchema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Exact command to run. No leading $ or prompt.",
        },
      },
      required: ["command"],
    },
  },
  {
    name: "read_file",
    description:
      "Read a UTF-8 text file from the local filesystem. Path may be absolute or relative to the user's home directory. Reads are limited to ~256 KB; larger files are truncated.",
    riskLevel: "safe",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path." },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description:
      "Write UTF-8 text content to a local file. Overwrites if the file exists. Creates parent directories as needed. Always requires user confirmation.",
    riskLevel: "risky",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path." },
        content: { type: "string", description: "File contents to write." },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "list_ssh_hosts",
    description:
      "List SSH hosts configured in the user's ~/.ssh/config file.",
    riskLevel: "safe",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_env_var",
    description:
      "Read a key from a workspace env vault scope. Returns the value or null if not set.",
    riskLevel: "safe",
    inputSchema: {
      type: "object",
      properties: {
        scopeId: {
          type: "string",
          description: "Workspace/scope id (e.g. workspace id).",
        },
        key: { type: "string", description: "Env variable name." },
      },
      required: ["scopeId", "key"],
    },
  },
  {
    name: "sftp_list",
    description:
      "List entries in a remote directory over SFTP. Requires an already-connected SFTP session id.",
    riskLevel: "safe",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        dirPath: { type: "string" },
      },
      required: ["sessionId", "dirPath"],
    },
  },
  {
    name: "sftp_read",
    description: "Read a UTF-8 text file over SFTP.",
    riskLevel: "safe",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        remotePath: { type: "string" },
      },
      required: ["sessionId", "remotePath"],
    },
  },
  {
    name: "sftp_write",
    description: "Write a UTF-8 text file over SFTP. Always confirms.",
    riskLevel: "risky",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        remotePath: { type: "string" },
        content: { type: "string" },
      },
      required: ["sessionId", "remotePath", "content"],
    },
  },
];

export function getToolSpec(name: string): ToolSpec | undefined {
  return AGENT_TOOLS.find((t) => t.name === name);
}

// Truncate a string for safe inclusion in tool results.
function truncate(s: string, max = 16000): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n…[truncated ${s.length - max} chars]`;
}

export async function executeTool(
  name: string,
  args: any,
  runtime: AgentRuntime,
): Promise<{ content: string; isError: boolean }> {
  try {
    switch (name) {
      case "read_terminal": {
        const term = runtime.getActiveTerminal();
        if (!term) return { content: "No active terminal", isError: true };
        const scope = args?.scope === "scrollback" ? "scrollback" : "visible";
        const text =
          scope === "scrollback" ? term.getAllBufferText() : term.getVisibleText();
        return { content: truncate(text), isError: false };
      }
      case "run_command": {
        const term = runtime.getActiveTerminal();
        if (!term) return { content: "No active terminal", isError: true };
        const cmd = String(args?.command ?? "");
        if (!cmd) return { content: "Empty command", isError: true };
        term.sendInput(cmd + "\r");
        return {
          content: `Command sent: ${cmd}\nNote: output is not returned synchronously. Call read_terminal to inspect the result.`,
          isError: false,
        };
      }
      case "read_file": {
        const path = String(args?.path ?? "");
        const res = await window.electron.ipcRenderer.invoke(
          "agent-fs-read",
          path,
        );
        if (res?.error)
          return { content: String(res.error), isError: true };
        return { content: truncate(String(res?.content ?? "")), isError: false };
      }
      case "write_file": {
        const path = String(args?.path ?? "");
        const content = String(args?.content ?? "");
        const res = await window.electron.ipcRenderer.invoke(
          "agent-fs-write",
          path,
          content,
        );
        if (res?.error)
          return { content: String(res.error), isError: true };
        return {
          content: `Wrote ${content.length} bytes to ${res?.path ?? path}`,
          isError: false,
        };
      }
      case "list_ssh_hosts": {
        const hosts = await window.api.sshConfig.list();
        return { content: JSON.stringify(hosts, null, 2), isError: false };
      }
      case "get_env_var": {
        const scopeId = String(args?.scopeId ?? "");
        const key = String(args?.key ?? "");
        const entries = await window.api.envVault.list(scopeId);
        const match = entries.find((e) => e.key === key);
        return {
          content: match ? match.value : "null",
          isError: false,
        };
      }
      case "sftp_list": {
        const entries = await window.api.sftp.list(
          String(args?.sessionId ?? ""),
          String(args?.dirPath ?? ""),
        );
        return {
          content: truncate(JSON.stringify(entries, null, 2)),
          isError: false,
        };
      }
      case "sftp_read": {
        const text = await window.api.sftp.readText(
          String(args?.sessionId ?? ""),
          String(args?.remotePath ?? ""),
        );
        return { content: truncate(text), isError: false };
      }
      case "sftp_write": {
        await window.api.sftp.writeText(
          String(args?.sessionId ?? ""),
          String(args?.remotePath ?? ""),
          String(args?.content ?? ""),
        );
        return { content: "ok", isError: false };
      }
      default:
        return { content: `Unknown tool: ${name}`, isError: true };
    }
  } catch (e: any) {
    return { content: e?.message ?? String(e), isError: true };
  }
}

// Model capability detection: which provider+model combinations reliably
// support tool calling. Conservative — when in doubt, return false so the
// UI disables the agent toggle.
export function supportsTools(provider: string, model: string): boolean {
  const m = (model || "").toLowerCase();
  if (!m) return false;
  switch (provider) {
    case "anthropic":
      return m.includes("claude-3") || m.includes("claude-4") || m.includes("claude-opus") || m.includes("claude-sonnet") || m.includes("claude-haiku");
    case "openai":
      return (
        m.includes("gpt-4") ||
        m.includes("gpt-4o") ||
        m.includes("gpt-5") ||
        m.includes("o1") ||
        m.includes("o3") ||
        m.includes("o4")
      );
    case "ollama":
      // Known tool-capable Ollama models
      return (
        m.includes("llama3.1") ||
        m.includes("llama3.2") ||
        m.includes("llama3.3") ||
        m.includes("qwen2.5") ||
        m.includes("qwen3") ||
        m.includes("mistral-nemo") ||
        m.includes("mistral-large") ||
        m.includes("firefunction") ||
        m.includes("command-r")
      );
    case "openai-compatible":
      // Hard to know — allow attempt; user can flip back to chat if it fails
      return true;
    default:
      return false;
  }
}

export type { ToolCall };
