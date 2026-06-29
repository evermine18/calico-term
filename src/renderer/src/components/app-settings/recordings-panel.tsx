import { useEffect, useState } from "react";
import { Button } from "@renderer/components/ui/button";
import { Circle, Play, Trash2, Download } from "lucide-react";
import RecordingPlayerDialog from "./recording-player-dialog";

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export function RecordingsPanel() {
  const [list, setList] = useState<RecordingMeta[]>([]);
  const [playing, setPlaying] = useState<RecordingMeta | null>(null);

  const refresh = async () => {
    const l = await window.api.recording.list();
    setList(l);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this recording?")) return;
    await window.api.recording.delete(id);
    await refresh();
  };

  const handleExport = async (m: RecordingMeta) => {
    const p = await window.api.recording.exportPath(m.id);
    if (p) window.api.clipboard.writeText(p);
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-ink-muted text-sm font-semibold">Session recordings</p>
        <p className="text-xs text-ink-muted mt-0.5">
          asciinema-compatible .cast files. Use the red dot in any terminal tab
          header to start/stop recording.
        </p>
      </div>

      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-accent-600/40 scrollbar-track-transparent">
        {list.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Circle size={28} className="text-ink-subtle mb-2" />
            <p className="text-sm text-ink-subtle">No recordings yet</p>
          </div>
        )}
        {list.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-2.5 p-2.5 rounded-md bg-elevated/60 border border-hairline/50"
          >
            <Circle
              size={10}
              className="text-danger/70 fill-danger/70 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-ink-muted truncate">{r.title}</div>
              <div className="text-xs text-ink-subtle font-mono truncate">
                {new Date(r.createdAt).toLocaleString()} ·{" "}
                {formatDuration(r.durationMs)} · {formatBytes(r.bytes)} ·{" "}
                {r.cols}×{r.rows}
              </div>
            </div>
            <Button
              onClick={() => setPlaying(r)}
              variant="ghost"
              size="icon"
              title="Replay"
              className="h-8 w-8 text-ink-muted hover:text-accent-300 hover:bg-accent-500/20"
            >
              <Play size={14} />
            </Button>
            <Button
              onClick={() => handleExport(r)}
              variant="ghost"
              size="icon"
              title="Copy .cast path to clipboard"
              className="h-8 w-8 text-ink-muted hover:text-accent-300 hover:bg-accent-500/20"
            >
              <Download size={14} />
            </Button>
            <Button
              onClick={() => handleDelete(r.id)}
              variant="ghost"
              size="icon"
              title="Delete"
              className="h-8 w-8 text-ink-muted hover:text-danger hover:bg-danger/20"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
      </div>
      {playing && (
        <RecordingPlayerDialog
          recording={playing}
          onClose={() => setPlaying(null)}
        />
      )}
    </div>
  );
}
