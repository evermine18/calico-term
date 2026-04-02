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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@renderer/components/ui/tabs";
import { Input } from "@renderer/components/ui/input";
import { Label } from "@renderer/components/ui/label";
import { ModelsSelector } from "./model-combobox";
import { useAppContext } from "@renderer/contexts/app-context";
import { useState, useEffect } from "react";
import { Eye, EyeOff, Plus, X, Edit2, Check, Vault, User, KeyRound, Bot, Tag, ShieldCheck, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface Tag {
  id: string;
  name: string;
  color: string;
}

const TAGS_STORAGE_KEY = 'calico-term-tags';

type VaultFormData = {
  name: string;
  username: string;
  password: string;
};

const EMPTY_VAULT_FORM: VaultFormData = { name: "", username: "", password: "" };

export default function SettingsDialog({ children }) {
  const {
    apiUrl,
    setApiUrl,
    apiKey,
    setApiKey,
    selectedModel,
    setSelectedModel,
    historyRetentionDays,
    setHistoryRetentionDays,
    vaultCredentials,
    addVaultCredential,
    updateVaultCredential,
    deleteVaultCredential,
  } = useAppContext();
  const [localSettings, setLocalSettings] = useState({
    apiUrl: apiUrl || "",
    apiKey: apiKey || "",
    selectedModel: selectedModel || "",
    historyRetentionDays: historyRetentionDays || 1,
  });
  const [open, setOpen] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiStatus, setApiStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [apiError, setApiError] = useState<string>("");
  const [tags, setTags] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#06b6d4");
  const [editingTagId, setEditingTagId] = useState<string | null>(null);

  // Vault credential state
  const [vaultDialogOpen, setVaultDialogOpen] = useState(false);
  const [editingCredentialId, setEditingCredentialId] = useState<string | null>(null);
  const [vaultForm, setVaultForm] = useState<VaultFormData>(EMPTY_VAULT_FORM);
  const [showVaultPassword, setShowVaultPassword] = useState(false);

  // Load tags from localStorage
  useEffect(() => {
    const storedTags = localStorage.getItem(TAGS_STORAGE_KEY);
    if (storedTags) {
      setTags(JSON.parse(storedTags));
    }
  }, [open]);

  const saveTags = (updatedTags: Tag[]) => {
    localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(updatedTags));
    setTags(updatedTags);
    window.dispatchEvent(new Event('tags-updated'));
  };

  const addTag = () => {
    if (!newTagName.trim()) return;
    const newTag: Tag = {
      id: crypto.randomUUID(),
      name: newTagName.trim(),
      color: newTagColor,
    };
    saveTags([...tags, newTag]);
    setNewTagName("");
    setNewTagColor("#06b6d4");
  };

  const updateTag = (id: string, name: string, color: string) => {
    saveTags(tags.map(tag => tag.id === id ? { ...tag, name, color } : tag));
    setEditingTagId(null);
  };

  const deleteTag = (id: string) => {
    saveTags(tags.filter(tag => tag.id !== id));
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

    const existing = isEdit ? vaultCredentials.find((c) => c.id === credId) : null;
    const hasPassword = vaultForm.password ? true : (existing?.hasPassword ?? false);

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
      await window.electron.ipcRenderer.invoke("vault-password-set", credId, vaultForm.password);
    }

    setVaultDialogOpen(false);
  };

  const handleVaultDelete = (credId: string) => {
    deleteVaultCredential(credId);
    window.electron.ipcRenderer.send("vault-password-delete", credId);
  };

  const handleSave = () => {
    setApiUrl(localSettings.apiUrl);
    setApiKey(localSettings.apiKey);
    setSelectedModel(localSettings.selectedModel);
    setHistoryRetentionDays(localSettings.historyRetentionDays);
    setOpen(false);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden bg-slate-900 border-slate-700/40 shadow-xl flex flex-col">
        <DialogHeader className="border-b border-slate-700/40 pb-4 shrink-0">
          <DialogTitle className="text-gray-100 flex items-center gap-2">
            <div className="w-8 h-8 bg-cyan-500/20 border border-cyan-500/30 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </div>
            Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="ai" className="flex flex-col flex-1 min-h-0">
          <TabsList className="shrink-0 w-full justify-start bg-slate-800/40 border border-slate-700/40 rounded-lg p-1">
            <TabsTrigger value="ai" className="flex items-center gap-1.5">
              <Bot size={14} />
              AI
            </TabsTrigger>
            <TabsTrigger value="terminal" className="flex items-center gap-1.5">
              <Tag size={14} />
              Terminal
            </TabsTrigger>
            <TabsTrigger value="vault" className="flex items-center gap-1.5">
              <ShieldCheck size={14} />
              Vault
            </TabsTrigger>
          </TabsList>

          {/* AI Tab */}
          <TabsContent value="ai" className="flex-1 overflow-y-auto px-1 space-y-5 mt-4">
            <div className="grid gap-2.5">
              <Label htmlFor="api-url" className="text-gray-300 text-sm">Base API URL</Label>
              <Input
                id="api-url"
                name="Api Url"
                defaultValue={localSettings.apiUrl}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, apiUrl: e.target.value })
                }
                className="bg-slate-800/60 border-slate-700/50 text-gray-100 focus:border-cyan-500/50 focus:ring-cyan-500/20"
              />
            </div>

            <div className="grid gap-2.5">
              <Label htmlFor="api-key" className="text-gray-300 text-sm">API Key</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="api-key"
                  name="Api Key"
                  type={showApiKey ? "text" : "password"}
                  defaultValue={localSettings.apiKey}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, apiKey: e.target.value })
                  }
                  className="bg-slate-800/60 border-slate-700/50 text-gray-100 focus:border-cyan-500/50 focus:ring-cyan-500/20"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="bg-slate-800/60 border-slate-700/50 hover:bg-cyan-500/20 hover:text-cyan-300 hover:border-cyan-500/50"
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
            </div>

            {/* Connection status */}
            {apiStatus !== "idle" && (
              <div className={`flex items-start gap-2 rounded-md px-3 py-2 text-xs border ${
                apiStatus === "loading"
                  ? "bg-slate-800/40 border-slate-700/40 text-gray-400"
                  : apiStatus === "success"
                    ? "bg-green-500/10 border-green-500/20 text-green-400"
                    : "bg-red-500/10 border-red-500/20 text-red-400"
              }`}>
                {apiStatus === "loading" && <Loader2 size={13} className="animate-spin mt-px shrink-0" />}
                {apiStatus === "success" && <CheckCircle2 size={13} className="mt-px shrink-0" />}
                {apiStatus === "error" && <XCircle size={13} className="mt-px shrink-0" />}
                <span className="break-all">
                  {apiStatus === "loading" && "Checking connection…"}
                  {apiStatus === "success" && "Connection successful"}
                  {apiStatus === "error" && (apiError.includes("401") || apiError.includes("403")
                    ? "Invalid API key or unauthorized"
                    : apiError.includes("ECONNREFUSED") || apiError.includes("ENOTFOUND") || apiError.includes("fetch")
                      ? "Could not reach the API URL"
                      : apiError || "Connection failed"
                  )}
                </span>
              </div>
            )}

            <div className="grid gap-2.5">
              <Label htmlFor="model" className="text-gray-300 text-sm">Model</Label>
              <ModelsSelector
                url={localSettings.apiUrl}
                apiKey={localSettings.apiKey}
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
          </TabsContent>

          {/* Terminal Tab */}
          <TabsContent value="terminal" className="flex-1 overflow-y-auto px-1 space-y-5 mt-4">
            {/* Command History */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-gray-300 text-sm font-semibold">
                <div className="w-1 h-4 bg-cyan-500 rounded-full"></div>
                Command History
              </div>
              <div className="grid gap-2.5">
                <Label htmlFor="retention-days" className="text-gray-300 text-sm">
                  History Retention Period
                </Label>
                <p className="text-xs text-gray-400">
                  Commands older than this period will be automatically deleted (pinned commands are kept forever)
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
                    <SelectTrigger className="flex-1 bg-slate-800/60 border-slate-700/50 text-gray-100 hover:bg-slate-800 focus:border-cyan-500/50 focus:ring-cyan-500/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700/50">
                      <SelectItem value="0.04167" className="text-gray-100 focus:bg-cyan-500/20 focus:text-cyan-100">1 hour</SelectItem>
                      <SelectItem value="0.125" className="text-gray-100 focus:bg-cyan-500/20 focus:text-cyan-100">3 hours</SelectItem>
                      <SelectItem value="0.25" className="text-gray-100 focus:bg-cyan-500/20 focus:text-cyan-100">6 hours</SelectItem>
                      <SelectItem value="0.5" className="text-gray-100 focus:bg-cyan-500/20 focus:text-cyan-100">12 hours</SelectItem>
                      <SelectItem value="1" className="text-gray-100 focus:bg-cyan-500/20 focus:text-cyan-100">1 day</SelectItem>
                      <SelectItem value="2" className="text-gray-100 focus:bg-cyan-500/20 focus:text-cyan-100">2 days</SelectItem>
                      <SelectItem value="3" className="text-gray-100 focus:bg-cyan-500/20 focus:text-cyan-100">3 days</SelectItem>
                      <SelectItem value="7" className="text-gray-100 focus:bg-cyan-500/20 focus:text-cyan-100">1 week</SelectItem>
                      <SelectItem value="14" className="text-gray-100 focus:bg-cyan-500/20 focus:text-cyan-100">2 weeks</SelectItem>
                      <SelectItem value="30" className="text-gray-100 focus:bg-cyan-500/20 focus:text-cyan-100">1 month</SelectItem>
                      <SelectItem value="90" className="text-gray-100 focus:bg-cyan-500/20 focus:text-cyan-100">3 months</SelectItem>
                      <SelectItem value="365" className="text-gray-100 focus:bg-cyan-500/20 focus:text-cyan-100">1 year</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-gray-400 min-w-fit">
                    {localSettings.historyRetentionDays < 1
                      ? `${Math.round(localSettings.historyRetentionDays * 24)}h`
                      : `${localSettings.historyRetentionDays}d`}
                  </span>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-3 pt-3 border-t border-slate-700/40">
              <div className="flex items-center gap-2 text-gray-300 text-sm font-semibold">
                <div className="w-1 h-4 bg-cyan-500 rounded-full"></div>
                Terminal Tags
              </div>
              <p className="text-xs text-gray-400">Create custom tags to organize your terminals</p>

              <div className="flex gap-2">
                <Input
                  placeholder="Tag name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); addTag(); }
                  }}
                  className="bg-slate-800/60 border-slate-700/50 text-gray-100 placeholder:text-gray-500 focus:border-cyan-500/50 focus:ring-cyan-500/20"
                />
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="w-12 h-9 rounded-md border border-slate-700/50 bg-slate-800/60 cursor-pointer"
                />
                <Button
                  onClick={addTag}
                  size="icon"
                  className="bg-slate-800/60 border border-slate-700/50 hover:bg-cyan-500/20 hover:text-cyan-300 hover:border-cyan-500/50 text-gray-400"
                >
                  <Plus size={16} />
                </Button>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-cyan-600/40 scrollbar-track-transparent">
                {tags.map(tag => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-2.5 p-2.5 rounded-md bg-slate-800/60 border border-slate-700/50 hover:border-slate-600/60 transition-colors"
                  >
                    {editingTagId === tag.id ? (
                      <>
                        <Input
                          value={tag.name}
                          onChange={(e) => {
                            setTags(tags.map(t => t.id === tag.id ? { ...t, name: e.target.value } : t));
                          }}
                          className="flex-1 h-8 bg-slate-900/60 border-slate-700/50 text-gray-100"
                        />
                        <input
                          type="color"
                          value={tag.color}
                          onChange={(e) => {
                            setTags(tags.map(t => t.id === tag.id ? { ...t, color: e.target.value } : t));
                          }}
                          className="w-10 h-8 rounded border border-slate-700/50 bg-slate-900/60 cursor-pointer"
                        />
                        <Button
                          onClick={() => updateTag(tag.id, tag.name, tag.color)}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20"
                        >
                          <Check size={14} />
                        </Button>
                      </>
                    ) : (
                      <>
                        <div
                          className="w-4 h-4 rounded-full border border-slate-600/60 shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="flex-1 text-sm text-gray-200">{tag.name}</span>
                        <Button
                          onClick={() => setEditingTagId(tag.id)}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-cyan-300 hover:bg-cyan-500/20"
                        >
                          <Edit2 size={14} />
                        </Button>
                        <Button
                          onClick={() => deleteTag(tag.id)}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-red-400 hover:bg-red-500/20"
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
          <TabsContent value="vault" className="flex-1 overflow-y-auto px-1 mt-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-300 text-sm font-semibold">Credential Vault</p>
                  <p className="text-xs text-gray-400 mt-0.5">Save username/password pairs to reuse across SSH connections</p>
                </div>
                <Button
                  onClick={openAddVault}
                  size="sm"
                  className="gap-1.5 bg-slate-800/60 border border-slate-700/50 hover:bg-cyan-500/20 hover:text-cyan-300 hover:border-cyan-500/50 text-gray-400"
                >
                  <Plus size={14} />
                  Add
                </Button>
              </div>

              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-cyan-600/40 scrollbar-track-transparent">
                {vaultCredentials.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Vault size={32} className="text-slate-600 mb-3" />
                    <p className="text-sm text-gray-500">No credentials saved yet</p>
                    <p className="text-xs text-gray-600 mt-1">Click "Add" to store your first credential</p>
                  </div>
                )}
                {vaultCredentials.map((cred) => (
                  <div
                    key={cred.id}
                    className="flex items-center gap-2.5 p-2.5 rounded-md bg-slate-800/60 border border-slate-700/50 hover:border-slate-600/60 transition-colors"
                  >
                    <Vault size={14} className="text-cyan-500/70 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-200 truncate">{cred.name}</div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
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
                      className="h-8 w-8 text-gray-400 hover:text-cyan-300 hover:bg-cyan-500/20"
                    >
                      <Edit2 size={14} />
                    </Button>
                    <Button
                      onClick={() => handleVaultDelete(cred.id)}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-400 hover:text-red-400 hover:bg-red-500/20"
                    >
                      <X size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="border-t border-slate-700/40 pt-4 gap-2 shrink-0">
          <DialogClose asChild>
            <Button variant="outline" className="bg-slate-800/60 border-slate-700/50 hover:bg-slate-700/60 text-gray-300">
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleSave}
            className="bg-cyan-500/90 hover:bg-cyan-500 text-white shadow-sm"
          >
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Vault credential add/edit dialog */}
    <Dialog open={vaultDialogOpen} onOpenChange={setVaultDialogOpen}>
      <DialogContent className="sm:max-w-[400px] bg-slate-900 border-slate-700/40 shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-gray-100 flex items-center gap-2">
            <Vault size={16} className="text-cyan-400" />
            {editingCredentialId ? "Edit Credential" : "New Credential"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label className="text-gray-300 text-sm">Name <span className="text-red-400">*</span></Label>
            <Input
              placeholder="e.g. Work Admin"
              value={vaultForm.name}
              onChange={(e) => setVaultForm((p) => ({ ...p, name: e.target.value }))}
              className="bg-slate-800/60 border-slate-700 text-gray-100 placeholder:text-gray-500"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-gray-300 text-sm">Username <span className="text-red-400">*</span></Label>
            <Input
              placeholder="root"
              value={vaultForm.username}
              onChange={(e) => setVaultForm((p) => ({ ...p, username: e.target.value }))}
              className="bg-slate-800/60 border-slate-700 text-gray-100 placeholder:text-gray-500"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-gray-300 text-sm">
              Password{" "}
              {editingCredentialId && (
                <span className="text-gray-500 font-normal">(leave blank to keep current)</span>
              )}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type={showVaultPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder={editingCredentialId ? "Saved password" : "Enter password"}
                value={vaultForm.password}
                onChange={(e) => setVaultForm((p) => ({ ...p, password: e.target.value }))}
                className="bg-slate-800/60 border-slate-700 text-gray-100 placeholder:text-gray-500"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowVaultPassword((v) => !v)}
                className="bg-slate-800/60 border-slate-700/50 hover:bg-cyan-500/20 hover:text-cyan-300 hover:border-cyan-500/50"
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
            className="border-slate-700 text-gray-300 hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleVaultSave}
            disabled={!vaultForm.name.trim() || !vaultForm.username.trim()}
            className="bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50"
          >
            {editingCredentialId ? "Save Changes" : "Add Credential"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
