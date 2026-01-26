import { TerminalTab } from "@renderer/types/terminal";
import { Terminal } from "@xterm/xterm";

import TabsList from "./tabs-list";
import { Bot, Cog, Plus, Clock } from "lucide-react";
import { useAppContext } from "@renderer/contexts/app-context";
import SettingsDialog from "../app-settings/dialog";

export default function TerminalHeader({
  tabs,
  setTabs,
  activeTab,
  setActiveTab,
}) {
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

  return (
    <div className="bg-slate-900/95 backdrop-blur-md border-b border-slate-700/40 px-4 py-2.5 flex items-center gap-2 shadow-xl overflow-hidden">
      <TabsList
        tabs={tabs}
        setTabs={setTabs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
      {/* Add new terminal button */}
      <button
        onClick={addTab}
        className="
            flex items-center justify-center w-9 h-9 rounded-md
            bg-slate-800/60 text-gray-400 border border-slate-700/50
            hover:bg-cyan-500/20 hover:text-cyan-300 hover:border-cyan-500/50
            transition-all duration-150 flex-shrink-0
            shadow-sm
          "
        title="New terminal (Ctrl+Shift+T)"
      >
        <Plus size={18} />
      </button>

      <button
        onClick={() => setHistoryDialogOpen(true)}
        className="
            flex items-center justify-center w-9 h-9 rounded-md
            bg-slate-800/60 text-gray-400 border border-slate-700/50
            hover:bg-cyan-500/20 hover:text-cyan-300 hover:border-cyan-500/50
            transition-all duration-150 flex-shrink-0
            shadow-sm
          "
        title="Command History"
      >
        <Clock size={18} />
      </button>

      <button
        onClick={() => setAiSidebarOpen(true)}
        className="
            flex items-center justify-center w-9 h-9 rounded-md
            bg-slate-800/60 text-gray-400 border border-slate-700/50
            hover:bg-cyan-500/20 hover:text-cyan-300 hover:border-cyan-500/50
            transition-all duration-150 flex-shrink-0
            shadow-sm
          "
        title="AI Assistant"
      >
        <Bot size={18} />
      </button>

      {/* Settings button */}
      <SettingsDialog>
        <button
          className="
            flex items-center justify-center w-9 h-9 rounded-md
            bg-slate-800/60 text-gray-400 border border-slate-700/50
            hover:bg-cyan-500/20 hover:text-cyan-300 hover:border-cyan-500/50
            transition-all duration-150 flex-shrink-0
            shadow-sm
          "
          title="Settings"
        >
          <Cog size={18} />
        </button>
      </SettingsDialog>
    </div>
  );
}
