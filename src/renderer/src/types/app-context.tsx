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
  sshConnections: SSHConnectionEntry[];
  addSSHConnection: (conn: SSHConnectionEntry) => void;
  updateSSHConnection: (conn: SSHConnectionEntry) => void;
  deleteSSHConnection: (id: string) => void;
  vaultCredentials: VaultCredential[];
  addVaultCredential: (cred: VaultCredential) => void;
  updateVaultCredential: (cred: VaultCredential) => void;
  deleteVaultCredential: (id: string) => void;
};
