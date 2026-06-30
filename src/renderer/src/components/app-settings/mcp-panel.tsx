import { useEffect, useState } from "react";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import { Label } from "@renderer/components/ui/label";
import {
  PlugZap,
  Copy,
  Check,
  RefreshCw,
  Eye,
  EyeOff,
  ShieldAlert,
} from "lucide-react";
import {
  AGENT_LAUNCHERS,
  MCP_CAPABLE_AGENTS,
  mcpConnect,
} from "@renderer/types/ai-agents";

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? "bg-accent-500" : "bg-elevated"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-panel transition-transform ${
          checked ? "translate-x-4.5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export function McpPanel() {
  const [status, setStatus] = useState<McpStatus | null>(null);
  const [portInput, setPortInput] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string>(MCP_CAPABLE_AGENTS[0]);

  useEffect(() => {
    window.api.mcp.getConfig().then((s) => {
      setStatus(s);
      setPortInput(String(s.port));
    });
  }, []);

  const apply = async (patch: {
    enabled?: boolean;
    allowAcceptAll?: boolean;
    port?: number;
  }) => {
    const s = await window.api.mcp.setConfig(patch);
    setStatus(s);
    setPortInput(String(s.port));
  };

  const regenerate = async () => {
    const s = await window.api.mcp.regenerateToken();
    setStatus(s);
  };

  const copy = (key: string, value: string) => {
    window.api.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  };

  if (!status) {
    return <div className="text-sm text-ink-subtle px-1 py-4">Loading…</div>;
  }

  const connect = mcpConnect(agentId, status.url, status.token);
  const agents = MCP_CAPABLE_AGENTS.map(
    (id) => AGENT_LAUNCHERS.find((a) => a.id === id)!,
  );

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-ink-muted text-sm font-semibold flex items-center gap-2">
          <PlugZap size={15} className="text-accent-400" />
          MCP Server
        </p>
        <p className="text-xs text-ink-muted">
          Expose your open terminals to external AI agents (Claude Code, Codex,
          …) over a local Model Context Protocol server. Agents can list tabs,
          read output, and — with your approval — run commands in a specific
          tab.
        </p>
      </div>

      {/* Enable */}
      <div className="flex items-center justify-between p-3 rounded-md bg-elevated/60 border border-hairline/50">
        <div className="min-w-0">
          <div className="text-sm text-ink-muted">Enable server</div>
          <div className="text-xs text-ink-subtle">
            {status.running ? (
              <span className="text-success">
                ● Listening on {status.url}
              </span>
            ) : (
              "Off — no agent can connect"
            )}
          </div>
        </div>
        <Toggle
          checked={status.enabled}
          onChange={(v) => apply({ enabled: v })}
        />
      </div>

      {/* Accept-all */}
      <div className="flex items-center justify-between p-3 rounded-md bg-elevated/60 border border-hairline/50">
        <div className="min-w-0 pr-3">
          <div className="text-sm text-ink-muted flex items-center gap-1.5">
            <ShieldAlert size={13} className="text-warning" />
            Allow “Allow all this session”
          </div>
          <div className="text-xs text-ink-subtle">
            When on, the approval dialog offers a button to auto-approve every
            agent action until the server restarts. Off = every command asks.
          </div>
        </div>
        <Toggle
          checked={status.allowAcceptAll}
          onChange={(v) => apply({ allowAcceptAll: v })}
        />
      </div>

      {/* Port */}
      <div className="grid gap-2">
        <Label className="text-ink-muted text-sm">Port</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1024}
            max={65535}
            value={portInput}
            onChange={(e) => setPortInput(e.target.value)}
            className="bg-elevated/60 border-hairline/50 text-ink w-40 font-mono"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!portInput || parseInt(portInput, 10) === status.port}
            onClick={() => {
              const p = parseInt(portInput, 10);
              if (p >= 1024 && p <= 65535) apply({ port: p });
            }}
            className="border-hairline/50 text-ink-muted"
          >
            Apply
          </Button>
        </div>
      </div>

      {/* Token */}
      <div className="grid gap-2">
        <Label className="text-ink-muted text-sm">Access token</Label>
        <div className="flex items-center gap-2">
          <Input
            type={showToken ? "text" : "password"}
            readOnly
            value={status.token}
            className="bg-elevated/60 border-hairline/50 text-ink font-mono text-xs"
          />
          <Button
            size="icon"
            variant="outline"
            onClick={() => setShowToken((v) => !v)}
            className="bg-elevated/60 border-hairline/50 shrink-0"
          >
            {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={() => copy("token", status.token)}
            className="bg-elevated/60 border-hairline/50 shrink-0"
          >
            {copied === "token" ? <Check size={15} /> : <Copy size={15} />}
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={regenerate}
            title="Regenerate token"
            className="bg-elevated/60 border-hairline/50 shrink-0"
          >
            <RefreshCw size={15} />
          </Button>
        </div>
      </div>

      {/* Connect an agent */}
      <div className="grid gap-2 pt-3 border-t border-hairline/40">
        <Label className="text-ink-muted text-sm">Connect an agent</Label>

        {/* Agent picker */}
        <div className="flex flex-wrap gap-1.5">
          {agents.map((a) => {
            const active = a.id === agentId;
            const [r, g, b] = a.color;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAgentId(a.id)}
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors ${
                  active
                    ? "border-hairline bg-elevated/70 text-ink"
                    : "border-hairline/50 bg-elevated/40 text-ink-muted hover:text-ink-muted"
                }`}
              >
                <span
                  style={{ color: active ? `rgb(${r} ${g} ${b})` : undefined }}
                >
                  {a.glyph}
                </span>
                {a.name}
              </button>
            );
          })}
        </div>

        {connect && (
          <>
            <p className="text-xs text-ink-muted">
              {connect.kind === "command"
                ? "Run this once in a terminal to register Calico Term as an MCP server:"
                : `Add this to ${connect.configPath}:`}
            </p>
            <div className="flex items-start gap-2">
              <pre className="flex-1 text-xs font-mono text-accent-400 bg-elevated/80 border border-hairline/40 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                {connect.snippet}
              </pre>
              <Button
                size="icon"
                variant="outline"
                onClick={() => copy("cmd", connect.snippet)}
                className="bg-elevated/60 border-hairline/50 shrink-0"
              >
                {copied === "cmd" ? <Check size={15} /> : <Copy size={15} />}
              </Button>
            </div>
            {connect.note && (
              <p className="text-[11px] text-warning/80">{connect.note}</p>
            )}
          </>
        )}

        <p className="text-[11px] text-ink-subtle">
          The server binds to localhost only and requires the token above.
          Anyone who has the token can drive your terminals — keep it private
          and regenerate it if leaked.
        </p>
      </div>
    </div>
  );
}
