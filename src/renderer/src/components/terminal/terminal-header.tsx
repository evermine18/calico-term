import { TerminalTab } from "@renderer/types/terminal";
import { Terminal } from "@xterm/xterm";

import TabsList from "./tabs-list";
import {
  Bot,
  Cog,
  Plus,
  Clock,
  House,
  FolderOpen,
  Circle,
  Sparkles,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";
import { useAppContext } from "@renderer/contexts/app-context";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@renderer/components/ui/popover";
import SettingsDialog from "../app-settings/dialog";
import AgentLaunchDialog from "../ai/agent-launch-dialog";
import { ReactElement, ReactNode, useEffect, useState } from "react";

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
  onDetachTab,
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
  onDetachTab: (id: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  // Tab-bar menus / controlled dialogs (keeps the toolbar uncluttered).
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
    <div className="bg-panel/95 backdrop-blur-md border-b border-hairline/40 px-4 py-2.5 flex items-center gap-2 shadow-xl overflow-hidden">
      {/* Home button — wrapped in pt-2.5 to match tabs-list internal offset */}
      <div className="flex items-center gap-2 pt-2.5 flex-shrink-0">
        <button
          onClick={() => {
            if (tabs.length > 0) setShowHome(!showHome);
          }}
          className={`
            flex items-center justify-center w-9 h-8 rounded-lg
            border transition-all duration-150 shadow-sm
            ${
              isHomeActive
                ? "bg-gradient-to-br from-elevated/95 to-elevated/90 text-accent-300 border-accent-400/50"
                : "bg-panel/60 text-ink-muted  border-l-hairline/50 border-r-hairline/30 border-t-hairline/30 border-b-hairline/30 hover:bg-elevated/70 hover:text-accent-100"
            }
            ${tabs.length === 0 ? "cursor-default" : "cursor-pointer"}
          `}
          title="Home"
        >
          <House size={15} />
        </button>

        {tabs.length > 0 && <div className="w-px h-5 bg-hairline/60" />}
      </div>

      <TabsList
        tabs={tabs}
        setTabs={setTabs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onDetachTab={onDetachTab}
      />
      {/* Action buttons group */}
      <div className="flex items-center gap-0.5 bg-elevated/40 border border-hairline/40 rounded-lg p-0.5 flex-shrink-0">
        {/* New — split button: the icon opens a local terminal, the caret a menu */}
        <button
          onClick={addTab}
          className="
              flex items-center justify-center w-8 h-8 rounded-md
              text-ink-subtle
              hover:bg-elevated/60 hover:text-accent-300
              transition-all duration-150
            "
          title="New terminal (Ctrl+Shift+T)"
        >
          <Plus size={16} />
        </button>
        <Popover open={newMenuOpen} onOpenChange={setNewMenuOpen}>
          <PopoverTrigger asChild>
            <button
              className="flex items-center justify-center w-5 h-8 rounded-md text-ink-subtle hover:bg-elevated/60 hover:text-accent-300 transition-all duration-150"
              title="New…"
            >
              <ChevronDown size={13} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-52 p-1 bg-panel border-hairline text-ink-muted"
          >
            <MenuItem
              icon={<Plus size={14} className="text-accent-400/80" />}
              label="Local terminal"
              onClick={() => {
                setNewMenuOpen(false);
                addTab();
              }}
            />
            <MenuItem
              icon={<Sparkles size={14} className="text-accent-400/80" />}
              label="Launch AI agent…"
              onClick={() => {
                setNewMenuOpen(false);
                setAgentOpen(true);
              }}
            />
          </PopoverContent>
        </Popover>

        {activeTabIsSSH && (
          <button
            onClick={() => setSftpOpen(!sftpOpen)}
            className={`
              flex items-center justify-center w-8 h-8 rounded-md
              transition-all duration-150
              ${
                sftpOpen
                  ? "bg-elevated/60 text-accent-300"
                  : "text-ink-subtle hover:bg-elevated/60 hover:text-accent-300"
              }
            `}
            title="File Browser (SFTP)"
          >
            <FolderOpen size={16} />
          </button>
        )}

        <button
          onClick={() => setAiSidebarOpen(true)}
          className="
              flex items-center justify-center w-8 h-8 rounded-md
              text-ink-subtle
              hover:bg-elevated/60 hover:text-accent-300
              transition-all duration-150
            "
          title="AI Assistant"
        >
          <Bot size={16} />
        </button>

        <div className="w-px h-5 bg-hairline/50 mx-0.5" />

        {/* Overflow — secondary actions kept out of the toolbar */}
        <Popover open={overflowOpen} onOpenChange={setOverflowOpen}>
          <PopoverTrigger asChild>
            <button
              className="flex items-center justify-center w-8 h-8 rounded-md text-ink-subtle hover:bg-elevated/60 hover:text-ink-muted transition-all duration-150"
              title="More"
            >
              <MoreHorizontal size={16} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-52 p-1 bg-panel border-hairline text-ink-muted"
          >
            <MenuItem
              icon={<Clock size={14} className="text-ink-muted" />}
              label="Command history"
              onClick={() => {
                setOverflowOpen(false);
                setHistoryDialogOpen(true);
              }}
            />
            {activeTab && (
              <MenuItem
                icon={
                  <Circle
                    size={12}
                    className={
                      recording ? "fill-danger text-danger" : "text-ink-muted"
                    }
                  />
                }
                label={recording ? "Stop recording" : "Record session"}
                onClick={() => {
                  setOverflowOpen(false);
                  toggleRecording();
                }}
              />
            )}
            <MenuItem
              icon={<Cog size={14} className="text-ink-muted" />}
              label="Settings"
              onClick={() => {
                setOverflowOpen(false);
                setSettingsOpen(true);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Controlled dialogs, opened from the menus above */}
      <AgentLaunchDialog
        open={agentOpen}
        onOpenChange={setAgentOpen}
        setTabs={setTabs}
        setActiveTab={setActiveTab}
      />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}): ReactElement {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm text-ink-muted hover:bg-elevated transition-colors"
    >
      {icon}
      {label}
    </button>
  );
}
