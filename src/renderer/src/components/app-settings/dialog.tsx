import { Button } from "@renderer/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@renderer/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@renderer/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@renderer/components/ui/tabs";
import { Input } from "@renderer/components/ui/input";
import { Textarea } from "@renderer/components/ui/textarea";
import { Label } from "@renderer/components/ui/label";
import { ModelsSelector } from "./model-combobox";
import { useAppContext } from "@renderer/contexts/app-context";
import { useState, useEffect, useRef } from "react";
import {
  Eye,
  EyeOff,
  Plus,
  X,
  Edit2,
  Check,
  Vault,
  User,
  KeyRound,
  Bot,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  Palette,
  Terminal as TerminalIcon,
  Settings2,
  Keyboard, Info, Download, RefreshCw, RotateCcw,
  Variable,
  Circle, Bell, FileSignature, Layers, ShieldAlert, Sparkles,
} from "lucide-react";
import { ThemePicker } from "./theme-picker";
import { SSHKeysPanel } from "./ssh-keys-panel";
import { EnvVaultPanel } from "./env-vault-panel";
import { RecordingsPanel } from "./recordings-panel";
import { AlertsPanel } from "./alerts-panel";
import { AuditPanel } from "./audit-panel";
import { WorkspacesPanel } from "../workspaces/workspaces-panel";
import { WorkspaceIdentityPanel } from "./workspace-identity-panel";
import { GuardrailsPanel } from "./guardrails-panel";
import type { ThemeId } from "@renderer/themes";

interface TagItem {
  id: string;
  name: string;
  color: string;
}

const TAGS_STORAGE_KEY = "calico-term-tags";

type VaultFormData = {
  name: string;
  username: string;
  password: string;
};

const EMPTY_VAULT_FORM: VaultFormData = {
  name: "",
  username: "",
  password: "",
};

type SettingsTabItem = {
  value: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
};

type SettingsGroup = {
  label: string;
  items: SettingsTabItem[];
};

const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    label: "General",
    items: [
      { value: "general", label: "General", icon: Settings2 },
      { value: "terminal", label: "Terminal", icon: TerminalIcon },
      { value: "appearance", label: "Appearance", icon: Palette },
    ],
  },
  {
    label: "AI",
    items: [{ value: "ai", label: "AI", icon: Bot }],
  },
  {
    label: "Security",
    items: [
      { value: "vault", label: "Vault", icon: ShieldCheck },
      { value: "keys", label: "Keys", icon: KeyRound },
      { value: "env", label: "Env", icon: Variable },
      { value: "guardrails", label: "Guardrails", icon: ShieldAlert },
    ],
  },
  {
    label: "Observability",
    items: [
      { value: "recordings", label: "Recordings", icon: Circle },
      { value: "alerts", label: "Alerts", icon: Bell },
      { value: "audit", label: "Audit", icon: FileSignature },
    ],
  },
  {
    label: "Workspaces",
    items: [
      { value: "workspaces", label: "Workspaces", icon: Layers },
      { value: "workspace-identity", label: "Identity", icon: Sparkles },
    ],
  },
  {
    label: "About",
    items: [{ value: "about", label: "About", icon: Info }],
  },
];

function formatShortcut(s: ShortcutDef): string {
  const parts: string[] = [];
  if (s.ctrl) parts.push("Ctrl");
  if (s.alt) parts.push("Alt");
  if (s.shift) parts.push("Shift");
  parts.push(s.key === " " ? "Space" : s.key);
  return parts.join("+");
}

export default function SettingsDialog({ children }) {
  const {
    theme,
    setTheme,
    apiUrl,
    setApiUrl,
    hasApiKey,
    setHasApiKey,
    selectedModel,
    setSelectedModel,
    historyRetentionDays,
    setHistoryRetentionDays,
    vaultCredentials,
    addVaultCredential,
    updateVaultCredential,
    deleteVaultCredential,
    // Terminal appearance
    terminalFontFamily,
    setTerminalFontFamily,
    terminalFontSize,
    setTerminalFontSize,
    terminalLineHeight,
    setTerminalLineHeight,
    cursorStyle,
    setCursorStyle,
    cursorBlink,
    setCursorBlink,
    scrollback,
    setScrollback,
    // Default startup
    defaultShell,
    setDefaultShell,
    defaultCwd,
    setDefaultCwd,
    // AI advanced
    aiSystemPrompt,
    setAiSystemPrompt,
    aiTemperature,
    setAiTemperature,
    aiMaxTokens,
    setAiMaxTokens,
    aiProvider,
    setAiProvider,
    // Shortcuts
    shortcuts,
    setShortcuts,
  } = useAppContext();
  const [localSettings, setLocalSettings] = useState({
    apiUrl: apiUrl || "",
    selectedModel: selectedModel || "",
    historyRetentionDays: historyRetentionDays || 1,
    // Terminal
    terminalFontFamily,
    terminalFontSize,
    terminalLineHeight,
    cursorStyle,
    cursorBlink,
    scrollback,
    defaultShell,
    defaultCwd,
    // AI advanced
    aiSystemPrompt,
    aiTemperature,
    aiMaxTokens,
    aiProvider,
  });
  // Separate local API key input — not included in localSettings to avoid re-renders
  const [localApiKey, setLocalApiKey] = useState("");
  const [localShortcuts, setLocalShortcuts] = useState<AppShortcuts>(shortcuts);
  const [capturingKey, setCapturingKey] = useState<keyof AppShortcuts | null>(
    null,
  );
  const captureRef = useRef<HTMLButtonElement | null>(null);
  const [localTheme, setLocalTheme] = useState<ThemeId>(theme);
  const [open, setOpen] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiStatus, setApiStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [apiError, setApiError] = useState<string>("");
  const [tags, setTags] = useState<TagItem[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(
    () =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--accent-500")
        .trim() || "#06b6d4",
  );
  const [editingTagId, setEditingTagId] = useState<string | null>(null);

  // Updater state
  type UpdaterStatus = "idle" | "checking" | "up-to-date" | "available" | "downloading" | "downloaded" | "error";
  const [updaterStatus, setUpdaterStatus] = useState<UpdaterStatus>("idle");
  const [updaterVersion, setUpdaterVersion] = useState<string | null>(null);
  const [updaterProgress, setUpdaterProgress] = useState(0);
  const [updaterError, setUpdaterError] = useState<string | null>(null);

  const currentVersion = __APP_VERSION__;

  useEffect(() => {
    if (!open) return;
    window.api.updater.onUpdateAvailable((info) => {
      setUpdaterVersion(info.version);
      setUpdaterStatus("available");
    });
    window.api.updater.onUpToDate(() => {
      setUpdaterStatus("up-to-date");
    });
    window.api.updater.onDownloadProgress((progress) => {
      setUpdaterProgress(Math.round(progress.percent));
      setUpdaterStatus("downloading");
    });
    window.api.updater.onUpdateDownloaded(() => {
      setUpdaterStatus("downloaded");
    });
    window.api.updater.onError((msg) => {
      setUpdaterError(msg);
      setUpdaterStatus("error");
    });
    return () => {
      window.api.updater.removeAllListeners();
    };
  }, [open]);

  const handleCheckUpdates = async () => {
    setUpdaterStatus("checking");
    setUpdaterError(null);
    await window.api.updater.check();
  };

  const handleDownloadUpdate = async () => {
    setUpdaterStatus("downloading");
    await window.api.updater.download();
  };

  const handleInstallUpdate = () => {
    window.api.updater.install();
  };

  // Vault credential state
  const [vaultDialogOpen, setVaultDialogOpen] = useState(false);
  const [editingCredentialId, setEditingCredentialId] = useState<string | null>(
    null,
  );
  const [vaultForm, setVaultForm] = useState<VaultFormData>(EMPTY_VAULT_FORM);
  const [showVaultPassword, setShowVaultPassword] = useState(false);

  // Load tags from localStorage
  useEffect(() => {
    const storedTags = localStorage.getItem(TAGS_STORAGE_KEY);
    if (storedTags) {
      setTags(JSON.parse(storedTags));
    }
  }, [open]);

  // Sync localTheme and all local settings when dialog opens
  useEffect(() => {
    if (open) {
      setLocalTheme(theme);
      setLocalSettings({
        apiUrl: apiUrl || "",
        selectedModel: selectedModel || "",
        historyRetentionDays: historyRetentionDays || 1,
        terminalFontFamily,
        terminalFontSize,
        terminalLineHeight,
        cursorStyle,
        cursorBlink,
        scrollback,
        defaultShell,
        defaultCwd,
        aiSystemPrompt,
        aiTemperature,
        aiMaxTokens,
        aiProvider,
      });
      setLocalApiKey("");
      setLocalShortcuts(shortcuts);
    }
  }, [open]);

  const saveTags = (updatedTags: TagItem[]) => {
    localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(updatedTags));
    setTags(updatedTags);
    window.dispatchEvent(new Event("tags-updated"));
  };

  const addTag = () => {
    if (!newTagName.trim()) return;
    const newTag: TagItem = {
      id: crypto.randomUUID(),
      name: newTagName.trim(),
      color: newTagColor,
    };
    saveTags([...tags, newTag]);
    setNewTagName("");
    setNewTagColor(
      getComputedStyle(document.documentElement)
        .getPropertyValue("--accent-500")
        .trim() || "#06b6d4",
    );
  };

  const updateTag = (id: string, name: string, color: string) => {
    saveTags(
      tags.map((tag) => (tag.id === id ? { ...tag, name, color } : tag)),
    );
    setEditingTagId(null);
  };

  const deleteTag = (id: string) => {
    saveTags(tags.filter((tag) => tag.id !== id));
  };

  const openAddVault = () => {
    setEditingCredentialId(null);
    setVaultForm(EMPTY_VAULT_FORM);
    setShowVaultPassword(false);
    setVaultDialogOpen(true);
  };

  const openEditVault = (cred: VaultCredential) => {
    setEditingCredentialId(cred.id);
    setVaultForm({ name: cred.name, username: cred.username, password: "" });
    setShowVaultPassword(false);
    setVaultDialogOpen(true);
  };

  const handleVaultSave = async () => {
    if (!vaultForm.name.trim() || !vaultForm.username.trim()) return;
    const isEdit = !!editingCredentialId;
    const credId = isEdit ? editingCredentialId! : crypto.randomUUID();

    const existing = isEdit
      ? vaultCredentials.find((c) => c.id === credId)
      : null;
    const hasPassword = vaultForm.password
      ? true
      : (existing?.hasPassword ?? false);

    const cred: VaultCredential = {
      id: credId,
      name: vaultForm.name.trim(),
      username: vaultForm.username.trim(),
      hasPassword,
    };

    if (isEdit) {
      updateVaultCredential(cred);
    } else {
      addVaultCredential(cred);
    }

    if (vaultForm.password) {
      await window.electron.ipcRenderer.invoke(
        "vault-password-set",
        credId,
        vaultForm.password,
      );
    }

    setVaultDialogOpen(false);
  };

  const handleVaultDelete = (credId: string) => {
    deleteVaultCredential(credId);
    window.electron.ipcRenderer.send("vault-password-delete", credId);
  };

  const handleThemeChange = (id: ThemeId) => {
    setLocalTheme(id);
    setTheme(id); // live preview — applies instantly
  };

  const handleSave = async () => {
    // Validate API URL format
    if (localSettings.apiUrl) {
      try {
        new URL(localSettings.apiUrl);
      } catch {
        setApiError("Invalid URL format");
        setApiStatus("error");
        return;
      }
    }
    setApiUrl(localSettings.apiUrl);
    // Save API key via safeStorage if user typed a new one
    if (localApiKey.trim()) {
      await window.electron.ipcRenderer.invoke(
        "ai-apikey-set",
        localApiKey.trim(),
      );
      setHasApiKey(true);
    }
    setSelectedModel(localSettings.selectedModel);
    setHistoryRetentionDays(localSettings.historyRetentionDays);
    // Terminal
    setTerminalFontFamily(localSettings.terminalFontFamily);
    setTerminalFontSize(localSettings.terminalFontSize);
    setTerminalLineHeight(localSettings.terminalLineHeight);
    setCursorStyle(localSettings.cursorStyle);
    setCursorBlink(localSettings.cursorBlink);
    setScrollback(localSettings.scrollback);
    setDefaultShell(localSettings.defaultShell);
    setDefaultCwd(localSettings.defaultCwd);
    // AI advanced
    setAiSystemPrompt(localSettings.aiSystemPrompt);
    setAiTemperature(localSettings.aiTemperature);
    setAiMaxTokens(localSettings.aiMaxTokens);
    setAiProvider(
      localSettings.aiProvider as
      | "openai"
      | "anthropic"
      | "ollama"
      | "openai-compatible",
    );
    // Shortcuts
    setShortcuts(localShortcuts);
    setOpen(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger>{children}</DialogTrigger>
        <DialogContent className="sm:max-w-[900px] max-h-[85vh] overflow-hidden bg-card border-border/60 shadow-xl flex flex-col">
          <DialogHeader className="border-b border-border/60 pb-4 shrink-0">
            <DialogTitle className="text-foreground flex items-center gap-2">
              <div className="w-8 h-8 bg-accent-500/20 border border-accent-500/30 rounded-lg flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-accent-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              Settings
            </DialogTitle>
          </DialogHeader>

          <Tabs
            defaultValue="general"
            orientation="vertical"
            className="flex flex-row flex-1 min-h-0 gap-4"
          >
            <TabsList className="shrink-0 w-48 flex-col items-stretch justify-start bg-card/40 border border-border/60 rounded-lg p-2 gap-0.5 self-stretch min-h-0 overflow-y-auto scrollbar-hover-only">
              {SETTINGS_GROUPS.map((group, groupIdx) => {
                const showHeader = group.items.length > 1;
                return (
                  <div key={group.label} className="flex flex-col gap-0.5">
                    {showHeader && (
                      <div
                        className={`px-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground/70 ${groupIdx === 0 ? "pt-1" : "pt-3"}`}
                      >
                        {group.label}
                      </div>
                    )}
                    {group.items.map(({ value, label, icon: Icon }) => (
                      <TabsTrigger
                        key={value}
                        value={value}
                        className="w-full justify-start gap-2 px-2.5"
                      >
                        <Icon size={14} />
                        {label}
                      </TabsTrigger>
                    ))}
                  </div>
                );
              })}
            </TabsList>

            <div className="flex-1 min-w-0 min-h-0 flex flex-col">

            {/* Appearance Tab */}
            <TabsContent
              value="appearance"
              className="flex-1 overflow-y-auto px-1 mt-4"
            >
              <div className="space-y-4">
                <div>
                  <p className="text-foreground/80 text-sm font-semibold">
                    Color Theme
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Changes apply instantly — no need to save.
                  </p>
                </div>
                <ThemePicker value={localTheme} onChange={handleThemeChange} />
              </div>
            </TabsContent>

            {/* AI Tab */}
            <TabsContent
              value="ai"
              className="flex-1 overflow-y-auto px-1 space-y-5 mt-4"
            >
              <div className="grid gap-2.5">
                <Label htmlFor="ai-provider" className="text-foreground/80 text-sm">
                  Provider
                </Label>
                <Select
                  value={localSettings.aiProvider}
                  onValueChange={(v) =>
                    setLocalSettings({
                      ...localSettings,
                      aiProvider: v as
                        | "openai"
                        | "anthropic"
                        | "ollama"
                        | "openai-compatible",
                    })
                  }
                >
                  <SelectTrigger
                    id="ai-provider"
                    className="bg-card/50 border-border/80 text-foreground focus:border-accent-500/50 focus:ring-accent-500/20"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border/80">
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="ollama">Ollama (local)</SelectItem>
                    <SelectItem value="openai-compatible">
                      OpenAI-compatible
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2.5">
                <Label htmlFor="api-url" className="text-foreground/80 text-sm">
                  Base API URL
                </Label>
                <Input
                  id="api-url"
                  name="Api Url"
                  defaultValue={localSettings.apiUrl}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      apiUrl: e.target.value,
                    })
                  }
                  placeholder={
                    localSettings.aiProvider === "anthropic"
                      ? "https://api.anthropic.com"
                      : localSettings.aiProvider === "ollama"
                        ? "http://localhost:11434"
                        : "https://api.openai.com"
                  }
                  className="bg-card/50 border-border/80 text-foreground focus:border-accent-500/50 focus:ring-accent-500/20 placeholder:text-muted-foreground/70"
                />
              </div>

              {localSettings.aiProvider !== "ollama" && (
                <div className="grid gap-2.5">
                  <Label htmlFor="api-key" className="text-foreground/80 text-sm">
                    API Key
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="api-key"
                      name="Api Key"
                      type={showApiKey ? "text" : "password"}
                      value={localApiKey}
                      onChange={(e) => setLocalApiKey(e.target.value)}
                      placeholder={
                        hasApiKey
                          ? "••••••••  (key saved — leave blank to keep)"
                          : localSettings.aiProvider === "anthropic"
                            ? "sk-ant-…"
                            : localSettings.aiProvider === "openai-compatible"
                              ? "API key"
                              : "sk-…"
                      }
                      className="bg-card/50 border-border/80 text-foreground focus:border-accent-500/50 focus:ring-accent-500/20 placeholder:text-muted-foreground/70"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="bg-card/50 border-border/80 hover:bg-accent-500/20 hover:text-accent-300 hover:border-accent-500/50"
                    >
                      {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                  </div>
                </div>
              )}

              {/* Connection status */}
              {apiStatus !== "idle" && (
                <div
                  className={`flex items-start gap-2 rounded-md px-3 py-2 text-xs border ${apiStatus === "loading"
                      ? "bg-card/40 border-border/60 text-muted-foreground"
                      : apiStatus === "success"
                        ? "bg-green-500/10 border-green-500/20 text-green-400"
                        : "bg-red-500/10 border-red-500/20 text-red-400"
                    }`}
                >
                  {apiStatus === "loading" && (
                    <Loader2
                      size={13}
                      className="animate-spin mt-px shrink-0"
                    />
                  )}
                  {apiStatus === "success" && (
                    <CheckCircle2 size={13} className="mt-px shrink-0" />
                  )}
                  {apiStatus === "error" && (
                    <XCircle size={13} className="mt-px shrink-0" />
                  )}
                  <span className="break-all">
                    {apiStatus === "loading" && "Checking connection…"}
                    {apiStatus === "success" && "Connection successful"}
                    {apiStatus === "error" &&
                      (apiError.includes("401") || apiError.includes("403")
                        ? "Invalid API key or unauthorized"
                        : apiError.includes("ECONNREFUSED") ||
                          apiError.includes("ENOTFOUND") ||
                          apiError.includes("fetch")
                          ? "Could not reach the API URL"
                          : apiError || "Connection failed")}
                  </span>
                </div>
              )}

              <div className="grid gap-2.5">
                <Label htmlFor="model" className="text-foreground/80 text-sm">
                  Model
                </Label>
                <ModelsSelector
                  url={localSettings.apiUrl}
                  apiKey={localApiKey}
                  hasStoredApiKey={hasApiKey}
                  provider={
                    localSettings.aiProvider as
                    | "openai"
                    | "anthropic"
                    | "ollama"
                    | "openai-compatible"
                  }
                  currentValue={localSettings.selectedModel}
                  onValueChange={(model) =>
                    setLocalSettings({ ...localSettings, selectedModel: model })
                  }
                  onStatusChange={(status, error) => {
                    setApiStatus(status);
                    setApiError(error ?? "");
                  }}
                />
              </div>

              {/* System prompt */}
              <div className="space-y-2 pt-3 border-t border-border/60">
                <div className="flex items-center gap-2 text-foreground/80 text-sm font-semibold">
                  <div className="w-1 h-4 bg-accent-500 rounded-full"></div>
                  System Prompt
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave blank to use the built-in DevOps/SRE assistant prompt.
                </p>
                <Textarea
                  value={localSettings.aiSystemPrompt}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      aiSystemPrompt: e.target.value,
                    })
                  }
                  placeholder="You are a helpful assistant..."
                  rows={4}
                  className="bg-card/50 border-border/80 text-foreground placeholder:text-muted-foreground/70 focus:border-accent-500/50 focus:ring-accent-500/20 resize-none text-sm"
                />
              </div>

              {/* Temperature & Max Tokens */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/60">
                <div className="grid gap-2">
                  <Label className="text-foreground/80 text-sm">
                    Temperature
                    <span className="ml-2 text-accent-400 font-mono">
                      {localSettings.aiTemperature.toFixed(1)}
                    </span>
                  </Label>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={localSettings.aiTemperature}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        aiTemperature: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-accent-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground/70">
                    <span>Precise</span>
                    <span>Creative</span>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label className="text-foreground/80 text-sm">
                    Max Tokens{" "}
                    <span className="text-muted-foreground/70 font-normal">
                      (0 = API default)
                    </span>
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={128000}
                    step={256}
                    value={localSettings.aiMaxTokens}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        aiMaxTokens: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="bg-card/50 border-border/80 text-foreground focus:border-accent-500/50 focus:ring-accent-500/20"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Terminal Tab */}
            <TabsContent
              value="terminal"
              className="flex-1 overflow-y-auto px-1 space-y-5 mt-4"
            >
              {/* Font settings */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-foreground/80 text-sm font-semibold">
                  <div className="w-1 h-4 bg-accent-500 rounded-full"></div>
                  Font
                </div>
                <div className="grid gap-2.5">
                  <Label className="text-foreground/80 text-sm">Font Family</Label>
                  <Select
                    value={localSettings.terminalFontFamily}
                    onValueChange={(v) =>
                      setLocalSettings({
                        ...localSettings,
                        terminalFontFamily: v,
                      })
                    }
                  >
                    <SelectTrigger className="bg-card/50 border-border/80 text-foreground hover:bg-card focus:border-accent-500/50 h-auto py-2">
                      <SelectValue>
                        <span
                          style={{
                            fontFamily: localSettings.terminalFontFamily,
                          }}
                          className="text-sm"
                        >
                          {localSettings.terminalFontFamily
                            .split(",")[0]
                            .replace(/['"/]/g, "")
                            .trim()}
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border/80">
                      {(
                        [
                          {
                            label: "Cascadia Code",
                            stack:
                              "Cascadia Code, Consolas, 'Courier New', monospace",
                          },
                          {
                            label: "Fira Code",
                            stack: "Fira Code, 'Courier New', monospace",
                          },
                          {
                            label: "JetBrains Mono",
                            stack: "JetBrains Mono, 'Courier New', monospace",
                          },
                          {
                            label: "Source Code Pro",
                            stack: "Source Code Pro, Consolas, monospace",
                          },
                          {
                            label: "Consolas",
                            stack: "Consolas, 'Courier New', monospace",
                          },
                          {
                            label: "Courier New",
                            stack: "'Courier New', Courier, monospace",
                          },
                          {
                            label: "Hack",
                            stack: "Hack, 'Courier New', monospace",
                          },
                          {
                            label: "Inconsolata",
                            stack: "Inconsolata, 'Courier New', monospace",
                          },
                          {
                            label: "Ubuntu Mono",
                            stack: "'Ubuntu Mono', 'Courier New', monospace",
                          },
                          {
                            label: "IBM Plex Mono",
                            stack: "'IBM Plex Mono', 'Courier New', monospace",
                          },
                        ] as { label: string; stack: string }[]
                      ).map(({ label, stack }) => (
                        <SelectItem
                          key={stack}
                          value={stack}
                          className="text-foreground focus:bg-accent-500/20 focus:text-accent-100 py-2.5"
                        >
                          <span
                            style={{ fontFamily: stack }}
                            className="text-sm"
                          >
                            {label}&nbsp;&nbsp;
                            <span className="opacity-50">ABCabc 0123 !@#</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label className="text-foreground/80 text-sm">
                      Font Size (px)
                    </Label>
                    <Input
                      type="number"
                      min={8}
                      max={32}
                      value={localSettings.terminalFontSize}
                      onChange={(e) =>
                        setLocalSettings({
                          ...localSettings,
                          terminalFontSize: parseFloat(e.target.value) || 14,
                        })
                      }
                      className="bg-card/50 border-border/80 text-foreground focus:border-accent-500/50 focus:ring-accent-500/20"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-foreground/80 text-sm">Line Height</Label>
                    <Input
                      type="number"
                      min={1}
                      max={2}
                      step={0.05}
                      value={localSettings.terminalLineHeight}
                      onChange={(e) =>
                        setLocalSettings({
                          ...localSettings,
                          terminalLineHeight: parseFloat(e.target.value) || 1.2,
                        })
                      }
                      className="bg-card/50 border-border/80 text-foreground focus:border-accent-500/50 focus:ring-accent-500/20"
                    />
                  </div>
                </div>
              </div>

              {/* Cursor settings */}
              <div className="space-y-3 pt-3 border-t border-border/60">
                <div className="flex items-center gap-2 text-foreground/80 text-sm font-semibold">
                  <div className="w-1 h-4 bg-accent-500 rounded-full"></div>
                  Cursor
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label className="text-foreground/80 text-sm">Style</Label>
                    <Select
                      value={localSettings.cursorStyle}
                      onValueChange={(v) =>
                        setLocalSettings({
                          ...localSettings,
                          cursorStyle: v as "block" | "bar" | "underline",
                        })
                      }
                    >
                      <SelectTrigger className="bg-card/50 border-border/80 text-foreground hover:bg-card focus:border-accent-500/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border/80">
                        <SelectItem
                          value="block"
                          className="text-foreground focus:bg-accent-500/20 focus:text-accent-100"
                        >
                          Block
                        </SelectItem>
                        <SelectItem
                          value="bar"
                          className="text-foreground focus:bg-accent-500/20 focus:text-accent-100"
                        >
                          Bar
                        </SelectItem>
                        <SelectItem
                          value="underline"
                          className="text-foreground focus:bg-accent-500/20 focus:text-accent-100"
                        >
                          Underline
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-foreground/80 text-sm">Blink</Label>
                    <div className="flex items-center gap-3 h-9">
                      <button
                        type="button"
                        onClick={() =>
                          setLocalSettings({
                            ...localSettings,
                            cursorBlink: !localSettings.cursorBlink,
                          })
                        }
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${localSettings.cursorBlink ? "bg-accent-500" : "bg-secondary"}`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${localSettings.cursorBlink ? "translate-x-4.5" : "translate-x-0.5"}`}
                        />
                      </button>
                      <span className="text-xs text-muted-foreground">
                        {localSettings.cursorBlink ? "On" : "Off"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Scrollback */}
              <div className="space-y-3 pt-3 border-t border-border/60">
                <div className="flex items-center gap-2 text-foreground/80 text-sm font-semibold">
                  <div className="w-1 h-4 bg-accent-500 rounded-full"></div>
                  Scrollback Buffer
                </div>
                <div className="grid gap-2">
                  <Label className="text-foreground/80 text-sm">Max lines</Label>
                  <div className="flex items-center gap-3">
                    <Select
                      value={localSettings.scrollback.toString()}
                      onValueChange={(v) =>
                        setLocalSettings({
                          ...localSettings,
                          scrollback: parseInt(v, 10),
                        })
                      }
                    >
                      <SelectTrigger className="flex-1 bg-card/50 border-border/80 text-foreground hover:bg-card focus:border-accent-500/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border/80">
                        {[1000, 2000, 5000, 10000, 20000, 50000].map((v) => (
                          <SelectItem
                            key={v}
                            value={v.toString()}
                            className="text-foreground focus:bg-accent-500/20 focus:text-accent-100"
                          >
                            {v.toLocaleString()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground shrink-0">
                      lines
                    </span>
                  </div>
                </div>
              </div>

              {/* Command History */}
              <div className="space-y-3 pt-3 border-t border-border/60">
                <div className="flex items-center gap-2 text-foreground/80 text-sm font-semibold">
                  <div className="w-1 h-4 bg-accent-500 rounded-full"></div>
                  Command History
                </div>
                <div className="grid gap-2.5">
                  <Label
                    htmlFor="retention-days"
                    className="text-foreground/80 text-sm"
                  >
                    History Retention Period
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Commands older than this period will be automatically
                    deleted (pinned commands are kept forever)
                  </p>
                  <div className="flex items-center gap-3">
                    <Select
                      value={localSettings.historyRetentionDays.toString()}
                      onValueChange={(value) =>
                        setLocalSettings({
                          ...localSettings,
                          historyRetentionDays: parseFloat(value),
                        })
                      }
                    >
                      <SelectTrigger className="flex-1 bg-card/50 border-border/80 text-foreground hover:bg-card focus:border-accent-500/50 focus:ring-accent-500/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border/80">
                        <SelectItem
                          value="0.04167"
                          className="text-foreground focus:bg-accent-500/20 focus:text-accent-100"
                        >
                          1 hour
                        </SelectItem>
                        <SelectItem
                          value="0.125"
                          className="text-foreground focus:bg-accent-500/20 focus:text-accent-100"
                        >
                          3 hours
                        </SelectItem>
                        <SelectItem
                          value="0.25"
                          className="text-foreground focus:bg-accent-500/20 focus:text-accent-100"
                        >
                          6 hours
                        </SelectItem>
                        <SelectItem
                          value="0.5"
                          className="text-foreground focus:bg-accent-500/20 focus:text-accent-100"
                        >
                          12 hours
                        </SelectItem>
                        <SelectItem
                          value="1"
                          className="text-foreground focus:bg-accent-500/20 focus:text-accent-100"
                        >
                          1 day
                        </SelectItem>
                        <SelectItem
                          value="2"
                          className="text-foreground focus:bg-accent-500/20 focus:text-accent-100"
                        >
                          2 days
                        </SelectItem>
                        <SelectItem
                          value="3"
                          className="text-foreground focus:bg-accent-500/20 focus:text-accent-100"
                        >
                          3 days
                        </SelectItem>
                        <SelectItem
                          value="7"
                          className="text-foreground focus:bg-accent-500/20 focus:text-accent-100"
                        >
                          1 week
                        </SelectItem>
                        <SelectItem
                          value="14"
                          className="text-foreground focus:bg-accent-500/20 focus:text-accent-100"
                        >
                          2 weeks
                        </SelectItem>
                        <SelectItem
                          value="30"
                          className="text-foreground focus:bg-accent-500/20 focus:text-accent-100"
                        >
                          1 month
                        </SelectItem>
                        <SelectItem
                          value="90"
                          className="text-foreground focus:bg-accent-500/20 focus:text-accent-100"
                        >
                          3 months
                        </SelectItem>
                        <SelectItem
                          value="365"
                          className="text-foreground focus:bg-accent-500/20 focus:text-accent-100"
                        >
                          1 year
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground min-w-fit">
                      {localSettings.historyRetentionDays < 1
                        ? `${Math.round(localSettings.historyRetentionDays * 24)}h`
                        : `${localSettings.historyRetentionDays}d`}
                    </span>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* General Tab */}
            <TabsContent
              value="general"
              className="flex-1 overflow-y-auto px-1 space-y-5 mt-4"
            >
              {/* Default Shell / CWD */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-foreground/80 text-sm font-semibold">
                  <div className="w-1 h-4 bg-accent-500 rounded-full"></div>
                  Default Terminal Startup
                </div>
                <div className="grid gap-2.5">
                  <Label className="text-foreground/80 text-sm">
                    Default Shell{" "}
                    <span className="text-muted-foreground/70 font-normal">
                      (leave blank for OS default)
                    </span>
                  </Label>
                  <Input
                    value={localSettings.defaultShell}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        defaultShell: e.target.value,
                      })
                    }
                    placeholder={
                      window.platform?.os === "win32"
                        ? "powershell.exe"
                        : "/bin/zsh"
                    }
                    className="bg-card/50 border-border/80 text-foreground placeholder:text-muted-foreground/70 focus:border-accent-500/50 focus:ring-accent-500/20 font-mono text-sm"
                  />
                </div>
                <div className="grid gap-2.5">
                  <Label className="text-foreground/80 text-sm">
                    Default Working Directory{" "}
                    <span className="text-muted-foreground/70 font-normal">
                      (leave blank for home)
                    </span>
                  </Label>
                  <Input
                    value={localSettings.defaultCwd}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        defaultCwd: e.target.value,
                      })
                    }
                    placeholder="/home/user/projects"
                    className="bg-card/50 border-border/80 text-foreground placeholder:text-muted-foreground/70 focus:border-accent-500/50 focus:ring-accent-500/20 font-mono text-sm"
                  />
                </div>
              </div>

              {/* Keyboard Shortcuts */}
              <div className="space-y-3 pt-3 border-t border-border/60">
                <div className="flex items-center gap-2 text-foreground/80 text-sm font-semibold">
                  <div className="w-1 h-4 bg-accent-500 rounded-full"></div>
                  <Keyboard size={14} />
                  Keyboard Shortcuts
                </div>
                <p className="text-xs text-muted-foreground">
                  Click "Record" then press your desired key combination.
                </p>
                <div className="space-y-2">
                  {(
                    Object.entries(localShortcuts) as [
                      keyof AppShortcuts,
                      ShortcutDef,
                    ][]
                  ).map(([action, shortcut]) => {
                    const labels: Record<keyof AppShortcuts, string> = {
                      newTab: "New Tab",
                      closeTab: "Close Tab",
                      nextTab: "Next Tab",
                      prevTab: "Previous Tab",
                      toggleSidebar: "Toggle AI Sidebar",
                      openHistory: "Open Command History",
                      openWorkspaceSwitcher: "Open Workspace Switcher",
                      openSnippetPalette: "Open Snippet Palette",
                    };
                    const isCapturing = capturingKey === action;
                    return (
                      <div
                        key={action}
                        className="flex items-center gap-2.5 p-2.5 rounded-md bg-card/50 border border-border/80"
                      >
                        <span className="flex-1 text-sm text-foreground/80">
                          {labels[action]}
                        </span>
                        <kbd className="px-2 py-0.5 rounded bg-card border border-border text-xs text-accent-300 font-mono min-w-[90px] text-center">
                          {isCapturing ? (
                            <span className="animate-pulse text-yellow-400">
                              Press keys…
                            </span>
                          ) : (
                            formatShortcut(shortcut)
                          )}
                        </kbd>
                        <button
                          ref={isCapturing ? captureRef : null}
                          type="button"
                          onKeyDown={(e) => {
                            if (!isCapturing) return;
                            e.preventDefault();
                            e.stopPropagation();
                            if (
                              ["Control", "Shift", "Alt", "Meta"].includes(
                                e.key,
                              )
                            )
                              return;
                            setLocalShortcuts({
                              ...localShortcuts,
                              [action]: {
                                key: e.key,
                                ctrl: e.ctrlKey,
                                shift: e.shiftKey,
                                alt: e.altKey,
                              },
                            });
                            setCapturingKey(null);
                          }}
                          onBlur={() => {
                            if (isCapturing) setCapturingKey(null);
                          }}
                          onClick={() => {
                            setCapturingKey(isCapturing ? null : action);
                            setTimeout(() => captureRef.current?.focus(), 10);
                          }}
                          className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors outline-none ${isCapturing
                              ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-300"
                              : "bg-accent border-border/50 text-muted-foreground hover:bg-accent-500/20 hover:text-accent-300 hover:border-accent-500/50"
                            }`}
                        >
                          {isCapturing ? "Cancel" : "Record"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-3 pt-3 border-t border-border/60">
                <div className="flex items-center gap-2 text-foreground/80 text-sm font-semibold">
                  <div className="w-1 h-4 bg-accent-500 rounded-full"></div>
                  Terminal Tags
                </div>
                <p className="text-xs text-muted-foreground">
                  Create custom tags to organize your terminals
                </p>

                <div className="flex gap-2">
                  <Input
                    placeholder="Tag name"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    className="bg-card/50 border-border/80 text-foreground placeholder:text-muted-foreground/70 focus:border-accent-500/50 focus:ring-accent-500/20"
                  />
                  <input
                    type="color"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                    className="w-12 h-9 rounded-md border border-border/80 bg-card/50 cursor-pointer"
                  />
                  <Button
                    onClick={addTag}
                    size="icon"
                    className="bg-card/50 border border-border/80 hover:bg-accent-500/20 hover:text-accent-300 hover:border-accent-500/50 text-muted-foreground"
                  >
                    <Plus size={16} />
                  </Button>
                </div>

                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-accent-600/40 scrollbar-track-transparent">
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center gap-2.5 p-2.5 rounded-md bg-card/50 border border-border/80 hover:border-border transition-colors"
                    >
                      {editingTagId === tag.id ? (
                        <>
                          <Input
                            value={tag.name}
                            onChange={(e) => {
                              setTags(
                                tags.map((t) =>
                                  t.id === tag.id
                                    ? { ...t, name: e.target.value }
                                    : t,
                                ),
                              );
                            }}
                            className="flex-1 h-8 bg-card/50 border-border/80 text-foreground"
                          />
                          <input
                            type="color"
                            value={tag.color}
                            onChange={(e) => {
                              setTags(
                                tags.map((t) =>
                                  t.id === tag.id
                                    ? { ...t, color: e.target.value }
                                    : t,
                                ),
                              );
                            }}
                            className="w-10 h-8 rounded border border-border/80 bg-card/50 cursor-pointer"
                          />
                          <Button
                            onClick={() =>
                              updateTag(tag.id, tag.name, tag.color)
                            }
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-accent-400 hover:text-accent-300 hover:bg-accent-500/20"
                          >
                            <Check size={14} />
                          </Button>
                        </>
                      ) : (
                        <>
                          <div
                            className="w-4 h-4 rounded-full border border-border shrink-0"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="flex-1 text-sm text-foreground">
                            {tag.name}
                          </span>
                          <Button
                            onClick={() => setEditingTagId(tag.id)}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-accent-300 hover:bg-accent-500/20"
                          >
                            <Edit2 size={14} />
                          </Button>
                          <Button
                            onClick={() => deleteTag(tag.id)}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-500/20"
                          >
                            <X size={14} />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Vault Tab */}
            <TabsContent
              value="vault"
              className="flex-1 overflow-y-auto px-1 mt-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-foreground/80 text-sm font-semibold">
                      Credential Vault
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Save username/password pairs to reuse across SSH
                      connections
                    </p>
                  </div>
                  <Button
                    onClick={openAddVault}
                    size="sm"
                    className="gap-1.5 bg-card/50 border border-border/80 hover:bg-accent-500/20 hover:text-accent-300 hover:border-accent-500/50 text-muted-foreground"
                  >
                    <Plus size={14} />
                    Add
                  </Button>
                </div>

                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-accent-600/40 scrollbar-track-transparent">
                  {vaultCredentials.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <Vault size={32} className="text-muted-foreground/60 mb-3" />
                      <p className="text-sm text-muted-foreground/70">
                        No credentials saved yet
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        Click "Add" to store your first credential
                      </p>
                    </div>
                  )}
                  {vaultCredentials.map((cred) => (
                    <div
                      key={cred.id}
                      className="flex items-center gap-2.5 p-2.5 rounded-md bg-card/50 border border-border/80 hover:border-border transition-colors"
                    >
                      <Vault
                        size={14}
                        className="text-accent-500/70 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-foreground truncate">
                          {cred.name}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground/70">
                          <User size={10} />
                          {cred.username}
                          {cred.hasPassword && (
                            <>
                              <KeyRound size={10} className="ml-1" />
                              <span>password saved</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={() => openEditVault(cred)}
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-accent-300 hover:bg-accent-500/20"
                      >
                        <Edit2 size={14} />
                      </Button>
                      <Button
                        onClick={() => handleVaultDelete(cred.id)}
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-500/20"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
            {/* SSH Keys Tab */}
            <TabsContent value="keys" className="flex-1 overflow-y-auto px-1 mt-4">
              <SSHKeysPanel />
            </TabsContent>

            {/* Env Vault Tab */}
            <TabsContent value="env" className="flex-1 overflow-y-auto px-1 mt-4">
              <EnvVaultPanel />
            </TabsContent>

            <TabsContent value="recordings" className="flex-1 overflow-y-auto px-1 mt-4">
              <RecordingsPanel />
            </TabsContent>
            <TabsContent value="alerts" className="flex-1 overflow-y-auto px-1 mt-4">
              <AlertsPanel />
            </TabsContent>
            <TabsContent value="audit" className="flex-1 overflow-y-auto px-1 mt-4">
              <AuditPanel />
            </TabsContent>
            <TabsContent value="workspaces" className="flex-1 overflow-y-auto px-1 mt-4">
              <WorkspacesPanel />
            </TabsContent>
            <TabsContent value="workspace-identity" className="flex-1 overflow-y-auto px-1 mt-4">
              <WorkspaceIdentityPanel />
            </TabsContent>
            <TabsContent value="guardrails" className="flex-1 overflow-y-auto px-1 mt-4">
              <GuardrailsPanel />
            </TabsContent>

            {/* About Tab */}
            <TabsContent value="about" className="flex-1 overflow-y-auto px-1 mt-4">
              <div className="space-y-6">
                <div className="space-y-1">
                  <p className="text-foreground/80 text-sm font-semibold">About calico-term</p>
                  <p className="text-xs text-muted-foreground">Check for updates and manage the application version.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-card/50 border border-border/80 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Current version</p>
                    <p className="text-sm font-mono text-foreground">{currentVersion}</p>
                  </div>
                  <div className="bg-card/50 border border-border/80 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Latest version</p>
                    <p className="text-sm font-mono text-foreground">
                      {updaterStatus === "checking" && <span className="text-muted-foreground">Checking...</span>}
                      {updaterStatus === "idle" && <span className="text-muted-foreground/70">—</span>}
                      {updaterStatus === "up-to-date" && <span className="text-green-400">{currentVersion}</span>}
                      {(updaterStatus === "available" || updaterStatus === "downloading" || updaterStatus === "downloaded") && (
                        <span className="text-accent-400">{updaterVersion}</span>
                      )}
                      {updaterStatus === "error" && <span className="text-red-400">Error</span>}
                    </p>
                  </div>
                </div>

                {updaterStatus === "up-to-date" && (
                  <div className="flex items-center gap-2 text-green-400 text-sm bg-green-400/10 border border-green-400/20 rounded-lg px-3 py-2">
                    <CheckCircle2 size={14} />
                    You are on the latest version.
                  </div>
                )}

                {updaterStatus === "available" && (
                  <div className="flex items-center gap-2 text-accent-400 text-sm bg-accent-500/10 border border-accent-500/20 rounded-lg px-3 py-2">
                    <Download size={14} />
                    Version {updaterVersion} is available.
                  </div>
                )}

                {updaterStatus === "downloading" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Downloading update...</span>
                      <span>{updaterProgress}%</span>
                    </div>
                    <div className="h-1.5 bg-accent rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent-500 rounded-full transition-all duration-300"
                        style={{ width: `${updaterProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {updaterStatus === "downloaded" && (
                  <div className="flex items-center gap-2 text-green-400 text-sm bg-green-400/10 border border-green-400/20 rounded-lg px-3 py-2">
                    <CheckCircle2 size={14} />
                    Update downloaded. Restart to install version {updaterVersion}.
                  </div>
                )}

                {updaterStatus === "error" && (
                  <div className="flex items-start gap-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                    <XCircle size={14} className="mt-0.5 shrink-0" />
                    <span className="break-all">{updaterError}</span>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  {(updaterStatus === "idle" || updaterStatus === "up-to-date" || updaterStatus === "error") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCheckUpdates}
                      className="bg-card/50 border-border/80 hover:bg-accent text-foreground/80 flex items-center gap-1.5"
                    >
                      <RefreshCw size={13} />
                      Check for updates
                    </Button>
                  )}
                  {updaterStatus === "checking" && (
                    <Button variant="outline" size="sm" disabled className="bg-card/50 border-border/80 text-muted-foreground/70 flex items-center gap-1.5">
                      <Loader2 size={13} className="animate-spin" />
                      Checking...
                    </Button>
                  )}
                  {updaterStatus === "available" && (
                    <Button
                      size="sm"
                      onClick={handleDownloadUpdate}
                      className="bg-accent-500/90 hover:bg-accent-500 text-white flex items-center gap-1.5"
                    >
                      <Download size={13} />
                      Download update
                    </Button>
                  )}
                  {updaterStatus === "downloaded" && (
                    <Button
                      size="sm"
                      onClick={handleInstallUpdate}
                      className="bg-green-600/90 hover:bg-green-600 text-white flex items-center gap-1.5"
                    >
                      <RotateCcw size={13} />
                      Restart and install
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="border-t border-border/60 pt-4 gap-2 shrink-0">
            <DialogClose asChild>
              <Button
                variant="outline"
                className="bg-card/50 border-border/80 hover:bg-accent text-foreground/80"
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              onClick={handleSave}
              className="bg-accent-500/90 hover:bg-accent-500 text-white shadow-sm"
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vault credential add/edit dialog */}
      <Dialog open={vaultDialogOpen} onOpenChange={setVaultDialogOpen}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border/60 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Vault size={16} className="text-accent-400" />
              {editingCredentialId ? "Edit Credential" : "New Credential"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label className="text-foreground/80 text-sm">
                Name <span className="text-red-400">*</span>
              </Label>
              <Input
                placeholder="e.g. Work Admin"
                value={vaultForm.name}
                onChange={(e) =>
                  setVaultForm((p) => ({ ...p, name: e.target.value }))
                }
                className="bg-card/50 border-border text-foreground placeholder:text-muted-foreground/70"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-foreground/80 text-sm">
                Username <span className="text-red-400">*</span>
              </Label>
              <Input
                placeholder="root"
                value={vaultForm.username}
                onChange={(e) =>
                  setVaultForm((p) => ({ ...p, username: e.target.value }))
                }
                className="bg-card/50 border-border text-foreground placeholder:text-muted-foreground/70"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-foreground/80 text-sm">
                Password{" "}
                {editingCredentialId && (
                  <span className="text-muted-foreground/70 font-normal">
                    (leave blank to keep current)
                  </span>
                )}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type={showVaultPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder={
                    editingCredentialId ? "Saved password" : "Enter password"
                  }
                  value={vaultForm.password}
                  onChange={(e) =>
                    setVaultForm((p) => ({ ...p, password: e.target.value }))
                  }
                  className="bg-card/50 border-border text-foreground placeholder:text-muted-foreground/70"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowVaultPassword((v) => !v)}
                  className="bg-card/50 border-border/80 hover:bg-accent-500/20 hover:text-accent-300 hover:border-accent-500/50"
                >
                  {showVaultPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setVaultDialogOpen(false)}
              className="border-border text-foreground/80 hover:bg-card"
            >
              Cancel
            </Button>
            <Button
              onClick={handleVaultSave}
              disabled={!vaultForm.name.trim() || !vaultForm.username.trim()}
              className="bg-accent-600 hover:bg-accent-500 text-white disabled:opacity-50"
            >
              {editingCredentialId ? "Save Changes" : "Add Credential"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
