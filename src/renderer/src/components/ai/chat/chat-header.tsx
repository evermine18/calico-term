import { Bot, X, RotateCcw, Plus } from "lucide-react";

interface ChatHeaderProps {
  onClose: () => void;
  onNewChat: () => void;
}

export default function ChatHeader({ onClose, onNewChat }: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between p-4 border-b bg-gray-900/95 backdrop-blur-xl border-gray-700/30 text-gray-100">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
          <Bot size={18} />
        </div>
        <div>
          <h3 className="font-semibold text-sm">AI</h3>
          <p className="text-xs text-blue-100">Connected</p>
        </div>
      </div>
      <div className="flex items-center space-x-7">
        <button
          onClick={onNewChat}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          title="Nueva conversación"
        >
          <Plus size={16} />
        </button>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          title={"Close"}
        >
          <X size={16} className={`transform transition-transform`} />
        </button>
      </div>
    </div>
  );
}
