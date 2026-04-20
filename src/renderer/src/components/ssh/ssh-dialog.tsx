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
import { KeyRound, ShieldAlert, Tag, Check, Vault } from "lucide-react";

type SSHFormData = {
  name: string;
  host: string;
  port: string;
  username: string;
  identityFile: string;
  password: string;
  confirmPassword: string;
  credentialId: string;
  tags: string[];
};

const EMPTY_FORM: SSHFormData = {
  name: "",
  host: "",
  port: "22",
  username: "",
  identityFile: "",
  password: "",
  confirmPassword: "",
  credentialId: "",
  tags: [],
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editConnection?: SSHConnectionEntry | null;
};

export default function SSHDialog({ open, onOpenChange, editConnection }: Props) {
  const { addSSHConnection, updateSSHConnection, vaultCredentials } = useAppContext();
  const customTags = useTags();
  const [form, setForm] = useState<SSHFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<SSHFormData>>({});

  useEffect(() => {
    if (open) {
      if (editConnection) {
        setForm({
          name: editConnection.name,
          host: editConnection.host,
          port: String(editConnection.port),
          username: editConnection.username,
          identityFile: editConnection.identityFile ?? "",
          password: "",
          confirmPassword: "",
          credentialId: editConnection.credentialId ?? "",
          tags: editConnection.tags ?? [],
        });
      } else {
        setForm(EMPTY_FORM);
      }
      setErrors({});
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
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const isEdit = !!editConnection;
    const connId = isEdit ? editConnection!.id : crypto.randomUUID();
    const usingVault = !!form.credentialId;

    let hasPassword: boolean;
    if (usingVault) {
      hasPassword = false; // vault handles the password
    } else if (isEdit) {
      hasPassword = form.password ? true : (editConnection!.hasPassword ?? false);
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
      hasPassword,
      credentialId: form.credentialId || undefined,
      tags: form.tags,
    };

    if (isEdit) {
      updateSSHConnection(conn);
    } else {
      addSSHConnection(conn);
    }

    if (!usingVault && form.password) {
      await window.electron.ipcRenderer.invoke("ssh-password-set", connId, form.password);
    }

    onOpenChange(false);
  };

  const set = (field: keyof Omit<SSHFormData, "tags">) =>
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-900 border-slate-700 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-100">
            {editConnection ? "Edit SSH Connection" : "New SSH Connection"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Name */}
          <div className="grid gap-1.5">
            <Label htmlFor="ssh-name" className="text-gray-300 text-sm">
              Name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="ssh-name"
              placeholder="My Server"
              value={form.name}
              onChange={set("name")}
              className="bg-slate-800/60 border-slate-700 text-gray-100 placeholder:text-gray-500"
            />
            {errors.name && <p className="text-red-400 text-xs">{errors.name}</p>}
          </div>

          {/* Host */}
          <div className="grid gap-1.5">
            <Label htmlFor="ssh-host" className="text-gray-300 text-sm">
              Hostname / IP <span className="text-red-400">*</span>
            </Label>
            <Input
              id="ssh-host"
              placeholder="192.168.1.1"
              value={form.host}
              onChange={set("host")}
              className="bg-slate-800/60 border-slate-700 text-gray-100 placeholder:text-gray-500"
            />
            {errors.host && <p className="text-red-400 text-xs">{errors.host}</p>}
          </div>

          {/* Username + Port */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="ssh-user" className="text-gray-300 text-sm">
                Username <span className="text-red-400">*</span>
              </Label>
              <Input
                id="ssh-user"
                placeholder="root"
                value={form.username}
                onChange={set("username")}
                className="bg-slate-800/60 border-slate-700 text-gray-100 placeholder:text-gray-500"
              />
              {errors.username && (
                <p className="text-red-400 text-xs">{errors.username}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ssh-port" className="text-gray-300 text-sm">
                Port <span className="text-red-400">*</span>
              </Label>
              <Input
                id="ssh-port"
                placeholder="22"
                value={form.port}
                onChange={set("port")}
                className="bg-slate-800/60 border-slate-700 text-gray-100 placeholder:text-gray-500"
              />
              {errors.port && <p className="text-red-400 text-xs">{errors.port}</p>}
            </div>
          </div>

          {/* Identity File */}
          <div className="grid gap-1.5">
            <Label htmlFor="ssh-identity" className="text-gray-300 text-sm">
              Identity File{" "}
              <span className="text-gray-500 font-normal">(optional)</span>
            </Label>
            <Input
              id="ssh-identity"
              placeholder="~/.ssh/id_rsa"
              value={form.identityFile}
              onChange={set("identityFile")}
              className="bg-slate-800/60 border-slate-700 text-gray-100 placeholder:text-gray-500"
            />
          </div>

          {/* Vault Credential Selector */}
          {vaultCredentials.length > 0 && (
            <div className="grid gap-1.5">
              <Label className="text-gray-300 text-sm flex items-center gap-1.5">
                <Vault size={12} className="text-gray-500" />
                Vault Credential{" "}
                <span className="text-gray-500 font-normal">(optional)</span>
              </Label>
              <Select
                value={form.credentialId || "none"}
                onValueChange={(val) =>
                  setForm((prev) => ({
                    ...prev,
                    credentialId: val === "none" ? "" : val,
                    username: val !== "none"
                      ? (vaultCredentials.find((c) => c.id === val)?.username ?? prev.username)
                      : prev.username,
                  }))
                }
              >
                <SelectTrigger className="bg-slate-800/60 border-slate-700 text-gray-100">
                  <SelectValue placeholder="None (use own password)" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700/50">
                  <SelectItem value="none" className="text-gray-400 focus:bg-accent-500/20 focus:text-accent-100">
                    None (use own password)
                  </SelectItem>
                  {vaultCredentials.map((cred) => (
                    <SelectItem key={cred.id} value={cred.id} className="text-gray-100 focus:bg-accent-500/20 focus:text-accent-100">
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
              <Label className="text-gray-300 text-sm flex items-center gap-1.5">
                <Tag size={12} className="text-gray-500" />
                Tags{" "}
                <span className="text-gray-500 font-normal">(optional)</span>
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
                        backgroundColor: selected ? `${tag.color}22` : "transparent",
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
            <div className="flex-1 h-px bg-slate-700/60" />
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <KeyRound size={11} />
              Password Authentication
            </span>
            <div className="flex-1 h-px bg-slate-700/60" />
          </div>

          {form.credentialId ? (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-accent-500/8 border border-accent-500/20 text-xs text-accent-400/80">
              <Vault size={13} className="mt-0.5 flex-shrink-0 text-accent-400/70" />
              <span>
                Using vault credential <span className="font-semibold">{vaultCredentials.find((c) => c.id === form.credentialId)?.name}</span>.
                Manage the password from Settings → Credential Vault.
              </span>
            </div>
          ) : (
            <>
              {/* Security recommendation */}
              <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-amber-500/8 border border-amber-500/20 text-xs text-amber-400/80">
                <ShieldAlert size={13} className="mt-0.5 flex-shrink-0 text-amber-400/70" />
                <span>
                  Prefer <span className="font-semibold">SSH keys</span> over passwords.
                  Use the Identity File field above for a more secure connection.
                  Password auth is supported as a last resort.
                </span>
              </div>

              {editConnection?.hasPassword && !form.password && !editConnection.credentialId && (
                <p className="text-xs text-accent-400/80 bg-accent-500/10 border border-accent-500/20 rounded-md px-3 py-2">
                  A password is saved. Leave blank to keep it, or enter a new one to replace it.
                </p>
              )}

              {/* Password */}
              <div className="grid gap-1.5">
                <Label htmlFor="ssh-password" className="text-gray-300 text-sm">
                  Password{" "}
                  <span className="text-gray-500 font-normal">(optional)</span>
                </Label>
                <Input
                  id="ssh-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder={editConnection?.hasPassword ? "Saved password" : "Leave blank to skip"}
                  value={form.password}
                  onChange={set("password")}
                  className="bg-slate-800/60 border-slate-700 text-gray-100 placeholder:text-gray-500"
                />
              </div>

              {form.password && (
                <div className="grid gap-1.5">
                  <Label htmlFor="ssh-confirm-password" className="text-gray-300 text-sm">
                    Confirm Password <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="ssh-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repeat password"
                    value={form.confirmPassword}
                    onChange={set("confirmPassword")}
                    className="bg-slate-800/60 border-slate-700 text-gray-100 placeholder:text-gray-500"
                  />
                  {errors.confirmPassword && (
                    <p className="text-red-400 text-xs">{errors.confirmPassword}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-slate-700 text-gray-300 hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-accent-600 hover:bg-accent-500 text-white"
          >
            {editConnection ? "Save Changes" : "Add Connection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
