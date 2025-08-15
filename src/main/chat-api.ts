import { net } from "electron";

type ChatMessage = {
  id: number;
  type: string;
  content: string;
  timestamp: string;
};

export async function sendChat(
  basepath: string,
  apiKey: string,
  selectedModel: string,
  messages: ChatMessage[],
  terminalContent = undefined
): Promise<string> {
  let context = [];
  const parsedMessages = parseMessages(messages);
  // Append a developer message to the chat history at the start
  const dev_prompt = {
    role: "developer",
    content: `You are "Calico Assistant", an AI embedded in a *nix command-line environment.  
Goal: turn DevOps requests into safe, clear, and reproducible shell commands.

Rules:
1. Respond in the user's language.  
2. Format:  
   a) Single \`\`\`bash\`\`\` block with commands.  
   b) Brief explanation (<4 lines).  
   c) Add a "precaution checklist" only if there's a destructive risk.  
3. Ask before acting if critical context is missing.  
4. Prefer read-only/dry-run modes and staging environments; require "CONFIRM" for irreversible actions.  
5. Never include secrets; use placeholders like <TOKEN>.  
6. Mention risks and possible mitigations if relevant.  
7. Use variables ($APP, $ENV) for reusability and avoid obscure one-liners if they reduce clarity.`,
  };
  context.push(dev_prompt);
  if (terminalContent) {
    context = [
      {
        role: "developer",
        content: `The users current Terminal context is:\n\n${terminalContent}`,
      },
    ];
  }
  context.push(...parsedMessages);
  //https://api.openai.com/v1/chat/completions
  try {
    const res = await net.fetch(`${basepath}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: context,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`OpenAI API error: ${res.status} - ${errorText}`);
    }

    const data = await res.json();
    console.log("AI response data:", data.choices[0].message);

    return data.choices[0].message.content;
  } catch (error) {
    console.error("Error sending chat to OpenAI:", error);
    throw error;
  }
}

function parseMessages(
  messages: ChatMessage[]
): { role: string; content: string }[] {
  return messages.map((msg) => ({
    role: msg.type === "user" ? "user" : "assistant",
    content: msg.content,
  }));
}

export async function getModels(
  basepath: string,
  apiKey: string
): Promise<string[]> {
  try {
    const res = await net.fetch(`${basepath}/v1/models`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`OpenAI API error: ${res.status} - ${errorText}`);
    }

    const data = await res.json();
    if (data.data) {
      const ids: string[] = data.data.map((item) => item.id);
      return ids;
    }
    throw new Error("Unexpected response format from OpenAI API");
  } catch (error) {
    console.error("Error sending chat to OpenAI:", error);
    throw error;
  }
}
