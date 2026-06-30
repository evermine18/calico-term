import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";
type Toast = { id: string; message: string; kind: ToastKind };

type ToastContextValue = {
  toast: (message: string, kind?: ToastKind) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

// Non-blocking feedback. Use for outcomes (imported, copied, failed) — NOT for
// confirmations, which still need a blocking dialog.
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

const ICON: Record<ToastKind, ReactNode> = {
  success: <CheckCircle2 size={15} className="text-success" />,
  error: <AlertTriangle size={15} className="text-danger" />,
  info: <Info size={15} className="text-accent-400" />,
};

export function ToastProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, kind }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-12 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-2 max-w-sm rounded-lg border border-hairline/60 bg-panel/95 px-3 py-2 shadow-xl shadow-black/10 dark:shadow-black/40 backdrop-blur-md animate-in slide-in-from-right-4 fade-in duration-200"
          >
            <span className="mt-0.5 flex-shrink-0">{ICON[t.kind]}</span>
            <span className="text-sm text-ink break-words">
              {t.message}
            </span>
            <button
              onClick={() => dismiss(t.id)}
              className="ml-1 flex-shrink-0 text-ink-subtle hover:text-ink-muted transition-colors"
              title="Close"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
