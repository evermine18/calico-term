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
  const { sshConnections } = useAppContext();
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
    const base = [{ id: GLOBAL, label: "Global (all terminals)" }];
    for (const c of sshConnections) {
      base.push({ id: `host:${c.id}`, label: `Host: ${c.name}` });
    }
    return base;
  }, [sshConnections]);

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
        <p className="text-gray-300 text-sm font-semibold">Env Var Vault</p>
        <p className="text-xs text-gray-400 mt-0.5">
          Encrypted environment variables injected into terminals at startup.
          Global scope applies everywhere; host scopes apply only when launching
          that SSH connection.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label className="text-gray-300 text-sm">Scope</Label>
        <Select value={scopeId} onValueChange={setScopeId}>
          <SelectTrigger className="bg-slate-800/60 border-slate-700/50 text-gray-100">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700/50">
            {scopeOptions.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-accent-600/40 scrollbar-track-transparent">
        {entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Variable size={28} className="text-slate-600 mb-2" />
            <p className="text-sm text-gray-500">No variables in this scope</p>
          </div>
        )}
        {entries.map((e) => (
          <div
            key={e.key}
            className="flex items-center gap-2 p-2 rounded-md bg-slate-800/60 border border-slate-700/50"
          >
            <span className="text-xs font-mono text-accent-300 shrink-0">
              {e.key}
            </span>
            <span className="text-gray-600">=</span>
            <span className="flex-1 min-w-0 text-xs font-mono text-gray-200 truncate">
              {revealed.has(e.key)
                ? e.value
                : "•".repeat(Math.min(e.value.length, 12))}
            </span>
            <Button
              onClick={() => toggleReveal(e.key)}
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-400 hover:text-accent-300 hover:bg-accent-500/20"
            >
              {revealed.has(e.key) ? <EyeOff size={13} /> : <Eye size={13} />}
            </Button>
            <Button
              onClick={() => handleDelete(e.key)}
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-400 hover:text-red-400 hover:bg-red-500/20"
            >
              <Trash2 size={13} />
            </Button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_2fr_auto] gap-2 items-end pt-2 border-t border-slate-700/40">
        <div className="grid gap-1">
          <Label className="text-gray-300 text-xs">Name</Label>
          <Input
            placeholder="MY_VAR"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="bg-slate-800/60 border-slate-700 text-gray-100 font-mono text-sm h-8"
          />
        </div>
        <div className="grid gap-1">
          <Label className="text-gray-300 text-xs">Value</Label>
          <Input
            placeholder="value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="bg-slate-800/60 border-slate-700 text-gray-100 font-mono text-sm h-8"
          />
        </div>
        <Button
          onClick={handleAdd}
          size="icon"
          className="h-8 w-8 bg-accent-600/90 hover:bg-accent-500 text-white"
        >
          <Plus size={14} />
        </Button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
