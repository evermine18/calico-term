import { Terminal } from "@xterm/xterm";
import { Check, Pencil, TerminalSquare } from "lucide-react";

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
    <div className="flex items-center gap-1.5 flex-1 overflow-x-auto scrollbar-thin scrollbar-thumb-cyan-600/40 scrollbar-track-transparent">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`
                relative group flex items-center gap-2 px-3 py-2 rounded-lg
                text-sm font-medium border-l-[3px] border-r border-t border-b
                min-w-[110px] max-w-[200px] flex-shrink-0 cursor-pointer
                backdrop-blur-md transition-all duration-100
                ${activeTab === tab.id
              ? "bg-gradient-to-br from-slate-800/95 to-slate-800/90 text-gray-100 border-l-cyan-400 border-r-slate-700/50 border-t-slate-700/50 border-b-slate-700/50 shadow-xl shadow-cyan-500/20 z-10"
              : "bg-slate-900/60 text-gray-400 border-l-slate-700/50 border-r-slate-700/30 border-t-slate-700/30 border-b-slate-700/30 hover:bg-slate-800/70 hover:text-cyan-100 hover:border-l-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/10"
            }
              `}
          onClick={() => setActiveTab(tab.id)}
          onContextMenu={(e) => {
            e.preventDefault();
            // Here you could add a context menu
          }}
        >
          {/* Terminal Icon */}
          <div
            className={`flex-shrink-0 transition-colors duration-100 ${activeTab === tab.id
              ? "text-cyan-400"
              : "text-slate-500 group-hover:text-cyan-400/70"
              }`}
          >
            <TerminalSquare size={14} strokeWidth={2} />
          </div>

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
                className="bg-slate-900/60 border border-cyan-500/50 rounded px-2 py-0.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500"
                style={{
                  width: `calc(${document.getElementById(`tab-title-measure-${tab.id}`)?.offsetWidth || 50}px + 1ch)`,
                  minWidth: "40px",
                  maxWidth: "180px",
                }}
                autoFocus
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
                className="w-5 h-5 rounded flex items-center justify-center text-gray-500 
                           hover:text-green-400 hover:bg-green-500/15 transition-colors duration-75"
                title="Apply title"
              >
                <Check size={14} />
              </button>
            </>
          ) : (
            <span className="truncate flex-1 select-none font-medium">{tab.title}</span>
          )}

          {/* Action buttons */}
          {tab.mode === "normal" && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateTab(tab.id);
                }}
                className="w-5 h-5 rounded flex items-center justify-center text-gray-500 
                           hover:text-cyan-400 hover:bg-cyan-500/15 transition-colors duration-75"
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
                className="w-5 h-5 rounded flex items-center justify-center text-gray-500 
                           hover:text-amber-400 hover:bg-amber-500/15 transition-colors duration-75"
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
                  className="w-5 h-5 rounded flex items-center justify-center text-gray-500 
                             hover:text-red-400 hover:bg-red-500/15 transition-colors duration-75"
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

        </div>
      ))}
    </div>
  );
}
