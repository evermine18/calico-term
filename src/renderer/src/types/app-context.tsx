type CommandHistoryEntry = {
  id: string;
  command: string;
  timestamp: Date;
  tabId: string;
  tabTitle: string;
  pinned?: boolean;
};

type AppContextType = {
  aiSidebarOpen: boolean;
  setAiSidebarOpen: (open: boolean) => void;
  apiUrl: string;
  setApiUrl: (url: string) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  commandHistory: CommandHistoryEntry[];
  addCommandToHistory: (command: string, tabId: string, tabTitle: string) => void;
  togglePinCommand: (id: string) => void;
  deleteCommand: (id: string) => void;
  runGarbageCollection: () => void;
  historyDialogOpen: boolean;
  setHistoryDialogOpen: (open: boolean) => void;
  historyRetentionDays: number;
  setHistoryRetentionDays: (days: number) => void;
};
