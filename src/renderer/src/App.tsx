import { useState, useEffect } from "react";
import { TerminalPanel } from "./components/terminal-tab";
import { TerminalTab } from "./types/terminal";
import TerminalHeader from "./components/terminal/terminal-header";
import { AppProvider, useAppContext } from "./contexts/app-context";
import AISidebarChat from "./components/ai/sidebar-chat";
import { ThemeProvider } from "./components/theme-provider";
import {
  TerminalProvider,
  useTerminalContext,
} from "./contexts/terminal-context";
import CommandHistoryDialog from "./components/command-history/dialog";
import SSHConnectionsHome from "./components/ssh/ssh-connections-home";
import FileBrowserPanel from "./components/sftp/file-browser-panel";
import MetricsPanel from "./components/observability/metrics-panel";
import MetricsStatusInline from "./components/observability/metrics-status-inline";
import { useMetrics } from "./components/observability/use-metrics";
import { WorkspaceSwitcher } from "./components/workspaces/workspace-switcher";
import { WorkspaceChip } from "./components/workspaces/workspace-chip";
import { SnippetPalette } from "./components/workspaces/snippet-palette";
import WhatsNewDialog from "./components/whats-new/whats-new-dialog";
import { APP_VERSION, WHATS_NEW_STORAGE_KEY } from "./lib/whats-new-data";
import { buildSSHCommand } from "./types/ssh";
import { Terminal } from "@xterm/xterm";
import {
  Minus,
  Square,
  TerminalSquare,
  X,
  ShieldAlert,
  PlugZap,
} from "lucide-react";
import { closeTab, detachTab, armSSHSession } from "./lib/tab-operations";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";

function matchShortcut(e: KeyboardEvent, s: ShortcutDef): boolean {
  return (
    e.key.toLowerCase() === s.key.toLowerCase() &&
    !!e.ctrlKey === s.ctrl &&
    !!e.shiftKey === s.shift &&
    !!e.altKey === s.alt
  );
}

function buildEnvScopes(
  activeWorkspaceId: string,
  connId: string | undefined,
  workspaces: WorkspaceEntry[],
): string[] {
  const scopes = ["global", `workspace:${activeWorkspaceId}`];
  if (connId) {
    // If the connection lives in workspaces other than the active one,
    // include those scopes too so per-workspace env still applies.
    for (const w of workspaces) {
      if (w.id === activeWorkspaceId) continue;
      if (w.sshConnectionIds.includes(connId)) {
        scopes.push(`workspace:${w.id}`);
      }
    }
    scopes.push(`host:${connId}`);
  }
  return scopes;
}

function AppContent(): React.JSX.Element {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [showHome, setShowHome] = useState(false);
  const [sftpOpen, setSftpOpen] = useState(false);
  const [metricsOpen, setMetricsOpen] = useState(false);
  // Scrollback to repaint for tabs returning from a closed detached window.
  const [returnedSerialized, setReturnedSerialized] = useState<
    Record<string, string>
  >({});
  const { getById } = useTerminalContext();
  const {
    setHistoryDialogOpen,
    shortcuts,
    aiSidebarOpen,
    setAiSidebarOpen,
    sshConnections,
    workspaces,
    activeWorkspaceId,
    setWorkspaceSwitcherOpen,
    setSnippetPaletteOpen,
  } = useAppContext();
  const [guardrailPrompt, setGuardrailPrompt] = useState<{
    tabId: string;
    command: string;
    description: string;
  } | null>(null);
  const [guardrailConfirm, setGuardrailConfirm] = useState("");
  const [mcpPrompt, setMcpPrompt] = useState<McpApprovalPrompt | null>(null);
  const [disconnectedTabs, setDisconnectedTabs] = useState<Set<string>>(
    new Set(),
  );
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);

  // Show the What's New dialog once per release. We compare the persisted
  // "last seen version" against APP_VERSION; if they differ (or it's missing)
  // we open the dialog and mark it as seen on close.
  useEffect(() => {
    try {
      const seen = localStorage.getItem(WHATS_NEW_STORAGE_KEY);
      if (seen !== APP_VERSION) setWhatsNewOpen(true);
    } catch {
      // localStorage may be unavailable (e.g. file:// edge cases) — fail open.
    }
  }, []);

  const handleWhatsNewClose = (): void => {
    setWhatsNewOpen(false);
    try {
      localStorage.setItem(WHATS_NEW_STORAGE_KEY, APP_VERSION);
    } catch {
      // ignore — worst case the dialog reappears on next launch.
    }
  };

  const activeTabObj = tabs.find((t) => t.id === activeTab) ?? null;
  const activeSSHConn =
    activeTabObj?.isSSH && activeTabObj.connId
      ? (sshConnections.find((c) => c.id === activeTabObj.connId) ?? null)
      : null;

  // Build metrics-connection info from the active SSH connection (independent
  // of SFTP). null when no SSH tab is active so the polling stops.
  const metricsConn = activeSSHConn
    ? {
        id: activeSSHConn.id,
        host: activeSSHConn.host,
        port: activeSSHConn.port,
        username: activeSSHConn.username,
        identityFile: activeSSHConn.identityFile,
        identityKeyId: activeSSHConn.identityKeyId,
        hasPassword: activeSSHConn.hasPassword,
        credentialId: activeSSHConn.credentialId,
        passwordRef: activeSSHConn.passwordRef,
        jumpHosts: (activeSSHConn.jumpHostIds ?? [])
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

  const metricsSessionId =
    activeSSHConn && activeTabObj ? `metrics-${activeTabObj.id}` : null;
  const metrics = useMetrics(metricsSessionId, metricsConn);

  // Wrap setActiveTab so any tab click also dismisses the home overlay and clears activity
  const handleSetActiveTab = (id: string) => {
    setActiveTab(id);
    setShowHome(false);
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, hasActivity: false } : t)),
    );
  };

  const handleTabActivity = (id: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, hasActivity: true } : t)),
    );
  };

  // Pop a tab out into its own window. Serialize its current buffer first so
  // the detached window inherits the scrollback; the PTY keeps running.
  const handleDetachTab = (id: string) => {
    const serialized = getById(id)?.serialize() ?? "";
    detachTab(id, tabs, activeTab, setTabs, handleSetActiveTab, serialized);
  };

  // Re-adopt a tab whose detached window was closed, restoring its scrollback.
  useEffect(() => {
    const off = window.api.detach.onReturned((data) => {
      setReturnedSerialized((prev) => ({
        ...prev,
        [data.tabId]: data.serialized,
      }));
      setTabs((prev) => {
        if (prev.some((t) => t.id === data.tabId)) return prev;
        const newTab: TerminalTab = {
          id: data.tabId,
          title: data.title,
          mode: "normal",
          terminal: new Terminal(),
          isSSH: data.isSSH,
          connId: data.connId,
          agentId: data.agentId,
        };
        return [...prev, newTab];
      });
      setShowHome(false);
      setActiveTab(data.tabId);
    });
    return off;
  }, []);

  // Configurable keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchShortcut(e, shortcuts.openHistory)) {
        e.preventDefault();
        setHistoryDialogOpen(true);
      } else if (matchShortcut(e, shortcuts.toggleSidebar)) {
        e.preventDefault();
        setAiSidebarOpen(!aiSidebarOpen);
      } else if (matchShortcut(e, shortcuts.newTab)) {
        e.preventDefault();
        const id = crypto.randomUUID();
        const newTab: TerminalTab = {
          id,
          title: `Terminal ${tabs.length + 1}`,
          mode: "normal",
          terminal: new Terminal(),
        };
        setTabs((prev) => [...prev, newTab]);
        handleSetActiveTab(id);
      } else if (matchShortcut(e, shortcuts.closeTab) && activeTab) {
        e.preventDefault();
        closeTab(activeTab, tabs, activeTab, setTabs, handleSetActiveTab);
      } else if (matchShortcut(e, shortcuts.nextTab) && tabs.length > 1) {
        e.preventDefault();
        const idx = tabs.findIndex((t) => t.id === activeTab);
        handleSetActiveTab(tabs[(idx + 1) % tabs.length].id);
      } else if (matchShortcut(e, shortcuts.prevTab) && tabs.length > 1) {
        e.preventDefault();
        const idx = tabs.findIndex((t) => t.id === activeTab);
        handleSetActiveTab(tabs[(idx - 1 + tabs.length) % tabs.length].id);
      } else if (matchShortcut(e, shortcuts.openWorkspaceSwitcher)) {
        e.preventDefault();
        setWorkspaceSwitcherOpen(true);
      } else if (matchShortcut(e, shortcuts.openSnippetPalette)) {
        e.preventDefault();
        setSnippetPaletteOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    shortcuts,
    aiSidebarOpen,
    tabs,
    activeTab,
    setHistoryDialogOpen,
    setAiSidebarOpen,
    setWorkspaceSwitcherOpen,
    setSnippetPaletteOpen,
  ]);

  // Sync workspace ↔ main: alert rule scoping and prod guardrails need to
  // know which connections live in which workspace, and which tabs are
  // currently associated with a prod-owned connection.
  useEffect(() => {
    const map: Record<string, string[]> = {};
    for (const w of workspaces) map[w.id] = [...w.sshConnectionIds];
    window.api.alerts.setWorkspaceMap(map);
  }, [workspaces]);

  // Push the set of prod-owning tabIds whenever tabs or workspaces change.
  useEffect(() => {
    const prodConnIds = new Set<string>();
    for (const w of workspaces) {
      if (w.environment === "prod") {
        for (const cid of w.sshConnectionIds) prodConnIds.add(cid);
      }
    }
    const prodTabIds: string[] = [];
    for (const t of tabs) {
      if (t.connId && prodConnIds.has(t.connId)) prodTabIds.push(t.id);
    }
    window.api.guardrails.setProdTabs(prodTabIds);
  }, [tabs, workspaces]);

  // Mirror tab metadata to main so the MCP `list_terminals` tool can name tabs
  // (the main process only knows raw tabIds otherwise).
  useEffect(() => {
    window.api.mcp.setTabsMeta(
      tabs.map((t) => ({
        tabId: t.id,
        title: t.title,
        isSSH: !!t.isSSH,
        connId: t.connId ?? null,
      })),
    );
  }, [tabs]);

  // Listen for MCP command-approval requests from main and surface a dialog.
  useEffect(() => {
    const off = window.api.mcp.onApprovalPrompt((data) => {
      setMcpPrompt(data);
    });
    return off;
  }, []);

  const resolveMcp = (decision: "allow" | "deny" | "allow-all") => {
    if (!mcpPrompt) return;
    window.api.mcp.resolveApproval(mcpPrompt.id, decision);
    setMcpPrompt(null);
  };

  // Listen for guardrail prompts from main.
  useEffect(() => {
    const off = window.api.guardrails.onPrompt((data) => {
      setGuardrailPrompt({
        tabId: data.tabId,
        command: data.command,
        description: data.description,
      });
      setGuardrailConfirm("");
    });
    return off;
  }, []);

  // Listen for SSH session drops from main and flag the tab so the status bar
  // can offer a Reconnect action.
  useEffect(() => {
    const off = window.api.ssh.onDisconnected((tabId) => {
      setDisconnectedTabs((prev) => {
        const next = new Set(prev);
        next.add(tabId);
        return next;
      });
    });
    return off;
  }, []);

  // Prune disconnected-flag entries for tabs that no longer exist.
  useEffect(() => {
    setDisconnectedTabs((prev) => {
      const tabIds = new Set(tabs.map((t) => t.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (tabIds.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [tabs]);

  const reconnectSSHTab = async (tab: TerminalTab) => {
    if (!tab.connId || !tab.initialCommand) return;
    const conn = sshConnections.find((c) => c.id === tab.connId);
    if (!conn) return;
    await armSSHSession(tab.id, conn);
    window.electron.ipcRenderer.send("terminal-input", {
      tabId: tab.id,
      data: tab.initialCommand + "\r",
    });
    setDisconnectedTabs((prev) => {
      const next = new Set(prev);
      next.delete(tab.id);
      return next;
    });
  };

  return (
    <div className="h-screen flex flex-col relative bg-slate-950 text-gray-100">
      {/* Header with window controls */}
      <div className="bg-slate-900/95 backdrop-blur-xl border-b border-slate-700/40 px-4 py-1.5 flex items-center gap-2 shadow-xl">
        {window.platform?.os === "darwin" && (
          <div className="ml-16 flex-shrink-0" />
        )}
        <div className="drag-region flex flex-1 items-center gap-2">
          <div className="flex items-center gap-2">
            <TerminalSquare
              size={15}
              className="text-accent-400 flex-shrink-0"
              style={{
                filter: "drop-shadow(0 0 5px rgba(var(--accent-rgb),0.7))",
              }}
            />
            <span className="text-sm font-semibold tracking-widest text-gray-300 select-none">
              <span className="text-accent-400">calico</span>
              <span className="text-slate-500 mx-0.5">/</span>
              <span className="text-gray-400">term</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-gray-400 text-xs">
            <span className="selectable-section">
              <WorkspaceSwitcher />
            </span>
          </div>
        </div>
        {window.platform?.os === "linux" && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={() => window.api.windowControls.minimize()}
              className="flex items-center justify-center w-7 h-7 rounded text-gray-500 hover:bg-slate-700/60 hover:text-gray-300 transition-all duration-150"
              title="Minimize"
            >
              <Minus size={12} />
            </button>
            <button
              onClick={() => window.api.windowControls.maximize()}
              className="flex items-center justify-center w-7 h-7 rounded text-gray-500 hover:bg-slate-700/60 hover:text-gray-300 transition-all duration-150"
              title="Maximize"
            >
              <Square size={10} />
            </button>
            <button
              onClick={() => window.api.windowControls.close()}
              className="flex items-center justify-center w-7 h-7 rounded text-gray-500 hover:bg-red-500/20 hover:text-red-400 transition-all duration-150"
              title="Close"
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Tabs Header */}
      <TerminalHeader
        tabs={tabs}
        setTabs={setTabs}
        activeTab={activeTab}
        setActiveTab={handleSetActiveTab}
        showHome={showHome}
        setShowHome={setShowHome}
        sftpOpen={sftpOpen}
        setSftpOpen={setSftpOpen}
        activeTabIsSSH={!!activeSSHConn}
        onDetachTab={handleDetachTab}
      />
      {/* Terminal Content */}
      <div className="flex-1 bg-slate-950 relative overflow-hidden pb-8">
        {sftpOpen && activeSSHConn && (
          <FileBrowserPanel
            sessionId={activeTabObj!.id}
            connection={activeSSHConn}
            onClose={() => setSftpOpen(false)}
          />
        )}
        {metricsOpen && activeSSHConn && (
          <MetricsPanel
            samples={metrics.samples}
            error={metrics.error}
            onClose={() => setMetricsOpen(false)}
          />
        )}
        <AISidebarChat />
        <CommandHistoryDialog />
        {/* Terminals — always mounted to preserve PTY state */}
        {tabs.map((tab) => {
          const tabEnvScopes = buildEnvScopes(
            activeWorkspaceId,
            tab.connId,
            workspaces,
          );
          return (
            <div
              key={tab.id}
              className={`absolute inset-0 transition-all duration-300 ${
                !showHome && activeTab === tab.id
                  ? "opacity-100 scale-100"
                  : "opacity-0 scale-95 pointer-events-none"
              }`}
            >
              <TerminalPanel
                tabId={tab.id}
                active={!showHome && activeTab === tab.id}
                tabTitle={tab.title}
                initialCommand={tab.initialCommand}
                onActivity={() => handleTabActivity(tab.id)}
                envScopes={tabEnvScopes}
                initialSerialized={returnedSerialized[tab.id]}
                cwd={tab.cwd}
                agentBanner={tab.agentBanner}
              />
            </div>
          );
        })}

        {/* Home overlay — shown when no tabs, or user toggled home */}
        {(tabs.length === 0 || showHome) && (
          <div className="absolute inset-0 bg-slate-950 z-10">
            <SSHConnectionsHome
              onConnect={async (conn) => {
                // Prod confirmation: any workspace marked `prod` that owns this connection
                const inProd = workspaces.some(
                  (w) =>
                    w.environment === "prod" &&
                    w.sshConnectionIds.includes(conn.id),
                );
                if (inProd) {
                  const ok = window.confirm(
                    `⚠ Production environment\n\nYou are about to connect to "${conn.name}" which belongs to a PROD workspace. Continue?`,
                  );
                  if (!ok) return;
                }
                const id = crypto.randomUUID();
                const jumpChain = (conn.jumpHostIds ?? [])
                  .map((jid) => sshConnections.find((c) => c.id === jid))
                  .filter((c): c is SSHConnectionEntry => !!c);
                const command = buildSSHCommand(conn, jumpChain);
                const newTab: TerminalTab = {
                  id,
                  title: conn.name,
                  mode: "normal",
                  terminal: new Terminal(),
                  initialCommand: command,
                  badge: conn.tags?.[0] ?? null,
                  isSSH: true,
                  connId: conn.id,
                };
                // Register password-injection session BEFORE the terminal mounts
                // and wire alert/guardrail scoping + SSH-disconnect detection.
                await armSSHSession(id, conn);
                setTabs((prev) => [...prev, newTab]);
                handleSetActiveTab(id);
              }}
            />
          </div>
        )}
      </div>

      {/* Snippet palette (cmdk dialog) */}
      <SnippetPalette />

      {/* What's New — gated by APP_VERSION via localStorage */}
      <WhatsNewDialog open={whatsNewOpen} onClose={handleWhatsNewClose} />

      {/* Prod guardrail confirmation */}
      <Dialog
        open={!!guardrailPrompt}
        onOpenChange={(o) => {
          if (!o && guardrailPrompt) {
            window.api.guardrails.resolve(guardrailPrompt.tabId, false);
            setGuardrailPrompt(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[460px] bg-slate-900 border-red-500/40">
          <DialogHeader>
            <DialogTitle className="text-red-300 flex items-center gap-2">
              <ShieldAlert size={16} />
              Production guardrail
            </DialogTitle>
          </DialogHeader>
          {guardrailPrompt && (
            <div className="space-y-3 py-1">
              <p className="text-sm text-gray-300">
                The command you are about to execute matched:
              </p>
              <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1.5">
                {guardrailPrompt.description}
              </div>
              <pre className="text-xs font-mono text-gray-100 bg-slate-800/80 border border-slate-700/40 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                {guardrailPrompt.command || "(empty)"}
              </pre>
              <p className="text-xs text-gray-400">
                This tab belongs to a workspace marked{" "}
                <span className="text-red-400 font-bold">PROD</span>. Type{" "}
                <span className="font-mono text-red-300">yes</span> below to
                confirm.
              </p>
              <Input
                autoFocus
                value={guardrailConfirm}
                onChange={(e) => setGuardrailConfirm(e.target.value)}
                placeholder="yes"
                className="bg-slate-800/60 border-slate-700 text-gray-100 font-mono"
              />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (guardrailPrompt) {
                  window.api.guardrails.resolve(guardrailPrompt.tabId, false);
                }
                setGuardrailPrompt(null);
              }}
              className="border-slate-700/50 text-gray-300"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={guardrailConfirm.trim().toLowerCase() !== "yes"}
              onClick={() => {
                if (guardrailPrompt) {
                  window.api.guardrails.resolve(guardrailPrompt.tabId, true);
                }
                setGuardrailPrompt(null);
              }}
              className="bg-red-600/90 hover:bg-red-600 text-white"
            >
              Execute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MCP agent action approval */}
      <Dialog
        open={!!mcpPrompt}
        onOpenChange={(o) => {
          if (!o) resolveMcp("deny");
        }}
      >
        <DialogContent className="sm:max-w-[480px] bg-slate-900 border-accent-500/40">
          <DialogHeader>
            <DialogTitle className="text-accent-300 flex items-center gap-2">
              <PlugZap size={16} />
              External agent request
            </DialogTitle>
          </DialogHeader>
          {mcpPrompt && (
            <div className="space-y-3 py-1">
              <p className="text-sm text-gray-300">
                A connected agent (via MCP) wants to run{" "}
                <span className="font-mono text-accent-300">
                  {mcpPrompt.tool}
                </span>{" "}
                on tab{" "}
                <span className="font-semibold text-gray-100">
                  {mcpPrompt.title}
                </span>
                .
              </p>
              <pre className="text-xs font-mono text-gray-100 bg-slate-800/80 border border-slate-700/40 rounded p-2 max-h-40 overflow-auto whitespace-pre-wrap break-all">
                {mcpPrompt.detail || "(empty)"}
              </pre>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => resolveMcp("deny")}
              className="border-slate-700/50 text-gray-300"
            >
              Deny
            </Button>
            {mcpPrompt?.allowAcceptAll && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => resolveMcp("allow-all")}
                className="border-accent-500/40 text-accent-300 hover:bg-accent-500/10"
              >
                Allow all this session
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => resolveMcp("allow")}
              className="bg-accent-600/90 hover:bg-accent-600 text-white"
            >
              Allow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Bar */}
      <div className="bg-slate-900/90 backdrop-blur-md border-t border-slate-700/30 px-4 py-1.5 flex items-center justify-between text-[11px] text-gray-500 tracking-wide">
        <div className="flex items-center gap-3">
          <WorkspaceChip />
          {activeTab && (
            <span className="text-gray-600 truncate max-w-[200px]">
              {tabs.find((t) => t.id === activeTab)?.title}
            </span>
          )}
          {activeSSHConn && (
            <>
              <span className="text-slate-700">·</span>
              <MetricsStatusInline
                sample={metrics.latest}
                error={metrics.error}
                loading={metrics.loading}
                expanded={metricsOpen}
                onClick={() => setMetricsOpen((v) => !v)}
              />
            </>
          )}
          {activeTabObj?.isSSH &&
            activeTabObj.connId &&
            disconnectedTabs.has(activeTabObj.id) && (
              <>
                <span className="text-slate-700">·</span>
                <button
                  onClick={() => void reconnectSSHTab(activeTabObj)}
                  title="La sesión SSH se ha cerrado. Click para reconectar."
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 hover:text-amber-200 transition-colors"
                >
                  <PlugZap size={11} />
                  <span>Reconectar</span>
                </button>
              </>
            )}
        </div>
        <div className="flex items-center gap-3 text-gray-600">
          <span>UTF-8</span>
          <span className="text-slate-700">·</span>
          <span>LF</span>
          <span className="text-slate-700">·</span>
          <span>zsh</span>
        </div>
      </div>
    </div>
  );
}

function App(): React.JSX.Element {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <AppProvider>
        <TerminalProvider>
          <AppContent />
        </TerminalProvider>
      </AppProvider>
    </ThemeProvider>
  );
}

export default App;
