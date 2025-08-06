import { User } from "lucide-react";

interface UserMessageProps {
  message: string;
  timestamp: string;
}

export default function UserMessage({ message, timestamp }: UserMessageProps) {
  return (
    <div className="flex justify-end animate-fade-in">
      <div className="flex items-start space-x-2 max-w-[85%]">
        <div className="bg-[var(--color-background-soft)] text-[var(--color-text)] rounded-2xl rounded-br-sm px-4 py-3">
          <p className="text-sm leading-relaxed">{message}</p>
          <span className="text-xs text-[var(--color-text-2)] mt-1 block">
            {timestamp}
          </span>
        </div>
        <div className="flex-shrink-0 w-6 h-6 bg-[var(--color-background-mute)] rounded-full flex items-center justify-center">
          <User size={14} className="text-[var(--color-text-2)]" />
        </div>
      </div>
    </div>
  );
}
