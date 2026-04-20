import { useState, useRef, useEffect } from "react";
import { SFTPFileEntry } from "@renderer/types/sftp";
import {
  Folder,
  File,
  Download,
  Pencil,
  Trash2,
  Check,
  X,
  Link,
} from "lucide-react";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(mtime: number): string {
  const d = new Date(mtime * 1000);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type Props = {
  entry: SFTPFileEntry;
  onDoubleClick: () => void;
  onDownload: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
};

export default function FileEntryRow({
  entry,
  onDoubleClick,
  onDownload,
  onRename,
  onDelete,
}: Props) {
  const [renaming, setRenaming] = useState(false);
  const [nameValue, setNameValue] = useState(entry.filename);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [renaming]);

  const commitRename = () => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== entry.filename) {
      onRename(trimmed);
    }
    setRenaming(false);
  };

  const cancelRename = () => {
    setNameValue(entry.filename);
    setRenaming(false);
  };

  const Icon = entry.isSymlink ? Link : entry.isDirectory ? Folder : File;
  const iconColor = entry.isSymlink
    ? "text-cyan-400/60"
    : entry.isDirectory
      ? "text-accent-400/80"
      : "text-gray-500";

  return (
    <div
      className="group flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-800/60 cursor-pointer select-none"
      onDoubleClick={() => !renaming && onDoubleClick()}
    >
      <Icon size={13} className={`flex-shrink-0 ${iconColor}`} />

      {renaming ? (
        <div className="flex-1 flex items-center gap-1 min-w-0">
          <input
            ref={inputRef}
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") cancelRename();
              e.stopPropagation();
            }}
            onBlur={commitRename}
            className="flex-1 bg-slate-700/60 border border-accent-500/40 rounded px-1.5 py-0.5 text-[12px] text-gray-200 outline-none min-w-0"
          />
          <button
            onClick={commitRename}
            className="text-green-400/70 hover:text-green-400 p-0.5"
          >
            <Check size={11} />
          </button>
          <button
            onClick={cancelRename}
            className="text-gray-500 hover:text-gray-300 p-0.5"
          >
            <X size={11} />
          </button>
        </div>
      ) : (
        <>
          <span className="flex-1 truncate text-[12px] text-gray-300 min-w-0">
            {entry.filename}
          </span>
          <span className="flex-shrink-0 text-[10px] text-gray-600 hidden group-hover:hidden w-10 text-right">
            {entry.isDirectory ? "" : formatSize(entry.attrs.size)}
          </span>
          <span className="flex-shrink-0 text-[10px] text-gray-600 group-hover:hidden">
            {formatDate(entry.attrs.mtime)}
          </span>

          {/* Hover action buttons */}
          <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
            {!entry.isDirectory && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload();
                }}
                className="p-1 rounded text-gray-500 hover:text-accent-300 hover:bg-slate-700/50 transition-colors"
                title="Download"
              >
                <Download size={11} />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRenaming(true);
              }}
              className="p-1 rounded text-gray-500 hover:text-accent-300 hover:bg-slate-700/50 transition-colors"
              title="Rename"
            >
              <Pencil size={11} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-slate-700/50 transition-colors"
              title="Delete"
            >
              <Trash2 size={11} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
