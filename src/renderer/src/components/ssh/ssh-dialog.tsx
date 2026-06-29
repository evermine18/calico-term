import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@renderer/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@renderer/components/ui/select";
import { Input } from "@renderer/components/ui/input";
import { Label } from "@renderer/components/ui/label";
import { Button } from "@renderer/components/ui/button";
import { useAppContext } from "@renderer/contexts/app-context";
import { useTags } from "@renderer/hooks/useTags";
import {
  KeyRound,
  ShieldAlert,
  Tag,
  Check,
  Vault,
  Network,
  X,
  Download,
  Boxes,
} from "lucide-react";

type SecretProviderId = "op" | "bw" | "vault" | "aws";

type SSHFormData = {
  name: string;
  host: string;
  port: string;
  username: string;
  identityFile: string;
  identityKeyId: string;
  password: string;
  confirmPassword: string;
  credentialId: string;
  tags: string[];
  jumpHostIds: string[];
  passwordRefProvider: "" | SecretProviderId;
  passwordRefRef: string;
};

const EMPTY_FORM: SSHFormData = {
  name: "",
  host: "",
  port: "22",
  username: "",
  identityFile: "",
  identityKeyId: "",
  password: "",
  confirmPassword: "",
  credentialId: "",
  tags: [],
  jumpHostIds: [],
  passwordRefProvider: "",
  passwordRefRef: "",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editConnection?: SSHConnectionEntry | null;
};

export default function SSHDialog({
  open,
  onOpenChange,
  editConnection,
}: Props) {
  const {
    addSSHConnection,
    updateSSHConnection,
    vaultCredentials,
    sshConnections,
  } = useAppContext();
  const customTags = useTags();
  const [form, setForm] = useState<SSHFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<SSHFormData>>({});
  const [keys, setKeys] = useState<SSHKeyMetadata[]>([]);
  const [configHosts, setConfigHosts] = useState<SSHConfigHost[]>([]);
  const [secretTestState, setSecretTestState] = useState<
    "idle" | "ok" | "error"
  >("idle");
  const [secretTestMessage, setSecretTestMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    window.api.sshKeys.list().then(setKeys).catch(() => setKeys([]));
    window.api.sshConfig.list().then(setConfigHosts).catch(() => setConfigHosts([]));
  }, [open]);

  useEffect(() => {
    if (open) {
      if (editConnection) {
        setForm({
          name: editConnection.name,
          host: editConnection.host,
          port: String(editConnection.port),
          username: editConnection.username,
          identityFile: editConnection.identityFile ?? "",
          identityKeyId: editConnection.identityKeyId ?? "",
          password: "",
          confirmPassword: "",
          credentialId: editConnection.credentialId ?? "",
          tags: editConnection.tags ?? [],
          jumpHostIds: editConnection.jumpHostIds ?? [],
          passwordRefProvider: editConnection.passwordRef?.provider ?? "",
          passwordRefRef: editConnection.passwordRef?.ref ?? "",
        });
      } else {
        setForm(EMPTY_FORM);
      }
      setErrors({});
      setSecretTestState("idle");
    }
  }, [open, editConnection]);

  const validate = (): boolean => {
    const errs: Partial<SSHFormData> = {};
    if (!form.name.trim()) errs.name = "Required";
    if (!form.host.trim()) errs.host = "Required";
    if (!form.username.trim()) errs.username = "Required";
    const portNum = parseInt(form.port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535)
      errs.port = "Must be 1-65535";
    if (form.password && form.password !== form.confirmPassword)
      errs.confirmPassword = "Passwords do not match";
    if (form.passwordRefProvider && !form.passwordRefRef.trim())
      errs.passwordRefRef = "Required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const isEdit = !!editConnection;
    const connId = isEdit ? editConnection!.id : crypto.randomUUID();
    const usingVault = !!form.credentialId;
    const usingSecretRef = !!form.passwordRefProvider;

    let hasPassword: boolean;
    if (usingVault || usingSecretRef) {
      hasPassword = false;
    } else if (isEdit) {
      hasPassword = form.password
        ? true
        : (editConnection!.hasPassword ?? false);
    } else {
      hasPassword = !!form.password;
    }

    const conn: SSHConnectionEntry = {
      id: connId,
      name: form.name.trim(),
      host: form.host.trim(),
      port: parseInt(form.port, 10),
      username: form.username.trim(),
      identityFile: form.identityFile.trim() || undefined,
      identityKeyId: form.identityKeyId || undefined,
      hasPassword,
      credentialId: form.credentialId || undefined,
      passwordRef: usingSecretRef
        ? {
            provider: form.passwordRefProvider as SecretProviderId,
            ref: form.passwordRefRef.trim(),
          }
        : undefined,
      tags: form.tags,
      jumpHostIds: form.jumpHostIds.length > 0 ? form.jumpHostIds : undefined,
    };

    if (isEdit) {
      updateSSHConnection(conn);
    } else {
      addSSHConnection(conn);
    }

    if (!usingVault && !usingSecretRef && form.password) {
      await window.electron.ipcRenderer.invoke(
        "ssh-password-set",
        connId,
        form.password,
      );
    }

    onOpenChange(false);
  };

  const set = (field: keyof Omit<SSHFormData, "tags" | "jumpHostIds">) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

  const toggleTag = (tagId: string) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tagId)
        ? prev.tags.filter((t) => t !== tagId)
        : [...prev.tags, tagId],
    }));
  };

  const addJumpHost = (id: string) => {
    if (!id || form.jumpHostIds.includes(id) || id === editConnection?.id)
      return;
    setForm((prev) => ({
      ...prev,
      jumpHostIds: [...prev.jumpHostIds, id],
    }));
  };

  const removeJumpHost = (id: string) => {
    setForm((prev) => ({
      ...prev,
      jumpHostIds: prev.jumpHostIds.filter((j) => j !== id),
    }));
  };

  const importFromConfig = (alias: string) => {
    const h = configHosts.find((c) => c.alias === alias);
    if (!h) return;
    setForm((prev) => ({
      ...prev,
      name: prev.name || h.alias,
      host: h.host,
      port: String(h.port),
      username: h.user ?? prev.username,
      identityFile: h.identityFile ?? prev.identityFile,
    }));
  };

  const testSecret = async () => {
    if (!form.passwordRefProvider || !form.passwordRefRef.trim()) return;
    setSecretTestState("idle");
    const res = await window.api.secrets.test(
      form.passwordRefProvider as SecretProviderId,
      form.passwordRefRef.trim(),
    );
    if (res.ok && res.hasValue) {
      setSecretTestState("ok");
      setSecretTestMessage("Secret resolved successfully");
    } else {
      setSecretTestState("error");
      setSecretTestMessage(res.error ?? "Resolved an empty value");
    }
  };

  const availableJumpCandidates = sshConnections.filter(
    (c) => c.id !== editConnection?.id && !form.jumpHostIds.includes(c.id),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-panel border-hairline max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-ink">
            {editConnection ? "Edit SSH Connection" : "New SSH Connection"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Import from ~/.ssh/config */}
          {!editConnection && configHosts.length > 0 && (
            <div className="grid gap-1.5">
              <Label className="text-ink-muted text-sm flex items-center gap-1.5">
                <Download size={12} className="text-ink-subtle" />
                Import from ~/.ssh/config
              </Label>
              <Select value="" onValueChange={importFromConfig}>
                <SelectTrigger className="bg-elevated/60 border-hairline text-ink">
                  <SelectValue placeholder="Pick a host to pre-fill the form" />
                </SelectTrigger>
                <SelectContent className="bg-panel border-hairline/50 max-h-60">
                  {configHosts.map((h) => (
                    <SelectItem key={h.alias} value={h.alias}>
                      {h.alias} — {h.user ?? "?"}@{h.host}
                      {h.port !== 22 ? `:${h.port}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Name */}
          <div className="grid gap-1.5">
            <Label htmlFor="ssh-name" className="text-ink-muted text-sm">
              Name <span className="text-danger">*</span>
            </Label>
            <Input
              id="ssh-name"
              placeholder="My Server"
              value={form.name}
              onChange={set("name")}
              className="bg-elevated/60 border-hairline text-ink placeholder:text-ink-subtle"
            />
            {errors.name && (
              <p className="text-danger text-xs">{errors.name}</p>
            )}
          </div>

          {/* Host */}
          <div className="grid gap-1.5">
            <Label htmlFor="ssh-host" className="text-ink-muted text-sm">
              Hostname / IP <span className="text-danger">*</span>
            </Label>
            <Input
              id="ssh-host"
              placeholder="192.168.1.1"
              value={form.host}
              onChange={set("host")}
              className="bg-elevated/60 border-hairline text-ink placeholder:text-ink-subtle"
            />
            {errors.host && (
              <p className="text-danger text-xs">{errors.host}</p>
            )}
          </div>

          {/* Username + Port */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="ssh-user" className="text-ink-muted text-sm">
                Username <span className="text-danger">*</span>
              </Label>
              <Input
                id="ssh-user"
                placeholder="root"
                value={form.username}
                onChange={set("username")}
                className="bg-elevated/60 border-hairline text-ink placeholder:text-ink-subtle"
              />
              {errors.username && (
                <p className="text-danger text-xs">{errors.username}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ssh-port" className="text-ink-muted text-sm">
                Port <span className="text-danger">*</span>
              </Label>
              <Input
                id="ssh-port"
                placeholder="22"
                value={form.port}
                onChange={set("port")}
                className="bg-elevated/60 border-hairline text-ink placeholder:text-ink-subtle"
              />
              {errors.port && (
                <p className="text-danger text-xs">{errors.port}</p>
              )}
            </div>
          </div>

          {/* Managed key selector */}
          {keys.length > 0 && (
            <div className="grid gap-1.5">
              <Label className="text-ink-muted text-sm flex items-center gap-1.5">
                <KeyRound size={12} className="text-ink-subtle" />
                Managed Key{" "}
                <span className="text-ink-subtle font-normal">(optional)</span>
              </Label>
              <Select
                value={form.identityKeyId || "none"}
                onValueChange={(val) =>
                  setForm((prev) => ({
                    ...prev,
                    identityKeyId: val === "none" ? "" : val,
                  }))
                }
              >
                <SelectTrigger className="bg-elevated/60 border-hairline text-ink">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent className="bg-panel border-hairline/50">
                  <SelectItem value="none">None</SelectItem>
                  {keys.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.name} ({k.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Identity File (legacy path) */}
          <div className="grid gap-1.5">
            <Label htmlFor="ssh-identity" className="text-ink-muted text-sm">
              Identity File{" "}
              <span className="text-ink-subtle font-normal">(optional)</span>
            </Label>
            <Input
              id="ssh-identity"
              placeholder="~/.ssh/id_rsa"
              value={form.identityFile}
              onChange={set("identityFile")}
              className="bg-elevated/60 border-hairline text-ink placeholder:text-ink-subtle"
            />
          </div>

          {/* Jump hosts */}
          <div className="grid gap-1.5">
            <Label className="text-ink-muted text-sm flex items-center gap-1.5">
              <Network size={12} className="text-ink-subtle" />
              Jump Hosts (ProxyJump){" "}
              <span className="text-ink-subtle font-normal">(optional)</span>
            </Label>
            {form.jumpHostIds.length > 0 && (
              <div className="flex flex-col gap-1">
                {form.jumpHostIds.map((id, idx) => {
                  const j = sshConnections.find((c) => c.id === id);
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-elevated/60 border border-hairline/50 text-xs"
                    >
                      <span className="text-ink-subtle">{idx + 1}.</span>
                      <span className="flex-1 text-ink-muted truncate">
                        {j ? `${j.name} (${j.username}@${j.host})` : id}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeJumpHost(id)}
                        className="text-ink-subtle hover:text-danger"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {availableJumpCandidates.length > 0 && (
              <Select value="" onValueChange={addJumpHost}>
                <SelectTrigger className="bg-elevated/60 border-hairline text-ink">
                  <SelectValue placeholder="Add a jump host…" />
                </SelectTrigger>
                <SelectContent className="bg-panel border-hairline/50">
                  {availableJumpCandidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.username}@{c.host})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Vault Credential Selector */}
          {vaultCredentials.length > 0 && (
            <div className="grid gap-1.5">
              <Label className="text-ink-muted text-sm flex items-center gap-1.5">
                <Vault size={12} className="text-ink-subtle" />
                Vault Credential{" "}
                <span className="text-ink-subtle font-normal">(optional)</span>
              </Label>
              <Select
                value={form.credentialId || "none"}
                onValueChange={(val) =>
                  setForm((prev) => ({
                    ...prev,
                    credentialId: val === "none" ? "" : val,
                    username:
                      val !== "none"
                        ? (vaultCredentials.find((c) => c.id === val)
                            ?.username ?? prev.username)
                        : prev.username,
                  }))
                }
              >
                <SelectTrigger className="bg-elevated/60 border-hairline text-ink">
                  <SelectValue placeholder="None (use own password)" />
                </SelectTrigger>
                <SelectContent className="bg-panel border-hairline/50">
                  <SelectItem value="none">None (use own password)</SelectItem>
                  {vaultCredentials.map((cred) => (
                    <SelectItem key={cred.id} value={cred.id}>
                      {cred.name} ({cred.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Tags */}
          {customTags.length > 0 && (
            <div className="grid gap-1.5">
              <Label className="text-ink-muted text-sm flex items-center gap-1.5">
                <Tag size={12} className="text-ink-subtle" />
                Tags{" "}
                <span className="text-ink-subtle font-normal">(optional)</span>
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {customTags.map((tag) => {
                  const selected = form.tags.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 border"
                      style={{
                        backgroundColor: selected
                          ? `${tag.color}22`
                          : "transparent",
                        color: selected ? tag.color : "#6b7280",
                        borderColor: selected ? `${tag.color}60` : "#374151",
                      }}
                    >
                      {selected && <Check size={10} />}
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Password section separator */}
          <div className="flex items-center gap-2 pt-1">
            <div className="flex-1 h-px bg-elevated/60" />
            <span className="flex items-center gap-1.5 text-xs text-ink-subtle">
              <KeyRound size={11} />
              Authentication
            </span>
            <div className="flex-1 h-px bg-elevated/60" />
          </div>

          {form.credentialId ? (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-accent-500/8 border border-accent-500/20 text-xs text-accent-400/80">
              <Vault
                size={13}
                className="mt-0.5 flex-shrink-0 text-accent-400/70"
              />
              <span>
                Using vault credential{" "}
                <span className="font-semibold">
                  {
                    vaultCredentials.find((c) => c.id === form.credentialId)
                      ?.name
                  }
                </span>
                . Manage the password from Settings → Credential Vault.
              </span>
            </div>
          ) : (
            <>
              {/* External secret ref */}
              <div className="grid gap-1.5">
                <Label className="text-ink-muted text-sm flex items-center gap-1.5">
                  <Boxes size={12} className="text-ink-subtle" />
                  External Secret{" "}
                  <span className="text-ink-subtle font-normal">(optional)</span>
                </Label>
                <div className="grid grid-cols-[120px_1fr] gap-2">
                  <Select
                    value={form.passwordRefProvider || "none"}
                    onValueChange={(val) =>
                      setForm((prev) => ({
                        ...prev,
                        passwordRefProvider:
                          val === "none" ? "" : (val as SecretProviderId),
                        passwordRefRef:
                          val === "none" ? "" : prev.passwordRefRef,
                      }))
                    }
                  >
                    <SelectTrigger className="bg-elevated/60 border-hairline text-ink">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-panel border-hairline/50">
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="op">1Password</SelectItem>
                      <SelectItem value="bw">Bitwarden</SelectItem>
                      <SelectItem value="vault">HashiCorp Vault</SelectItem>
                      <SelectItem value="aws">AWS Secrets Mgr</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder={
                      form.passwordRefProvider === "op"
                        ? "op://Vault/Item/password"
                        : form.passwordRefProvider === "bw"
                          ? "item-id-or-name"
                          : form.passwordRefProvider === "vault"
                            ? "secret/path#field"
                            : form.passwordRefProvider === "aws"
                              ? "my-secret-id#password"
                              : "Pick a provider first"
                    }
                    disabled={!form.passwordRefProvider}
                    value={form.passwordRefRef}
                    onChange={set("passwordRefRef")}
                    className="bg-elevated/60 border-hairline text-ink font-mono text-xs"
                  />
                </div>
                {form.passwordRefProvider && (
                  <div className="flex items-center gap-2 text-xs">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={testSecret}
                      className="h-7 px-2 text-xs bg-elevated/60 border-hairline/50"
                    >
                      Test
                    </Button>
                    {secretTestState === "ok" && (
                      <span className="text-success">{secretTestMessage}</span>
                    )}
                    {secretTestState === "error" && (
                      <span className="text-danger truncate">
                        {secretTestMessage}
                      </span>
                    )}
                  </div>
                )}
                {errors.passwordRefRef && (
                  <p className="text-danger text-xs">{errors.passwordRefRef}</p>
                )}
              </div>

              {/* Plain password (only if no secret-ref) */}
              {!form.passwordRefProvider && (
                <>
                  <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-warning/8 border border-warning/20 text-xs text-warning/80">
                    <ShieldAlert
                      size={13}
                      className="mt-0.5 flex-shrink-0 text-warning/70"
                    />
                    <span>
                      Prefer SSH keys or external secret references over plain
                      passwords.
                    </span>
                  </div>

                  {editConnection?.hasPassword && !form.password && (
                    <p className="text-xs text-accent-400/80 bg-accent-500/10 border border-accent-500/20 rounded-md px-3 py-2">
                      A password is saved. Leave blank to keep it, or enter a
                      new one to replace it.
                    </p>
                  )}

                  <div className="grid gap-1.5">
                    <Label htmlFor="ssh-password" className="text-ink-muted text-sm">
                      Password{" "}
                      <span className="text-ink-subtle font-normal">
                        (optional)
                      </span>
                    </Label>
                    <Input
                      id="ssh-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder={
                        editConnection?.hasPassword
                          ? "Saved password"
                          : "Leave blank to skip"
                      }
                      value={form.password}
                      onChange={set("password")}
                      className="bg-elevated/60 border-hairline text-ink placeholder:text-ink-subtle"
                    />
                  </div>

                  {form.password && (
                    <div className="grid gap-1.5">
                      <Label
                        htmlFor="ssh-confirm-password"
                        className="text-ink-muted text-sm"
                      >
                        Confirm Password{" "}
                        <span className="text-danger">*</span>
                      </Label>
                      <Input
                        id="ssh-confirm-password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Repeat password"
                        value={form.confirmPassword}
                        onChange={set("confirmPassword")}
                        className="bg-elevated/60 border-hairline text-ink placeholder:text-ink-subtle"
                      />
                      {errors.confirmPassword && (
                        <p className="text-danger text-xs">
                          {errors.confirmPassword}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-hairline text-ink-muted hover:bg-elevated"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-accent-600 hover:bg-accent-500 text-on-accent"
          >
            {editConnection ? "Save Changes" : "Add Connection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
