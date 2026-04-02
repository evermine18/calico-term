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

function AppContent(): React.JSX.Element {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHome, setShowHome] = useState(false);
  const { setHistoryDialogOpen } = useAppContext();

  // Wrap setActiveTab so any tab click also dismisses the home overlay
  const handleSetActiveTab = (id: string) => {
    setActiveTab(id);
    setShowHome(false);
  };

  // Keyboard shortcut: Ctrl+H to open history
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'h') {
        e.preventDefault();
        setHistoryDialogOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setHistoryDialogOpen]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const closeApp = () => {
    window.electron?.ipcRenderer.send("app-close");
  };

  return (
    <div
      className={`h-screen flex flex-col relative bg-slate-950 text-gray-100 transition-all duration-300 ${isFullscreen ? "fixed inset-0 z-50" : ""
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
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <svg
                  className="w-4 h-4 text-cyan-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M3 4a1 1 0 011-1h12a1 1 0 011 1v1a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 8a1 1 0 011-1h12a1 1 0 011 1v5a1 1 0 01-1 1H4a1 1 0 01-1-1V8z"
                    clipRule="evenodd"
                  ></path>
                </svg>
                <span className="font-semibold tracking-wide text-gray-300">Calico Term</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-gray-400 text-xs">
              <span className="px-2.5 py-1 bg-slate-800/60 rounded border border-slate-700/50 font-mono text-cyan-400/80">
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
            className={`absolute inset-0 transition-all duration-300 ${!showHome && activeTab === tab.id
                ? "opacity-100 scale-100"
                : "opacity-0 scale-95 pointer-events-none"
              }`}
          >
            <TerminalPanel
              tabId={tab.id}
              active={!showHome && activeTab === tab.id}
              tabTitle={tab.title}
              initialCommand={tab.initialCommand}
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
                };
                // Register password-injection session BEFORE the terminal mounts.
                // If the connection uses a vault credential, inject via vault key.
                if (conn.credentialId) {
                  window.electron.ipcRenderer.send("ssh-session-init", id, "vault-" + conn.credentialId);
                } else if (conn.hasPassword) {
                  window.electron.ipcRenderer.send("ssh-session-init", id, conn.id);
                }
                setTabs((prev) => [...prev, newTab]);
                handleSetActiveTab(id);
              }}
            />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="bg-slate-900/95 backdrop-blur-md border-t border-slate-700/40 px-4 py-2 flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50"></div>
            <span className="text-cyan-400/90 font-medium">Connected</span>
          </span>
          {activeTab && (
            <span className="font-mono text-gray-500">
              {tabs.find((t) => t.id === activeTab)?.title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-500">UTF-8</span>
          <span className="text-gray-500">LF</span>
          <span className="flex items-center gap-1.5">
            <svg
              className="w-3 h-3 text-cyan-400/70"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              ></path>
            </svg>
            <span className="text-gray-500">Shell</span>
          </span>
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
