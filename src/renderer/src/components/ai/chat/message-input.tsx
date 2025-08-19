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
    <div className="p-4 border-t bg-[var(--color-background-soft)] border-[var(--color-background-mute)]">
      <div className="flex items-center justify-between mb-2">
        <Toggle
          aria-label="Toggle italic"
          pressed={enableTerminalContext}
          onPressedChange={(pressed) => setEnableTerminalContext(pressed)}
        >
          <Terminal className="h-2 w-2" />
          <Label>Show Terminal</Label>
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
            className="w-full resize-none rounded-xl bg-[var(--color-background)] border border-[var(--color-background-mute)] px-4 py-3 pr-12 text-sm text-[var(--color-text)] placeholder-[var(--color-text-2)] focus:border-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-text-2)] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: "44px", maxHeight: "120px" }}
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!inputText.trim() || disabled}
          className="flex-shrink-0 w-11 h-11 bg-[var(--color-background-mute)] hover:bg-[var(--color-background)] disabled:bg-[var(--color-background)] disabled:cursor-not-allowed text-[var(--color-text)] rounded-xl flex items-center justify-center transition-colors"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
