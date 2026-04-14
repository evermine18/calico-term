import { Label } from "@renderer/components/ui/label";
import { Toggle } from "@renderer/components/ui/toggle";
import { Send, Terminal, X, Eye, ChevronDown, ChevronUp, CircleHelp, Wrench, FileText, History, BookOpen, Keyboard, TerminalSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTerminalContext } from "@renderer/contexts/terminal-context";

const SLASH_COMMANDS = [
  { command: "/explain", icon: CircleHelp, description: "Explain the last command or output", template: "Explain what the last command did and its output: " },
  { command: "/fix", icon: Wrench, description: "Diagnose and fix an error in the terminal", template: "Help me fix this error from the terminal: " },
  { command: "/command", icon: TerminalSquare, description: "Suggest a shell command for a task", template: "Suggest a shell command to: " },
  { command: "/script", icon: FileText, description: "Write a shell script", template: "Write a shell script that: " },
  { command: "/history", icon: History, description: "Analyze recent terminal activity", template: "Analyze my recent terminal activity and summarize: " },
  { command: "/man", icon: BookOpen, description: "Explain a command or its flags", template: "Explain this command and its options: " },
];

const QUICK_SUGGESTIONS = [
  "Explain the last command output",
  "What does this error mean?",
  "Suggest a command to find large files",
  "Write a script to back up this folder",
];

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
  const [showPreview, setShowPreview] = useState(false);
  const [terminalPreview, setTerminalPreview] = useState("");
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const { getActive } = useTerminalContext();

  // Update terminal preview when toggled
  useEffect(() => {
    if (enableTerminalContext && showPreview) {
      const termApi = getActive();
      setTerminalPreview(termApi?.getVisibleText() ?? "");
    }
  }, [enableTerminalContext, showPreview, getActive]);

  // Update terminal preview periodically
  useEffect(() => {
    if (!enableTerminalContext || !showPreview) return;
    
    const interval = setInterval(() => {
      const termApi = getActive();
      setTerminalPreview(termApi?.getVisibleText() ?? "");
    }, 2000);
    
    return () => clearInterval(interval);
  }, [enableTerminalContext, showPreview, getActive]);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "44px";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [inputText]);

  // Show/hide slash menu
  useEffect(() => {
    if (inputText.startsWith("/")) {
      setShowSlashMenu(true);
    } else {
      setShowSlashMenu(false);
    }
  }, [inputText]);

  // Show suggestions on focus when empty
  const handleFocus = () => {
    if (!inputText) {
      setShowSuggestions(true);
    }
  };

  const handleBlur = () => {
    // Delay to allow suggestion click
    setTimeout(() => setShowSuggestions(false), 200);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    setShowSuggestions(false);
  };

  const handleSubmit = () => {
    if (inputText.trim() && !disabled) {
      // Handle slash commands
      let messageToSend = inputText.trim();
      const slashCmd = SLASH_COMMANDS.find(cmd => messageToSend.startsWith(cmd.command + " ") || messageToSend === cmd.command);
      if (slashCmd && messageToSend === slashCmd.command) {
        // Just the command, show template
        setInputText(slashCmd.template);
        return;
      }
      
      onSendMessage(messageToSend);
      setInputText("");
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab" && showSlashMenu) {
      e.preventDefault();
      // Auto-complete first slash command
      const cmd = inputText.slice(1).toLowerCase();
      const match = SLASH_COMMANDS.find(c => c.command.startsWith("/" + cmd));
      if (match) {
        setInputText(match.command + " ");
        setShowSlashMenu(false);
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="p-4 border-t bg-slate-900/95 border-slate-700/50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Toggle
            aria-label="Toggle terminal context"
            pressed={enableTerminalContext}
            onPressedChange={(pressed) => {
              setEnableTerminalContext(pressed);
              if (pressed) setShowPreview(false);
            }}
            className="data-[state=on]:bg-accent-500/20 data-[state=on]:text-accent-400 data-[state=on]:border-accent-500/40 relative"
          >
            <Terminal className="h-3.5 w-3.5" />
            <Label className="ml-2 cursor-pointer">Terminal Context</Label>
            {enableTerminalContext && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent-400 rounded-full animate-pulse" />
            )}
          </Toggle>
          {enableTerminalContext && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="p-1.5 hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-slate-200"
              title={showPreview ? "Hide preview" : "Show preview"}
            >
              {showPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
        {enableTerminalContext && showPreview && (
          <span className="text-[10px] text-slate-500">
            {terminalPreview.length} chars captured
          </span>
        )}
      </div>

      {enableTerminalContext && showPreview && (
        <div className="mb-3 p-3 bg-slate-950/50 border border-slate-700/50 rounded-lg max-h-32 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wide">
              <Eye size={10} className="inline mr-1" />
              Terminal Preview
            </span>
            <button
              onClick={() => {
                const termApi = getActive();
                setTerminalPreview(termApi?.getVisibleText() ?? "");
              }}
              className="text-[10px] text-accent-400 hover:text-accent-300 transition-colors"
            >
              Refresh
            </button>
          </div>
          <pre className="text-[10px] font-mono text-slate-400 whitespace-pre-wrap line-clamp-6">
            {terminalPreview || "No terminal content available"}
          </pre>
        </div>
      )}

      <div className="flex items-end gap-2 relative">
        {/* Slash command menu */}
        {showSlashMenu && (
          <div className="absolute bottom-full left-0 mb-2 w-64 bg-slate-900 border border-slate-700/50 rounded-lg shadow-xl overflow-hidden z-50">
            <div className="p-2 border-b border-slate-700/50">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Slash Commands</p>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {SLASH_COMMANDS.filter(cmd => 
                cmd.command.startsWith(inputText.toLowerCase())
              ).map((cmd) => {
                const Icon = cmd.icon;
                return (
                  <button
                    key={cmd.command}
                    onClick={() => {
                      setInputText(cmd.command + " ");
                      setShowSlashMenu(false);
                      textareaRef.current?.focus();
                    }}
                    className="w-full px-3 py-2.5 text-left hover:bg-slate-800 transition-colors flex items-center gap-2"
                  >
                    <Icon size={14} className="text-accent-400" />
                    <div>
                      <p className="text-xs text-slate-200 font-mono">{cmd.command}</p>
                      <p className="text-[10px] text-slate-500">{cmd.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick suggestions */}
        {showSuggestions && !disabled && (
          <div className="absolute bottom-full left-0 mb-2 w-full">
            <div className="bg-slate-900/95 border border-slate-700/50 rounded-lg shadow-xl p-2">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-2">Quick Suggestions</p>
              <div className="flex flex-col gap-1">
                {QUICK_SUGGESTIONS.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputText(suggestion);
                      setShowSuggestions(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800 rounded transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Type your message… (Try /explain, /debug, etc.)"
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

      {/* Keyboard shortcuts hint */}
      <div className="relative mt-2">
        <button
          onMouseEnter={() => setShowShortcuts(true)}
          onMouseLeave={() => setShowShortcuts(false)}
          className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-1"
        >
          <Keyboard size={10} />
          Shortcuts
        </button>
        {showShortcuts && (
          <div className="absolute bottom-full left-0 mb-2 bg-slate-900 border border-slate-700/50 rounded-md shadow-lg p-3 min-w-[200px] z-50">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-2">Keyboard Shortcuts</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Send message</span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] font-mono text-slate-300">Enter</kbd>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">New line</span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] font-mono text-slate-300">Shift+Enter</kbd>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Auto-complete command</span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] font-mono text-slate-300">Tab</kbd>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Cancel editing</span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] font-mono text-slate-300">Esc</kbd>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
