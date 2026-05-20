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

export default function ToolCallCard({ call }: { call: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TOOL_ICONS[call.name] ?? Wrench;
  const label = TOOL_LABELS[call.name] ?? call.name;
  const summary = summarizeArgs(call.name, call.args);

  const statusBadge = (() => {
    switch (call.status) {
      case "pending":
        return (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
            awaiting
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

  return (
    <div className="my-2 rounded-md border border-slate-700/40 bg-slate-950/40 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-slate-900/60 transition-colors"
      >
        <ChevronRight
          size={12}
          className={`text-slate-500 transition-transform ${
            expanded ? "rotate-90" : ""
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
      {expanded && (
        <div className="px-2.5 pb-2 pt-1 space-y-2 border-t border-slate-800">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
              arguments
            </div>
            <pre className="text-xs font-mono bg-slate-950 text-slate-300 rounded px-2 py-1 overflow-x-auto max-h-32">
              {JSON.stringify(call.args, null, 2)}
            </pre>
          </div>
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
