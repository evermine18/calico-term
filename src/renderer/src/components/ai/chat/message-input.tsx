import { Label } from "@renderer/components/ui/label";
import { Toggle } from "@renderer/components/ui/toggle";
import { Send, Terminal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  onCancel: () => void;
  enableTerminalContext: boolean;
  setEnableTerminalContext: (enabled: boolean) => void;
  disabled?: boolean;
}

export default function MessageInput({
  onSendMessage,
  onCancel,
  enableTerminalContext,
  setEnableTerminalContext,
  disabled,
}: MessageInputProps) {
  const [inputText, setInputText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "44px";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [inputText]);

  const handleSubmit = () => {
    if (inputText.trim() && !disabled) {
      onSendMessage(inputText.trim());
      setInputText("");
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
          className="data-[state=on]:bg-accent-500/20 data-[state=on]:text-accent-400 data-[state=on]:border-accent-500/40"
        >
          <Terminal className="h-3.5 w-3.5" />
          <Label className="ml-2 cursor-pointer">Terminal Context</Label>
        </Toggle>
      </div>
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message…"
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-lg bg-slate-950 border border-slate-700/50 px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:border-accent-500/50 focus:outline-none focus:ring-2 focus:ring-accent-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all overflow-hidden"
          style={{ minHeight: "44px", maxHeight: "120px" }}
        />
        {disabled ? (
          <button
            onClick={onCancel}
            className="shrink-0 w-9 h-9 mb-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-md flex items-center justify-center transition-all"
            title="Cancel"
          >
            <X size={16} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!inputText.trim()}
            className="shrink-0 w-9 h-9 mb-1 bg-accent-500/20 hover:bg-accent-500/30 disabled:bg-transparent disabled:cursor-not-allowed text-accent-400 disabled:text-gray-600 border border-accent-500/30 disabled:border-transparent rounded-md flex items-center justify-center transition-all"
          >
            <Send size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
