import { net } from "electron";

type AIProvider = "openai" | "anthropic" | "ollama" | "openai-compatible";

export interface AgentToolCallPayload {
  id: string;
  name: string;
  args: unknown;
  result?: string;
  isError?: boolean;
}

export interface AgentMessage {
  // Renderer-side ChatMessage shape: id/type/content/timestamp plus optional toolCalls
  id?: number;
  type: "user" | "assistant" | string;
  content: string;
  timestamp?: string;
  toolCalls?: AgentToolCallPayload[];
}

export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export type EmitToolCall = (call: {
  id: string;
  name: string;
  args: unknown;
}) => void;

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

const agentSystemAddon = `

## AGENT MODE — ACTIVE (overrides earlier formatting rules)
You are running as an AGENT with tools. You MUST act, not just describe.

Hard rules:
- When the user asks you to DO something (run, check, read, write, list, inspect, fix, deploy, etc.), CALL THE TOOL. Do NOT reply with a fenced code block of the command and stop — that is a failure mode.
- Never print a command as the answer when you could call \`run_command\` instead. The earlier "every command in a fenced code block" rule does NOT apply here: tools replace code-block answers for actions.
- It is fine to write a one-sentence plan in prose before the tool call, but the response must include the tool call itself.
- \`run_command\` waits for the command to finish and returns its output directly — do NOT call \`read_terminal\` afterwards to "check the result". Only use \`read_terminal\` to inspect state that wasn't produced by your own \`run_command\` call (e.g., what's on screen right now, output from something the user ran). For commands you expect to take a while, pass a larger \`timeoutMs\`.
- Only reply with prose / code blocks (no tool call) when the user is asking a pure question ("what does X mean?", "explain Y") with no action requested.
- Stop when the task is done — do not loop forever.
- If a tool returns an error, acknowledge it and adapt instead of retrying blindly.

Available tools include: read_terminal, run_command, read_file, write_file, list_ssh_hosts, get_env_var, and SFTP operations. Prefer them over text descriptions of what the user could do.`;

type TokenUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export interface SendChatResult {
  usage?: TokenUsage;
  stopReason: "end_turn" | "tool_use" | "stop" | string;
}

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
  if (provider === "ollama" && !apiKey) return {};
  return { Authorization: `Bearer ${apiKey}` };
}

export async function sendChat(
  basepath: string,
  apiKey: string,
  selectedModel: string,
  messages: AgentMessage[],
  onChunk: (delta: string) => void,
  signal?: AbortSignal,
  terminalContent: string | undefined = undefined,
  systemPrompt = "",
  temperature = 0.7,
  maxTokens = 0,
  provider: AIProvider = "openai",
  tools?: ToolSpec[],
  onToolCall?: EmitToolCall,
): Promise<SendChatResult> {
  const baseSystem = systemPrompt.trim() ? systemPrompt.trim() : defaultSystemContent;
  const systemContent = tools && tools.length > 0
    ? baseSystem + agentSystemAddon
    : baseSystem;
  const authHeaders = buildAuthHeaders(provider, apiKey);

  if (provider === "anthropic") {
    return sendChatAnthropic(
      basepath,
      selectedModel,
      messages,
      systemContent,
      terminalContent,
      temperature,
      maxTokens,
      authHeaders,
      onChunk,
      signal,
      tools,
      onToolCall,
    );
  }

  return sendChatOpenAI(
    basepath,
    selectedModel,
    messages,
    systemContent,
    terminalContent,
    temperature,
    maxTokens,
    authHeaders,
    onChunk,
    signal,
    provider,
    tools,
    onToolCall,
  );
}

// --- OpenAI / Ollama / OpenAI-compatible ---
async function sendChatOpenAI(
  basepath: string,
  selectedModel: string,
  messages: AgentMessage[],
  systemContent: string,
  terminalContent: string | undefined,
  temperature: number,
  maxTokens: number,
  authHeaders: Record<string, string>,
  onChunk: (delta: string) => void,
  signal: AbortSignal | undefined,
  provider: AIProvider,
  tools: ToolSpec[] | undefined,
  onToolCall: EmitToolCall | undefined,
): Promise<SendChatResult> {
  const context: any[] = [];

  if (terminalContent) {
    context.push({
      role: "system",
      content: `The user's current terminal context is:\n\n${terminalContent}`,
    });
  }
  context.push({ role: "system", content: systemContent });

  // Serialize agent messages into OpenAI-shaped messages.
  for (const m of messages) {
    if (m.type === "user") {
      context.push({ role: "user", content: m.content });
    } else if (m.type === "assistant") {
      if (m.toolCalls && m.toolCalls.length > 0) {
        context.push({
          role: "assistant",
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: {
              name: tc.name,
              arguments:
                typeof tc.args === "string"
                  ? tc.args
                  : JSON.stringify(tc.args ?? {}),
            },
          })),
        });
        for (const tc of m.toolCalls) {
          context.push({
            role: "tool",
            tool_call_id: tc.id,
            content:
              tc.result ?? (tc.isError ? "error" : ""),
          });
        }
      } else {
        context.push({ role: "assistant", content: m.content });
      }
    }
  }

  const body: Record<string, unknown> = {
    model: selectedModel,
    messages: context,
    temperature,
    stream: true,
    ...(maxTokens > 0 ? { max_tokens: maxTokens } : {}),
  };
  if (provider === "openai") {
    body.stream_options = { include_usage: true };
  }
  if (tools && tools.length > 0) {
    body.tools = tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));
  }

  const res = await net.fetch(`${basepath}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
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
  let stopReason = "stop";

  // Accumulate streaming tool calls by index.
  const pendingTools = new Map<
    number,
    { id?: string; name?: string; args: string }
  >();

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
        if (data === "[DONE]") {
          flushPendingTools(pendingTools, onToolCall);
          return { usage, stopReason };
        }
        try {
          const json = JSON.parse(data);
          const choice = json.choices?.[0];
          const delta = choice?.delta;
          if (delta?.content) onChunk(delta.content);
          if (Array.isArray(delta?.tool_calls)) {
            for (const tcDelta of delta.tool_calls) {
              const idx = tcDelta.index ?? 0;
              const entry = pendingTools.get(idx) ?? { args: "" };
              if (tcDelta.id) entry.id = tcDelta.id;
              if (tcDelta.function?.name) entry.name = tcDelta.function.name;
              if (typeof tcDelta.function?.arguments === "string") {
                entry.args += tcDelta.function.arguments;
              }
              pendingTools.set(idx, entry);
            }
          }
          if (choice?.finish_reason) {
            stopReason =
              choice.finish_reason === "tool_calls" ? "tool_use" : choice.finish_reason;
          }
          if (json.usage) usage = json.usage as TokenUsage;
        } catch {
          /* skip malformed SSE line */
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  flushPendingTools(pendingTools, onToolCall);
  return { usage, stopReason };
}

function flushPendingTools(
  pending: Map<number, { id?: string; name?: string; args: string }>,
  onToolCall: EmitToolCall | undefined,
) {
  if (!onToolCall || pending.size === 0) return;
  const ordered = [...pending.entries()].sort((a, b) => a[0] - b[0]);
  for (const [, t] of ordered) {
    if (!t.name) continue;
    let parsed: unknown = {};
    try {
      parsed = t.args ? JSON.parse(t.args) : {};
    } catch {
      parsed = { _raw: t.args };
    }
    onToolCall({
      id: t.id ?? `tc_${Math.random().toString(36).slice(2)}`,
      name: t.name,
      args: parsed,
    });
  }
}

// --- Anthropic Messages API ---
async function sendChatAnthropic(
  basepath: string,
  selectedModel: string,
  messages: AgentMessage[],
  systemContent: string,
  terminalContent: string | undefined,
  temperature: number,
  maxTokens: number,
  authHeaders: Record<string, string>,
  onChunk: (delta: string) => void,
  signal: AbortSignal | undefined,
  tools: ToolSpec[] | undefined,
  onToolCall: EmitToolCall | undefined,
): Promise<SendChatResult> {
  let system = systemContent;
  if (terminalContent) {
    system += `\n\nThe user's current terminal context is:\n\n${terminalContent}`;
  }

  const anthropicMessages: any[] = [];
  for (const m of messages) {
    if (m.type === "user") {
      anthropicMessages.push({ role: "user", content: m.content });
    } else if (m.type === "assistant") {
      if (m.toolCalls && m.toolCalls.length > 0) {
        const blocks: any[] = [];
        if (m.content) blocks.push({ type: "text", text: m.content });
        for (const tc of m.toolCalls) {
          blocks.push({
            type: "tool_use",
            id: tc.id,
            name: tc.name,
            input: typeof tc.args === "string" ? safeJsonParse(tc.args) : tc.args ?? {},
          });
        }
        anthropicMessages.push({ role: "assistant", content: blocks });
        anthropicMessages.push({
          role: "user",
          content: m.toolCalls.map((tc) => ({
            type: "tool_result",
            tool_use_id: tc.id,
            content: tc.result ?? "",
            ...(tc.isError ? { is_error: true } : {}),
          })),
        });
      } else {
        anthropicMessages.push({ role: "assistant", content: m.content });
      }
    }
  }

  const body: Record<string, unknown> = {
    model: selectedModel,
    system,
    messages: anthropicMessages,
    temperature,
    max_tokens: maxTokens > 0 ? maxTokens : 8192,
    stream: true,
  };
  if (tools && tools.length > 0) {
    body.tools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));
  }

  const res = await net.fetch(`${basepath}/v1/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
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
  let stopReason = "end_turn";

  // Track per-index content blocks (tool_use entries get input_json deltas)
  const blocks = new Map<
    number,
    { type: "tool_use"; id: string; name: string; args: string } | { type: "text" }
  >();

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
          const evt = currentEvent || json.type;
          if (evt === "content_block_start") {
            const idx = json.index ?? 0;
            const cb = json.content_block;
            if (cb?.type === "tool_use") {
              blocks.set(idx, {
                type: "tool_use",
                id: cb.id,
                name: cb.name,
                args: "",
              });
            } else {
              blocks.set(idx, { type: "text" });
            }
          } else if (evt === "content_block_delta") {
            const idx = json.index ?? 0;
            const block = blocks.get(idx);
            const d = json.delta;
            if (d?.type === "text_delta" && d.text) onChunk(d.text);
            else if (
              d?.type === "input_json_delta" &&
              block &&
              block.type === "tool_use"
            ) {
              block.args += d.partial_json ?? "";
            }
          } else if (evt === "content_block_stop") {
            const idx = json.index ?? 0;
            const block = blocks.get(idx);
            if (block && block.type === "tool_use" && onToolCall) {
              let parsed: unknown = {};
              try {
                parsed = block.args ? JSON.parse(block.args) : {};
              } catch {
                parsed = { _raw: block.args };
              }
              onToolCall({ id: block.id, name: block.name, args: parsed });
            }
          } else if (evt === "message_start") {
            inputTokens = json.message?.usage?.input_tokens ?? 0;
          } else if (evt === "message_delta") {
            outputTokens = json.usage?.output_tokens ?? outputTokens;
            if (json.delta?.stop_reason) stopReason = json.delta.stop_reason;
          }
        } catch {
          /* skip malformed SSE line */
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  const usage =
    inputTokens > 0 || outputTokens > 0
      ? {
          prompt_tokens: inputTokens,
          completion_tokens: outputTokens,
          total_tokens: inputTokens + outputTokens,
        }
      : undefined;
  return { usage, stopReason };
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
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
      headers: { "Content-Type": "application/json", ...authHeaders },
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`API error ${res.status}: ${errorText}`);
    }
    const data = await res.json();
    if (data.data) {
      const ids: string[] = data.data.map((item: any) => item.id);
      return ids;
    }
    throw new Error("Unexpected response format from API");
  } catch (error) {
    console.error("Error fetching models:", error);
    throw error;
  }
}
