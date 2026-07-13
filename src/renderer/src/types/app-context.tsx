type AIProvider = "openai" | "anthropic" | "ollama" | "openai-compatible";

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
  openWorkspaceSwitcher: ShortcutDef;
  openSnippetPalette: ShortcutDef;
};

type CommandHistoryEntry = {
  id: string;
  command: string;
  timestamp: Date;
  tabId: string;
  tabTitle: string;
  pinned?: boolean;
};

type SSHSecretRefEntry = {
  provider: "op" | "bw" | "vault" | "aws";
  ref: string;
};

type SSHForwardEntry = {
  type: "local" | "remote" | "dynamic";
  bindAddress?: string;
  bindPort: number;
  destHost?: string;
  destPort?: number;
};

type SSHConnectionEntry = {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  identityFile?: string;
  identityKeyId?: string;
  jumpHostIds?: string[];
  hasPassword?: boolean;
  credentialId?: string;
  passwordRef?: SSHSecretRefEntry;
  tags?: string[];
  forwards?: SSHForwardEntry[];
};

type AnsibleSourceEntry = {
  id: string;
  name: string;
  sshConnectionId: string; // control node this source runs on ("" for local)
  origin: "git" | "path" | "local";
  // git origin
  repoUrl?: string;
  branch?: string;
  deployKeyId?: string; // managed SSH key id used for git auth on the node
  subdir?: string; // playbook root within the repo
  // path origin
  basePath?: string; // existing playbook root on the node
  // local origin (Calico's own machine acts as the control node)
  localPath?: string; // existing playbook root on the local machine
  // inventory
  inventoryMode: "auto" | "file";
  inventoryFile?: string; // relative to run dir when mode === "file"
};

type AnsiblePlaybookEntry = {
  id: string;
  sourceId: string;
  name: string;
  relativePath: string; // path to the playbook relative to the run dir
  defaultLimit?: string;
  defaultExtraVars?: string;
  defaultCheck?: boolean;
};

type VaultCredential = {
  id: string;
  name: string;
  username: string;
  hasPassword: boolean;
};

type WorkspaceEnvironmentEntry = "dev" | "staging" | "prod" | "other";

type WorkspaceSnippetEntry = {
  id: string;
  name: string;
  command: string;
  description?: string;
};

type WorkspaceIdentityMode = "off" | "subtle" | "strong" | "prod-only";

type WorkspaceEntry = {
  id: string;
  name: string;
  color: string;
  environment?: WorkspaceEnvironmentEntry;
  sshConnectionIds: string[];
  envVarKeys?: string[];
  alertRuleIds?: string[];
  snippets?: WorkspaceSnippetEntry[];
};

type AppContextType = {
  theme: import("../themes").ThemeId;
  setTheme: (id: import("../themes").ThemeId) => void;
  aiSidebarOpen: boolean;
  setAiSidebarOpen: (open: boolean) => void;
  apiUrl: string;
  setApiUrl: (url: string) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  hasApiKey: boolean;
  setHasApiKey: (has: boolean) => void;
  aiProvider: AIProvider;
  setAiProvider: (provider: AIProvider) => void;
  // Terminal appearance
  terminalFontFamily: string;
  setTerminalFontFamily: (v: string) => void;
  terminalFontSize: number;
  setTerminalFontSize: (v: number) => void;
  terminalLineHeight: number;
  setTerminalLineHeight: (v: number) => void;
  cursorStyle: "block" | "bar" | "underline";
  setCursorStyle: (v: "block" | "bar" | "underline") => void;
  cursorBlink: boolean;
  setCursorBlink: (v: boolean) => void;
  scrollback: number;
  setScrollback: (v: number) => void;
  // Default terminal startup
  defaultShell: string;
  setDefaultShell: (v: string) => void;
  defaultCwd: string;
  setDefaultCwd: (v: string) => void;
  // Restore open tabs across app restarts (off by default)
  restoreTabsOnStartup: boolean;
  setRestoreTabsOnStartup: (v: boolean) => void;
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
  addCommandToHistory: (
    command: string,
    tabId: string,
    tabTitle: string,
  ) => void;
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
  // Ansible runner — persistent sources + playbooks
  ansibleSources: AnsibleSourceEntry[];
  addAnsibleSource: (src: AnsibleSourceEntry) => void;
  updateAnsibleSource: (src: AnsibleSourceEntry) => void;
  deleteAnsibleSource: (id: string) => void;
  ansiblePlaybooks: AnsiblePlaybookEntry[];
  addAnsiblePlaybook: (pb: AnsiblePlaybookEntry) => void;
  updateAnsiblePlaybook: (pb: AnsiblePlaybookEntry) => void;
  deleteAnsiblePlaybook: (id: string) => void;
  ansiblePanelOpen: boolean;
  setAnsiblePanelOpen: (open: boolean) => void;
  vaultCredentials: VaultCredential[];
  addVaultCredential: (cred: VaultCredential) => void;
  updateVaultCredential: (cred: VaultCredential) => void;
  deleteVaultCredential: (id: string) => void;
  // Workspaces (phase 4)
  workspaces: WorkspaceEntry[];
  activeWorkspaceId: string;
  setActiveWorkspaceId: (id: string) => void;
  addWorkspace: (ws: WorkspaceEntry) => void;
  updateWorkspace: (ws: WorkspaceEntry) => void;
  deleteWorkspace: (id: string) => void;
  assignConnectionToWorkspace: (
    connId: string,
    workspaceId: string,
    mode?: "toggle" | "add" | "remove" | "exclusive",
  ) => void;
  // Workspace identity visual feedback intensity
  workspaceIdentity: WorkspaceIdentityMode;
  setWorkspaceIdentity: (mode: WorkspaceIdentityMode) => void;
  // Workspace switcher control (used by keyboard shortcut)
  workspaceSwitcherOpen: boolean;
  setWorkspaceSwitcherOpen: (open: boolean) => void;
  // Snippet palette control
  snippetPaletteOpen: boolean;
  setSnippetPaletteOpen: (open: boolean) => void;
};
