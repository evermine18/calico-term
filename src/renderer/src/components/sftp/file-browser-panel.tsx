import { useEffect, useRef, useState } from "react";
import { SFTPFileEntry, SFTPTransfer } from "@renderer/types/sftp";
import FileEntryRow from "./file-entry";
import TransferItem from "./transfer-item";
import RemoteEditorDialog from "./remote-editor-dialog";
import TailViewerDialog from "./tail-viewer-dialog";
import DiffViewerDialog from "./diff-viewer-dialog";
import SyncDialog from "./sync-dialog";
import {
  ChevronLeft,
  ChevronUp,
  FolderPlus,
  FolderTree,
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
  const [dragOver, setDragOver] = useState(false);
  const [entries, setEntries] = useState<SFTPFileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [transfers, setTransfers] = useState<SFTPTransfer[]>([]);

  const [editorPath, setEditorPath] = useState<string | null>(null);
  const [tailPath, setTailPath] = useState<string | null>(null);
  const [diffPath, setDiffPath] = useState<string | null>(null);
  const [syncPath, setSyncPath] = useState<string | null>(null);

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
      transferId?: string;
    }) => {
      if (data.sessionId !== sessionId) return;
      setTransfers((prev) =>
        prev.map((t) =>
          // Match by transfer id (filename is unknown up front for picker-based
          // uploads). Adopt the resolved basename the main process reports.
          data.transferId === t.id && t.status === "transferring"
            ? {
                ...t,
                filename: data.filename || t.filename,
                bytes: data.bytes,
                total: data.total,
              }
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

  function addTransfer(type: "upload" | "download", filename: string): string {
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
        t.id === id ? { ...t, status: error ? "error" : "done", error } : t,
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
      await window.api.sftp.download(sessionId, remotePath, id);
      finishTransfer(id);
    } catch (err: any) {
      finishTransfer(id, err?.message ?? String(err));
    }
  }

  async function handleUpload() {
    const id = addTransfer("upload", "…");
    try {
      const result = await window.api.sftp.upload(sessionId, currentPath, id);
      // User cancelled the file picker — drop the placeholder transfer.
      if (!result) {
        activeTransferIds.current.delete(id);
        setTransfers((prev) => prev.filter((t) => t.id !== id));
        return;
      }
      finishTransfer(id);
      await navigateTo(currentPath);
    } catch (err: any) {
      finishTransfer(id, err?.message ?? String(err));
    }
  }

  // Upload files dropped from the OS file manager. Electron 35 removed the
  // `File.path` property, so resolve each dropped file's absolute path via
  // webUtils.getPathForFile (exposed through the preload bridge).
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    const paths = files
      .map((f) => window.api.sftp.getPathForFile(f))
      .filter((p): p is string => !!p);
    if (paths.length === 0) return;
    for (const localPath of paths) {
      const name = localPath.split(/[\\/]/).pop() ?? "file";
      const id = addTransfer("upload", name);
      try {
        await window.api.sftp.uploadPath(sessionId, localPath, currentPath, id);
        finishTransfer(id);
      } catch (err: any) {
        finishTransfer(id, err?.message ?? String(err));
      }
    }
    await navigateTo(currentPath);
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
      className="absolute left-0 top-0 bottom-0 h-full bg-panel/95 backdrop-blur-md border-r border-hairline/50 flex flex-col z-10 shadow-2xl"
      style={{ width: 260 }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!dragOver) setDragOver(true);
      }}
      onDragLeave={(e) => {
        // Only clear when the cursor actually leaves the panel bounds.
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={handleDrop}
    >
      {dragOver && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-accent-500/10 border-2 border-dashed border-accent-500/60 pointer-events-none">
          <span className="text-sm font-medium text-accent-200">
            Soltar para subir a {currentPath}
          </span>
        </div>
      )}

      {/* Resize handle (right edge) */}
      <div
        className="absolute right-0 top-0 h-full w-1 cursor-ew-resize bg-transparent hover:bg-accent-500/30 active:bg-accent-500/50 z-10 transition-colors"
        onMouseDown={startResizing}
      />

      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-hairline/50 flex-shrink-0">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-accent-400/90 tracking-wider uppercase truncate">
            Files
          </div>
          <div className="text-[10px] text-ink-subtle truncate">
            {connection.username}@{connection.host}
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1 rounded text-ink-subtle hover:text-ink-muted hover:bg-elevated/50 transition-colors"
          title="Close file browser"
        >
          <X size={13} />
        </button>
      </div>

      {connecting && (
        <div className="flex-1 flex items-center justify-center gap-2 text-ink-subtle text-[12px]">
          <Loader2 size={14} className="animate-spin" />
          Connecting…
        </div>
      )}

      {connectError && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 px-4 text-center">
          <AlertTriangle size={20} className="text-danger/70" />
          <span className="text-[11px] text-danger/80">{connectError}</span>
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
          <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-hairline/40 flex-shrink-0">
            <button
              onClick={() => navigateTo(parentPath(currentPath))}
              disabled={currentPath === "/"}
              className="p-1.5 rounded text-ink-subtle hover:text-accent-300 hover:bg-elevated/50 disabled:opacity-30 disabled:cursor-default transition-colors"
              title="Go up"
            >
              <ChevronUp size={13} />
            </button>
            <button
              onClick={() => navigateTo(currentPath)}
              className="p-1.5 rounded text-ink-subtle hover:text-accent-300 hover:bg-elevated/50 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
            <div className="flex-1" />
            <button
              onClick={handleUpload}
              className="p-1.5 rounded text-ink-subtle hover:text-accent-300 hover:bg-elevated/50 transition-colors"
              title="Upload file"
            >
              <Upload size={13} />
            </button>
            <button
              onClick={() => setSyncPath(currentPath)}
              className="p-1.5 rounded text-ink-subtle hover:text-accent-300 hover:bg-elevated/50 transition-colors"
              title="Sync this directory"
            >
              <FolderTree size={13} />
            </button>
            <button
              onClick={() => {
                setNewFolderMode(true);
                setNewFolderName("");
              }}
              className="p-1.5 rounded text-ink-subtle hover:text-accent-300 hover:bg-elevated/50 transition-colors"
              title="New folder"
            >
              <FolderPlus size={13} />
            </button>
          </div>

          {/* Breadcrumb */}
          <div className="flex items-center gap-0.5 px-2 py-1 overflow-x-auto flex-shrink-0 scrollbar-none">
            <button
              onClick={() => navigateTo("/")}
              className="text-[10px] text-ink-subtle hover:text-accent-300 flex-shrink-0 transition-colors"
            >
              /
            </button>
            {pathSegments.map((seg) => (
              <span key={seg.path} className="flex items-center gap-0.5">
                <ChevronLeft
                  size={9}
                  className="text-ink-subtle rotate-180 flex-shrink-0"
                />
                <button
                  onClick={() => navigateTo(seg.path)}
                  className="text-[10px] text-ink-subtle hover:text-accent-300 flex-shrink-0 truncate max-w-[80px] transition-colors"
                  title={seg.path}
                >
                  {seg.label}
                </button>
              </span>
            ))}
          </div>

          {listError && (
            <div className="px-3 py-1.5 text-[11px] text-danger/80 bg-danger/10 border-b border-danger/20 flex items-center gap-1.5 flex-shrink-0">
              <AlertTriangle size={11} />
              <span className="truncate">{listError}</span>
            </div>
          )}

          {/* File list */}
          <div className="flex-1 overflow-y-auto py-1 min-h-0">
            {/* New folder input row */}
            {newFolderMode && (
              <div className="flex items-center gap-1.5 px-2 py-1">
                <FolderPlus
                  size={13}
                  className="text-accent-400/80 flex-shrink-0"
                />
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
                  className="flex-1 bg-elevated/60 border border-accent-500/40 rounded px-1.5 py-0.5 text-[12px] text-ink-muted outline-none"
                />
              </div>
            )}

            {entries.length === 0 && !loading && !listError && (
              <div className="px-3 py-4 text-[11px] text-ink-subtle text-center">
                Empty directory
              </div>
            )}

            {entries.map((entry) => {
              const fullPath = joinPath(currentPath, entry.filename);
              return (
                <FileEntryRow
                  key={entry.filename}
                  entry={entry}
                  onDoubleClick={() => {
                    if (entry.isDirectory) {
                      navigateTo(fullPath);
                    } else {
                      setEditorPath(fullPath);
                    }
                  }}
                  onDownload={() => handleDownload(entry)}
                  onRename={(newName) => handleRename(entry, newName)}
                  onDelete={() => handleDelete(entry)}
                  onEdit={() => setEditorPath(fullPath)}
                  onTail={() => setTailPath(fullPath)}
                  onDiff={() => setDiffPath(fullPath)}
                  onSync={() => setSyncPath(fullPath)}
                />
              );
            })}
          </div>

          {/* Transfer queue */}
          {transfers.length > 0 && (
            <div className="border-t border-hairline/40 flex-shrink-0 max-h-32 overflow-y-auto">
              <div className="px-3 py-1 text-[10px] text-ink-subtle uppercase tracking-wider">
                Transfers
              </div>
              {transfers.map((t) => (
                <TransferItem key={t.id} transfer={t} />
              ))}
            </div>
          )}
        </>
      )}

      {editorPath && (
        <RemoteEditorDialog
          open={true}
          sessionId={sessionId}
          remotePath={editorPath}
          onClose={() => setEditorPath(null)}
        />
      )}
      {tailPath && (
        <TailViewerDialog
          open={true}
          sessionId={sessionId}
          remotePath={tailPath}
          onClose={() => setTailPath(null)}
        />
      )}
      {diffPath && (
        <DiffViewerDialog
          open={true}
          sessionId={sessionId}
          remotePath={diffPath}
          onClose={() => setDiffPath(null)}
        />
      )}
      {syncPath && (
        <SyncDialog
          open={true}
          sessionId={sessionId}
          remoteDir={syncPath}
          onClose={() => setSyncPath(null)}
        />
      )}
    </div>
  );
}
