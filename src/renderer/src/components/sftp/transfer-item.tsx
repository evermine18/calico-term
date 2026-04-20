import { SFTPTransfer } from "@renderer/types/sftp";
import { Download, Upload, CheckCircle, AlertCircle } from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TransferItem({ transfer }: { transfer: SFTPTransfer }) {
  const percent =
    transfer.total > 0
      ? Math.round((transfer.bytes / transfer.total) * 100)
      : transfer.status === "done"
        ? 100
        : 0;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-[11px]">
      <div className="flex-shrink-0 text-accent-400/70">
        {transfer.type === "download" ? (
          <Download size={11} />
        ) : (
          <Upload size={11} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="truncate text-gray-400">{transfer.filename}</span>
          <span className="flex-shrink-0 text-gray-600">
            {transfer.status === "done" ? (
              <CheckCircle size={11} className="text-green-500/70" />
            ) : transfer.status === "error" ? (
              <AlertCircle size={11} className="text-red-500/70" />
            ) : transfer.total > 0 ? (
              `${formatBytes(transfer.bytes)} / ${formatBytes(transfer.total)}`
            ) : (
              `${percent}%`
            )}
          </span>
        </div>
        {transfer.status !== "done" && transfer.status !== "error" && (
          <div className="h-0.5 bg-slate-700/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-500/70 rounded-full transition-all duration-200"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
        {transfer.status === "error" && transfer.error && (
          <span className="text-red-400/70 text-[10px]">{transfer.error}</span>
        )}
      </div>
    </div>
  );
}
