import { ReactElement, useEffect, useRef, useState } from "react";
import { ArrowUp, Folder, Loader2, Check, X } from "lucide-react";

/** Shape accepted by `sftp.connect` (mirrors the SSH connection, with jumps). */
export type RemoteConn = {
  id: string;
  host: string;
  port: number;
  username: string;
  identityFile?: string;
  identityKeyId?: string;
  hasPassword?: boolean;
  credentialId?: string;
  passwordRef?: { provider: SecretProvider; ref: string };
  jumpHosts?: {
    host: string;
    port: number;
    username: string;
    identityFile?: string;
    identityKeyId?: string;
  }[];
};

type Entry = { filename: string; isDirectory: boolean; isSymlink: boolean };

function joinPath(base: string, name: string): string {
  return base.endsWith("/") ? base + name : base + "/" + name;
}

function parentPath(p: string): string {
  const trimmed = p.replace(/\/+$/, "");
  const up = trimmed.substring(0, trimmed.lastIndexOf("/"));
  return up || "/";
}

type Props = {
  connection: RemoteConn;
  onPick: (path: string) => void;
  onClose: () => void;
};

/**
 * Inline remote directory browser used by the agent launcher to choose a
 * working directory over SFTP. Opens its own short-lived SFTP session (reusing
 * the host's stored key/password) and tears it down on unmount. Best-effort —
 * if auth needs an interactive password the connection fails and the user can
 * still type the path by hand.
 */
export default function RemoteFolderBrowser({
  connection,
  onPick,
  onClose,
}: Props): ReactElement {
  const sessionId = useRef(`agent-pick-${crypto.randomUUID()}`).current;
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [path, setPath] = useState("");
  const [dirs, setDirs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function navigate(target: string): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const list = (await window.api.sftp.list(sessionId, target)) as Entry[];
      const folders = list
        .filter((e) => e.isDirectory || e.isSymlink)
        .map((e) => e.filename)
        .sort((a, b) => a.localeCompare(b));
      setDirs(folders);
      setPath(target);
    } catch (err) {
      setError((err as Error)?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setConnecting(true);
    setError(null);
    window.api.sftp
      .connect(sessionId, connection)
      .then(async () => {
        if (cancelled) return;
        setConnecting(false);
        let home = "/";
        try {
          home = await window.api.sftp.realpath(sessionId, ".");
        } catch {
          /* fall back to root */
        }
        if (!cancelled) navigate(home);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setConnecting(false);
        setError(err?.message ?? String(err));
      });
    return () => {
      cancelled = true;
      window.api.sftp.disconnect(sessionId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-md border border-slate-700 bg-slate-950/60 text-sm">
      {/* Path bar */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-slate-700/60">
        <button
          type="button"
          onClick={() => navigate(parentPath(path))}
          disabled={connecting || !path || path === "/"}
          className="flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:bg-slate-800 hover:text-accent-300 disabled:opacity-40 transition-colors"
          title="Up one level"
        >
          <ArrowUp size={14} />
        </button>
        <span className="flex-1 min-w-0 truncate font-mono text-xs text-gray-400">
          {path || "…"}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center w-6 h-6 rounded text-gray-500 hover:bg-slate-800 hover:text-gray-300 transition-colors"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>

      {/* Listing */}
      <div className="max-h-48 overflow-y-auto p-1">
        {connecting && (
          <div className="flex items-center gap-2 px-2 py-3 text-xs text-gray-500">
            <Loader2 size={13} className="animate-spin" />
            Connecting…
          </div>
        )}
        {!connecting && error && (
          <div className="px-2 py-3 text-xs text-red-400">
            {error}
            <div className="mt-1 text-gray-500">
              You can still type the path manually.
            </div>
          </div>
        )}
        {!connecting && !error && loading && (
          <div className="flex items-center gap-2 px-2 py-3 text-xs text-gray-500">
            <Loader2 size={13} className="animate-spin" />
            Loading…
          </div>
        )}
        {!connecting && !error && !loading && dirs.length === 0 && (
          <div className="px-2 py-3 text-xs text-gray-600">
            No subfolders here.
          </div>
        )}
        {!connecting &&
          !error &&
          !loading &&
          dirs.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => navigate(joinPath(path, name))}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-gray-300 hover:bg-slate-800 transition-colors"
            >
              <Folder size={14} className="text-accent-400/70 flex-shrink-0" />
              <span className="truncate">{name}</span>
            </button>
          ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-t border-slate-700/60">
        <span className="text-[11px] text-gray-600">
          Browsing {connection.username}@{connection.host}
        </span>
        <button
          type="button"
          onClick={() => onPick(path)}
          disabled={connecting || !path}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-accent-600/20 text-accent-300 border border-accent-600/30 hover:bg-accent-600/30 disabled:opacity-40 transition-colors"
        >
          <Check size={13} />
          Use this folder
        </button>
      </div>
    </div>
  );
}
