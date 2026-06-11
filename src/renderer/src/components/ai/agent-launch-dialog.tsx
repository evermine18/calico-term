import { ReactElement, ReactNode, useEffect, useState } from "react";
import { FolderOpen, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@renderer/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@renderer/components/ui/select";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import { Label } from "@renderer/components/ui/label";
import { useAppContext } from "@renderer/contexts/app-context";
import { TerminalTab } from "@renderer/types/terminal";
import { AGENT_LAUNCHERS } from "@renderer/types/ai-agents";
import { launchAgentTab } from "@renderer/lib/tab-operations";
import RemoteFolderBrowser, {
  RemoteConn,
} from "@renderer/components/ai/remote-folder-browser";

const LOCAL = "__local__";

type Props = {
  setTabs: React.Dispatch<React.SetStateAction<TerminalTab[]>>;
  setActiveTab: (id: string) => void;
  /** Optional trigger element; omit when driving the dialog via `open`. */
  children?: ReactNode;
  /** Controlled open state (e.g. opened from a menu item). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * Compact launcher for external CLI agents (Claude Code, Codex, …). Lives in the
 * tab bar so the home panel stays focused on SSH connections. Always asks for a
 * working directory: a local folder picker for local runs, or a remote path for
 * SSH runs. Can be used as an uncontrolled dialog (pass `children` as a trigger)
 * or controlled (pass `open` / `onOpenChange`).
 */
export default function AgentLaunchDialog({
  setTabs,
  setActiveTab,
  children,
  open: openProp,
  onOpenChange,
}: Props): ReactElement {
  const { sshConnections, workspaces, activeWorkspaceId } = useAppContext();
  const activeWs =
    workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0] ?? null;
  const visibleConnections = activeWs
    ? sshConnections.filter((c) => activeWs.sshConnectionIds.includes(c.id))
    : sshConnections;

  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;
  const [agentId, setAgentId] = useState(AGENT_LAUNCHERS[0].id);
  const [target, setTarget] = useState(LOCAL);
  const [folder, setFolder] = useState("");
  const [browsing, setBrowsing] = useState(false);
  const [installed, setInstalled] = useState<Record<string, boolean>>({});

  const isLocal = target === LOCAL;
  const agent =
    AGENT_LAUNCHERS.find((a) => a.id === agentId) ?? AGENT_LAUNCHERS[0];
  const selectedConn = isLocal
    ? null
    : (visibleConnections.find((c) => c.id === target) ?? null);
  // SFTP connection info (with resolved jump hosts) for the remote browser.
  const sftpConn: RemoteConn | null = selectedConn
    ? {
        id: selectedConn.id,
        host: selectedConn.host,
        port: selectedConn.port,
        username: selectedConn.username,
        identityFile: selectedConn.identityFile,
        identityKeyId: selectedConn.identityKeyId,
        hasPassword: selectedConn.hasPassword,
        credentialId: selectedConn.credentialId,
        passwordRef: selectedConn.passwordRef,
        jumpHosts: (selectedConn.jumpHostIds ?? [])
          .map((jid) => sshConnections.find((c) => c.id === jid))
          .filter((c): c is SSHConnectionEntry => !!c)
          .map((j) => ({
            host: j.host,
            port: j.port,
            username: j.username,
            identityFile: j.identityFile,
            identityKeyId: j.identityKeyId,
          })),
      }
    : null;

  // Best-effort local install detection whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    window.api.agents
      .detect(AGENT_LAUNCHERS.map((a) => a.command))
      .then((map) => {
        if (!cancelled) setInstalled(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  const browseFolder = async (): Promise<void> => {
    const dir = await window.api.sftp.pickLocalDir();
    if (dir) setFolder(dir);
  };

  const launch = async (): Promise<void> => {
    const conn = selectedConn;
    const jumpChain = conn
      ? (conn.jumpHostIds ?? [])
          .map((jid) => sshConnections.find((c) => c.id === jid))
          .filter((c): c is SSHConnectionEntry => !!c)
      : [];
    await launchAgentTab(
      agent,
      conn,
      jumpChain,
      folder.trim() || null,
      setTabs,
      setActiveTab,
    );
    setOpen(false);
    setFolder("");
    setBrowsing(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700/40 shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-gray-100">Launch AI Agent</DialogTitle>
          <DialogDescription className="text-gray-400">
            Run a coding agent in a new tab — locally or over SSH.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Agent */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-gray-300 text-sm">Agent</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger className="bg-slate-800/60 border-slate-700 text-gray-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700/50">
                {AGENT_LAUNCHERS.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <span className="flex items-center gap-2">
                      <span style={{ color: `rgb(${a.color.join(",")})` }}>
                        {a.glyph}
                      </span>
                      {a.name}
                      {installed[a.command] === false && (
                        <span className="text-[10px] text-gray-500">
                          (not found)
                        </span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {installed[agent.command] === false && (
              <a
                href={agent.website}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-accent-400"
              >
                <code className="font-mono">{agent.command}</code> not found
                locally — install docs
                <ExternalLink size={10} />
              </a>
            )}
          </div>

          {/* Run on */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-gray-300 text-sm">Run on</Label>
            <Select
              value={target}
              onValueChange={(v) => {
                setTarget(v);
                setFolder("");
                setBrowsing(false);
              }}
            >
              <SelectTrigger className="bg-slate-800/60 border-slate-700 text-gray-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700/50">
                <SelectItem value={LOCAL}>Local</SelectItem>
                {visibleConnections.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Folder */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-gray-300 text-sm">
              {isLocal ? "Folder" : "Remote folder"}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                placeholder={
                  isLocal ? "Default (home directory)" : "~ (default login dir)"
                }
                className="bg-slate-800/60 border-slate-700 text-gray-100 placeholder:text-gray-500"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={isLocal ? browseFolder : () => setBrowsing((v) => !v)}
                title="Browse…"
                className="border-slate-700 text-gray-300 hover:bg-slate-800 hover:text-gray-100"
              >
                <FolderOpen size={16} />
              </Button>
            </div>
            {!isLocal && browsing && sftpConn && (
              <RemoteFolderBrowser
                connection={sftpConn}
                onPick={(p) => {
                  setFolder(p);
                  setBrowsing(false);
                }}
                onClose={() => setBrowsing(false)}
              />
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="border-slate-700 text-gray-300 hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            onClick={launch}
            className="bg-accent-600 hover:bg-accent-500 text-white"
          >
            Launch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
