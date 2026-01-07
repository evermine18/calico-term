import { User } from "lucide-react";

interface UserMessageProps {
  message: string;
  timestamp: string;
}

export default function UserMessage({ message, timestamp }: UserMessageProps) {
  return (
    <div className="flex justify-end animate-fade-in selectable-section">
      <div className="flex items-start space-x-2 max-w-[85%]">
        <div className="bg-cyan-500/15 backdrop-blur-sm border border-cyan-500/30 text-gray-100 rounded-2xl rounded-br-sm px-4 py-3">
          <p className="text-sm leading-relaxed">{message}</p>
          <span className="text-xs text-gray-500 mt-1 block">
            {timestamp}
          </span>
        </div>
        <div className="flex-shrink-0 w-8 h-8 bg-slate-700/60 border border-slate-600/50 rounded-lg flex items-center justify-center">
          <User size={14} className="text-gray-400" />
        </div>
      </div>
    </div>
  );
}
