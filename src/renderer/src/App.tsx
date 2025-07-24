import { Terminal } from "@xterm/xterm";
import TerminalComponent from "./components/terminal";
import { useState, useEffect } from "react";
import { TerminalTab } from "./components/terminal-tab";

type TerminalTab = {
  id: string;
  title: string;
  terminal: Terminal;
};

function App(): React.JSX.Element {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Create the first terminal on load
  useEffect(() => {
    if (tabs.length === 0) {
      addTab();
    }
  }, []);

  const addTab = () => {
    const id = crypto.randomUUID();
    const newTab = {
      id,
      title: `Terminal ${tabs.length + 1}`,
      terminal: new Terminal(), // Assuming you need to create the instance
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTab(id);
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

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const duplicateTab = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) {
      const id = crypto.randomUUID();
      const newTab = {
        id,
        title: `${tab.title} (Copy)`,
        terminal: new Terminal(),
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTab(id);
    }
  };

  return (
    <div
      className={`h-screen flex flex-col bg-gray-950 text-gray-100 transition-all duration-300 ${
        isFullscreen ? "fixed inset-0 z-50" : ""
      }`}
    >
      {/* Header with window controls */}
      <div className="bg-gray-900/95 backdrop-blur-xl border-b border-gray-700/30 px-4 py-1 flex items-center justify-between shadow-2xl">
        <div className="drag-region flex w-full items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors cursor-pointer shadow-sm"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 transition-colors cursor-pointer shadow-sm"></div>
              <div
                className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-400 transition-colors cursor-pointer shadow-sm"
                onClick={toggleFullscreen}
              ></div>
            </div>
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M3 4a1 1 0 011-1h12a1 1 0 011 1v1a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 8a1 1 0 011-1h12a1 1 0 011 1v5a1 1 0 01-1 1H4a1 1 0 01-1-1V8z"
                  clipRule="evenodd"
                ></path>
              </svg>
              <span className="font-mono">Calico Term</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-gray-400 text-xs">
            <span className="px-2 py-1 bg-gray-800/50 rounded border border-gray-700/50 font-mono">
              {tabs.length} tab{tabs.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="bg-gray-900/95 backdrop-blur-md border-b border-gray-700/30 px-4 py-2 flex items-center gap-1 shadow-xl overflow-hidden">
        <div className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
          {tabs.map((tab, index) => (
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
              <span className="truncate flex-1 select-none">{tab.title}</span>

              {/* Action buttons */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                {/* Duplicate button */}
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

      {/* Terminal Content */}
      <div className="flex-1 bg-gray-950 relative overflow-hidden">
        {tabs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <svg
                className="w-16 h-16 mx-auto mb-4 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-lg font-medium mb-2">No terminal sessions</p>
              <p className="text-sm opacity-75">
                Click the + button to create a new terminal
              </p>
            </div>
          </div>
        ) : (
          tabs.map((tab) => (
            <div
              key={tab.id}
              className={`absolute inset-0 transition-all duration-300 ${
                activeTab === tab.id
                  ? "opacity-100 scale-100"
                  : "opacity-0 scale-95 pointer-events-none"
              }`}
            >
              <TerminalTab tabId={tab.id} active={activeTab === tab.id} />
            </div>
          ))
        )}
      </div>

      {/* Status Bar */}
      <div className="px-8"></div>
      <div
        className="bg-gray-900/95 backdrop-blur-md border-t border-gray-700/30
                  max-w-screen-lg mx-auto px-4 py-2 flex items-center justify-between
                  text-xs text-gray-400 rounded-t-lg"
      >
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-400"></div>
            Connected
          </span>
          {activeTab && (
            <span className="font-mono">
              {tabs.find((t) => t.id === activeTab)?.title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span>UTF-8</span>
          <span>LF</span>
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              ></path>
            </svg>
            Shell
          </span>
        </div>
      </div>
    </div>
  );
}

export default App;
