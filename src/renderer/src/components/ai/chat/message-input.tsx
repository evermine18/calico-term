import { Label } from "@renderer/components/ui/label";
import { Toggle } from "@renderer/components/ui/toggle";
import { Send, Terminal } from "lucide-react";
import { useRef, useState } from "react";

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  enableTerminalContext: boolean;
  setEnableTerminalContext: (enabled: boolean) => void;
  disabled?: boolean;
}

export default function MessageInput({
  onSendMessage,
  enableTerminalContext,
  setEnableTerminalContext,
  disabled,
}: MessageInputProps) {
  const [inputText, setInputText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (inputText.trim() && !disabled) {
      onSendMessage(inputText.trim());
      setInputText("");
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="p-4 border-t bg-slate-900/95 border-slate-700/50">
      <div className="flex items-center justify-between mb-2">
        <Toggle
          aria-label="Toggle terminal context"
          pressed={enableTerminalContext}
          onPressedChange={(pressed) => setEnableTerminalContext(pressed)}
          className="data-[state=on]:bg-cyan-500/20 data-[state=on]:text-cyan-400 data-[state=on]:border-cyan-500/40"
        >
          <Terminal className="h-3.5 w-3.5" />
          <Label className="ml-2 cursor-pointer">Terminal Context</Label>
        </Toggle>
      </div>
      <div className="flex items-end space-x-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            disabled={disabled}
            rows={1}
            className="w-full resize-none rounded-lg bg-slate-950 border border-slate-700/50 px-4 py-3 pr-12 text-sm text-gray-100 placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            style={{ minHeight: "44px", maxHeight: "120px" }}
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!inputText.trim() || disabled}
          className="flex-shrink-0 w-11 h-11 bg-cyan-500/20 hover:bg-cyan-500/30 disabled:bg-slate-800/50 disabled:cursor-not-allowed text-cyan-400 disabled:text-gray-600 border border-cyan-500/30 disabled:border-slate-700/50 rounded-lg flex items-center justify-center transition-all"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
