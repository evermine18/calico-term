import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@renderer/components/ui/dialog";
import { Input } from "@renderer/components/ui/input";
import { Label } from "@renderer/components/ui/label";
import { Button } from "@renderer/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@renderer/components/ui/select";
import { Textarea } from "@renderer/components/ui/textarea";
import {
  Copy,
  KeyRound,
  Plus,
  Trash2,
  Upload,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";

type Mode = "generate" | "import" | null;

export function SSHKeysPanel() {
  const [keys, setKeys] = useState<SSHKeyMetadata[]>([]);
  const [mode, setMode] = useState<Mode>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const refresh = async () => {
    const list = await window.api.sshKeys.list();
    setKeys(list);
  };

  useEffect(() => {
    refresh();
  }, []);

  const copyPublic = async (k: SSHKeyMetadata) => {
    window.api.clipboard.writeText(k.publicKey);
    setCopiedId(k.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this SSH key? This is irreversible.")) return;
    await window.api.sshKeys.delete(id);
    await refresh();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-ink-muted text-sm font-semibold">SSH Keys</p>
          <p className="text-xs text-ink-muted mt-0.5">
            Generate or import private keys. Stored encrypted in the app data
            directory.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => setMode("import")}
            className="gap-1.5 bg-elevated/60 border border-hairline/50 hover:bg-accent-500/20 hover:text-accent-300 hover:border-accent-500/50 text-ink-muted"
          >
            <Upload size={14} />
            Import
          </Button>
          <Button
            size="sm"
            onClick={() => setMode("generate")}
            className="gap-1.5 bg-accent-600/90 hover:bg-accent-500 text-on-accent"
          >
            <Plus size={14} />
            Generate
          </Button>
        </div>
      </div>

      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-accent-600/40 scrollbar-track-transparent">
        {keys.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <KeyRound size={32} className="text-ink-subtle mb-3" />
            <p className="text-sm text-ink-subtle">No keys yet</p>
            <p className="text-xs text-ink-subtle mt-1">
              Generate or import a key to start authenticating.
            </p>
          </div>
        )}
        {keys.map((k) => (
          <div
            key={k.id}
            className="flex items-center gap-2.5 p-2.5 rounded-md bg-elevated/60 border border-hairline/50"
          >
            <KeyRound size={14} className="text-accent-500/70 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-ink-muted truncate">{k.name}</div>
              <div className="text-xs text-ink-subtle font-mono truncate">
                {k.type}
                {k.bits ? `-${k.bits}` : ""}
                {" · "}
                {k.fingerprint}
                {k.hasPassphrase && " · 🔒"}
              </div>
            </div>
            <Button
              onClick={() => copyPublic(k)}
              variant="ghost"
              size="icon"
              title="Copy public key"
              className="h-8 w-8 text-ink-muted hover:text-accent-300 hover:bg-accent-500/20"
            >
              {copiedId === k.id ? <Check size={14} /> : <Copy size={14} />}
            </Button>
            <Button
              onClick={() => handleDelete(k.id)}
              variant="ghost"
              size="icon"
              title="Delete key"
              className="h-8 w-8 text-ink-muted hover:text-danger hover:bg-danger/20"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
      </div>

      <KeyDialog
        mode={mode}
        onClose={() => setMode(null)}
        onSaved={async () => {
          setMode(null);
          await refresh();
        }}
      />
    </div>
  );
}

function KeyDialog({
  mode,
  onClose,
  onSaved,
}: {
  mode: Mode;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"ed25519" | "rsa">("ed25519");
  const [bits, setBits] = useState<number>(4096);
  const [comment, setComment] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [privatePem, setPrivatePem] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== null) {
      setName("");
      setType("ed25519");
      setBits(4096);
      setComment("");
      setPassphrase("");
      setShowPass(false);
      setPrivatePem("");
      setError(null);
    }
  }, [mode]);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "generate") {
        if (!name.trim()) throw new Error("Name is required");
        await window.api.sshKeys.generate({
          name: name.trim(),
          type,
          bits: type === "rsa" ? bits : undefined,
          passphrase: passphrase || undefined,
          comment: comment.trim() || undefined,
        });
      } else if (mode === "import") {
        if (!name.trim()) throw new Error("Name is required");
        if (!privatePem.trim()) throw new Error("Private key is required");
        await window.api.sshKeys.importKey({
          name: name.trim(),
          privatePem,
          passphrase: passphrase || undefined,
        });
      }
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px] bg-panel border-hairline/40 shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-ink flex items-center gap-2">
            <KeyRound size={16} className="text-accent-400" />
            {mode === "generate" ? "Generate SSH Key" : "Import SSH Key"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label className="text-ink-muted text-sm">
              Name <span className="text-danger">*</span>
            </Label>
            <Input
              placeholder="e.g. prod-bastion"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-elevated/60 border-hairline text-ink"
            />
          </div>

          {mode === "generate" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-ink-muted text-sm">Type</Label>
                  <Select
                    value={type}
                    onValueChange={(v) => setType(v as "ed25519" | "rsa")}
                  >
                    <SelectTrigger className="bg-elevated/60 border-hairline text-ink">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-panel border-hairline/50">
                      <SelectItem value="ed25519">ed25519 (recommended)</SelectItem>
                      <SelectItem value="rsa">RSA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {type === "rsa" && (
                  <div className="grid gap-1.5">
                    <Label className="text-ink-muted text-sm">Bits</Label>
                    <Select
                      value={String(bits)}
                      onValueChange={(v) => setBits(parseInt(v, 10))}
                    >
                      <SelectTrigger className="bg-elevated/60 border-hairline text-ink">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-panel border-hairline/50">
                        <SelectItem value="2048">2048</SelectItem>
                        <SelectItem value="3072">3072</SelectItem>
                        <SelectItem value="4096">4096</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label className="text-ink-muted text-sm">
                  Comment{" "}
                  <span className="text-ink-subtle font-normal">(optional)</span>
                </Label>
                <Input
                  placeholder="user@host"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="bg-elevated/60 border-hairline text-ink"
                />
              </div>
            </>
          )}

          {mode === "import" && (
            <div className="grid gap-1.5">
              <Label className="text-ink-muted text-sm">
                Private key (PEM){" "}
                <span className="text-danger">*</span>
              </Label>
              <Textarea
                rows={6}
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..."
                value={privatePem}
                onChange={(e) => setPrivatePem(e.target.value)}
                className="bg-elevated/60 border-hairline text-ink font-mono text-xs"
              />
            </div>
          )}

          <div className="grid gap-1.5">
            <Label className="text-ink-muted text-sm">
              Passphrase{" "}
              <span className="text-ink-subtle font-normal">(optional)</span>
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type={showPass ? "text" : "password"}
                autoComplete="new-password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="bg-elevated/60 border-hairline text-ink"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowPass((v) => !v)}
                className="bg-elevated/60 border-hairline/50"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </Button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-md px-3 py-2">
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="border-hairline text-ink-muted hover:bg-elevated"
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={submitting}
            className="bg-accent-600 hover:bg-accent-500 text-on-accent"
          >
            {submitting
              ? "Working…"
              : mode === "generate"
                ? "Generate"
                : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
