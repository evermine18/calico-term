import { useState } from "react";
import { TerminalPanel } from "./components/terminal-tab";
import { TerminalTab } from "./types/terminal";
import TerminalHeader from "./components/terminal/terminal-header";

function App(): React.JSX.Element {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const closeApp = () => {
    window.electron?.ipcRenderer.send("app-close");
  };

  return (
    <div
      className={`h-screen flex flex-col bg-gray-950 text-gray-100 transition-all duration-300 ${
        isFullscreen ? "fixed inset-0 z-50" : ""
      }`}
    >
      {/* Header with window controls */}
      <div className="bg-gray-900/95 backdrop-blur-xl border-b border-gray-700/30 px-4 py-1 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-2 w-full">
          <div className="flex items-center gap-2 ">
            <div
              className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors cursor-pointer shadow-sm"
              onClick={closeApp}
            ></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 transition-colors cursor-pointer shadow-sm"></div>
            <div
              className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-400 transition-colors cursor-pointer shadow-sm"
              onClick={toggleFullscreen}
            ></div>
          </div>

          <div className="drag-region flex w-full items-center gap-2 left-0 right-0">
            <div className="flex items-center gap-3">
              <div className=" flex items-center gap-2 text-gray-400 text-sm">
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
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
      </div>

      {/* Tabs Header */}
      <TerminalHeader
        tabs={tabs}
        setTabs={setTabs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
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
              <TerminalPanel tabId={tab.id} active={activeTab === tab.id} />
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
