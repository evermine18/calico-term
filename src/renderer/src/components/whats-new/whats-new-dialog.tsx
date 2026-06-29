import { Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@renderer/components/ui/dialog";
import { Button } from "@renderer/components/ui/button";
import { WHATS_NEW } from "@renderer/lib/whats-new-data";

interface WhatsNewDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function WhatsNewDialog({
  open,
  onClose,
}: WhatsNewDialogProps): React.JSX.Element | null {
  const latest = WHATS_NEW[0];
  if (!latest) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[780px] max-h-[85vh] flex flex-col gap-3 bg-panel border-hairline/50 text-ink">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-2 text-accent-400">
            <Sparkles size={14} />
            <span className="text-[11px] uppercase tracking-[0.2em] font-semibold">
              What&apos;s new
            </span>
          </div>
          <DialogTitle className="text-xl text-ink mt-1">
            Calico Term{" "}
            <span className="text-accent-400">v{latest.version}</span>
          </DialogTitle>
          {latest.tagline && (
            <p className="text-sm text-ink-muted mt-1">{latest.tagline}</p>
          )}
          <p className="text-[11px] text-ink-subtle mt-0.5">
            Released {latest.date}
          </p>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-3 mt-1 overflow-y-auto pr-1 -mr-1 min-h-0">
          {latest.sections.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.id}
                className="rounded-lg border border-hairline/50 bg-elevated/40 p-3.5 flex flex-col gap-2 hover:border-hairline/60 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`flex items-center justify-center w-7 h-7 rounded-md border ${s.accent}`}
                  >
                    <Icon size={14} />
                  </div>
                  <h3 className="text-sm font-semibold text-ink">
                    {s.title}
                  </h3>
                </div>
                <ul className="space-y-1.5 text-[12.5px] leading-snug text-ink-muted">
                  {s.items.map((it, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-accent-400 mt-[3px] leading-none">
                        •
                      </span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <DialogFooter className="shrink-0 border-t border-hairline/40 pt-3">
          <Button
            size="sm"
            onClick={onClose}
            className="bg-accent-500 hover:bg-accent-400 text-ink"
          >
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
