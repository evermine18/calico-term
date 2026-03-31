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
    return stored ? parseFloat(stored) : 1;
  });

  const setHistoryRetentionDays = (days: number) => {
    localStorage.setItem("historyRetentionDays", days.toString());
    setHistoryRetentionDaysState(days);
  };

  const [sshConnections, setSSHConnections] = useState<SSHConnectionEntry[]>(() => {
    const stored = localStorage.getItem("sshConnections");
    if (stored) {
      try { return JSON.parse(stored); } catch { return []; }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem("sshConnections", JSON.stringify(sshConnections));
  }, [sshConnections]);

  const addSSHConnection = (conn: SSHConnectionEntry) => {
    setSSHConnections((prev) => [...prev, conn]);
  };

  const updateSSHConnection = (conn: SSHConnectionEntry) => {
    setSSHConnections((prev) => prev.map((c) => (c.id === conn.id ? conn : c)));
  };

  const deleteSSHConnection = (id: string) => {
    setSSHConnections((prev) => prev.filter((c) => c.id !== id));
  };
  const [commandHistory, setCommandHistory] = useState<CommandHistoryEntry[]>(() => {
    const stored = localStorage.getItem("commandHistory");
    const retentionDays = parseFloat(localStorage.getItem("historyRetentionDays") || "1");

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

    // Filter out sensitive information patterns
    const sensitivePatterns = [
      // Password prompts (case insensitive)
      /password[:\s]/i,
      /passphrase[:\s]/i,
      /passcode[:\s]/i,

      // SSH/Authentication prompts
      /['"]s password:/i,
      /@[\w\-\.]+['"]s password:/i,

      // Commands with password flags
      /--password[=\s]/i,
      /-p\s+['"][^'"]*['"]/i,  // -p "password"
      /password=["']?[\w\S]+["']?/i,

      // API keys and tokens
      /api[_-]?key[=:\s]/i,
      /token[=:\s]/i,
      /secret[=:\s]/i,
      /auth[_-]?token[=:\s]/i,

      // Connection strings with credentials
      /\/\/[\w]+:[\w\S]+@/,  // user:pass@host format

      // Environment variable assignments with sensitive data
      /export\s+\w*(PASSWORD|SECRET|TOKEN|KEY)\w*=/i,
      /set\s+\w*(PASSWORD|SECRET|TOKEN|KEY)\w*=/i,
    ];

    // Check if command matches any sensitive pattern
    const isSensitive = sensitivePatterns.some(pattern => pattern.test(trimmed));

    if (isSensitive) {
      console.log('[Command History] Skipped sensitive command');
      return;
    }

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
      sshConnections,
      addSSHConnection,
      updateSSHConnection,
      deleteSSHConnection,
    }),
    [aiSidebarOpen, apiUrl, selectedModel, apiKey, commandHistory, historyDialogOpen, historyRetentionDays, sshConnections]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
