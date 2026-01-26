import { useState, useMemo, useEffect } from "react";
import { useAppContext } from "@renderer/contexts/app-context";
import { X, Search, Clock, Terminal, Copy, Play, Trash2, Pin, PinOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function CommandHistoryDialog() {
  const {
    historyDialogOpen,
    setHistoryDialogOpen,
    commandHistory,
    togglePinCommand,
    deleteCommand,
    runGarbageCollection,
    historyRetentionDays,
  } = useAppContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Run garbage collection when dialog opens
  useEffect(() => {
    if (historyDialogOpen) {
      runGarbageCollection();
    }
  }, [historyDialogOpen, runGarbageCollection]);

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return commandHistory;

    const query = searchQuery.toLowerCase();
    return commandHistory.filter((entry) =>
      entry.command.toLowerCase().includes(query)
    );
  }, [commandHistory, searchQuery]);

  const handleCopyCommand = (command: string, id: string) => {
    navigator.clipboard.writeText(command);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExecuteCommand = (command: string) => {
    window.electron?.ipcRenderer.send("execute-command", command);
    setHistoryDialogOpen(false);
  };

  const handleClearHistory = () => {
    if (confirm("Are you sure you want to delete all command history? Pinned commands will be kept.")) {
      const pinnedOnly = commandHistory.filter(entry => entry.pinned);
      localStorage.setItem("commandHistory", JSON.stringify(pinnedOnly));
      window.location.reload();
    }
  };

  const handleDeleteCommand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteCommand(id);
  };

  const handleTogglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    togglePinCommand(id);
  };

  const pinnedCount = commandHistory.filter(entry => entry.pinned).length;

  if (!historyDialogOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => setHistoryDialogOpen(false)}
    >
      <div
        className="bg-slate-900/98 border border-slate-700/50 rounded-xl shadow-2xl w-[700px] max-h-[600px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <Clock className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-100">
                Command History
              </h2>
              <p className="text-xs text-gray-400">
                {commandHistory.length} command{commandHistory.length !== 1 ? "s" : ""} saved
                {pinnedCount > 0 && ` • ${pinnedCount} pinned`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setHistoryDialogOpen(false)}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-4 border-b border-slate-700/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search command history..."
              className="w-full pl-10 pr-4 py-2 bg-slate-800/60 border border-slate-700/50 rounded-lg
                       text-gray-100 placeholder-gray-500 focus:outline-none focus:border-cyan-500/50
                       focus:bg-slate-800 transition-colors text-sm"
              autoFocus
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            {commandHistory.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="flex items-center gap-2 text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Clear all history
              </button>
            )}
            <p className="text-xs text-gray-500 ml-auto">
              Commands older than {historyRetentionDays < 1
                ? `${Math.round(historyRetentionDays * 24)} hour${Math.round(historyRetentionDays * 24) !== 1 ? 's' : ''}`
                : `${historyRetentionDays} day${historyRetentionDays !== 1 ? 's' : ''}`
              } are auto-deleted (except pinned)
            </p>
          </div>
        </div>

        {/* Command List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <Terminal className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">
                {searchQuery ? "No commands found" : "No commands in history"}
              </p>
            </div>
          ) : (
            filteredHistory.map((entry) => (
              <div
                key={entry.id}
                className={`group bg-slate-800/40 hover:bg-slate-800/70 border rounded-lg p-3 transition-all duration-150 ${entry.pinned
                    ? 'border-cyan-500/50 bg-slate-800/60'
                    : 'border-slate-700/30 hover:border-cyan-500/30'
                  }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <code className="text-sm font-mono text-gray-100 break-all">
                      {entry.command}
                    </code>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Terminal className="w-3 h-3" />
                        {entry.tabTitle}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(entry.timestamp), {
                          addSuffix: true,
                        })}
                      </span>
                      {entry.pinned && (
                        <span className="flex items-center gap-1 text-cyan-400">
                          <Pin className="w-3 h-3 fill-cyan-400" />
                          Pinned
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleTogglePin(entry.id, e)}
                      className={`p-2 rounded-md transition-colors ${entry.pinned
                          ? 'bg-cyan-500/20 hover:bg-cyan-500/30'
                          : 'hover:bg-slate-700/50'
                        }`}
                      title={entry.pinned ? "Unpin command" : "Pin command (keep forever)"}
                    >
                      {entry.pinned ? (
                        <Pin className="w-4 h-4 text-cyan-400 fill-cyan-400" />
                      ) : (
                        <PinOff className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                    <button
                      onClick={() => handleCopyCommand(entry.command, entry.id)}
                      className="p-2 hover:bg-cyan-500/20 rounded-md transition-colors"
                      title="Copy command"
                    >
                      <Copy
                        className={`w-4 h-4 ${copiedId === entry.id ? "text-green-400" : "text-gray-400"
                          }`}
                      />
                    </button>
                    <button
                      onClick={() => handleExecuteCommand(entry.command)}
                      className="p-2 hover:bg-cyan-500/20 rounded-md transition-colors"
                      title="Execute command"
                    >
                      <Play className="w-4 h-4 text-cyan-400" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteCommand(entry.id, e)}
                      className="p-2 hover:bg-red-500/20 rounded-md transition-colors"
                      title="Delete command"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-700/30 bg-slate-900/50">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              Showing {filteredHistory.length} of {commandHistory.length}
            </span>
            <span className="font-mono">
              Tip: Pin important commands to keep them forever
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
