import { useState, useEffect } from "react";
import { TerminalPanel } from "./components/terminal-tab";
import { TerminalTab } from "./types/terminal";
import TerminalHeader from "./components/terminal/terminal-header";
import { AppProvider, useAppContext } from "./contexts/app-context";
import AISidebarChat from "./components/ai/sidebar-chat";
import { ThemeProvider } from "./components/theme-provider";
import { TerminalProvider } from "./contexts/terminal-context";
import CommandHistoryDialog from "./components/command-history/dialog";
import SSHConnectionsHome from "./components/ssh/ssh-connections-home";
import { buildSSHCommand } from "./types/ssh";
import { Terminal } from "@xterm/xterm";
import { TerminalSquare } from "lucide-react";
import { closeTab } from "./lib/tab-operations";
import { isEditableTarget, isPrimaryModifier } from "./lib/keyboard";

function matchShortcut(e: KeyboardEvent, s: ShortcutDef): boolean {
  return (
    e.key.toLowerCase() === s.key.toLowerCase() &&
    !!e.ctrlKey === s.ctrl &&
    !!e.shiftKey === s.shift &&
    !!e.altKey === s.alt
  );
}

function AppContent(): React.JSX.Element {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHome, setShowHome] = useState(false);
  const { setHistoryDialogOpen, shortcuts, aiSidebarOpen, setAiSidebarOpen } =
    useAppContext();

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
  ]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const closeApp = () => {
    window.electron?.ipcRenderer.send("app-close");
  };

  return (
    <div
      className={`h-screen flex flex-col relative bg-slate-950 text-gray-100 transition-all duration-300 ${
        isFullscreen ? "fixed inset-0 z-50" : ""
      }`}
    >
      {/* Header with window controls */}
      <div className="bg-slate-900/95 backdrop-blur-xl border-b border-slate-700/40 px-4 py-1.5 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-2 w-full">
          {window.platform?.os !== "darwin" ? (
            <div className="flex items-center gap-2.5">
              <div
                className="w-3 h-3 rounded-full bg-red-500/90 hover:bg-red-400 transition-colors cursor-pointer shadow-sm"
                onClick={closeApp}
              ></div>
              <div className="w-3 h-3 rounded-full bg-amber-500/90 hover:bg-amber-400 transition-colors cursor-pointer shadow-sm"></div>
              <div
                className="w-3 h-3 rounded-full bg-green-500/90 hover:bg-green-400 transition-colors cursor-pointer shadow-sm"
                onClick={toggleFullscreen}
              ></div>
            </div>
          ) : (
            <div className="ml-16"></div>
          )}

          <div className="drag-region flex w-full items-center gap-2 left-0 right-0">
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
              <span className="px-2 py-0.5 bg-slate-800/50 rounded border border-slate-700/40 text-accent-400/70 text-[10px] tracking-wider">
                {tabs.length} tab{tabs.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Header */}
      <TerminalHeader
        tabs={tabs}
        setTabs={setTabs}
        activeTab={activeTab}
        setActiveTab={handleSetActiveTab}
        showHome={showHome}
        setShowHome={setShowHome}
      />
      {/* Terminal Content */}
      <div className="flex-1 bg-slate-950 relative overflow-hidden pb-8">
        <AISidebarChat />
        <CommandHistoryDialog />
        {/* Terminals — always mounted to preserve PTY state */}
        {tabs.map((tab) => (
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
            />
          </div>
        ))}

        {/* Home overlay — shown when no tabs, or user toggled home */}
        {(tabs.length === 0 || showHome) && (
          <div className="absolute inset-0 bg-slate-950 z-10">
            <SSHConnectionsHome
              onConnect={(conn) => {
                const id = crypto.randomUUID();
                const command = buildSSHCommand(conn);
                const newTab: TerminalTab = {
                  id,
                  title: conn.name,
                  mode: "normal",
                  terminal: new Terminal(),
                  initialCommand: command,
                  badge: conn.tags?.[0] ?? null,
                  isSSH: true,
                };
                // Register password-injection session BEFORE the terminal mounts.
                // If the connection uses a vault credential, inject via vault key.
                if (conn.credentialId) {
                  window.electron.ipcRenderer.send(
                    "ssh-session-init",
                    id,
                    "vault-" + conn.credentialId,
                  );
                } else if (conn.hasPassword) {
                  window.electron.ipcRenderer.send(
                    "ssh-session-init",
                    id,
                    conn.id,
                  );
                }
                setTabs((prev) => [...prev, newTab]);
                handleSetActiveTab(id);
              }}
            />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="bg-slate-900/90 backdrop-blur-md border-t border-slate-700/30 px-4 py-1.5 flex items-center justify-between text-[11px] text-gray-500 tracking-wide">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full bg-accent-400"
              style={{ boxShadow: "0 0 4px rgba(var(--accent-rgb),0.8)" }}
            ></div>
            <span className="text-accent-400/80 font-medium uppercase tracking-widest text-[10px]">
              ready
            </span>
          </span>
          {activeTab && (
            <span className="text-gray-600 truncate max-w-[200px]">
              {tabs.find((t) => t.id === activeTab)?.title}
            </span>
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
