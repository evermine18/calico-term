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
  const Icon = TOOL_ICONS[call.name] ?? Wrench;
  const label = TOOL_LABELS[call.name] ?? call.name;
  const summary = summarizeArgs(call.name, call.args);
  const isExpanded = expanded || awaitingApproval;

  const statusBadge = (() => {
    switch (call.status) {
      case "pending":
        return (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
            awaiting
          </span>
        );
      case "awaiting_approval":
        return (
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
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
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-300">
            <Check size={9} />
            done
          </span>
        );
      case "error":
        return (
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-300">
            <AlertTriangle size={9} />
            error
          </span>
        );
      case "denied":
        return (
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-700/40 text-slate-400">
            <X size={9} />
            denied
          </span>
        );
      default:
        return null;
    }
  })();

  const cardBorder = awaitingApproval
    ? "border-amber-500/40"
    : "border-slate-700/40";

  return (
    <div
      className={`my-2 rounded-md border ${cardBorder} bg-slate-950/40 overflow-hidden`}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-slate-900/60 transition-colors"
      >
        <ChevronRight
          size={12}
          className={`text-slate-500 transition-transform ${
            isExpanded ? "rotate-90" : ""
          }`}
        />
        <Icon size={12} className="text-accent-400 flex-shrink-0" />
        <span className="text-xs font-medium text-slate-200 flex-shrink-0">
          {label}
        </span>
        {summary && (
          <span className="text-xs text-slate-500 font-mono truncate flex-1 min-w-0">
            {summary}
          </span>
        )}
        <div className="flex-shrink-0">{statusBadge}</div>
      </button>
      {isExpanded && (
        <div className="px-2.5 pb-2 pt-1 space-y-2 border-t border-slate-800">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
              arguments
            </div>
            <pre className="text-xs font-mono bg-slate-950 text-slate-300 rounded px-2 py-1 overflow-x-auto max-h-32">
              {JSON.stringify(call.args, null, 2)}
            </pre>
          </div>
          {awaitingApproval && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <button
                onClick={() => onDeny!(call.id, call.name)}
                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
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
                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-amber-500/15 border border-amber-500/40 text-amber-200 hover:bg-amber-500/25 transition-colors ml-auto"
                title={`Auto-approve every "${label}" call for the rest of this conversation`}
              >
                <ShieldCheck size={11} />
                Always allow {label.toLowerCase()} this session
              </button>
            </div>
          )}
          {call.result !== undefined && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                result {call.isError ? "(error)" : ""}
              </div>
              <pre
                className={`text-xs font-mono rounded px-2 py-1 overflow-x-auto max-h-48 ${
                  call.isError
                    ? "bg-red-950/40 text-red-300"
                    : "bg-slate-950 text-slate-300"
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
