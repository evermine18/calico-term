import { useEffect, useState } from "react";
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
import { Bell, Plus, Trash2 } from "lucide-react";
import { useAppContext } from "@renderer/contexts/app-context";

const STORAGE_KEY = "calico-alert-rules";
const GLOBAL_SCOPE_VALUE = "global";

function scopeToValue(scope?: AlertScope): string {
  if (!scope || scope === "global") return GLOBAL_SCOPE_VALUE;
  if (typeof scope === "object" && "workspaceId" in scope) {
    return `workspace:${scope.workspaceId}`;
  }
  return GLOBAL_SCOPE_VALUE;
}

function valueToScope(value: string): AlertScope {
  if (value.startsWith("workspace:")) {
    return { workspaceId: value.slice("workspace:".length) };
  }
  return "global";
}

function load(): AlertRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return [];
}

function persist(rules: AlertRule[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  window.api.alerts.setRules(rules);
}

export function AlertsPanel() {
  const { workspaces } = useAppContext();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState("i");
  const [severity, setSeverity] = useState<AlertSeverity>("warning");
  const [scopeValue, setScopeValue] = useState<string>(GLOBAL_SCOPE_VALUE);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initial = load();
    setRules(initial);
    window.api.alerts.setRules(initial);
  }, []);

  const update = (next: AlertRule[]) => {
    setRules(next);
    persist(next);
  };

  const addRule = () => {
    setError(null);
    if (!pattern.trim()) {
      setError("Pattern required");
      return;
    }
    try {
      new RegExp(pattern, flags);
    } catch (e) {
      setError(`Invalid regex: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    const next: AlertRule = {
      id: crypto.randomUUID(),
      pattern: pattern.trim(),
      flags: flags.trim(),
      severity,
      message: message.trim() || undefined,
      enabled: true,
      scope: valueToScope(scopeValue),
    };
    update([next, ...rules]);
    setPattern("");
    setMessage("");
  };

  const setRuleScope = (id: string, value: string) => {
    update(
      rules.map((r) =>
        r.id === id ? { ...r, scope: valueToScope(value) } : r,
      ),
    );
  };

  const toggle = (id: string) => {
    update(
      rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    );
  };

  const remove = (id: string) => {
    update(rules.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-ink-muted text-sm font-semibold">Log alerts</p>
        <p className="text-xs text-ink-muted mt-0.5">
          Regex rules matched against terminal output. Fires a native
          notification on match (rate-limited per rule).
        </p>
      </div>

      <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-accent-600/40 scrollbar-track-transparent">
        {rules.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Bell size={26} className="text-ink-subtle mb-2" />
            <p className="text-sm text-ink-subtle">No alert rules yet</p>
          </div>
        )}
        {rules.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-2 p-2 rounded-md bg-elevated/60 border border-hairline/50"
          >
            <button
              onClick={() => toggle(r.id)}
              className={`w-2 h-2 rounded-full shrink-0 ${r.enabled ? (r.severity === "critical" ? "bg-danger" : r.severity === "warning" ? "bg-warning" : "bg-info") : "bg-elevated"}`}
              title={r.enabled ? "Disable" : "Enable"}
            />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-mono text-ink-muted truncate">
                /{r.pattern}/{r.flags}
              </div>
              {r.message && (
                <div className="text-[10px] text-ink-subtle truncate">
                  {r.message}
                </div>
              )}
            </div>
            <Select
              value={scopeToValue(r.scope)}
              onValueChange={(v) => setRuleScope(r.id, v)}
            >
              <SelectTrigger className="h-6 px-1.5 text-[10px] bg-panel/60 border-hairline/40 text-ink-muted w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-panel border-hairline/50">
                <SelectItem value={GLOBAL_SCOPE_VALUE}>Global</SelectItem>
                {workspaces.map((w) => (
                  <SelectItem key={w.id} value={`workspace:${w.id}`}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-[10px] uppercase tracking-wider text-ink-subtle">
              {r.severity}
            </span>
            <Button
              onClick={() => remove(r.id)}
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-ink-muted hover:text-danger hover:bg-danger/20"
            >
              <Trash2 size={13} />
            </Button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_60px_120px_auto] gap-2 items-end pt-2 border-t border-hairline/40">
        <div className="grid gap-1">
          <Label className="text-ink-muted text-xs">Pattern</Label>
          <Input
            placeholder="error|fatal"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            className="bg-elevated/60 border-hairline text-ink font-mono text-sm h-8"
          />
        </div>
        <div className="grid gap-1">
          <Label className="text-ink-muted text-xs">Flags</Label>
          <Input
            value={flags}
            onChange={(e) => setFlags(e.target.value)}
            className="bg-elevated/60 border-hairline text-ink font-mono text-sm h-8"
          />
        </div>
        <div className="grid gap-1">
          <Label className="text-ink-muted text-xs">Severity</Label>
          <Select value={severity} onValueChange={(v) => setSeverity(v as AlertSeverity)}>
            <SelectTrigger className="h-8 bg-elevated/60 border-hairline text-ink">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-panel border-hairline/50">
              <SelectItem value="info">info</SelectItem>
              <SelectItem value="warning">warning</SelectItem>
              <SelectItem value="critical">critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={addRule}
          size="icon"
          className="h-8 w-8 bg-accent-600/90 hover:bg-accent-500 text-on-accent"
        >
          <Plus size={14} />
        </Button>
      </div>
      <div className="grid grid-cols-[1fr_2fr] gap-2">
        <div className="grid gap-1">
          <Label className="text-ink-muted text-xs">Scope</Label>
          <Select value={scopeValue} onValueChange={setScopeValue}>
            <SelectTrigger className="h-8 bg-elevated/60 border-hairline text-ink">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-panel border-hairline/50">
              <SelectItem value={GLOBAL_SCOPE_VALUE}>Global</SelectItem>
              {workspaces.map((w) => (
                <SelectItem key={w.id} value={`workspace:${w.id}`}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label className="text-ink-muted text-xs">Message (optional)</Label>
          <Input
            placeholder="Friendly description"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="bg-elevated/60 border-hairline text-ink text-sm h-8"
          />
        </div>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
