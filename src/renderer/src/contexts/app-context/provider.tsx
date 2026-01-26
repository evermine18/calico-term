import { useMemo, useState, useEffect } from "react";
import { AppContext } from "./context";

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [apiUrl, setApiUrl] = useState(localStorage.getItem("apiUrl") || "");
  const [selectedModel, setSelectedModel] = useState(
    localStorage.getItem("selectedModel") || ""
  );
  const [apiKey, setApiKey] = useState(localStorage.getItem("apiKey") || "");
  const [historyRetentionDays, setHistoryRetentionDaysState] = useState<number>(() => {
    const stored = localStorage.getItem("historyRetentionDays");
    return stored ? parseInt(stored, 10) : 1;
  });

  const setHistoryRetentionDays = (days: number) => {
    localStorage.setItem("historyRetentionDays", days.toString());
    setHistoryRetentionDaysState(days);
  };
  const [commandHistory, setCommandHistory] = useState<CommandHistoryEntry[]>(() => {
    const stored = localStorage.getItem("commandHistory");
    const retentionDays = parseInt(localStorage.getItem("historyRetentionDays") || "1", 10);

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const entries = parsed.map((entry: any) => ({
          ...entry,
          timestamp: new Date(entry.timestamp),
        }));

        // Run GC on load to remove old commands
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        return entries.filter((entry: CommandHistoryEntry) => {
          return entry.pinned || new Date(entry.timestamp) > cutoffDate;
        });
      } catch {
        return [];
      }
    }
    return [];
  });

  // Save history to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("commandHistory", JSON.stringify(commandHistory));
  }, [commandHistory]);

  const addCommandToHistory = (command: string, tabId: string, tabTitle: string) => {
    const trimmed = command.trim();
    if (!trimmed) return;

    const newEntry: CommandHistoryEntry = {
      id: crypto.randomUUID(),
      command: trimmed,
      timestamp: new Date(),
      tabId,
      tabTitle,
      pinned: false,
    };

    setCommandHistory((prev) => {
      // Limit to 500 most recent commands
      const updated = [newEntry, ...prev].slice(0, 500);
      return updated;
    });
  };

  const togglePinCommand = (id: string) => {
    setCommandHistory((prev) =>
      prev.map((entry) =>
        entry.id === id ? { ...entry, pinned: !entry.pinned } : entry
      )
    );
  };

  const deleteCommand = (id: string) => {
    setCommandHistory((prev) => prev.filter((entry) => entry.id !== id));
  };

  const runGarbageCollection = () => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - historyRetentionDays);

    setCommandHistory((prev) =>
      prev.filter((entry) => {
        // Keep if pinned or within retention period
        return entry.pinned || new Date(entry.timestamp) > cutoffDate;
      })
    );
  };

  const value: AppContextType = useMemo(
    () => ({
      aiSidebarOpen,
      setAiSidebarOpen,
      apiUrl,
      setApiUrl: (url: string) => {
        localStorage.setItem("apiUrl", url);
        setApiUrl(url);
      },
      selectedModel,
      setSelectedModel: (model: string) => {
        localStorage.setItem("selectedModel", model);
        setSelectedModel(model);
      },
      apiKey,
      setApiKey: (key: string) => {
        localStorage.setItem("apiKey", key);
        setApiKey(key);
      },
      commandHistory,
      addCommandToHistory,
      togglePinCommand,
      deleteCommand,
      runGarbageCollection,
      historyDialogOpen,
      setHistoryDialogOpen,
      historyRetentionDays,
      setHistoryRetentionDays,
    }),
    [aiSidebarOpen, apiUrl, selectedModel, apiKey, commandHistory, historyDialogOpen, historyRetentionDays]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
