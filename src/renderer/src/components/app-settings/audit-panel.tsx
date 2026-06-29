import { useEffect, useState } from "react";
import { Button } from "@renderer/components/ui/button";
import { Download, FileSignature, KeyRound, Trash2 } from "lucide-react";

export function AuditPanel() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [pubKey, setPubKey] = useState<string>("");
  const [status, setStatus] = useState<string | null>(null);

  const refresh = async () => {
    const list = await window.api.audit.list(500);
    setEntries(list);
  };

  useEffect(() => {
    refresh();
    window.api.audit.publicKey().then(setPubKey);
  }, []);

  const handleExport = async () => {
    const r = await window.api.audit.exportSigned();
    if (r.ok) setStatus(`Exported to ${r.path} (with .sig + .pub)`);
    else if (r.error) setStatus(`Error: ${r.error}`);
    else setStatus(null);
  };

  const handleClear = async () => {
    if (!confirm("Clear the entire audit log? This cannot be undone.")) return;
    await window.api.audit.clear();
    await refresh();
  };

  const copyPub = () => {
    window.api.clipboard.writeText(pubKey);
    setStatus("Public key copied to clipboard");
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-ink-muted text-sm font-semibold">Audit log</p>
        <p className="text-xs text-ink-muted mt-0.5">
          Append-only command history kept in the userData directory. Export is
          signed with a per-installation ed25519 key.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={handleExport}
          size="sm"
          className="gap-1.5 bg-accent-600/90 hover:bg-accent-500 text-on-accent"
        >
          <Download size={13} />
          Export signed
        </Button>
        <Button
          onClick={copyPub}
          size="sm"
          variant="outline"
          className="gap-1.5 border-hairline/50 bg-elevated/60"
        >
          <KeyRound size={13} />
          Copy public key
        </Button>
        <Button
          onClick={handleClear}
          size="sm"
          variant="outline"
          className="gap-1.5 border-hairline/50 bg-elevated/60 hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 size={13} />
          Clear log
        </Button>
      </div>

      {status && (
        <div className="text-xs text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-md px-3 py-2 break-all">
          {status}
        </div>
      )}

      <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-accent-600/40 scrollbar-track-transparent">
        {entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileSignature size={26} className="text-ink-subtle mb-2" />
            <p className="text-sm text-ink-subtle">No audit entries yet</p>
          </div>
        )}
        {entries
          .slice()
          .reverse()
          .map((e, i) => (
            <div
              key={`${e.ts}-${i}`}
              className="flex items-baseline gap-2 px-2 py-1 rounded bg-elevated/40 text-[11px]"
            >
              <span className="text-ink-subtle font-mono shrink-0">
                {new Date(e.ts).toLocaleTimeString()}
              </span>
              <span className="text-ink-muted font-mono truncate flex-1">
                {e.command}
              </span>
              {e.hostId && (
                <span className="text-accent-400/80 text-[10px] shrink-0">
                  @{e.hostId}
                </span>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
