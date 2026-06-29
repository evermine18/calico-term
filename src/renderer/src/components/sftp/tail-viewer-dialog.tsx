import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@renderer/components/ui/dialog";
import { Input } from "@renderer/components/ui/input";
import { Button } from "@renderer/components/ui/button";
import { Eye, Pause, Play, Trash2 } from "lucide-react";

type Props = {
  open: boolean;
  sessionId: string;
  remotePath: string;
  onClose: () => void;
};

const MAX_LINES = 5000;

export default function TailViewerDialog({
  open,
  sessionId,
  remotePath,
  onClose,
}: Props) {
  const [lines, setLines] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const tailIdRef = useRef<string | null>(null);
  const bufferRef = useRef<string>("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLines([]);
    setError(null);
    bufferRef.current = "";

    const offData = window.api.sftp.onTailData(({ tailId, data, isErr }) => {
      if (tailId !== tailIdRef.current) return;
      if (paused) return;
      const combined = bufferRef.current + data;
      const parts = combined.split("\n");
      bufferRef.current = parts.pop() ?? "";
      if (parts.length === 0) return;
      const prefix = isErr ? "[stderr] " : "";
      setLines((prev) => {
        const next = [...prev, ...parts.map((p) => prefix + p)];
        return next.length > MAX_LINES
          ? next.slice(next.length - MAX_LINES)
          : next;
      });
    });
    const offEnd = window.api.sftp.onTailEnd(({ tailId }) => {
      if (tailId === tailIdRef.current) tailIdRef.current = null;
    });

    window.api.sftp
      .tailStart(sessionId, remotePath, 200)
      .then((tailId) => {
        if (cancelled) {
          window.api.sftp.tailStop(tailId);
          return;
        }
        tailIdRef.current = tailId;
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e?.message ?? String(e));
      });

    return () => {
      cancelled = true;
      offData();
      offEnd();
      if (tailIdRef.current) {
        window.api.sftp.tailStop(tailIdRef.current);
        tailIdRef.current = null;
      }
    };
  }, [open, sessionId, remotePath, paused]);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  const visibleLines = (() => {
    if (!filter) return lines;
    try {
      const re = new RegExp(filter, "i");
      return lines.filter((l) => re.test(l));
    } catch {
      return lines.filter((l) => l.includes(filter));
    }
  })();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh] bg-panel border-hairline/40 shadow-xl flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-ink flex items-center gap-2 text-sm">
            <Eye size={14} className="text-accent-400" />
            <span className="font-mono truncate">tail -F {remotePath}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Filter (regex)…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-elevated/60 border-hairline text-ink font-mono text-xs h-8"
          />
          <Button
            onClick={() => setPaused((p) => !p)}
            variant="outline"
            size="icon"
            className="h-8 w-8 border-hairline/50 bg-elevated/60"
            title={paused ? "Resume" : "Pause"}
          >
            {paused ? <Play size={13} /> : <Pause size={13} />}
          </Button>
          <Button
            onClick={() => setLines([])}
            variant="outline"
            size="icon"
            className="h-8 w-8 border-hairline/50 bg-elevated/60"
            title="Clear"
          >
            <Trash2 size={13} />
          </Button>
        </div>

        <div
          ref={containerRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            const atBottom =
              el.scrollHeight - el.clientHeight - el.scrollTop < 20;
            setAutoScroll(atBottom);
          }}
          className="flex-1 min-h-[400px] max-h-[60vh] overflow-y-auto bg-surface border border-hairline/50 rounded-md p-2 font-mono text-[11px] text-ink-muted"
        >
          {visibleLines.length === 0 ? (
            <div className="text-ink-subtle italic p-2">
              {filter ? "No lines matching filter" : "Waiting for output…"}
            </div>
          ) : (
            visibleLines.map((l, i) => (
              <div
                key={i}
                className={`whitespace-pre-wrap break-all ${l.startsWith("[stderr]") ? "text-danger/80" : ""}`}
              >
                {l || " "}
              </div>
            ))
          )}
        </div>

        {error && (
          <p className="text-xs text-danger">{error}</p>
        )}

        <DialogFooter>
          <span className="text-xs text-ink-subtle mr-auto">
            {visibleLines.length} / {lines.length} lines
            {paused && " · paused"}
          </span>
          <Button
            variant="outline"
            onClick={onClose}
            className="border-hairline text-ink-muted hover:bg-elevated"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
