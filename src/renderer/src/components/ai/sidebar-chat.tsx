import { useAppContext } from "@renderer/contexts/app-context";
import { useEffect, useRef, useState } from "react";
import {
  AssistantMessage,
  ChatHeader,
  MessageInput,
  UserMessage,
} from "./chat";
import { MessageCircle } from "lucide-react";

export default function AISidebarChat() {
  const { aiSidebarOpen, setAiSidebarOpen } = useAppContext();

  const [messages, setMessages] = useState([
    {
      id: 1,
      type: "assistant",
      content: "Hi, how can I assist you today?",
      timestamp: new Date().toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const simulateAIResponse = async (_userMessage) => {
    setIsTyping(true);

    // Simular tiempo de respuesta
    await new Promise((resolve) =>
      setTimeout(resolve, 1000 + Math.random() * 2000)
    );

    const newMessage = {
      id: Date.now(),
      type: "assistant",
      content: "Test AI response",
      timestamp: new Date().toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, newMessage]);
    setIsTyping(false);
  };

  const handleSendMessage = async (messageText) => {
    const userMessage = {
      id: Date.now(),
      type: "user",
      content: messageText,
      timestamp: new Date().toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, userMessage]);
    await simulateAIResponse(messageText);
  };

  const handleNewChat = () => {
    setMessages([
      {
        id: 1,
        type: "assistant",
        content: "Hi, how can I assist you today?",
        timestamp: new Date().toLocaleTimeString("es-ES", {
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

      {!isMinimized && (
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
      )}

      {isMinimized && (
        <div className="p-4 text-center text-gray-400 bg-[var(--color-background)] flex-1 flex items-center justify-center">
          <div>
            <MessageCircle size={24} className="mx-auto mb-2" />
            <p className="text-sm">Chat minimizado</p>
          </div>
        </div>
      )}
    </div>
  );
}
