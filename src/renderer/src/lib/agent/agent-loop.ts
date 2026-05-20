import { AGENT_TOOLS, executeTool, getToolSpec } from "./tools";
import type { AgentRuntime } from "./tools";
import type {
  ChatMessage,
  ToolCall,
} from "@renderer/components/ai/chat/conversation-types";

export interface AgentLoopOptions {
  basepath: string;
  selectedModel: string;
  provider: "openai" | "anthropic" | "ollama" | "openai-compatible";
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  terminalContent?: string;
  runtime: AgentRuntime;
  // Risk confirmation hook. Resolve(true) approves, resolve(false) denies.
  confirmRisky: (name: string, args: unknown) => Promise<boolean>;
  // Called whenever the message list should be re-rendered (replaces full list).
  onMessages: (messages: ChatMessage[]) => void;
  onUsage?: (usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  }) => void;
  onError?: (error: string) => void;
  onDone?: () => void;
}

export class AgentLoop {
  private aborted = false;
  private currentStreamId: string | null = null;
  private cleanup: (() => void) | null = null;
  private messages: ChatMessage[];
  private opts: AgentLoopOptions;

  constructor(initialMessages: ChatMessage[], opts: AgentLoopOptions) {
    this.messages = initialMessages;
    this.opts = opts;
  }

  abort() {
    this.aborted = true;
    if (this.currentStreamId) {
      window.electron.ipcRenderer.send(
        "ai-stream-cancel",
        this.currentStreamId,
      );
    }
    this.cleanup?.();
    this.opts.onDone?.();
  }

  async start() {
    while (!this.aborted) {
      const result = await this.oneTurn();
      if (this.aborted) return;
      if (result.error) {
        this.opts.onError?.(result.error);
        this.opts.onDone?.();
        return;
      }
      if (result.stopReason === "tool_use") {
        const lastMsg = this.messages[this.messages.length - 1];
        if (!lastMsg?.toolCalls || lastMsg.toolCalls.length === 0) {
          // Model claimed tool_use but emitted none — stop to avoid infinite loop.
          this.opts.onDone?.();
          return;
        }
        await this.executePendingTools(lastMsg);
        if (this.aborted) return;
        continue;
      }
      // end_turn / stop / anything else
      this.opts.onDone?.();
      return;
    }
  }

  private async oneTurn(): Promise<{ stopReason: string; error?: string }> {
    return new Promise((resolve) => {
      const streamId = Date.now().toString() + Math.random().toString(36).slice(2);
      this.currentStreamId = streamId;

      const assistantMsgId = Date.now() + Math.floor(Math.random() * 1000);
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        type: "assistant",
        error: false,
        content: "",
        timestamp: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        toolCalls: [],
      };
      this.messages = [...this.messages, assistantMsg];
      this.opts.onMessages(this.messages);

      const handleChunk = (_e: any, id: string, delta: string) => {
        if (id !== streamId) return;
        this.messages = this.messages.map((m) =>
          m.id === assistantMsgId ? { ...m, content: m.content + delta } : m,
        );
        this.opts.onMessages(this.messages);
      };

      const handleToolCall = (
        _e: any,
        id: string,
        call: { id: string; name: string; args: unknown },
      ) => {
        if (id !== streamId) return;
        this.messages = this.messages.map((m) => {
          if (m.id !== assistantMsgId) return m;
          const tc: ToolCall = {
            id: call.id,
            name: call.name,
            args: call.args,
            status: "pending",
          };
          return { ...m, toolCalls: [...(m.toolCalls ?? []), tc] };
        });
        this.opts.onMessages(this.messages);
      };

      const handleDone = (
        _e: any,
        id: string,
        usage: any,
        stopReason: string,
      ) => {
        if (id !== streamId) return;
        if (usage) this.opts.onUsage?.(usage);
        clear();
        resolve({ stopReason: stopReason || "stop" });
      };

      const handleError = (_e: any, id: string, errorMsg: string) => {
        if (id !== streamId) return;
        this.messages = this.messages.map((m) =>
          m.id === assistantMsgId
            ? { ...m, error: true, content: errorMsg }
            : m,
        );
        this.opts.onMessages(this.messages);
        clear();
        resolve({ stopReason: "error", error: errorMsg });
      };

      const clear = () => {
        window.electron.ipcRenderer.removeListener("ai-stream-chunk", handleChunk);
        window.electron.ipcRenderer.removeListener("ai-stream-tool-call", handleToolCall);
        window.electron.ipcRenderer.removeListener("ai-stream-done", handleDone);
        window.electron.ipcRenderer.removeListener("ai-stream-error", handleError);
        this.currentStreamId = null;
        this.cleanup = null;
      };
      this.cleanup = clear;

      window.electron.ipcRenderer.on("ai-stream-chunk", handleChunk);
      window.electron.ipcRenderer.on("ai-stream-tool-call", handleToolCall);
      window.electron.ipcRenderer.on("ai-stream-done", handleDone);
      window.electron.ipcRenderer.on("ai-stream-error", handleError);

      const wireMessages = this.messages.filter((m) => m.id !== assistantMsgId);

      window.electron.ipcRenderer.send(
        "send-ai-message",
        streamId,
        this.opts.basepath,
        this.opts.selectedModel,
        wireMessages,
        // Terminal context only on the first turn — model reads via tools afterwards.
        this.messages.length <= 2 ? this.opts.terminalContent : undefined,
        this.opts.systemPrompt,
        this.opts.temperature,
        this.opts.maxTokens,
        this.opts.provider,
        AGENT_TOOLS,
      );
    });
  }

  private async executePendingTools(assistantMsg: ChatMessage) {
    const calls = assistantMsg.toolCalls ?? [];
    for (const call of calls) {
      if (this.aborted) return;
      const spec = getToolSpec(call.name);
      if (!spec) {
        this.updateCall(assistantMsg.id, call.id, {
          status: "error",
          result: `Unknown tool: ${call.name}`,
          isError: true,
        });
        continue;
      }
      if (spec.riskLevel === "risky") {
        this.updateCall(assistantMsg.id, call.id, { status: "pending" });
        const ok = await this.opts.confirmRisky(call.name, call.args);
        if (this.aborted) return;
        if (!ok) {
          this.updateCall(assistantMsg.id, call.id, {
            status: "denied",
            result: "User denied this action.",
            isError: true,
          });
          continue;
        }
      }
      this.updateCall(assistantMsg.id, call.id, { status: "running" });
      const exec = await executeTool(call.name, call.args, this.opts.runtime);
      if (this.aborted) return;
      this.updateCall(assistantMsg.id, call.id, {
        status: exec.isError ? "error" : "done",
        result: exec.content,
        isError: exec.isError,
      });
    }
  }

  private updateCall(
    msgId: number,
    callId: string,
    patch: Partial<ToolCall>,
  ) {
    this.messages = this.messages.map((m) => {
      if (m.id !== msgId) return m;
      return {
        ...m,
        toolCalls: (m.toolCalls ?? []).map((tc) =>
          tc.id === callId ? { ...tc, ...patch } : tc,
        ),
      };
    });
    this.opts.onMessages(this.messages);
  }
}
