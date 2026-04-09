import { net } from "electron";

type AIProvider = "openai" | "anthropic" | "ollama" | "openai-compatible";

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

// --- Auth headers per provider ---
function buildAuthHeaders(
  provider: AIProvider,
  apiKey: string,
): Record<string, string> {
  if (provider === "anthropic") {
    return {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    };
  }
  if (provider === "ollama" && !apiKey) {
    return {};
  }
  return { Authorization: `Bearer ${apiKey}` };
}

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
  provider: AIProvider = "openai",
): Promise<TokenUsage | undefined> {
  const parsedMessages = parseMessages(messages);
  const systemContent = systemPrompt.trim()
    ? systemPrompt.trim()
    : defaultSystemContent;

  const authHeaders = buildAuthHeaders(provider, apiKey);

  if (provider === "anthropic") {
    return sendChatAnthropic(
      basepath,
      selectedModel,
      parsedMessages,
      systemContent,
      terminalContent,
      temperature,
      maxTokens,
      authHeaders,
      onChunk,
      signal,
    );
  }

  // OpenAI / Ollama / OpenAI-compatible — all use /v1/chat/completions + SSE choices[0].delta.content
  const context: { role: string; content: string }[] = [];

  if (terminalContent) {
    context.push({
      role: "system" as const,
      content: `The user's current terminal context is:\n\n${terminalContent}`,
    });
    console.log("[AI Chat] Terminal context detected!");
  }
  context.push({ role: "system" as const, content: systemContent });
  context.push(...parsedMessages);

  const body: Record<string, unknown> = {
    model: selectedModel,
    messages: context,
    temperature,
    stream: true,
    ...(maxTokens > 0 ? { max_tokens: maxTokens } : {}),
  };

  // include_usage is an OpenAI-only extension — skip for other providers
  if (provider === "openai") {
    body.stream_options = { include_usage: true };
  }

  const res = await net.fetch(`${basepath}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify(body),
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

// --- Anthropic Messages API (native SSE) ---
async function sendChatAnthropic(
  basepath: string,
  selectedModel: string,
  parsedMessages: { role: string; content: string }[],
  systemContent: string,
  terminalContent: string | undefined,
  temperature: number,
  maxTokens: number,
  authHeaders: Record<string, string>,
  onChunk: (delta: string) => void,
  signal?: AbortSignal,
): Promise<TokenUsage | undefined> {
  // Anthropic system prompt — merge terminal context into it if present
  let system = systemContent;
  if (terminalContent) {
    system += `\n\nThe user's current terminal context is:\n\n${terminalContent}`;
    console.log("[AI Chat] Terminal context detected!");
  }

  // Anthropic only accepts user/assistant roles in messages
  const anthropicMessages = parsedMessages.filter(
    (m) => m.role === "user" || m.role === "assistant",
  );

  const body: Record<string, unknown> = {
    model: selectedModel,
    system,
    messages: anthropicMessages,
    temperature,
    max_tokens: maxTokens > 0 ? maxTokens : 8192,
    stream: true,
  };

  const res = await net.fetch(`${basepath}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API error ${res.status}: ${errorText}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      let currentEvent = "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("event: ")) {
          currentEvent = trimmed.slice(7);
          continue;
        }
        if (!trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") break;
        try {
          const json = JSON.parse(data);
          if (
            currentEvent === "content_block_delta" ||
            json.type === "content_block_delta"
          ) {
            const text = json.delta?.text;
            if (text) onChunk(text);
          } else if (
            currentEvent === "message_start" ||
            json.type === "message_start"
          ) {
            inputTokens = json.message?.usage?.input_tokens ?? 0;
          } else if (
            currentEvent === "message_delta" ||
            json.type === "message_delta"
          ) {
            outputTokens = json.usage?.output_tokens ?? 0;
          }
        } catch {
          // skip malformed SSE line
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (inputTokens > 0 || outputTokens > 0) {
    return {
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
    };
  }
  return undefined;
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
  provider: AIProvider = "openai",
): Promise<string[]> {
  try {
    const authHeaders = buildAuthHeaders(provider, apiKey);

    const res = await net.fetch(`${basepath}/v1/models`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
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
