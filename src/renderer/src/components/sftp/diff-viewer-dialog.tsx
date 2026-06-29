import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@renderer/components/ui/dialog";
import { Button } from "@renderer/components/ui/button";
import { GitCompare, Loader2, Upload } from "lucide-react";

type Props = {
  open: boolean;
  sessionId: string;
  remotePath: string;
  onClose: () => void;
};

type Op = { kind: "eq" | "del" | "add"; line: string };

// Patience-ish diff via LCS table — fine for moderate file sizes.
function diffLines(a: string[], b: string[]): Op[] {
  const n = a.length;
  const m = b.length;
  if (n === 0) return b.map((line) => ({ kind: "add" as const, line }));
  if (m === 0) return a.map((line) => ({ kind: "del" as const, line }));

  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ kind: "eq", line: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ kind: "del", line: a[i] });
      i++;
    } else {
      ops.push({ kind: "add", line: b[j] });
      j++;
    }
  }
  while (i < n) ops.push({ kind: "del", line: a[i++] });
  while (j < m) ops.push({ kind: "add", line: b[j++] });
  return ops;
}

export default function DiffViewerDialog({
  open,
  sessionId,
  remotePath,
  onClose,
}: Props) {
  const [remoteText, setRemoteText] = useState("");
  const [localText, setLocalText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setLocalText("");
    window.api.sftp
      .readText(sessionId, remotePath)
      .then((t) => !cancelled && setRemoteText(t))
      .catch((e: Error) => !cancelled && setError(e?.message ?? String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, sessionId, remotePath]);

  const ops = useMemo(
    () => diffLines(remoteText.split("\n"), localText.split("\n")),
    [remoteText, localText],
  );

  const stats = useMemo(() => {
    let add = 0;
    let del = 0;
    for (const o of ops) {
      if (o.kind === "add") add++;
      else if (o.kind === "del") del++;
    }
    return { add, del };
  }, [ops]);

  const pushLocal = async () => {
    setPushing(true);
    setError(null);
    try {
      await window.api.sftp.writeText(sessionId, remotePath, localText);
      setRemoteText(localText);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPushing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh] bg-panel border-hairline/40 shadow-xl flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-ink flex items-center gap-2 text-sm">
            <GitCompare size={14} className="text-accent-400" />
            <span className="font-mono truncate">Diff: {remotePath}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="text-xs text-ink-muted">
          Paste local file contents to compare against the remote version.
        </div>

        <div className="grid grid-cols-2 gap-2 flex-1 min-h-[400px]">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-ink-subtle uppercase tracking-widest">
              Local (paste here)
            </span>
            <textarea
              value={localText}
              onChange={(e) => setLocalText(e.target.value)}
              spellCheck={false}
              className="flex-1 bg-surface border border-hairline/50 rounded-md p-2 font-mono text-[11px] text-ink-muted outline-none resize-none focus:border-accent-500/60"
              placeholder="Paste or type local contents…"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-ink-subtle uppercase tracking-widest">
              Diff (remote → local)
            </span>
            <div className="flex-1 overflow-y-auto bg-surface border border-hairline/50 rounded-md p-2 font-mono text-[11px]">
              {loading ? (
                <div className="flex items-center gap-2 text-ink-subtle">
                  <Loader2 className="animate-spin" size={12} /> Loading remote…
                </div>
              ) : (
                ops.map((o, i) => (
                  <div
                    key={i}
                    className={`whitespace-pre-wrap break-all ${
                      o.kind === "add"
                        ? "bg-success/10 text-success"
                        : o.kind === "del"
                          ? "bg-danger/10 text-danger"
                          : "text-ink-muted"
                    }`}
                  >
                    <span className="select-none pr-1">
                      {o.kind === "add" ? "+" : o.kind === "del" ? "-" : " "}
                    </span>
                    {o.line || " "}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        <DialogFooter className="gap-2">
          <span className="text-xs text-ink-subtle mr-auto">
            <span className="text-success">+{stats.add}</span>{" "}
            <span className="text-danger">-{stats.del}</span>
          </span>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={pushing}
            className="border-hairline text-ink-muted hover:bg-elevated"
          >
            Close
          </Button>
          <Button
            onClick={pushLocal}
            disabled={pushing || loading || localText === remoteText}
            className="bg-accent-600 hover:bg-accent-500 text-on-accent gap-1.5"
          >
            <Upload size={14} />
            {pushing ? "Pushing…" : "Push local → remote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
