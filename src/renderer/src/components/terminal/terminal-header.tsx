import { TerminalTab } from "@renderer/types/terminal";
import { Terminal } from "@xterm/xterm";
import { Check, Pencil } from "lucide-react";

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

  const updateTabTitle = (id: string, title: string) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === id ? { ...tab, title } : tab))
    );
  };

  const closeTab = (id: string) => {
    if (tabs.length === 1) return; // Do not close the last tab

    window.electron?.ipcRenderer.send("terminal-kill", id);

    const currentIndex = tabs.findIndex((tab) => tab.id === id);
    const nextActiveIndex = currentIndex > 0 ? currentIndex - 1 : 1;

    setTabs((prev) => prev.filter((t) => t.id !== id));

    if (activeTab === id && tabs.length > 1) {
      setActiveTab(tabs[nextActiveIndex]?.id ?? tabs[0]?.id);
    }
  };

  const duplicateTab = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) {
      const id = crypto.randomUUID();
      const newTab = {
        id,
        title: `${tab.title} (Copy)`,
        mode: tab.mode,
        terminal: new Terminal(),
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTab(id);
    }
  };

  return (
    <div className="bg-gray-900/95 backdrop-blur-md border-b border-gray-700/30 px-4 py-2 flex items-center gap-1 shadow-xl overflow-hidden">
      <div className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`
                relative group flex items-center gap-2 px-4 py-2.5 rounded-t-lg
                text-sm font-medium transition-all duration-200 border-t border-l border-r
                min-w-0 max-w-48 flex-shrink-0 cursor-pointer
                transform hover:scale-105 hover:-translate-y-0.5
                ${
                  activeTab === tab.id
                    ? "bg-gray-800 text-gray-100 border-blue-500/50 shadow-lg shadow-blue-500/10 z-10"
                    : "bg-gray-800/30 text-gray-400 border-gray-700/30 hover:bg-gray-800/60 hover:text-gray-200 hover:border-gray-600/50"
                }
              `}
            onClick={() => setActiveTab(tab.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              // Here you could add a context menu
            }}
          >
            {/* Status indicator */}
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 transition-all duration-200 ${
                activeTab === tab.id
                  ? "bg-green-400 shadow-sm shadow-green-400/50"
                  : "bg-gray-500 group-hover:bg-blue-400"
              }`}
            ></div>

            {/* Tab title */}
            {tab.mode === "edit" ? (
              <>
                <span
                  id={`tab-title-measure-${tab.id}`}
                  style={{
                    position: "absolute",
                    visibility: "hidden",
                    whiteSpace: "pre",
                    fontSize: "1rem",
                    fontFamily: "inherit",
                    fontWeight: "500",
                    padding: "0",
                  }}
                >
                  {tab.title || " "}
                </span>
                <input
                  value={tab.title}
                  onChange={(e) => updateTabTitle(tab.id, e.target.value)}
                  style={{
                    width: `calc(${document.getElementById(`tab-title-measure-${tab.id}`)?.offsetWidth || 50}px + 1ch)`,
                    minWidth: "40px",
                    maxWidth: "180px",
                  }}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setTabs((prev) =>
                      prev.map((t) =>
                        t.id === tab.id ? { ...t, mode: "normal" } : t
                      )
                    );
                  }}
                  className="w-5 h-5 rounded flex items-center justify-center text-gray-400 
                           hover:text-blue-400 hover:bg-blue-500/20 transition-all duration-150
                           active:scale-90"
                  title="Apply title"
                >
                  <Check />
                </button>
              </>
            ) : (
              <span className="truncate flex-1 select-none">{tab.title}</span>
            )}

            {/* Action buttons */}
            {tab.mode === "normal" && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicateTab(tab.id);
                  }}
                  className="w-5 h-5 rounded flex items-center justify-center text-gray-400 
                           hover:text-blue-400 hover:bg-blue-500/20 transition-all duration-150
                           active:scale-90"
                  title="Duplicate tab"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setTabs((prev) =>
                      prev.map((t) =>
                        t.id === tab.id ? { ...t, mode: "edit" } : t
                      )
                    );
                  }}
                  className={
                    "w-5 h-5 rounded flex items-center justify-center text-gray-400 " +
                    "hover:text-yellow-400 hover:bg-yellow-500/20 transition-all duration-150 " +
                    "active:scale-90"
                  }
                  title="Edit title"
                >
                  <Pencil size={14} />
                </button>
                {/* Close button */}
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    className="w-5 h-5 rounded flex items-center justify-center text-gray-400 
                             hover:text-red-400 hover:bg-red-500/20 transition-all duration-150
                             active:scale-90"
                    title="Close tab"
                  >
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Tab ID for debugging */}
            {/* Active tab indicator */}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
            )}
          </div>
        ))}
      </div>

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
