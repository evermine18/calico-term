import { useEffect, useRef } from "react";
import { ChevronUp, ChevronDown, X } from "lucide-react";

interface TerminalSearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  onFindNext: () => void;
  onFindPrev: () => void;
  onClose: () => void;
  resultCount?: number;
}

export function TerminalSearchBar({
  query,
  onQueryChange,
  onFindNext,
  onFindPrev,
  onClose,
  resultCount,
}: TerminalSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.shiftKey ? onFindPrev() : onFindNext();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="absolute top-2 right-3 z-20 flex items-center gap-1.5 bg-card/90 backdrop-blur-md border border-border rounded-lg px-2 py-1.5 shadow-xl shadow-black/40 backdrop-blur-md">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Buscar... (Ctrl+Shift+F)"
        className="bg-transparent text-sm text-foreground placeholder-gray-600 outline-none w-44 caret-cyan-400"
      />

      {query && (
        <span className="text-[10px] text-muted-foreground/70 min-w-[24px] text-center">
          {resultCount !== undefined ? resultCount : "–"}
        </span>
      )}

      <div className="flex items-center gap-0.5 border-l border-border/80 pl-1.5 ml-0.5">
        <button
          onClick={onFindPrev}
          title="Anterior (Shift+Enter)"
          className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground/70 hover:text-cyan-400 hover:bg-accent/70 transition-colors"
        >
          <ChevronUp size={13} />
        </button>
        <button
          onClick={onFindNext}
          title="Siguiente (Enter)"
          className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground/70 hover:text-cyan-400 hover:bg-accent/70 transition-colors"
        >
          <ChevronDown size={13} />
        </button>
        <button
          onClick={onClose}
          title="Cerrar (Escape)"
          className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground/70 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-0.5"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
