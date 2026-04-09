import { Bot, X, Plus, ArrowUp, ArrowDown, Layers } from "lucide-react";

interface ChatHeaderProps {
  onClose: () => void;
  onNewChat: () => void;
  status: "unconfigured" | "ready";
  lastUsage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  } | null;
}

export default function ChatHeader({
  onClose,
  onNewChat,
  status,
  lastUsage,
}: ChatHeaderProps) {
  return (
    <div className="border-b border-slate-700/50 bg-slate-900/95 backdrop-blur-xl">
      <div className="flex items-center justify-between px-4 pt-4 pb-3 text-gray-100">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-accent-500/20 border border-accent-500/30 rounded-lg flex items-center justify-center">
            <Bot size={18} className="text-accent-400" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">AI Assistant</h3>
            <p
              className={`text-xs ${status === "ready" ? "text-green-400/80" : "text-yellow-500/80"}`}
            >
              {status === "ready" ? "Ready" : "Not configured"}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={onNewChat}
            className="p-2 hover:bg-accent-500/20 text-gray-400 hover:text-accent-300 rounded-md transition-colors"
            title="New Chat"
          >
            <Plus size={18} />
          </button>
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
