import { TerminalTab } from "@renderer/types/terminal";
import { Terminal } from "@xterm/xterm";

import TabsList from "./tabs-list";
import { Bot, Cog, Plus } from "lucide-react";
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

  const { setAiSidebarOpen } = useAppContext();

  return (
    <div className="bg-gray-900/95 backdrop-blur-md border-b border-gray-700/30 px-4 py-2 flex items-center gap-1 shadow-xl overflow-hidden">
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
            flex items-center justify-center w-9 h-9 rounded-lg
            bg-gray-700/30 text-gray-400 border border-gray-600/30
            hover:bg-gray-600/50 hover:text-gray-100 hover:border-gray-500/50
            transition-all duration-200 flex-shrink-0
            active:scale-95 transform hover:scale-105
            shadow-sm hover:shadow-md
            group
          "
        title="New terminal (Ctrl+Shift+T)"
      >
        <Plus
          className="transition-transform group-hover:rotate-90 duration-200"
          size={16}
        />
      </button>

      <button
        onClick={() => setAiSidebarOpen(true)}
        className="
            flex items-center justify-center w-9 h-9 rounded-lg
            bg-gray-700/30 text-gray-400 border border-gray-600/30
            hover:bg-gray-600/50 hover:text-gray-100 hover:border-gray-500/50
            transition-all duration-200 flex-shrink-0
            active:scale-95 transform hover:scale-105
            shadow-sm hover:shadow-md ml-1
            group
          "
        title="AI"
      >
        <Bot
          size={16}
          className="w-4 h-4 transition-transform group-hover:rotate-45 duration-200"
        />
      </button>

      {/* Settings button */}
      <SettingsDialog>
        <button
          className="
            flex items-center justify-center w-9 h-9 rounded-lg
            bg-gray-700/30 text-gray-400 border border-gray-600/30
            hover:bg-gray-600/50 hover:text-gray-100 hover:border-gray-500/50
            transition-all duration-200 flex-shrink-0
            active:scale-95 transform hover:scale-105
            shadow-sm hover:shadow-md ml-1
            group
          "
          title="Settings"
        >
          <Cog
            className="transition-transform group-hover:rotate-90 duration-200"
            size={16}
          />
        </button>
      </SettingsDialog>
    </div>
  );
}
