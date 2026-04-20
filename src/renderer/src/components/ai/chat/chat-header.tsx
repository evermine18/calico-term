import { Bot, X, Plus, ArrowUp, ArrowDown, Layers, Save, List, Check, Download, Copy, Settings2, MoreVertical } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

function ExportDropdown({
  onExport,
  onCopy,
}: {
  onExport?: () => void;
  onCopy?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        btnRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const toggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen(!open);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="p-2 hover:bg-slate-800 text-gray-400 hover:text-slate-200 rounded-md transition-colors"
        title="Export/Copy conversation"
      >
        <Layers size={18} />
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: pos.top, right: pos.right }}
          className="bg-slate-900 border border-slate-700/50 rounded-md shadow-xl py-1 min-w-[160px] z-[9999]"
        >
          {onExport && (
            <button
              onClick={() => {
                onExport();
                setOpen(false);
              }}
              className="w-full px-3 py-2 text-xs text-left text-slate-300 hover:bg-slate-800 flex items-center gap-2 transition-colors"
            >
              <Download size={12} />
              Export as Markdown
            </button>
          )}
          {onCopy && (
            <button
              onClick={() => {
                onCopy();
                setOpen(false);
              }}
              className="w-full px-3 py-2 text-xs text-left text-slate-300 hover:bg-slate-800 flex items-center gap-2 transition-colors"
            >
              <Copy size={12} />
              Copy Conversation
            </button>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

function ProviderDropdown({
  current,
  onChange,
}: {
  current: string;
  onChange: (provider: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        btnRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const providers = ["openai", "anthropic", "ollama", "openai-compatible"];

  const toggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(!open);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="text-[10px] text-accent-400 hover:text-accent-300 transition-colors capitalize flex items-center gap-1"
      >
        <Settings2 size={10} />
        {current}
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: pos.top, left: pos.left }}
          className="bg-slate-900 border border-slate-700/50 rounded-md shadow-xl py-1 min-w-[130px] z-[9999]"
        >
          {providers.map((p) => (
            <button
              key={p}
              onClick={() => {
                onChange(p);
                setOpen(false);
              }}
              className={`w-full px-3 py-1.5 text-xs text-left capitalize hover:bg-slate-800 transition-colors ${
                current === p ? "text-accent-400" : "text-slate-300"
              }`}
            >
              {p}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

type MenuItem = {
  key: string;
  label: string;
  icon: typeof Save;
  onClick: () => void;
  accent?: boolean;
  dot?: boolean;
};

function OverflowMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const toggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen(!open);
  };

  const hasDot = items.some((i) => i.dot);

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="p-2 hover:bg-slate-800 text-gray-400 hover:text-slate-200 rounded-md transition-colors relative"
        title="More actions"
      >
        <MoreVertical size={18} />
        {hasDot && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-accent-400 rounded-full" />
        )}
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: pos.top, right: pos.right }}
          className="bg-slate-900 border border-slate-700/50 rounded-md shadow-xl py-1 min-w-[180px] z-[9999]"
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => {
                  item.onClick();
                  setOpen(false);
                }}
                className={`w-full px-3 py-2 text-xs text-left hover:bg-slate-800 flex items-center gap-2 transition-colors ${
                  item.accent ? "text-accent-400" : "text-slate-300"
                }`}
              >
                <Icon size={14} />
                <span className="flex-1">{item.label}</span>
                {item.dot && <span className="w-1.5 h-1.5 bg-accent-400 rounded-full" />}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}

interface ChatHeaderProps {
  onClose: () => void;
  onNewChat: () => void;
  onSaveConversation?: () => void;
  onToggleConvList?: () => void;
  onExportConversation?: () => void;
  onCopyConversation?: () => void;
  hasUnsavedChanges?: boolean;
  status: "unconfigured" | "ready";
  aiProvider?: string;
  selectedModel?: string;
  onProviderChange?: (provider: string) => void;
  onModelChange?: (model: string) => void;
  lastUsage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  } | null;
}

export default function ChatHeader({
  onClose,
  onNewChat,
  onSaveConversation,
  onToggleConvList,
  onExportConversation,
  onCopyConversation,
  hasUnsavedChanges = false,
  status,
  aiProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
  lastUsage,
}: ChatHeaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCompact(entry.contentRect.width < 360);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const overflowItems: MenuItem[] = [];
  if (onSaveConversation) {
    overflowItems.push({
      key: "save",
      label: hasUnsavedChanges ? "Save conversation" : "Saved",
      icon: hasUnsavedChanges ? Save : Check,
      onClick: onSaveConversation,
      accent: hasUnsavedChanges,
      dot: hasUnsavedChanges,
    });
  }
  if (onToggleConvList) {
    overflowItems.push({
      key: "list",
      label: "Browse conversations",
      icon: List,
      onClick: onToggleConvList,
    });
  }
  overflowItems.push({
    key: "new",
    label: "New chat",
    icon: Plus,
    onClick: onNewChat,
  });
  if (onExportConversation) {
    overflowItems.push({
      key: "export",
      label: "Export as Markdown",
      icon: Download,
      onClick: onExportConversation,
    });
  }
  if (onCopyConversation) {
    overflowItems.push({
      key: "copy",
      label: "Copy conversation",
      icon: Copy,
      onClick: onCopyConversation,
    });
  }

  return (
    <div ref={containerRef} className="border-b border-slate-700/50 bg-slate-900/95 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3 text-gray-100">
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <div className="shrink-0 w-9 h-9 bg-accent-500/20 border border-accent-500/30 rounded-lg flex items-center justify-center">
            <Bot size={18} className="text-accent-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm truncate">AI Assistant</h3>
            {(aiProvider || selectedModel) && (
              <div className="flex items-center gap-1.5 mt-0.5">
                {aiProvider && onProviderChange && (
                  <ProviderDropdown current={aiProvider} onChange={onProviderChange} />
                )}
                {selectedModel && onModelChange && (
                  <span className="text-[10px] text-slate-500">·</span>
                )}
                {selectedModel && (
                  <span className="text-[10px] text-slate-500 font-mono truncate max-w-[100px]">
                    {selectedModel.split("/").pop()}
                  </span>
                )}
              </div>
            )}
            {!aiProvider && !selectedModel && (
              <p
                className={`text-xs ${status === "ready" ? "text-green-400/80" : "text-yellow-500/80"}`}
              >
                {status === "ready" ? "Ready" : "Not configured"}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-1 shrink-0">
          {compact ? (
            <OverflowMenu items={overflowItems} />
          ) : (
            <>
              {onSaveConversation && (
                <button
                  onClick={onSaveConversation}
                  className={`p-2 rounded-md transition-colors relative ${
                    hasUnsavedChanges
                      ? "hover:bg-accent-500/20 text-accent-400"
                      : "text-gray-400 hover:bg-slate-800"
                  }`}
                  title={hasUnsavedChanges ? "Save conversation" : "Saved"}
                >
                  {hasUnsavedChanges ? <Save size={18} /> : <Check size={18} />}
                  {hasUnsavedChanges && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-accent-400 rounded-full" />
                  )}
                </button>
              )}
              {onToggleConvList && (
                <button
                  onClick={onToggleConvList}
                  className="p-2 hover:bg-slate-800 text-gray-400 hover:text-slate-200 rounded-md transition-colors"
                  title="Browse conversations"
                >
                  <List size={18} />
                </button>
              )}
              <button
                onClick={onNewChat}
                className="p-2 hover:bg-accent-500/20 text-gray-400 hover:text-accent-300 rounded-md transition-colors"
                title="New Chat"
              >
                <Plus size={18} />
              </button>
              {(onExportConversation || onCopyConversation) && (
                <ExportDropdown
                  onExport={onExportConversation}
                  onCopy={onCopyConversation}
                />
              )}
            </>
          )}
          <button
            onClick={onClose}
            className="p-2 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-md transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {lastUsage && (
        <div className="flex items-center gap-2 px-4 pb-3">
          <div className="flex items-center gap-1.5 rounded-md bg-slate-800/80 border border-slate-700/50 px-2 py-1 text-[11px] text-slate-400">
            <ArrowUp size={10} className="text-accent-400" />
            <span>{lastUsage.prompt_tokens.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-slate-800/80 border border-slate-700/50 px-2 py-1 text-[11px] text-slate-400">
            <ArrowDown size={10} className="text-green-400" />
            <span>{lastUsage.completion_tokens.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-slate-800/80 border border-slate-700/50 px-2 py-1 text-[11px] text-slate-400">
            <Layers size={10} className="text-slate-500" />
            <span>{lastUsage.total_tokens.toLocaleString()} tokens</span>
          </div>
        </div>
      )}
    </div>
  );
}
