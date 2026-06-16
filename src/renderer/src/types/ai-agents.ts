/**
 * Catalog of external CLI coding agents that Calico Term can launch in a PTY,
 * locally or over SSH (Warp-style "run an agent" compatibility layer).
 *
 * These are ordinary terminal programs — launching one is just spawning its
 * command as a tab's `initialCommand`. See `launchAgentTab` in
 * `lib/tab-operations.ts` and the launcher UI in
 * `components/ai/agent-launch-dialog.tsx`.
 */
export type AgentLauncher = {
  /** Stable id, e.g. "claude-code". */
  id: string;
  /** Display name, e.g. "Claude Code". */
  name: string;
  /** Binary expected on PATH, e.g. "claude". Used for launch + install detection. */
  command: string;
  /** Optional default arguments appended after the command. */
  args?: string[];
  /** Short one-line description shown on the card. */
  description: string;
  /** Install / docs URL, surfaced when the binary is not detected locally. */
  website: string;
  /** Brand accent (24-bit RGB) used for the terminal banner + UI accents. */
  color: [number, number, number];
  /** A single glyph shown next to the name in the banner / picker. */
  glyph: string;
};

export const AGENT_LAUNCHERS: AgentLauncher[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    command: "claude",
    description: "Anthropic's agentic coding CLI",
    website: "https://docs.claude.com/claude-code",
    color: [217, 119, 87],
    glyph: "✦",
  },
  {
    id: "codex",
    name: "Codex",
    command: "codex",
    description: "OpenAI Codex CLI",
    website: "https://github.com/openai/codex",
    color: [16, 163, 127],
    glyph: "◇",
  },
  {
    id: "opencode",
    name: "OpenCode",
    command: "opencode",
    description: "Open-source terminal coding agent",
    website: "https://opencode.ai",
    color: [20, 184, 166],
    glyph: "◆",
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    command: "gemini",
    description: "Google Gemini CLI",
    website: "https://github.com/google-gemini/gemini-cli",
    color: [66, 133, 244],
    glyph: "✶",
  },
  {
    id: "aider",
    name: "Aider",
    command: "aider",
    description: "AI pair programming in your terminal",
    website: "https://aider.chat",
    color: [249, 115, 22],
    glyph: "⚙",
  },
];

/** The shell string that launches an agent (command + default args). */
export function agentRunString(agent: AgentLauncher): string {
  return [agent.command, ...(agent.args ?? [])].join(" ");
}

/**
 * How an agent registers Calico Term's local (HTTP) MCP server. Each CLI does
 * this differently: some take a one-shot shell command, others want a snippet
 * pasted into a config file.
 */
export type McpConnect = {
  /** "command" = paste into a shell; "config" = add to a config file. */
  kind: "command" | "config";
  /** Copyable text — shell command(s), or a config-file snippet. */
  snippet: string;
  /** For kind "config", the file the snippet belongs in. */
  configPath?: string;
  /** Optional caveat (e.g. an experimental flag the agent needs first). */
  note?: string;
};

/** Agent ids that can connect to the MCP server, in display order. */
export const MCP_CAPABLE_AGENTS = [
  "claude-code",
  "codex",
  "opencode",
  "gemini",
] as const;

/**
 * Build the instructions for pointing an agent at Calico Term's MCP server.
 * `name` is the server name the agent will register it under. Returns null for
 * agents with no known HTTP-MCP support.
 */
export function mcpConnect(
  agentId: string,
  url: string,
  token: string,
  name = "calico-term",
): McpConnect | null {
  switch (agentId) {
    case "claude-code":
      return {
        kind: "command",
        snippet: `claude mcp add --transport http ${name} ${url} --header "Authorization: Bearer ${token}"`,
      };
    case "codex":
      return {
        kind: "command",
        // Codex only accepts the bearer token via an env var (no inline header),
        // and needs the experimental rmcp client for Streamable HTTP servers.
        snippet:
          `export CALICO_TERM_TOKEN="${token}"\n` +
          `codex mcp add ${name} --url ${url} --bearer-token-env-var CALICO_TERM_TOKEN`,
        note: 'Requires `experimental_use_rmcp_client = true` in ~/.codex/config.toml. On PowerShell, set the token with `$env:CALICO_TERM_TOKEN="…"` instead of `export`.',
      };
    case "gemini":
      return {
        kind: "command",
        snippet: `gemini mcp add --transport http ${name} ${url} --header "Authorization: Bearer ${token}"`,
      };
    case "opencode":
      return {
        kind: "config",
        configPath:
          "opencode.json (project root) or ~/.config/opencode/opencode.json",
        snippet: JSON.stringify(
          {
            mcp: {
              [name]: {
                type: "remote",
                url,
                enabled: true,
                headers: { Authorization: `Bearer ${token}` },
              },
            },
          },
          null,
          2,
        ),
      };
    default:
      return null;
  }
}

/**
 * An ANSI banner (the agent's "logo") printed to the terminal right before the
 * agent starts. Full-screen TUIs (Claude Code, Codex, …) use the alternate
 * screen buffer, so the banner stays in the normal buffer — visible at launch
 * and again once the agent exits. Line-based agents (Aider) keep it in view.
 */
export function agentBanner(agent: AgentLauncher): string {
  const [r, g, b] = agent.color;
  const c = `\x1b[38;2;${r};${g};${b}m`;
  const reset = "\x1b[0m";
  const name = agent.name.toUpperCase();
  const rule = "─".repeat(Math.max(name.length + 4, 28));
  return (
    `\r\n  ${c}\x1b[1m${agent.glyph}  ${name}${reset}\r\n` +
    `  ${c}${rule}${reset}\r\n` +
    `  \x1b[2m${agent.description}${reset}\r\n\r\n`
  );
}
