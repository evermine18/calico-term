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
    role: "system" as const,
    content: `You are a DevOps/SRE assistant.
STYLE (MANDATORY):
- Answer in Markdown.
- Put ANY command or multi-line snippet inside fenced code blocks with a language tag.
- Do NOT put commands as list items; explain first, then the code block.
- Commands must be copy-paste ready (no leading $).
- Answer ONLY what the user explicitly asks.
- If highly relevant, you may add ONE short extra tip or recommendation at the end, formatted as a blockquote (>).
`,
  };
  if (terminalContent) {
    context.push({
      role: "developer",
      content: `The users current Terminal context is:\n\n${terminalContent}`,
    });
    console.log("[AI Chat] Terminal context detected!");
  }
  context.push(dev_prompt);
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
