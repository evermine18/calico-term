import { Bot, CircleX, Loader } from "lucide-react";
import MarkdownPreview from "@uiw/react-markdown-preview";
interface AssistantMessageProps {
  message: string;
  timestamp: string;
  isTyping?: boolean;
  error?: boolean;
}

export default function AssistantMessage({
  message,
  timestamp,
  isTyping = false,
  error = false,
}: AssistantMessageProps) {
  return (
    <div className="flex justify-start animate-fade-in selectable-section">
      <div className="flex items-start space-x-2 max-w-[90%] min-w-0">
        <div className="flex-shrink-0 w-8 h-8 bg-[var(--color-background-mute)] rounded-full flex items-center justify-center">
          <Bot size={16} className="text-[var(--color-text-2)]" />
        </div>

        <div className="bg-[var(--color-background-soft)] text-[var(--color-text)] rounded-2xl rounded-bl-sm px-2 py-2 w-full min-w-0 max-w-full overflow-hidden">
          {isTyping ? (
            <div className="flex items-center space-x-1">
              <Loader
                size={14}
                className="animate-spin text-[var(--color-text-2)]"
              />
              <span className="text-sm text-[var(--color-text-2)]">
                Typing...
              </span>
            </div>
          ) : (
            <>
              {error ? (
                <div className="text-red-400">
                  <CircleX className="inline mr-1" size={18} />
                  <span>Error: </span>
                </div>
              ) : null}

              <MarkdownPreview
                source={message}
                style={{ padding: 1, background: "transparent" }}
              />

              <span className="text-xs text-[var(--color-text-2)] mt-1 block">
                {timestamp}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
