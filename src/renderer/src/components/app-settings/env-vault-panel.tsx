import { useEffect, useMemo, useState } from "react";
import { Input } from "@renderer/components/ui/input";
import { Label } from "@renderer/components/ui/label";
import { Button } from "@renderer/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@renderer/components/ui/select";
import { Plus, Trash2, Variable, Eye, EyeOff } from "lucide-react";
import { useAppContext } from "@renderer/contexts/app-context";

const GLOBAL = "global";

export function EnvVaultPanel() {
  const { sshConnections, workspaces } = useAppContext();
  const [scopeId, setScopeId] = useState<string>(GLOBAL);
  const [entries, setEntries] = useState<{ key: string; value: string }[]>([]);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const refresh = async (scope: string) => {
    const list = await window.api.envVault.list(scope);
    setEntries(list);
  };

  useEffect(() => {
    refresh(scopeId);
  }, [scopeId]);

  const scopeOptions = useMemo(() => {
    const base: { id: string; label: string; group: string }[] = [
      { id: GLOBAL, label: "Global (all terminals)", group: "Global" },
    ];
    for (const w of workspaces) {
      base.push({
        id: `workspace:${w.id}`,
        label: `${w.name}${w.environment === "prod" ? " · PROD" : ""}`,
        group: "Workspace",
      });
    }
    for (const c of sshConnections) {
      base.push({
        id: `host:${c.id}`,
        label: `${c.name}`,
        group: "Host",
      });
    }
    return base;
  }, [sshConnections, workspaces]);

  const handleAdd = async () => {
    setError(null);
    const k = newKey.trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) {
      setError("Variable name must be letters/digits/underscore, not starting with a digit.");
      return;
    }
    try {
      await window.api.envVault.set(scopeId, k, newValue);
      setNewKey("");
      setNewValue("");
      await refresh(scopeId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDelete = async (k: string) => {
    await window.api.envVault.delete(scopeId, k);
    await refresh(scopeId);
  };

  const toggleReveal = (k: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-ink-muted text-sm font-semibold">Env Var Vault</p>
        <p className="text-xs text-ink-muted mt-0.5">
          Encrypted environment variables injected into terminals at startup.
          Global applies everywhere; workspace scopes apply to tabs whose
          connection belongs to that workspace; host scopes only to that SSH
          connection.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label className="text-ink-muted text-sm">Scope</Label>
        <Select value={scopeId} onValueChange={setScopeId}>
          <SelectTrigger className="bg-elevated/60 border-hairline/50 text-ink">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-panel border-hairline/50">
            {(["Global", "Workspace", "Host"] as const).map((g) => {
              const items = scopeOptions.filter((o) => o.group === g);
              if (items.length === 0) return null;
              return (
                <div key={g}>
                  <div className="px-2 pt-1.5 pb-0.5 text-[10px] uppercase tracking-widest text-ink-subtle">
                    {g}
                  </div>
                  {items.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </div>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-accent-600/40 scrollbar-track-transparent">
        {entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Variable size={28} className="text-ink-subtle mb-2" />
            <p className="text-sm text-ink-subtle">No variables in this scope</p>
          </div>
        )}
        {entries.map((e) => (
          <div
            key={e.key}
            className="flex items-center gap-2 p-2 rounded-md bg-elevated/60 border border-hairline/50"
          >
            <span className="text-xs font-mono text-accent-300 shrink-0">
              {e.key}
            </span>
            <span className="text-ink-subtle">=</span>
            <span className="flex-1 min-w-0 text-xs font-mono text-ink-muted truncate">
              {revealed.has(e.key)
                ? e.value
                : "•".repeat(Math.min(e.value.length, 12))}
            </span>
            <Button
              onClick={() => toggleReveal(e.key)}
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-ink-muted hover:text-accent-300 hover:bg-accent-500/20"
            >
              {revealed.has(e.key) ? <EyeOff size={13} /> : <Eye size={13} />}
            </Button>
            <Button
              onClick={() => handleDelete(e.key)}
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-ink-muted hover:text-danger hover:bg-danger/20"
            >
              <Trash2 size={13} />
            </Button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_2fr_auto] gap-2 items-end pt-2 border-t border-hairline/40">
        <div className="grid gap-1">
          <Label className="text-ink-muted text-xs">Name</Label>
          <Input
            placeholder="MY_VAR"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="bg-elevated/60 border-hairline text-ink font-mono text-sm h-8"
          />
        </div>
        <div className="grid gap-1">
          <Label className="text-ink-muted text-xs">Value</Label>
          <Input
            placeholder="value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="bg-elevated/60 border-hairline text-ink font-mono text-sm h-8"
          />
        </div>
        <Button
          onClick={handleAdd}
          size="icon"
          className="h-8 w-8 bg-accent-600/90 hover:bg-accent-500 text-on-accent"
        >
          <Plus size={14} />
        </Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
