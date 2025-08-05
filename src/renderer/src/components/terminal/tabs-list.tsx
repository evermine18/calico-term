import { Terminal } from "@xterm/xterm";
import { Check, Pencil } from "lucide-react";

export default function TabsList({ tabs, setTabs, activeTab, setActiveTab }) {
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
  );
}
