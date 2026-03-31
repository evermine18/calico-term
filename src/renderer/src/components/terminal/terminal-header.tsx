import { TerminalTab } from "@renderer/types/terminal";
import { Terminal } from "@xterm/xterm";

import TabsList from "./tabs-list";
import { Bot, Cog, Plus, Clock, House } from "lucide-react";
import { useAppContext } from "@renderer/contexts/app-context";
import SettingsDialog from "../app-settings/dialog";

export default function TerminalHeader({
  tabs,
  setTabs,
  activeTab,
  setActiveTab,
  showHome,
  setShowHome,
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

  const isHomeActive = tabs.length === 0 || showHome;

  return (
    <div className="bg-slate-900/95 backdrop-blur-md border-b border-slate-700/40 px-4 py-2.5 flex items-center gap-2 shadow-xl overflow-hidden">
      {/* Home button — wrapped in pt-2.5 to match tabs-list internal offset */}
      <div className="flex items-center gap-2 pt-2.5 flex-shrink-0">
        <button
          onClick={() => {
            if (tabs.length > 0) setShowHome(!showHome);
          }}
          className={`
            flex items-center justify-center w-9 h-8 rounded-lg
            border transition-all duration-150 shadow-sm
            ${isHomeActive
              ? "bg-gradient-to-br from-slate-800/95 to-slate-800/90 text-cyan-300 border-l-[3px] border-l-cyan-400 border-r-slate-700/50 border-t-slate-700/50 border-b-slate-700/50 shadow-cyan-500/20"
              : "bg-slate-900/60 text-gray-400 border-l-[3px] border-l-slate-700/50 border-r-slate-700/30 border-t-slate-700/30 border-b-slate-700/30 hover:bg-slate-800/70 hover:text-cyan-100 hover:border-l-cyan-400/50"
            }
            ${tabs.length === 0 ? "cursor-default" : "cursor-pointer"}
          `}
          title="Home"
        >
          <House size={15} />
        </button>

        {tabs.length > 0 && (
          <div className="w-px h-5 bg-slate-700/60" />
        )}
      </div>

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
