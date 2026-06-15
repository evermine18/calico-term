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
        checked ? "bg-accent-500" : "bg-slate-700"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
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
    return <div className="text-sm text-gray-500 px-1 py-4">Loading…</div>;
  }

  const addCommand = `claude mcp add --transport http calico-term ${status.url} --header "Authorization: Bearer ${status.token}"`;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-gray-300 text-sm font-semibold flex items-center gap-2">
          <PlugZap size={15} className="text-accent-400" />
          MCP Server
        </p>
        <p className="text-xs text-gray-400">
          Expose your open terminals to external AI agents (Claude Code, Codex,
          …) over a local Model Context Protocol server. Agents can list tabs,
          read output, and — with your approval — run commands in a specific
          tab.
        </p>
      </div>

      {/* Enable */}
      <div className="flex items-center justify-between p-3 rounded-md bg-slate-800/60 border border-slate-700/50">
        <div className="min-w-0">
          <div className="text-sm text-gray-200">Enable server</div>
          <div className="text-xs text-gray-500">
            {status.running ? (
              <span className="text-green-400">
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
      <div className="flex items-center justify-between p-3 rounded-md bg-slate-800/60 border border-slate-700/50">
        <div className="min-w-0 pr-3">
          <div className="text-sm text-gray-200 flex items-center gap-1.5">
            <ShieldAlert size={13} className="text-amber-400" />
            Allow “Allow all this session”
          </div>
          <div className="text-xs text-gray-500">
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
        <Label className="text-gray-300 text-sm">Port</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1024}
            max={65535}
            value={portInput}
            onChange={(e) => setPortInput(e.target.value)}
            className="bg-slate-800/60 border-slate-700/50 text-gray-100 w-40 font-mono"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={
              !portInput || parseInt(portInput, 10) === status.port
            }
            onClick={() => {
              const p = parseInt(portInput, 10);
              if (p >= 1024 && p <= 65535) apply({ port: p });
            }}
            className="border-slate-700/50 text-gray-300"
          >
            Apply
          </Button>
        </div>
      </div>

      {/* Token */}
      <div className="grid gap-2">
        <Label className="text-gray-300 text-sm">Access token</Label>
        <div className="flex items-center gap-2">
          <Input
            type={showToken ? "text" : "password"}
            readOnly
            value={status.token}
            className="bg-slate-800/60 border-slate-700/50 text-gray-100 font-mono text-xs"
          />
          <Button
            size="icon"
            variant="outline"
            onClick={() => setShowToken((v) => !v)}
            className="bg-slate-800/60 border-slate-700/50 shrink-0"
          >
            {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={() => copy("token", status.token)}
            className="bg-slate-800/60 border-slate-700/50 shrink-0"
          >
            {copied === "token" ? <Check size={15} /> : <Copy size={15} />}
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={regenerate}
            title="Regenerate token"
            className="bg-slate-800/60 border-slate-700/50 shrink-0"
          >
            <RefreshCw size={15} />
          </Button>
        </div>
      </div>

      {/* Connect command */}
      <div className="grid gap-2 pt-3 border-t border-slate-700/40">
        <Label className="text-gray-300 text-sm">Connect Claude Code</Label>
        <p className="text-xs text-gray-400">
          Run this once in a terminal to register Calico Term as an MCP server:
        </p>
        <div className="flex items-start gap-2">
          <pre className="flex-1 text-xs font-mono text-accent-200 bg-slate-800/80 border border-slate-700/40 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
            {addCommand}
          </pre>
          <Button
            size="icon"
            variant="outline"
            onClick={() => copy("cmd", addCommand)}
            className="bg-slate-800/60 border-slate-700/50 shrink-0"
          >
            {copied === "cmd" ? <Check size={15} /> : <Copy size={15} />}
          </Button>
        </div>
        <p className="text-[11px] text-gray-500">
          The server binds to localhost only and requires the token above.
          Anyone who has the token can drive your terminals — keep it private and
          regenerate it if leaked.
        </p>
      </div>
    </div>
  );
}
