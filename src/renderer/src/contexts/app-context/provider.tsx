import { useMemo, useState, useEffect } from "react";
import { AppContext } from "./context";
import { DEFAULT_THEME_ID, getTheme } from "../../themes";
import type { ThemeId } from "../../themes";

const DEFAULT_SHORTCUTS: AppShortcuts = {
  newTab: { key: 't', ctrl: true, shift: true, alt: false },
  closeTab: { key: 'w', ctrl: true, shift: false, alt: false },
  nextTab: { key: 'Tab', ctrl: true, shift: false, alt: false },
  prevTab: { key: 'Tab', ctrl: true, shift: true, alt: false },
  toggleSidebar: { key: 'a', ctrl: true, shift: true, alt: false },
  openHistory: { key: 'h', ctrl: true, shift: false, alt: false },
};

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    const stored = localStorage.getItem("calico-theme");
    return (stored as ThemeId) ?? DEFAULT_THEME_ID;
  });

  const setTheme = (id: ThemeId) => {
    localStorage.setItem("calico-theme", id);
    setThemeState(id);
  };

  // Apply data-theme attribute and CSS variables to the document root
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    const colors = getTheme(theme).colors;
    root.style.setProperty("--accent-100", colors[100]);
    root.style.setProperty("--accent-300", colors[300]);
    root.style.setProperty("--accent-400", colors[400]);
    root.style.setProperty("--accent-500", colors[500]);
    root.style.setProperty("--accent-600", colors[600]);
    root.style.setProperty("--accent-rgb", colors.rgb);
    root.style.setProperty("--accent-oklch", colors.oklch);
  }, [theme]);

  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [apiUrl, setApiUrl] = useState(localStorage.getItem("apiUrl") || "");
  const [selectedModel, setSelectedModel] = useState(
    localStorage.getItem("selectedModel") || ""
  );
  const [apiKey, setApiKey] = useState(localStorage.getItem("apiKey") || "");

  // --- Terminal appearance ---
  const [terminalFontFamily, setTerminalFontFamilyState] = useState(
    localStorage.getItem("terminalFontFamily") || "Cascadia Code, Consolas, 'Courier New', monospace"
  );
  const setTerminalFontFamily = (v: string) => { localStorage.setItem("terminalFontFamily", v); setTerminalFontFamilyState(v); };

  const [terminalFontSize, setTerminalFontSizeState] = useState<number>(() => {
    const s = localStorage.getItem("terminalFontSize"); return s ? parseFloat(s) : 14;
  });
  const setTerminalFontSize = (v: number) => { localStorage.setItem("terminalFontSize", v.toString()); setTerminalFontSizeState(v); };

  const [terminalLineHeight, setTerminalLineHeightState] = useState<number>(() => {
    const s = localStorage.getItem("terminalLineHeight"); return s ? parseFloat(s) : 1.2;
  });
  const setTerminalLineHeight = (v: number) => { localStorage.setItem("terminalLineHeight", v.toString()); setTerminalLineHeightState(v); };

  const [cursorStyle, setCursorStyleState] = useState<'block' | 'bar' | 'underline'>(() => {
    const s = localStorage.getItem("cursorStyle");
    return (s as 'block' | 'bar' | 'underline') || 'block';
  });
  const setCursorStyle = (v: 'block' | 'bar' | 'underline') => { localStorage.setItem("cursorStyle", v); setCursorStyleState(v); };

  const [cursorBlink, setCursorBlinkState] = useState<boolean>(() => {
    const s = localStorage.getItem("cursorBlink"); return s !== null ? s === 'true' : true;
  });
  const setCursorBlink = (v: boolean) => { localStorage.setItem("cursorBlink", v.toString()); setCursorBlinkState(v); };

  const [scrollback, setScrollbackState] = useState<number>(() => {
    const s = localStorage.getItem("scrollback"); return s ? parseInt(s, 10) : 5000;
  });
  const setScrollback = (v: number) => { localStorage.setItem("scrollback", v.toString()); setScrollbackState(v); };

  // --- Default terminal startup ---
  const [defaultShell, setDefaultShellState] = useState(localStorage.getItem("defaultShell") || "");
  const setDefaultShell = (v: string) => { localStorage.setItem("defaultShell", v); setDefaultShellState(v); };

  const [defaultCwd, setDefaultCwdState] = useState(localStorage.getItem("defaultCwd") || "");
  const setDefaultCwd = (v: string) => { localStorage.setItem("defaultCwd", v); setDefaultCwdState(v); };

  // --- AI advanced settings ---
  const [aiSystemPrompt, setAiSystemPromptState] = useState(localStorage.getItem("aiSystemPrompt") || "");
  const setAiSystemPrompt = (v: string) => { localStorage.setItem("aiSystemPrompt", v); setAiSystemPromptState(v); };

  const [aiTemperature, setAiTemperatureState] = useState<number>(() => {
    const s = localStorage.getItem("aiTemperature"); return s ? parseFloat(s) : 0.7;
  });
  const setAiTemperature = (v: number) => { localStorage.setItem("aiTemperature", v.toString()); setAiTemperatureState(v); };

  const [aiMaxTokens, setAiMaxTokensState] = useState<number>(() => {
    const s = localStorage.getItem("aiMaxTokens"); return s ? parseInt(s, 10) : 0;
  });
  const setAiMaxTokens = (v: number) => { localStorage.setItem("aiMaxTokens", v.toString()); setAiMaxTokensState(v); };

  // --- Keyboard shortcuts ---
  const [shortcuts, setShortcutsState] = useState<AppShortcuts>(() => {
    const s = localStorage.getItem("shortcuts");
    if (s) { try { return JSON.parse(s); } catch { /* ignore */ } }
    return DEFAULT_SHORTCUTS;
  });
  const setShortcuts = (v: AppShortcuts) => { localStorage.setItem("shortcuts", JSON.stringify(v)); setShortcutsState(v); };
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

  const [vaultCredentials, setVaultCredentials] = useState<VaultCredential[]>(() => {
    const stored = localStorage.getItem("vaultCredentials");
    if (stored) {
      try { return JSON.parse(stored); } catch { return []; }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem("vaultCredentials", JSON.stringify(vaultCredentials));
  }, [vaultCredentials]);

  const addVaultCredential = (cred: VaultCredential) => {
    setVaultCredentials((prev) => [...prev, cred]);
  };

  const updateVaultCredential = (cred: VaultCredential) => {
    setVaultCredentials((prev) => prev.map((c) => (c.id === cred.id ? cred : c)));
  };

  const deleteVaultCredential = (id: string) => {
    setVaultCredentials((prev) => prev.filter((c) => c.id !== id));
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
      theme,
      setTheme,
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
      // Terminal appearance
      terminalFontFamily, setTerminalFontFamily,
      terminalFontSize, setTerminalFontSize,
      terminalLineHeight, setTerminalLineHeight,
      cursorStyle, setCursorStyle,
      cursorBlink, setCursorBlink,
      scrollback, setScrollback,
      // Default startup
      defaultShell, setDefaultShell,
      defaultCwd, setDefaultCwd,
      // AI advanced
      aiSystemPrompt, setAiSystemPrompt,
      aiTemperature, setAiTemperature,
      aiMaxTokens, setAiMaxTokens,
      // Shortcuts
      shortcuts, setShortcuts,
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
      vaultCredentials,
      addVaultCredential,
      updateVaultCredential,
      deleteVaultCredential,
    }),
    [theme, aiSidebarOpen, apiUrl, selectedModel, apiKey, commandHistory, historyDialogOpen, historyRetentionDays, sshConnections, vaultCredentials,
      terminalFontFamily, terminalFontSize, terminalLineHeight, cursorStyle, cursorBlink, scrollback,
      defaultShell, defaultCwd, aiSystemPrompt, aiTemperature, aiMaxTokens, shortcuts]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
