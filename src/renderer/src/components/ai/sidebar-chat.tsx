import { useAppContext } from "@renderer/contexts/app-context";
import { useEffect, useRef, useState } from "react";
import {
  AssistantMessage,
  ChatHeader,
  MessageInput,
  UserMessage,
} from "./chat";
import { useTerminalContext } from "@renderer/contexts/terminal-context";
import { ArrowDown } from "lucide-react";
import type { Conversation } from "./chat/conversation-types";
import { loadConversations, saveConversations } from "./chat/conversation-types";
import ConversationList from "./chat/conversation-list";
import type { ChatMessage } from "./chat/conversation-types";

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
    setSelectedModel,
    apiUrl,
    hasApiKey,
    aiSystemPrompt,
    aiTemperature,
    aiMaxTokens,
    aiProvider,
    setAiProvider,
  } = useAppContext();
  const [enableTerminalContext, setEnableTerminalContext] = useState(false);
  const { getActive } = useTerminalContext();
  const [width, setWidth] = useState(loadWidth);
  const resizingRef = useRef(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [isTyping, setIsTyping] = useState(false);
  const [lastUsage, setLastUsage] = useState<{
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 2;
  
  // Conversation management
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [showConvList, setShowConvList] = useState(false);
  const [convName, setConvName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  
  // Simulate initial load
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);
  
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const activeStreamId = useRef<string | null>(null);
  const cleanupStreamRef = useRef<(() => void) | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Detect if user has scrolled up manually
  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setAutoScroll(isNearBottom);
  };

  // Persist conversations (except initial empty load)
  useEffect(() => {
    if (conversations.length > 0 || currentConvId) {
      saveConversations(conversations);
    }
  }, [conversations, currentConvId]);

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
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, autoScroll]);

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
      
      // Auto-retry on network errors (up to maxRetries)
      if (retryCount < maxRetries && (errorMsg.includes("network") || errorMsg.includes("fetch") || errorMsg.includes("ECONNREFUSED"))) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          const lastUserMsg = allMessages.filter(m => m.type === "user").pop();
          if (lastUserMsg) {
            handleRetry(assistantMsgId);
          }
        }, 2000);
      }
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
    setRetryCount(0);
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

  const handleRetry = (failedMsgId: number) => {
    const idx = messages.findIndex((m) => m.id === failedMsgId);
    if (idx <= 0) return;
    const history = messages.slice(0, idx);
    setMessages(history);
    sendMessageToAI(history);
  };

  const handleEditMessage = (msgId: number, newMessage: string) => {
    const idx = messages.findIndex((m) => m.id === msgId);
    if (idx === -1 || messages[idx].type !== "user") return;
    
    const updated = messages.map((m) =>
      m.id === msgId ? { ...m, content: newMessage } : m
    );
    setMessages(updated);
    
    const history = updated.slice(0, idx + 1);
    setMessages(history);
    sendMessageToAI(history);
  };

  // Conversation management functions
  const handleNewConversation = () => {
    // Auto-save current conversation if it has messages
    if (messages.length > 1 && currentConvId) {
      handleSaveConversation();
    }
    
    handleCancel();
    setLastUsage(null);
    setRetryCount(0);
    setCurrentConvId(null);
    const fresh = [
      {
        ...INITIAL_MESSAGE,
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ];
    setMessages(fresh);
  };

  const handleSaveConversation = () => {
    if (messages.length <= 1) return; // Don't save empty conversations
    
    const name = convName || messages.find(m => m.type === "user")?.content.slice(0, 50) || "Conversation";
    const now = new Date().toISOString();
    
    if (currentConvId) {
      // Update existing
      setConversations(prev => prev.map(c => 
        c.id === currentConvId 
          ? { ...c, messages, name, updatedAt: now }
          : c
      ));
    } else {
      // Create new
      const newConv: Conversation = {
        id: crypto.randomUUID(),
        name,
        createdAt: now,
        updatedAt: now,
        messages,
      };
      setConversations(prev => [newConv, ...prev]);
      setCurrentConvId(newConv.id);
    }
    setConvName("");
  };

  const handleLoadConversation = (conv: Conversation) => {
    // Save current first if needed
    if (messages.length > 1 && currentConvId) {
      handleSaveConversation();
    }
    
    setCurrentConvId(conv.id);
    setMessages(conv.messages);
    setConvName(conv.name);
    setShowConvList(false);
    setRetryCount(0);
    setLastUsage(null);
  };

  const handleDeleteConversation = (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (currentConvId === id) {
      handleNewConversation();
    }
  };

  const handleExportConversation = () => {
    // Generate markdown format
    const md = messages.map(m => {
      const role = m.type === "user" ? "You" : "Assistant";
      const prefix = m.error ? "⚠️ Error: " : "";
      return `### ${role} (${m.timestamp})\n\n${prefix}${m.content}`;
    }).join("\n\n---\n\n");

    const header = `# AI Conversation\n\n**Exported:** ${new Date().toLocaleString()}\n**Messages:** ${messages.length}\n\n---\n\n`;
    const content = header + md;

    // Save to file
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversation-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyConversation = () => {
    const text = messages.map(m => {
      const role = m.type === "user" ? "You" : "Assistant";
      const prefix = m.error ? "[Error] " : "";
      return `${role} (${m.timestamp}):\n${prefix}${m.content}`;
    }).join("\n\n---\n\n");

    window.api.clipboard.writeText(text);
  };

  const connectionStatus: "unconfigured" | "ready" =
    !apiUrl || (aiProvider !== "ollama" && !hasApiKey)
      ? "unconfigured"
      : "ready";

  if (!aiSidebarOpen) return null;

  if (isLoading) {
    return (
      <div
        className="absolute right-0 top-0 bottom-0 h-full bg-slate-900/95 backdrop-blur-md border-l border-slate-700/50 flex flex-col z-10 shadow-2xl"
        style={{ width }}
      >
        <div
          onMouseDown={startResizing}
          className="absolute left-0 top-0 h-full w-1 cursor-ew-resize bg-transparent hover:bg-accent-500/30 active:bg-accent-500/50 z-1 transition-colors"
        />
        {/* Skeleton header */}
        <div className="border-b border-slate-700/50 bg-slate-900/95 backdrop-blur-xl">
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-slate-800 rounded-lg animate-pulse" />
              <div>
                <div className="w-24 h-4 bg-slate-800 rounded animate-pulse mb-1" />
                <div className="w-12 h-3 bg-slate-800 rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>
        
        {/* Skeleton messages */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-950">
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                <div className={`space-y-2 ${i % 2 === 0 ? "max-w-[85%]" : "max-w-[90%]"}`}>
                  <div className={`h-8 bg-slate-800 rounded-2xl animate-pulse ${i % 2 === 0 ? "rounded-br-sm" : "rounded-bl-sm"}`} style={{ width: `${60 + Math.random() * 40}%` }} />
                  <div className="h-3 bg-slate-800 rounded animate-pulse ml-2" style={{ width: "40px" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Skeleton input */}
        <div className="p-4 border-t bg-slate-900/95 border-slate-700/50">
          <div className="h-11 bg-slate-800 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

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
        onNewChat={handleNewConversation}
        status={connectionStatus}
        lastUsage={lastUsage}
        onSaveConversation={handleSaveConversation}
        onToggleConvList={() => setShowConvList(!showConvList)}
        onExportConversation={handleExportConversation}
        onCopyConversation={handleCopyConversation}
        hasUnsavedChanges={messages.length > 1 && !currentConvId}
        aiProvider={aiProvider}
        selectedModel={selectedModel}
        onProviderChange={(provider) => setAiProvider(provider as AIProvider)}
        onModelChange={(model) => setSelectedModel(model)}
      />

      {showConvList ? (
        <div className="flex-1 overflow-hidden flex flex-col">
          <ConversationList
            conversations={conversations}
            currentId={currentConvId}
            onSelect={handleLoadConversation}
            onDelete={handleDeleteConversation}
            onNew={handleNewConversation}
          />
        </div>
      ) : (
        <>
        <div className="flex-1 overflow-y-auto p-4 bg-slate-950 relative" ref={chatContainerRef} onScroll={handleScroll}>
          <div className="flex flex-col gap-3">
            {messages.map((message) =>
              message.type === "user" ? (
                <UserMessage
                  key={message.id}
                  message={message.content}
                  timestamp={message.timestamp}
                  onEdit={(newMsg) => handleEditMessage(message.id, newMsg)}
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
          
          {/* Scroll to bottom button */}
          {!autoScroll && (
            <button
              onClick={() => {
                setAutoScroll(true);
                setTimeout(() => {
                  messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                }, 10);
              }}
              className="absolute bottom-4 right-4 w-10 h-10 bg-accent-500/20 hover:bg-accent-500/30 border border-accent-500/40 rounded-full flex items-center justify-center transition-all shadow-lg backdrop-blur-sm"
              title="Scroll to bottom"
            >
              <ArrowDown size={18} className="text-accent-400" />
            </button>
          )}
        </div>
        <MessageInput
          onSendMessage={handleSendMessage}
          onCancel={handleCancel}
          enableTerminalContext={enableTerminalContext}
          setEnableTerminalContext={setEnableTerminalContext}
          disabled={isTyping}
        />
        </>
      )}
    </div>
  );
}
