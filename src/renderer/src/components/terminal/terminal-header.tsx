import { TerminalTab } from "@renderer/types/terminal";
import { Terminal } from "@xterm/xterm";

import TabsList from "./tabs-list";
import { Bot, Cog, Plus, Clock, House, FolderOpen, Circle } from "lucide-react";
import { useAppContext } from "@renderer/contexts/app-context";
import SettingsDialog from "../app-settings/dialog";
import { useEffect, useState } from "react";

export default function TerminalHeader({
  tabs,
  setTabs,
  activeTab,
  setActiveTab,
  showHome,
  setShowHome,
  sftpOpen,
  setSftpOpen,
  activeTabIsSSH,
}: {
  tabs: TerminalTab[];
  setTabs: React.Dispatch<React.SetStateAction<TerminalTab[]>>;
  activeTab: string | null;
  setActiveTab: (id: string) => void;
  showHome: boolean;
  setShowHome: (v: boolean) => void;
  sftpOpen: boolean;
  setSftpOpen: (v: boolean) => void;
  activeTabIsSSH: boolean;
}) {
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!activeTab) {
      setRecording(false);
      return;
    }
    window.api.recording.isActive(activeTab).then((on) => {
      if (!cancelled) setRecording(on);
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const toggleRecording = async () => {
    if (!activeTab) return;
    const tab = tabs.find((t) => t.id === activeTab);
    if (!tab) return;
    if (recording) {
      await window.api.recording.stop(activeTab);
      setRecording(false);
    } else {
      await window.api.recording.start(
        activeTab,
        tab.title,
        tab.terminal.cols,
        tab.terminal.rows,
      );
      setRecording(true);
    }
  };
  const addTab = () => {
    const id = crypto.randomUUID();
    const newTab: TerminalTab = {
      id,
      title: `Terminal ${tabs.length + 1}`,
      mode: "normal",
      terminal: new Terminal(),
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTab(id);
  };

  const { setAiSidebarOpen, setHistoryDialogOpen } = useAppContext();

  const isHomeActive = tabs.length === 0 || showHome;

  return (
    <div className="glass border-b border-border/60 px-4 py-2.5 flex items-center gap-2 overflow-hidden relative z-20">
      {/* Home button — wrapped in pt-2.5 to match tabs-list internal offset */}
      <div className="flex items-center gap-2 pt-2.5 flex-shrink-0">
        <button
          onClick={() => {
            if (tabs.length > 0) setShowHome(!showHome);
          }}
          className={`
            flex items-center justify-center w-9 h-8 rounded-lg
            border transition-[background-color,border-color,color,box-shadow] duration-150 ease-out
            ${isHomeActive
              ? "bg-card/80 text-foreground border-border shadow-[0_0_0_1px_rgba(var(--accent-rgb),0.4),0_0_18px_-4px_rgba(var(--accent-rgb),0.5)]"
              : "bg-card/30 text-muted-foreground border-border/50 hover:bg-card/70 hover:text-foreground hover:border-[rgba(var(--accent-rgb),0.4)]"
            }
            ${tabs.length === 0 ? "cursor-default" : "cursor-pointer"}
          `}
          title="Home"
        >
          <House size={15} />
        </button>

        {tabs.length > 0 && (
          <div className="w-px h-5 bg-border/60" />
        )}
      </div>

      <TabsList
        tabs={tabs}
        setTabs={setTabs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
      {/* Action buttons group */}
      <div className="flex items-center gap-0.5 bg-card/40 border border-border/60 rounded-lg p-0.5 flex-shrink-0 backdrop-blur-sm">
        <button
          onClick={addTab}
          className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors duration-150"
          title="New terminal (Ctrl+Shift+T)"
        >
          <Plus size={16} />
        </button>

        <button
          onClick={() => setHistoryDialogOpen(true)}
          className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors duration-150"
          title="Command History"
        >
          <Clock size={16} />
        </button>

        {activeTab && (
          <button
            onClick={toggleRecording}
            className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors duration-150 ${
              recording
                ? "bg-red-500/20 text-red-400"
                : "text-muted-foreground hover:bg-accent hover:text-red-400"
            }`}
            title={recording ? "Stop recording" : "Record session"}
          >
            <Circle
              size={12}
              className={recording ? "fill-red-500 animate-pulse" : ""}
            />
          </button>
        )}

        {activeTabIsSSH && (
          <button
            onClick={() => setSftpOpen(!sftpOpen)}
            className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors duration-150 ${
              sftpOpen
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
            title="File Browser (SFTP)"
          >
            <FolderOpen size={16} />
          </button>
        )}

        <button
          onClick={() => setAiSidebarOpen(true)}
          className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors duration-150"
          title="AI Assistant"
        >
          <Bot size={16} />
        </button>

        <div className="w-px h-5 bg-border/60 mx-0.5" />

        {/* Settings button */}
        <SettingsDialog>
          <button
            className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors duration-150"
            title="Settings"
          >
            <Cog size={16} />
          </button>
        </SettingsDialog>
      </div>
    </div>
  );
}
