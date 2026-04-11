export interface Conversation {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export type ChatMessage = {
  id: number;
  type: "user" | "assistant";
  error: boolean;
  content: string;
  timestamp: string;
};

export function loadConversations(): Conversation[] {
  try {
    const stored = localStorage.getItem("aiConversations");
    if (stored) return JSON.parse(stored) as Conversation[];
  } catch {
    // corrupt storage — ignore
  }
  return [];
}

export function saveConversations(conversations: Conversation[]) {
  localStorage.setItem("aiConversations", JSON.stringify(conversations));
}

export function createConversation(name: string): Conversation {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}
