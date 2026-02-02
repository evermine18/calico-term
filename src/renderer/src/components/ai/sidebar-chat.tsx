import { useAppContext } from "@renderer/contexts/app-context";
import { useEffect, useRef, useState } from "react";
import {
  AssistantMessage,
  ChatHeader,
  MessageInput,
  UserMessage,
} from "./chat";
import { useTerminalContext } from "@renderer/contexts/terminal-context";

export default function AISidebarChat() {
  const { aiSidebarOpen, setAiSidebarOpen, selectedModel, apiKey } =
    useAppContext();
  const [enableTerminalContext, setEnableTerminalContext] = useState(false);
  const { getActive } = useTerminalContext();
  const [width, setWidth] = useState(384);
  const resizingRef = useRef(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: "assistant",
      error: false,
      content: "Hi, how can I assist you today?",
      timestamp: new Date().toLocaleTimeString("en-EN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    document.body.style.userSelect = "none";
  };
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      // Sidebar is anchored to the right: calculate from right edge
      const newWidth = Math.min(
        700,
        Math.max(260, window.innerWidth - e.clientX)
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

  const sendMessageToAI = async (messages) => {
    setIsTyping(true);
    const api = getActive();
    const screen = api?.getVisibleText() ?? "";

    try {
      const response = await window.electron.ipcRenderer.invoke(
        "send-ai-message",
        "https://api.openai.com",
        apiKey,
        selectedModel,
        messages,
        enableTerminalContext ? screen : undefined
      );
      console.log("AI response:", response);
      if (!response) {
        setIsTyping(false);
        return;
      }

      const newMessage = {
        id: Date.now(),
        type: "assistant",
        error: false,
        content: response,
        timestamp: new Date().toLocaleTimeString("en-EN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, newMessage]);
    } catch (error) {
      const errorMSG = {
        id: Date.now(),
        type: "assistant",
        error: true,
        content: `\n\n\`\`\`\n${error}\n\`\`\``,
        timestamp: new Date().toLocaleTimeString("en-EN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, errorMSG]);
      console.error("Error sending message to AI: ", error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSendMessage = async (messageText) => {
    const userMessage = {
      id: Date.now(),
      type: "user",
      error: false,
      content: messageText,
      timestamp: new Date().toLocaleTimeString("en-EN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, userMessage]);
    await sendMessageToAI([...messages, userMessage]);
  };

  const handleNewChat = () => {
    setMessages([
      {
        id: 1,
        type: "assistant",
        error: false,
        content: "Hi, how can I assist you today?",
        timestamp: new Date().toLocaleTimeString("en-EN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);
  };

  if (!aiSidebarOpen) return null;

  return (
    <div
      className="absolute right-0 top-0 bottom-0 h-full bg-slate-900/95 backdrop-blur-md border-l border-slate-700/50 flex flex-col z-10 shadow-2xl"
      style={{ width }}
    >
      <div
        onMouseDown={startResizing}
        className="absolute left-0 top-0 h-full w-1 cursor-ew-resize bg-transparent hover:bg-cyan-500/30 active:bg-cyan-500/50 z-1 transition-colors"
        title="Resize sidebar"
      />
      <ChatHeader
        onClose={() => setAiSidebarOpen(false)}
        onNewChat={handleNewChat}
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
                />
              )
            )}

            {isTyping && (
              <AssistantMessage isTyping={true} message={""} timestamp={""} />
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <MessageInput
          onSendMessage={handleSendMessage}
          enableTerminalContext={enableTerminalContext}
          setEnableTerminalContext={setEnableTerminalContext}
          disabled={isTyping}
        />
      </>
    </div>
  );
}
