type ShortcutDef = {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
};

type AppShortcuts = {
  newTab: ShortcutDef;
  closeTab: ShortcutDef;
  nextTab: ShortcutDef;
  prevTab: ShortcutDef;
  toggleSidebar: ShortcutDef;
  openHistory: ShortcutDef;
};

type CommandHistoryEntry = {
  id: string;
  command: string;
  timestamp: Date;
  tabId: string;
  tabTitle: string;
  pinned?: boolean;
};

type SSHConnectionEntry = {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  identityFile?: string;
  hasPassword?: boolean;
  credentialId?: string;
  tags?: string[];
};

type VaultCredential = {
  id: string;
  name: string;
  username: string;
  hasPassword: boolean;
};

type AppContextType = {
  theme: import('../themes').ThemeId;
  setTheme: (id: import('../themes').ThemeId) => void;
  aiSidebarOpen: boolean;
  setAiSidebarOpen: (open: boolean) => void;
  apiUrl: string;
  setApiUrl: (url: string) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  // Terminal appearance
  terminalFontFamily: string;
  setTerminalFontFamily: (v: string) => void;
  terminalFontSize: number;
  setTerminalFontSize: (v: number) => void;
  terminalLineHeight: number;
  setTerminalLineHeight: (v: number) => void;
  cursorStyle: 'block' | 'bar' | 'underline';
  setCursorStyle: (v: 'block' | 'bar' | 'underline') => void;
  cursorBlink: boolean;
  setCursorBlink: (v: boolean) => void;
  scrollback: number;
  setScrollback: (v: number) => void;
  // Default terminal startup
  defaultShell: string;
  setDefaultShell: (v: string) => void;
  defaultCwd: string;
  setDefaultCwd: (v: string) => void;
  // AI advanced settings
  aiSystemPrompt: string;
  setAiSystemPrompt: (v: string) => void;
  aiTemperature: number;
  setAiTemperature: (v: number) => void;
  aiMaxTokens: number;
  setAiMaxTokens: (v: number) => void;
  // Keyboard shortcuts
  shortcuts: AppShortcuts;
  setShortcuts: (v: AppShortcuts) => void;
  commandHistory: CommandHistoryEntry[];
  addCommandToHistory: (command: string, tabId: string, tabTitle: string) => void;
  togglePinCommand: (id: string) => void;
  deleteCommand: (id: string) => void;
  runGarbageCollection: () => void;
  historyDialogOpen: boolean;
  setHistoryDialogOpen: (open: boolean) => void;
  historyRetentionDays: number;
  setHistoryRetentionDays: (days: number) => void;
  sshConnections: SSHConnectionEntry[];
  addSSHConnection: (conn: SSHConnectionEntry) => void;
  updateSSHConnection: (conn: SSHConnectionEntry) => void;
  deleteSSHConnection: (id: string) => void;
  vaultCredentials: VaultCredential[];
  addVaultCredential: (cred: VaultCredential) => void;
  updateVaultCredential: (cred: VaultCredential) => void;
  deleteVaultCredential: (id: string) => void;
};
