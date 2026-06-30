import { useState } from "react";
import {
  ChevronRight,
  Check,
  X,
  Loader2,
  AlertTriangle,
  Wrench,
  Terminal,
  FileText,
  FilePlus,
  Folder,
  Server,
  Key,
  Download,
  Upload,
  ShieldCheck,
} from "lucide-react";
import type { ToolCall } from "./conversation-types";

const TOOL_ICONS: Record<string, typeof Wrench> = {
  read_terminal: Terminal,
  run_command: Terminal,
  read_file: FileText,
  write_file: FilePlus,
  list_ssh_hosts: Server,
  get_env_var: Key,
  sftp_list: Folder,
  sftp_read: Download,
  sftp_write: Upload,
};

const TOOL_LABELS: Record<string, string> = {
  read_terminal: "Read terminal",
  run_command: "Run command",
  read_file: "Read file",
  write_file: "Write file",
  list_ssh_hosts: "List SSH hosts",
  get_env_var: "Get env var",
  sftp_list: "List remote dir",
  sftp_read: "Read remote file",
  sftp_write: "Write remote file",
};

function summarizeArgs(name: string, args: unknown): string {
  if (!args || typeof args !== "object") return "";
  const a = args as Record<string, unknown>;
  if (name === "run_command") return String(a.command ?? "");
  if (name === "read_file" || name === "write_file") return String(a.path ?? "");
  if (name === "sftp_list" || name === "sftp_read" || name === "sftp_write")
    return String(a.remotePath ?? a.dirPath ?? "");
  if (name === "read_terminal") return String(a.scope ?? "");
  if (name === "get_env_var") return `${a.scopeId ?? ""}:${a.key ?? ""}`;
  return "";
}

// Human-friendly preview of what's about to happen, rendered above the
// Approve/Deny buttons. Returns null when there's nothing useful to add
// beyond the header summary.
function ActionPreview({ name, args }: { name: string; args: unknown }) {
  const a = (args && typeof args === "object" ? args : {}) as Record<
    string,
    unknown
  >;

  if (name === "run_command") {
    const cmd = String(a.command ?? "");
    return (
      <div>
        <div className="text-[10px] uppercase tracking-wide text-ink-subtle mb-1">
          will run in your active terminal
        </div>
        <div className="flex items-start gap-2 bg-field dark:bg-black/60 rounded px-2.5 py-2 border border-hairline">
          <span className="text-success font-mono text-xs select-none">$</span>
          <code className="text-xs font-mono text-ink whitespace-pre-wrap break-all flex-1">
            {cmd}
          </code>
        </div>
      </div>
    );
  }

  if (name === "write_file") {
    const path = String(a.path ?? "");
    const content = String(a.content ?? "");
    const lines = content.split("\n").length;
    const bytes = content.length;
    const preview =
      content.length > 600 ? content.slice(0, 600) + "\n…" : content;
    return (
      <div>
        <div className="text-[10px] uppercase tracking-wide text-ink-subtle mb-1">
          will write file
        </div>
        <div className="bg-surface rounded px-2.5 py-2 border border-hairline space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-mono text-warning">
            <FilePlus size={11} className="flex-shrink-0" />
            <span className="break-all">{path}</span>
          </div>
          <div className="text-[10px] text-ink-subtle">
            {lines} line{lines === 1 ? "" : "s"} · {bytes} byte
            {bytes === 1 ? "" : "s"}
          </div>
          {preview && (
            <pre className="text-[11px] font-mono text-ink-muted bg-field dark:bg-black/40 rounded px-2 py-1 overflow-x-auto max-h-32">
              {preview}
            </pre>
          )}
        </div>
      </div>
    );
  }

  if (name === "read_file") {
    return (
      <div>
        <div className="text-[10px] uppercase tracking-wide text-ink-subtle mb-1">
          will read file
        </div>
        <div className="flex items-center gap-2 bg-surface rounded px-2.5 py-2 border border-hairline text-xs font-mono text-ink">
          <FileText size={11} className="text-accent-400 flex-shrink-0" />
          <span className="break-all">{String(a.path ?? "")}</span>
        </div>
      </div>
    );
  }

  if (name === "sftp_write" || name === "sftp_read" || name === "sftp_list") {
    const path = String(a.remotePath ?? a.dirPath ?? "");
    const verb =
      name === "sftp_write"
        ? "will write remote file"
        : name === "sftp_read"
          ? "will read remote file"
          : "will list remote directory";
    return (
      <div>
        <div className="text-[10px] uppercase tracking-wide text-ink-subtle mb-1">
          {verb}
        </div>
        <div className="flex items-center gap-2 bg-surface rounded px-2.5 py-2 border border-hairline text-xs font-mono text-ink">
          <Server size={11} className="text-accent-400 flex-shrink-0" />
          <span className="break-all">{path}</span>
        </div>
      </div>
    );
  }

  return null;
}

interface ToolCallCardProps {
  call: ToolCall;
  onApprove?: (callId: string, name: string, always: boolean) => void;
  onDeny?: (callId: string, name: string) => void;
}

export default function ToolCallCard({
  call,
  onApprove,
  onDeny,
}: ToolCallCardProps) {
  const awaitingApproval =
    call.status === "awaiting_approval" && !!onApprove && !!onDeny;
  const [expanded, setExpanded] = useState(awaitingApproval);
  const [showRaw, setShowRaw] = useState(false);
  const Icon = TOOL_ICONS[call.name] ?? Wrench;
  const label = TOOL_LABELS[call.name] ?? call.name;
  const summary = summarizeArgs(call.name, call.args);
  const isExpanded = expanded || awaitingApproval;

  const statusBadge = (() => {
    switch (call.status) {
      case "pending":
        return (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/15 text-warning">
            awaiting
          </span>
        );
      case "awaiting_approval":
        return (
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-warning/20 text-warning border border-warning/40">
            <AlertTriangle size={9} />
            needs approval
          </span>
        );
      case "running":
        return (
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-accent-500/15 text-accent-300">
            <Loader2 size={9} className="animate-spin" />
            running
          </span>
        );
      case "done":
        return (
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-success/15 text-success">
            <Check size={9} />
            done
          </span>
        );
      case "error":
        return (
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-danger/15 text-danger">
            <AlertTriangle size={9} />
            error
          </span>
        );
      case "denied":
        return (
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-elevated/40 text-ink-muted">
            <X size={9} />
            denied
          </span>
        );
      default:
        return null;
    }
  })();

  const cardBorder = awaitingApproval
    ? "border-warning/40"
    : "border-hairline/40";

  return (
    <div
      className={`my-2 rounded-md border ${cardBorder} bg-surface/40 overflow-hidden`}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-panel/60 transition-colors"
      >
        <ChevronRight
          size={12}
          className={`text-ink-subtle transition-transform ${
            isExpanded ? "rotate-90" : ""
          }`}
        />
        <Icon size={12} className="text-accent-400 flex-shrink-0" />
        <span className="text-xs font-medium text-ink flex-shrink-0">
          {label}
        </span>
        {summary && (
          <span className="text-xs text-ink-subtle font-mono truncate flex-1 min-w-0">
            {summary}
          </span>
        )}
        <div className="flex-shrink-0">{statusBadge}</div>
      </button>
      {isExpanded && (
        <div className="px-2.5 pb-2 pt-1 space-y-2 border-t border-hairline">
          <ActionPreview name={call.name} args={call.args} />
          <div>
            <button
              onClick={() => setShowRaw((v) => !v)}
              className="text-[10px] uppercase tracking-wide text-ink-subtle hover:text-ink-muted transition-colors"
            >
              {showRaw ? "hide" : "show"} raw arguments
            </button>
            {showRaw && (
              <pre className="mt-1 text-xs font-mono bg-surface text-ink-muted rounded px-2 py-1 overflow-x-auto max-h-32">
                {JSON.stringify(call.args, null, 2)}
              </pre>
            )}
          </div>
          {awaitingApproval && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <button
                onClick={() => onDeny!(call.id, call.name)}
                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-hairline text-ink-muted hover:bg-elevated transition-colors"
              >
                <X size={11} />
                Deny
              </button>
              <button
                onClick={() => onApprove!(call.id, call.name, false)}
                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-accent-500/20 border border-accent-500/40 text-accent-300 hover:bg-accent-500/30 transition-colors"
              >
                <Check size={11} />
                Approve
              </button>
              <button
                onClick={() => onApprove!(call.id, call.name, true)}
                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-warning/15 border border-warning/40 text-warning hover:bg-warning/25 transition-colors ml-auto"
                title={`Auto-approve every "${label}" call for the rest of this conversation`}
              >
                <ShieldCheck size={11} />
                Always allow {label.toLowerCase()} this session
              </button>
            </div>
          )}
          {call.result !== undefined && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-ink-subtle mb-1">
                result {call.isError ? "(error)" : ""}
              </div>
              <pre
                className={`text-xs font-mono rounded px-2 py-1 overflow-x-auto max-h-48 ${
                  call.isError
                    ? "bg-danger/40 text-danger"
                    : "bg-surface text-ink-muted"
                }`}
              >
                {call.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
