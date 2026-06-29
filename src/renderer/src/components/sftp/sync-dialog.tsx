import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@renderer/components/ui/dialog";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import { Label } from "@renderer/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@renderer/components/ui/select";
import { ArrowDownToLine, ArrowUpFromLine, FolderTree, FolderOpen } from "lucide-react";

type Props = {
  open: boolean;
  sessionId: string;
  remoteDir: string;
  onClose: () => void;
};

type Progress = {
  current: string;
  filesDone: number;
  filesTotal: number;
};

export default function SyncDialog({
  open,
  sessionId,
  remoteDir,
  onClose,
}: Props) {
  const [direction, setDirection] = useState<"download" | "upload">("download");
  const [localDir, setLocalDir] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ filesTransferred: number } | null>(null);

  useEffect(() => {
    if (!open) {
      setRunning(false);
      setProgress(null);
      setError(null);
      setResult(null);
      return;
    }
    const off = window.api.sftp.onSyncProgress((data) => {
      if (data.sessionId !== sessionId) return;
      setProgress({
        current: data.current,
        filesDone: data.filesDone,
        filesTotal: data.filesTotal,
      });
    });
    return off;
  }, [open, sessionId]);

  const pickLocal = async () => {
    const dir = await window.api.sftp.pickLocalDir();
    if (dir) setLocalDir(dir);
  };

  const run = async () => {
    if (!localDir.trim()) {
      setError("Pick a local directory first");
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    setProgress(null);
    try {
      const r = await window.api.sftp.syncDir(
        sessionId,
        remoteDir,
        localDir,
        direction,
      );
      setResult(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const pct =
    progress && progress.filesTotal > 0
      ? Math.round((progress.filesDone / progress.filesTotal) * 100)
      : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !running && onClose()}>
      <DialogContent className="sm:max-w-[520px] bg-panel border-hairline/40 shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-ink flex items-center gap-2 text-sm">
            <FolderTree size={14} className="text-accent-400" />
            Sync directory
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 py-1">
          <div className="grid gap-1.5">
            <Label className="text-ink-muted text-sm">Remote</Label>
            <Input
              value={remoteDir}
              readOnly
              className="bg-elevated/60 border-hairline text-ink-muted font-mono text-xs"
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-ink-muted text-sm">Local</Label>
            <div className="flex gap-2">
              <Input
                value={localDir}
                onChange={(e) => setLocalDir(e.target.value)}
                placeholder="/path/to/local"
                className="bg-elevated/60 border-hairline text-ink font-mono text-xs"
              />
              <Button
                variant="outline"
                onClick={pickLocal}
                disabled={running}
                className="border-hairline/50 bg-elevated/60 gap-1.5"
              >
                <FolderOpen size={14} />
                Pick
              </Button>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-ink-muted text-sm">Direction</Label>
            <Select
              value={direction}
              onValueChange={(v) => setDirection(v as typeof direction)}
              disabled={running}
            >
              <SelectTrigger className="bg-elevated/60 border-hairline text-ink">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-panel border-hairline/50">
                <SelectItem value="download">
                  Remote → Local (download new/changed)
                </SelectItem>
                <SelectItem value="upload">
                  Local → Remote (upload new/changed)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(running || progress) && (
            <div className="grid gap-1.5">
              <div className="flex justify-between text-xs text-ink-muted">
                <span>
                  {progress?.filesDone ?? 0} / {progress?.filesTotal ?? 0}
                </span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-elevated overflow-hidden">
                <div
                  className="h-full bg-accent-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {progress?.current && (
                <p className="text-[10px] text-ink-subtle font-mono truncate">
                  {progress.current}
                </p>
              )}
            </div>
          )}

          {result && (
            <p className="text-xs text-success">
              Done — {result.filesTransferred} file
              {result.filesTransferred !== 1 ? "s" : ""} transferred.
            </p>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={running}
            className="border-hairline text-ink-muted hover:bg-elevated"
          >
            Close
          </Button>
          <Button
            onClick={run}
            disabled={running || !localDir.trim()}
            className="bg-accent-600 hover:bg-accent-500 text-on-accent gap-1.5"
          >
            {direction === "download" ? (
              <ArrowDownToLine size={14} />
            ) : (
              <ArrowUpFromLine size={14} />
            )}
            {running ? "Syncing…" : "Start sync"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
