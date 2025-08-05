import { TerminalTab } from "@renderer/types/terminal";
import { Terminal } from "@xterm/xterm";

import TabsList from "./tabs-list";

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
        <svg
          className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>

      {/* Settings button */}
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
        <svg
          className="w-4 h-4 transition-transform group-hover:rotate-45 duration-200"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>
    </div>
  );
}
