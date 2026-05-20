import { useEffect, useState } from "react";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import { Label } from "@renderer/components/ui/label";
import { ShieldAlert, Plus, Trash2, RotateCcw } from "lucide-react";

export function GuardrailsPanel() {
  const [rules, setRules] = useState<GuardrailRule[]>([]);
  const [pattern, setPattern] = useState("");
  const [description, setDescription] = useState("");
  const [flags, setFlags] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const list = await window.api.guardrails.list();
    setRules(list);
  };

  useEffect(() => {
    refresh();
  }, []);

  const persist = async (next: GuardrailRule[]) => {
    setRules(next);
    await window.api.guardrails.set(next);
  };

  const addRule = async () => {
    setError(null);
    if (!pattern.trim() || !description.trim()) {
      setError("Pattern and description are required");
      return;
    }
    try {
      new RegExp(pattern, flags);
    } catch (e) {
      setError(`Invalid regex: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    const next: GuardrailRule = {
      id: crypto.randomUUID(),
      pattern: pattern.trim(),
      flags: flags.trim() || undefined,
      description: description.trim(),
      enabled: true,
    };
    await persist([...rules, next]);
    setPattern("");
    setDescription("");
    setFlags("");
  };

  const toggle = async (id: string) => {
    await persist(
      rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    );
  };

  const remove = async (id: string) => {
    await persist(rules.filter((r) => r.id !== id));
  };

  const resetDefaults = async () => {
    const defaults = await window.api.guardrails.resetDefaults();
    setRules(defaults);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-foreground/80 text-sm font-semibold flex items-center gap-1.5">
            <ShieldAlert size={14} className="text-red-400" />
            Production guardrails
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            When the active tab belongs to a workspace marked PROD and a
            command matches any enabled rule, Calico prompts for explicit
            confirmation before forwarding the Enter to the remote shell.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={resetDefaults}
          className="bg-card/50 border-border/80 text-foreground/80 gap-1 shrink-0"
        >
          <RotateCcw size={12} />
          Reset
        </Button>
      </div>

      <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-accent-600/40 scrollbar-track-transparent">
        {rules.length === 0 && (
          <div className="text-center py-8 text-xs text-muted-foreground/70">
            No guardrails configured.
          </div>
        )}
        {rules.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-2 p-2 rounded-md bg-card/50 border border-border/80"
          >
            <button
              onClick={() => toggle(r.id)}
              className={`w-2 h-2 rounded-full shrink-0 ${
                r.enabled ? "bg-red-500" : "bg-muted"
              }`}
              title={r.enabled ? "Disable" : "Enable"}
            />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-foreground truncate">
                {r.description}
              </div>
              <div className="text-[10px] font-mono text-muted-foreground/70 truncate">
                /{r.pattern}/{r.flags ?? ""}
              </div>
            </div>
            <Button
              onClick={() => remove(r.id)}
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-red-500/20"
            >
              <Trash2 size={13} />
            </Button>
          </div>
        ))}
      </div>

      <div className="space-y-2 pt-2 border-t border-border/60">
        <div className="grid grid-cols-[1fr_60px] gap-2">
          <div className="grid gap-1">
            <Label className="text-foreground/80 text-xs">Pattern (regex)</Label>
            <Input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="\\brm\\s+-rf\\b"
              className="bg-card/50 border-border text-foreground font-mono text-sm h-8"
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-foreground/80 text-xs">Flags</Label>
            <Input
              value={flags}
              onChange={(e) => setFlags(e.target.value)}
              placeholder="i"
              className="bg-card/50 border-border text-foreground font-mono text-sm h-8"
            />
          </div>
        </div>
        <div className="grid gap-1">
          <Label className="text-foreground/80 text-xs">Description</Label>
          <div className="flex items-center gap-2">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this match?"
              className="bg-card/50 border-border text-foreground text-sm h-8"
            />
            <Button
              onClick={addRule}
              size="icon"
              className="h-8 w-8 bg-accent-600/90 hover:bg-accent-500 text-white shrink-0"
            >
              <Plus size={14} />
            </Button>
          </div>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}
