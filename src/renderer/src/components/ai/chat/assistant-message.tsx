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
        <div className="flex-shrink-0 w-8 h-8 bg-cyan-500/20 border border-cyan-500/30 rounded-lg flex items-center justify-center">
          <Bot size={16} className="text-cyan-400" />
        </div>

        <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/40 text-gray-100 rounded-2xl rounded-bl-sm px-3 py-2.5 w-full min-w-0 max-w-full overflow-hidden">
          {isTyping ? (
            <div className="flex items-center space-x-2">
              <Loader
                size={14}
                className="animate-spin text-cyan-400"
              />
              <span className="text-sm text-gray-400">
                Typing...
              </span>
            </div>
          ) : (
            <>
              {error ? (
                <div className="text-red-400 mb-2">
                  <CircleX className="inline mr-1" size={18} />
                  <span className="font-medium">Error: </span>
                </div>
              ) : null}

              <MarkdownPreview
                source={message}
                style={{ padding: 1, background: "transparent" }}
              />

              <span className="text-xs text-gray-500 mt-1 block">
                {timestamp}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
