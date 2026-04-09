import { net } from "electron";

type ChatMessage = {
  id: number;
  type: string;
  content: string;
  timestamp: string;
};

const defaultSystemContent = `You are an expert DevOps/SRE/systems engineer assistant embedded in a terminal emulator.

## CONTEXT
- The user is working directly in a terminal. Prefer commands and practical solutions over theory.
- When terminal output is provided, read it carefully: identify errors, exit codes, stack traces, and relevant state before responding.
- Infer the OS and shell from the terminal context when possible; default to bash/Linux if unknown.

## RESPONSE FORMAT (MANDATORY)
- Write in Markdown.
- Every command or code snippet MUST be inside a fenced code block with the correct language tag (e.g. \`\`\`bash, \`\`\`powershell, \`\`\`yaml).
- Introduce a command with one sentence of explanation, then show the code block — never embed commands inline in prose or lists.
- Commands must be copy-paste ready: no leading \`$\`, no placeholder text like \`<your-value>\` unless a substitution is genuinely required (explain it if so).
- Be concise. Skip preamble ("Sure!", "Of course!") and redundant closing remarks.

## ANSWER SCOPE
- Answer exactly what was asked. Do not pad the response with tangential information.
- If the root cause is not the obvious one, briefly say why before giving the fix.
- If the request is ambiguous, state your assumption in one sentence, then answer.
- You may add ONE focused tip at the end only when it directly prevents a likely follow-up problem — format it as a Markdown blockquote (\`>\`).
`;

type TokenUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export async function sendChat(
  basepath: string,
  apiKey: string,
  selectedModel: string,
  messages: ChatMessage[],
  onChunk: (delta: string) => void,
  signal?: AbortSignal,
  terminalContent: string | undefined = undefined,
  systemPrompt = "",
  temperature = 0.7,
  maxTokens = 0,
): Promise<TokenUsage | undefined> {
  const context: { role: string; content: string }[] = [];
  const parsedMessages = parseMessages(messages);

  const dev_prompt = {
    role: "system" as const,
    content: systemPrompt.trim() ? systemPrompt.trim() : defaultSystemContent,
  };

  if (terminalContent) {
    context.push({
      role: "system" as const,
      content: `The user's current terminal context is:\n\n${terminalContent}`,
    });
    console.log("[AI Chat] Terminal context detected!");
  }
  context.push(dev_prompt);
  context.push(...parsedMessages);

  const res = await net.fetch(`${basepath}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: selectedModel,
      messages: context,
      temperature,
      stream: true,
      stream_options: { include_usage: true },
      ...(maxTokens > 0 ? { max_tokens: maxTokens } : {}),
    }),
    signal,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API error ${res.status}: ${errorText}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let usage: TokenUsage | undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") return usage;
        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) onChunk(delta);
          if (json.usage) usage = json.usage as TokenUsage;
        } catch {
          // skip malformed SSE line
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  return usage;
}

function parseMessages(
  messages: ChatMessage[],
): { role: string; content: string }[] {
  return messages.map((msg) => ({
    role: msg.type === "user" ? "user" : "assistant",
    content: msg.content,
  }));
}

export async function getModels(
  basepath: string,
  apiKey: string,
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
      throw new Error(`API error ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    if (data.data) {
      const ids: string[] = data.data.map((item) => item.id);
      return ids;
    }
    throw new Error("Unexpected response format from API");
  } catch (error) {
    console.error("Error fetching models:", error);
    throw error;
  }
}
