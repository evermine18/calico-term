import { useAppContext } from "@renderer/contexts/app-context";
import { useEffect, useRef, useState } from "react";
import {
  AssistantMessage,
  ChatHeader,
  MessageInput,
  UserMessage,
} from "./chat";

export default function AISidebarChat() {
  const { aiSidebarOpen, setAiSidebarOpen, selectedModel } = useAppContext();

  const [messages, setMessages] = useState([
    {
      id: 1,
      type: "assistant",
      content: "Hi, how can I assist you today?",
      timestamp: new Date().toLocaleTimeString("en-EN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const sendMessageToAI = async (messages) => {
    setIsTyping(true);
    try {
      const response = await window.electron.ipcRenderer.invoke(
        "send-ai-message",
        "https://api.openai.com",
        selectedModel,
        messages
      );
      console.log("AI response:", response);
      if (!response) {
        setIsTyping(false);
        return;
      }

      const newMessage = {
        id: Date.now(),
        type: "assistant",
        content: response,
        timestamp: new Date().toLocaleTimeString("en-EN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, newMessage]);
    } catch (error) {
      console.error("Error sending message to AI:", error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSendMessage = async (messageText) => {
    const userMessage = {
      id: Date.now(),
      type: "user",
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
    <div className="absolute right-0 top-0 bottom-0 w-96 h-full bg-[var(--color-background-soft)] border-l border-[var(--color-background-mute)] flex flex-col z-50">
      <ChatHeader
        onClose={() => setAiSidebarOpen(false)}
        onNewChat={handleNewChat}
      />

      <>
        <div className="flex-1 overflow-y-auto p-4 bg-[var(--color-background)]">
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
                />
              )
            )}

            {isTyping && (
              <AssistantMessage isTyping={true} message={""} timestamp={""} />
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <MessageInput onSendMessage={handleSendMessage} disabled={isTyping} />
      </>
    </div>
  );
}
