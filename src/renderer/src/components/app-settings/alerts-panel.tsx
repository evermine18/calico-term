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

const STORAGE_KEY = "calico-alert-rules";

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
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState("i");
  const [severity, setSeverity] = useState<AlertSeverity>("warning");
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
    };
    update([next, ...rules]);
    setPattern("");
    setMessage("");
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
        <p className="text-gray-300 text-sm font-semibold">Log alerts</p>
        <p className="text-xs text-gray-400 mt-0.5">
          Regex rules matched against terminal output. Fires a native
          notification on match (rate-limited per rule).
        </p>
      </div>

      <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-accent-600/40 scrollbar-track-transparent">
        {rules.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Bell size={26} className="text-slate-600 mb-2" />
            <p className="text-sm text-gray-500">No alert rules yet</p>
          </div>
        )}
        {rules.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-2 p-2 rounded-md bg-slate-800/60 border border-slate-700/50"
          >
            <button
              onClick={() => toggle(r.id)}
              className={`w-2 h-2 rounded-full shrink-0 ${r.enabled ? (r.severity === "critical" ? "bg-red-500" : r.severity === "warning" ? "bg-amber-400" : "bg-blue-400") : "bg-slate-600"}`}
              title={r.enabled ? "Disable" : "Enable"}
            />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-mono text-gray-200 truncate">
                /{r.pattern}/{r.flags}
              </div>
              {r.message && (
                <div className="text-[10px] text-gray-500 truncate">
                  {r.message}
                </div>
              )}
            </div>
            <span className="text-[10px] uppercase tracking-wider text-gray-500">
              {r.severity}
            </span>
            <Button
              onClick={() => remove(r.id)}
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-400 hover:text-red-400 hover:bg-red-500/20"
            >
              <Trash2 size={13} />
            </Button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_60px_120px_auto] gap-2 items-end pt-2 border-t border-slate-700/40">
        <div className="grid gap-1">
          <Label className="text-gray-300 text-xs">Pattern</Label>
          <Input
            placeholder="error|fatal"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            className="bg-slate-800/60 border-slate-700 text-gray-100 font-mono text-sm h-8"
          />
        </div>
        <div className="grid gap-1">
          <Label className="text-gray-300 text-xs">Flags</Label>
          <Input
            value={flags}
            onChange={(e) => setFlags(e.target.value)}
            className="bg-slate-800/60 border-slate-700 text-gray-100 font-mono text-sm h-8"
          />
        </div>
        <div className="grid gap-1">
          <Label className="text-gray-300 text-xs">Severity</Label>
          <Select value={severity} onValueChange={(v) => setSeverity(v as AlertSeverity)}>
            <SelectTrigger className="h-8 bg-slate-800/60 border-slate-700 text-gray-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700/50">
              <SelectItem value="info">info</SelectItem>
              <SelectItem value="warning">warning</SelectItem>
              <SelectItem value="critical">critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={addRule}
          size="icon"
          className="h-8 w-8 bg-accent-600/90 hover:bg-accent-500 text-white"
        >
          <Plus size={14} />
        </Button>
      </div>
      <div className="grid gap-1">
        <Label className="text-gray-300 text-xs">Message (optional)</Label>
        <Input
          placeholder="Friendly description"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="bg-slate-800/60 border-slate-700 text-gray-100 text-sm h-8"
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
