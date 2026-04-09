import { useAppContext } from "@renderer/contexts/app-context";
import { useEffect, useRef, useState } from "react";
import {
  AssistantMessage,
  ChatHeader,
  MessageInput,
  UserMessage,
} from "./chat";
import { useTerminalContext } from "@renderer/contexts/terminal-context";

type ChatMessage = {
  id: number;
  type: "user" | "assistant";
  error: boolean;
  content: string;
  timestamp: string;
};

const INITIAL_MESSAGE: ChatMessage = {
  id: 1,
  type: "assistant",
  error: false,
  content: "Hi, how can I assist you today?",
  timestamp: new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }),
};

function loadHistory(): ChatMessage[] {
  try {
    const stored = localStorage.getItem("aiChatHistory");
    if (stored) return JSON.parse(stored) as ChatMessage[];
  } catch {
    // corrupt storage — ignore
  }
  return [INITIAL_MESSAGE];
}

function defaultBaseUrl(provider: string): string {
  if (provider === "anthropic") return "https://api.anthropic.com";
  if (provider === "ollama") return "http://localhost:11434";
  return "https://api.openai.com";
}

function loadWidth(): number {
  const stored = localStorage.getItem("aiSidebarWidth");
  if (stored) {
    const n = parseInt(stored, 10);
    if (!isNaN(n)) return Math.min(700, Math.max(260, n));
  }
  return 384;
}

export default function AISidebarChat() {
  const {
    aiSidebarOpen,
    setAiSidebarOpen,
    selectedModel,
    apiUrl,
    hasApiKey,
    aiSystemPrompt,
    aiTemperature,
    aiMaxTokens,
    aiProvider,
  } = useAppContext();
  const [enableTerminalContext, setEnableTerminalContext] = useState(false);
  const { getActive } = useTerminalContext();
  const [width, setWidth] = useState(loadWidth);
  const resizingRef = useRef(false);
  const [messages, setMessages] = useState<ChatMessage[]>(loadHistory);
  const [isTyping, setIsTyping] = useState(false);
  const [lastUsage, setLastUsage] = useState<{
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const activeStreamId = useRef<string | null>(null);
  const cleanupStreamRef = useRef<(() => void) | null>(null);

  // Persist chat history
  useEffect(() => {
    localStorage.setItem("aiChatHistory", JSON.stringify(messages));
  }, [messages]);

  // Persist sidebar width
  useEffect(() => {
    localStorage.setItem("aiSidebarWidth", String(width));
  }, [width]);

  // Resize drag
  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    document.body.style.userSelect = "none";
  };
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const newWidth = Math.min(
        700,
        Math.max(260, window.innerWidth - e.clientX),
      );
      setWidth(newWidth);
    };
    const stopResizing = () => {
      if (resizingRef.current) {
        resizingRef.current = false;
        document.body.style.userSelect = "";
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const sendMessageToAI = (allMessages: ChatMessage[]) => {
    setIsTyping(true);
    const termApi = getActive();
    const screen = termApi?.getVisibleText() ?? "";
    const streamId = Date.now().toString();
    activeStreamId.current = streamId;

    const assistantMsgId = Date.now() + 1;
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMsgId,
        type: "assistant",
        error: false,
        content: "",
        timestamp: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);

    const handleChunk = (_event: any, id: string, delta: string) => {
      if (id !== streamId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, content: m.content + delta } : m,
        ),
      );
    };

    const handleDone = (
      _event: any,
      id: string,
      usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      } | null,
    ) => {
      if (id !== streamId) return;
      if (usage) setLastUsage(usage);
      cleanup();
      setIsTyping(false);
    };

    const handleError = (_event: any, id: string, errorMsg: string) => {
      if (id !== streamId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, error: true, content: errorMsg }
            : m,
        ),
      );
      cleanup();
      setIsTyping(false);
    };

    const cleanup = () => {
      window.electron.ipcRenderer.removeListener(
        "ai-stream-chunk",
        handleChunk,
      );
      window.electron.ipcRenderer.removeListener("ai-stream-done", handleDone);
      window.electron.ipcRenderer.removeListener(
        "ai-stream-error",
        handleError,
      );
      cleanupStreamRef.current = null;
      activeStreamId.current = null;
    };
    cleanupStreamRef.current = cleanup;

    window.electron.ipcRenderer.on("ai-stream-chunk", handleChunk);
    window.electron.ipcRenderer.on("ai-stream-done", handleDone);
    window.electron.ipcRenderer.on("ai-stream-error", handleError);

    window.electron.ipcRenderer.send(
      "send-ai-message",
      streamId,
      apiUrl || defaultBaseUrl(aiProvider),
      selectedModel,
      allMessages,
      enableTerminalContext ? screen : undefined,
      aiSystemPrompt,
      aiTemperature,
      aiMaxTokens,
      aiProvider,
    );
  };

  const handleSendMessage = (messageText: string) => {
    const userMessage: ChatMessage = {
      id: Date.now(),
      type: "user",
      error: false,
      content: messageText,
      timestamp: new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    const updated = [...messages, userMessage];
    setMessages(updated);
    sendMessageToAI(updated);
  };

  const handleCancel = () => {
    if (activeStreamId.current) {
      window.electron.ipcRenderer.send(
        "ai-stream-cancel",
        activeStreamId.current,
      );
    }
    cleanupStreamRef.current?.();
    setIsTyping(false);
  };

  const handleNewChat = () => {
    handleCancel();
    setLastUsage(null);
    const fresh = [
      {
        ...INITIAL_MESSAGE,
        timestamp: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ];
    setMessages(fresh);
    localStorage.setItem("aiChatHistory", JSON.stringify(fresh));
  };

  const handleRetry = (failedMsgId: number) => {
    // Find the user message before the failed assistant message
    const idx = messages.findIndex((m) => m.id === failedMsgId);
    if (idx <= 0) return;
    // Remove the failed message and resend from the previous history
    const history = messages.slice(0, idx);
    setMessages(history);
    sendMessageToAI(history);
  };

  const connectionStatus: "unconfigured" | "ready" =
    !apiUrl || (aiProvider !== "ollama" && !hasApiKey)
      ? "unconfigured"
      : "ready";

  if (!aiSidebarOpen) return null;

  return (
    <div
      className="absolute right-0 top-0 bottom-0 h-full bg-slate-900/95 backdrop-blur-md border-l border-slate-700/50 flex flex-col z-10 shadow-2xl"
      style={{ width }}
    >
      <div
        onMouseDown={startResizing}
        className="absolute left-0 top-0 h-full w-1 cursor-ew-resize bg-transparent hover:bg-accent-500/30 active:bg-accent-500/50 z-1 transition-colors"
        title="Resize sidebar"
      />
      <ChatHeader
        onClose={() => setAiSidebarOpen(false)}
        onNewChat={handleNewChat}
        status={connectionStatus}
        lastUsage={lastUsage}
      />

      <>
        <div className="flex-1 overflow-y-auto p-4 bg-slate-950">
          <div className="flex flex-col gap-3">
            {messages.map((message) =>
              message.type === "user" ? (
                <UserMessage
                  key={message.id}
                  message={message.content}
                  timestamp={message.timestamp}
                />
              ) : (
                <AssistantMessage
                  key={message.id}
                  message={message.content}
                  timestamp={message.timestamp}
                  error={message.error}
                  isTyping={
                    isTyping && message.content === "" && !message.error
                  }
                  onExecute={(cmd) => getActive()?.sendInput(cmd)}
                  onRetry={
                    message.error ? () => handleRetry(message.id) : undefined
                  }
                />
              ),
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
        <MessageInput
          onSendMessage={handleSendMessage}
          onCancel={handleCancel}
          enableTerminalContext={enableTerminalContext}
          setEnableTerminalContext={setEnableTerminalContext}
          disabled={isTyping}
        />
      </>
    </div>
  );
}
