import { Bot, X, Plus } from "lucide-react";

interface ChatHeaderProps {
  onClose: () => void;
  onNewChat: () => void;
}

export default function ChatHeader({ onClose, onNewChat }: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between p-4 border-b bg-slate-900/95 backdrop-blur-xl border-slate-700/50 text-gray-100">
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 bg-cyan-500/20 border border-cyan-500/30 rounded-lg flex items-center justify-center">
          <Bot size={18} className="text-cyan-400" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">AI Assistant</h3>
          <p className="text-xs text-cyan-400/80">Connected</p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={onNewChat}
          className="p-2 hover:bg-cyan-500/20 text-gray-400 hover:text-cyan-300 rounded-md transition-colors"
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
  );
}
