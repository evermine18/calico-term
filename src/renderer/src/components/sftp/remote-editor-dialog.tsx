import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@renderer/components/ui/dialog";
import { Button } from "@renderer/components/ui/button";
import { FileText, Loader2, Save } from "lucide-react";

type Props = {
  open: boolean;
  sessionId: string;
  remotePath: string;
  onClose: () => void;
};

export default function RemoteEditorDialog({
  open,
  sessionId,
  remotePath,
  onClose,
}: Props) {
  const [content, setContent] = useState("");
  const [original, setOriginal] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    window.api.sftp
      .readText(sessionId, remotePath)
      .then((text) => {
        if (cancelled) return;
        setContent(text);
        setOriginal(text);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e?.message ?? String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sessionId, remotePath]);

  const dirty = content !== original;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await window.api.sftp.writeText(sessionId, remotePath, content);
      setOriginal(content);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      if (dirty && !saving) save();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[820px] max-h-[85vh] bg-slate-900 border-slate-700/40 shadow-xl flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-gray-100 flex items-center gap-2 text-sm">
            <FileText size={14} className="text-accent-400" />
            <span className="font-mono truncate">{remotePath}</span>
            {dirty && <span className="text-amber-400 text-xs">●</span>}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500 text-sm gap-2">
            <Loader2 className="animate-spin" size={14} /> Loading…
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            className="w-full flex-1 min-h-[400px] bg-slate-950 border border-slate-700/50 rounded-md p-3 font-mono text-xs text-gray-200 outline-none resize-none focus:border-accent-500/60"
          />
        )}

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <DialogFooter className="gap-2">
          <span className="text-xs text-gray-500 mr-auto">
            ⌘S / Ctrl+S to save
          </span>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="border-slate-700 text-gray-300 hover:bg-slate-800"
          >
            Close
          </Button>
          <Button
            onClick={save}
            disabled={!dirty || saving || loading}
            className="bg-accent-600 hover:bg-accent-500 text-white gap-1.5"
          >
            <Save size={14} />
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
