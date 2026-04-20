import { useEffect, useRef, useState } from "react";
import { SFTPFileEntry, SFTPTransfer } from "@renderer/types/sftp";
import FileEntryRow from "./file-entry";
import TransferItem from "./transfer-item";
import {
  ChevronLeft,
  ChevronUp,
  FolderPlus,
  RefreshCw,
  Upload,
  X,
  AlertTriangle,
  Loader2,
} from "lucide-react";

type SSHConnectionInfo = {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  identityFile?: string;
  hasPassword?: boolean;
  credentialId?: string;
};

type Props = {
  sessionId: string;
  connection: SSHConnectionInfo;
  onClose: () => void;
};

function joinPath(dir: string, name: string): string {
  return dir.endsWith("/") ? dir + name : dir + "/" + name;
}

function parentPath(p: string): string {
  if (p === "/") return "/";
  const parts = p.split("/").filter(Boolean);
  if (parts.length === 0) return "/";
  parts.pop();
  return "/" + parts.join("/");
}

const DONE_LINGER_MS = 2000;

export default function FileBrowserPanel({
  sessionId,
  connection,
  onClose,
}: Props) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [currentPath, setCurrentPath] = useState("/");
  const [entries, setEntries] = useState<SFTPFileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [transfers, setTransfers] = useState<SFTPTransfer[]>([]);

  const [newFolderMode, setNewFolderMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  const resizingRef = useRef(false);

  // Track active transfers for progress updates
  const activeTransferIds = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    setConnecting(true);
    setConnectError(null);

    window.api.sftp
      .connect(sessionId, connection)
      .then(async () => {
        if (cancelled) return;
        setConnected(true);
        setConnecting(false);
        // Resolve home directory
        try {
          const home = await window.api.sftp.realpath(sessionId, ".");
          if (!cancelled) navigateTo(home);
        } catch {
          if (!cancelled) navigateTo("/");
        }
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setConnecting(false);
        setConnectError(err?.message ?? String(err));
      });

    const progressCb = (data: {
      sessionId: string;
      filename: string;
      bytes: number;
      total: number;
    }) => {
      if (data.sessionId !== sessionId) return;
      setTransfers((prev) =>
        prev.map((t) =>
          t.filename === data.filename &&
          activeTransferIds.current.has(t.id) &&
          t.status === "transferring"
            ? { ...t, bytes: data.bytes, total: data.total }
            : t,
        ),
      );
    };
    const removeProgress = window.api.sftp.onProgress(progressCb);

    return () => {
      cancelled = true;
      removeProgress();
      window.api.sftp.disconnect(sessionId);
    };
  }, [sessionId]);

  useEffect(() => {
    if (newFolderMode) {
      newFolderInputRef.current?.focus();
    }
  }, [newFolderMode]);

  async function navigateTo(path: string) {
    setLoading(true);
    setListError(null);
    try {
      const list = await window.api.sftp.list(sessionId, path);
      setEntries(list);
      setCurrentPath(path);
    } catch (err: any) {
      setListError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  function addTransfer(
    type: "upload" | "download",
    filename: string,
  ): string {
    const id = crypto.randomUUID();
    activeTransferIds.current.add(id);
    setTransfers((prev) => [
      ...prev,
      {
        id,
        sessionId,
        type,
        filename,
        bytes: 0,
        total: 0,
        status: "transferring",
      },
    ]);
    return id;
  }

  function finishTransfer(id: string, error?: string) {
    activeTransferIds.current.delete(id);
    setTransfers((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: error ? "error" : "done", error }
          : t,
      ),
    );
    setTimeout(() => {
      setTransfers((prev) => prev.filter((t) => t.id !== id));
    }, DONE_LINGER_MS);
  }

  async function handleDownload(entry: SFTPFileEntry) {
    const remotePath = joinPath(currentPath, entry.filename);
    const id = addTransfer("download", entry.filename);
    try {
      await window.api.sftp.download(sessionId, remotePath);
      finishTransfer(id);
    } catch (err: any) {
      finishTransfer(id, err?.message ?? String(err));
    }
  }

  async function handleUpload() {
    const id = addTransfer("upload", "...");
    try {
      await window.api.sftp.upload(sessionId, currentPath);
      finishTransfer(id);
      await navigateTo(currentPath);
    } catch (err: any) {
      finishTransfer(id, err?.message ?? String(err));
    }
  }

  async function handleDelete(entry: SFTPFileEntry) {
    const entryPath = joinPath(currentPath, entry.filename);
    try {
      await window.api.sftp.delete(sessionId, entryPath, entry.isDirectory);
      await navigateTo(currentPath);
    } catch (err: any) {
      setListError(`Delete failed: ${err?.message ?? String(err)}`);
    }
  }

  async function handleRename(entry: SFTPFileEntry, newName: string) {
    const oldPath = joinPath(currentPath, entry.filename);
    const newPath = joinPath(currentPath, newName);
    try {
      await window.api.sftp.rename(sessionId, oldPath, newPath);
      await navigateTo(currentPath);
    } catch (err: any) {
      setListError(`Rename failed: ${err?.message ?? String(err)}`);
    }
  }

  async function handleMkdir() {
    const name = newFolderName.trim();
    if (!name) {
      setNewFolderMode(false);
      return;
    }
    const dirPath = joinPath(currentPath, name);
    try {
      await window.api.sftp.mkdir(sessionId, dirPath);
      setNewFolderMode(false);
      setNewFolderName("");
      await navigateTo(currentPath);
    } catch (err: any) {
      setListError(`Create folder failed: ${err?.message ?? String(err)}`);
      setNewFolderMode(false);
    }
  }

  // Resize drag (right edge of panel)
  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    document.body.style.userSelect = "none";
  };
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      // Panel is on the left; width = clientX
      const newWidth = Math.min(500, Math.max(200, e.clientX));
      const panel = document.getElementById("sftp-panel");
      if (panel) panel.style.width = newWidth + "px";
    };
    const stopResizing = () => {
      if (resizingRef.current) {
        resizingRef.current = false;
        document.body.style.userSelect = "";
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, []);

  // Breadcrumb segments
  const pathSegments = currentPath
    .split("/")
    .filter(Boolean)
    .map((seg, i, arr) => ({
      label: seg,
      path: "/" + arr.slice(0, i + 1).join("/"),
    }));

  return (
    <div
      id="sftp-panel"
      className="absolute left-0 top-0 bottom-0 h-full bg-slate-900/95 backdrop-blur-md border-r border-slate-700/50 flex flex-col z-10 shadow-2xl"
      style={{ width: 260 }}
    >
      {/* Resize handle (right edge) */}
      <div
        className="absolute right-0 top-0 h-full w-1 cursor-ew-resize bg-transparent hover:bg-accent-500/30 active:bg-accent-500/50 z-10 transition-colors"
        onMouseDown={startResizing}
      />

      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50 flex-shrink-0">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-accent-400/90 tracking-wider uppercase truncate">
            Files
          </div>
          <div className="text-[10px] text-gray-600 truncate">
            {connection.username}@{connection.host}
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1 rounded text-gray-600 hover:text-gray-300 hover:bg-slate-700/50 transition-colors"
          title="Close file browser"
        >
          <X size={13} />
        </button>
      </div>

      {connecting && (
        <div className="flex-1 flex items-center justify-center gap-2 text-gray-500 text-[12px]">
          <Loader2 size={14} className="animate-spin" />
          Connecting…
        </div>
      )}

      {connectError && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 px-4 text-center">
          <AlertTriangle size={20} className="text-red-400/70" />
          <span className="text-[11px] text-red-400/80">{connectError}</span>
          <button
            onClick={() => {
              setConnectError(null);
              setConnecting(true);
              window.api.sftp
                .connect(sessionId, connection)
                .then(async () => {
                  setConnected(true);
                  setConnecting(false);
                  try {
                    const home = await window.api.sftp.realpath(sessionId, ".");
                    navigateTo(home);
                  } catch {
                    navigateTo("/");
                  }
                })
                .catch((err: Error) => {
                  setConnecting(false);
                  setConnectError(err?.message ?? String(err));
                });
            }}
            className="text-[11px] text-accent-400 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {connected && (
        <>
          {/* Navigation toolbar */}
          <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-slate-700/40 flex-shrink-0">
            <button
              onClick={() => navigateTo(parentPath(currentPath))}
              disabled={currentPath === "/"}
              className="p-1.5 rounded text-gray-500 hover:text-accent-300 hover:bg-slate-700/50 disabled:opacity-30 disabled:cursor-default transition-colors"
              title="Go up"
            >
              <ChevronUp size={13} />
            </button>
            <button
              onClick={() => navigateTo(currentPath)}
              className="p-1.5 rounded text-gray-500 hover:text-accent-300 hover:bg-slate-700/50 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
            <div className="flex-1" />
            <button
              onClick={handleUpload}
              className="p-1.5 rounded text-gray-500 hover:text-accent-300 hover:bg-slate-700/50 transition-colors"
              title="Upload file"
            >
              <Upload size={13} />
            </button>
            <button
              onClick={() => {
                setNewFolderMode(true);
                setNewFolderName("");
              }}
              className="p-1.5 rounded text-gray-500 hover:text-accent-300 hover:bg-slate-700/50 transition-colors"
              title="New folder"
            >
              <FolderPlus size={13} />
            </button>
          </div>

          {/* Breadcrumb */}
          <div className="flex items-center gap-0.5 px-2 py-1 overflow-x-auto flex-shrink-0 scrollbar-none">
            <button
              onClick={() => navigateTo("/")}
              className="text-[10px] text-gray-500 hover:text-accent-300 flex-shrink-0 transition-colors"
            >
              /
            </button>
            {pathSegments.map((seg) => (
              <span key={seg.path} className="flex items-center gap-0.5">
                <ChevronLeft
                  size={9}
                  className="text-gray-700 rotate-180 flex-shrink-0"
                />
                <button
                  onClick={() => navigateTo(seg.path)}
                  className="text-[10px] text-gray-500 hover:text-accent-300 flex-shrink-0 truncate max-w-[80px] transition-colors"
                  title={seg.path}
                >
                  {seg.label}
                </button>
              </span>
            ))}
          </div>

          {listError && (
            <div className="px-3 py-1.5 text-[11px] text-red-400/80 bg-red-900/10 border-b border-red-800/20 flex items-center gap-1.5 flex-shrink-0">
              <AlertTriangle size={11} />
              <span className="truncate">{listError}</span>
            </div>
          )}

          {/* File list */}
          <div className="flex-1 overflow-y-auto py-1 min-h-0">
            {/* New folder input row */}
            {newFolderMode && (
              <div className="flex items-center gap-1.5 px-2 py-1">
                <FolderPlus size={13} className="text-accent-400/80 flex-shrink-0" />
                <input
                  ref={newFolderInputRef}
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleMkdir();
                    if (e.key === "Escape") {
                      setNewFolderMode(false);
                      setNewFolderName("");
                    }
                    e.stopPropagation();
                  }}
                  onBlur={handleMkdir}
                  placeholder="New folder name"
                  className="flex-1 bg-slate-700/60 border border-accent-500/40 rounded px-1.5 py-0.5 text-[12px] text-gray-200 outline-none"
                />
              </div>
            )}

            {entries.length === 0 && !loading && !listError && (
              <div className="px-3 py-4 text-[11px] text-gray-600 text-center">
                Empty directory
              </div>
            )}

            {entries.map((entry) => (
              <FileEntryRow
                key={entry.filename}
                entry={entry}
                onDoubleClick={() => {
                  if (entry.isDirectory) {
                    navigateTo(joinPath(currentPath, entry.filename));
                  } else {
                    handleDownload(entry);
                  }
                }}
                onDownload={() => handleDownload(entry)}
                onRename={(newName) => handleRename(entry, newName)}
                onDelete={() => handleDelete(entry)}
              />
            ))}
          </div>

          {/* Transfer queue */}
          {transfers.length > 0 && (
            <div className="border-t border-slate-700/40 flex-shrink-0 max-h-32 overflow-y-auto">
              <div className="px-3 py-1 text-[10px] text-gray-600 uppercase tracking-wider">
                Transfers
              </div>
              {transfers.map((t) => (
                <TransferItem key={t.id} transfer={t} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
