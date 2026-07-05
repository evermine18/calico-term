import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@renderer/components/ui/dialog";
import { Button } from "@renderer/components/ui/button";

const inputCls =
  "w-full bg-elevated/60 border border-hairline/50 rounded px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:border-accent-500/60";
const labelCls = "block text-xs font-medium text-ink-muted mb-1";

// Small dialog to register a playbook by hand. Replaces window.prompt(), which
// Electron does not implement (it silently returns null).
export default function AddPlaybookDialog({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (name: string, relativePath: string) => void;
}): React.JSX.Element {
  const [name, setName] = useState("");
  const [relativePath, setRelativePath] = useState("");

  // Default the name to the file's base name if the user leaves it blank.
  const effectiveName =
    name.trim() ||
    relativePath
      .trim()
      .split("/")
      .pop()
      ?.replace(/\.ya?ml$/i, "") ||
    "";
  const canSave = effectiveName && relativePath.trim();

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[440px] bg-panel border-hairline/60">
        <DialogHeader>
          <DialogTitle className="text-ink">Add playbook</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div>
            <label className={labelCls}>Relative path</label>
            <input
              autoFocus
              value={relativePath}
              onChange={(e) => setRelativePath(e.target.value)}
              placeholder="site.yml or plays/deploy.yml"
              className={`${inputCls} font-mono`}
            />
            <p className="text-[11px] text-ink-subtle mt-1">
              Path to the playbook, relative to the source root.
            </p>
          </div>
          <div>
            <label className={labelCls}>Name (optional)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={effectiveName || "Deploy web"}
              className={inputCls}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="border-hairline/50 text-ink-muted"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!canSave}
            onClick={() => onAdd(effectiveName, relativePath.trim())}
            className="bg-accent-600/90 hover:bg-accent-600 text-on-accent"
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
