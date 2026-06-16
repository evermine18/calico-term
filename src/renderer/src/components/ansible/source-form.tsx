import { useEffect, useState } from "react";
import { useAppContext } from "@renderer/contexts/app-context";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@renderer/components/ui/dialog";
import { Button } from "@renderer/components/ui/button";
import { KeyRound, Loader2, Copy, Check } from "lucide-react";

const inputCls =
  "w-full bg-slate-800/60 border border-slate-700/50 rounded px-2.5 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-accent-500/60";
const labelCls = "block text-xs font-medium text-gray-400 mb-1";

// Build the control-node shape for the "test access" probe.
function toControlNode(
  conn: SSHConnectionEntry,
  all: SSHConnectionEntry[],
): AnsibleControlNode {
  return {
    id: conn.id,
    host: conn.host,
    port: conn.port,
    username: conn.username,
    identityFile: conn.identityFile,
    identityKeyId: conn.identityKeyId,
    hasPassword: conn.hasPassword,
    credentialId: conn.credentialId,
    passwordRef: conn.passwordRef,
    jumpHosts: (conn.jumpHostIds ?? [])
      .map((jid) => all.find((c) => c.id === jid))
      .filter((c): c is SSHConnectionEntry => !!c)
      .map((j) => ({
        host: j.host,
        port: j.port,
        username: j.username,
        identityFile: j.identityFile,
        identityKeyId: j.identityKeyId,
      })),
  };
}

export default function AnsibleSourceForm({
  sourceId,
  onClose,
  onSaved,
}: {
  sourceId: string | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}): React.JSX.Element {
  const {
    ansibleSources,
    addAnsibleSource,
    updateAnsibleSource,
    sshConnections,
  } = useAppContext();
  const existing = ansibleSources.find((s) => s.id === sourceId) ?? null;

  const [name, setName] = useState(existing?.name ?? "");
  const [sshConnectionId, setSshConnectionId] = useState(
    existing?.sshConnectionId ?? sshConnections[0]?.id ?? "",
  );
  const [origin, setOrigin] = useState<"git" | "path">(
    existing?.origin ?? "git",
  );
  const [repoUrl, setRepoUrl] = useState(existing?.repoUrl ?? "");
  const [branch, setBranch] = useState(existing?.branch ?? "main");
  const [subdir, setSubdir] = useState(existing?.subdir ?? "");
  const [basePath, setBasePath] = useState(existing?.basePath ?? "");
  const [deployKeyId, setDeployKeyId] = useState(existing?.deployKeyId ?? "");
  const [inventoryMode, setInventoryMode] = useState<"auto" | "file">(
    existing?.inventoryMode ?? "file",
  );
  const [inventoryFile, setInventoryFile] = useState(
    existing?.inventoryFile ?? "inventory",
  );

  // Deploy-key helpers
  const [keys, setKeys] = useState<SSHKeyMetadata[]>([]);
  const [generating, setGenerating] = useState(false);
  const [newPublicKey, setNewPublicKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    output: string;
  } | null>(null);

  useEffect(() => {
    window.api.sshKeys.list().then(setKeys);
  }, []);

  const generateDeployKey = async (): Promise<void> => {
    setGenerating(true);
    try {
      const meta = await window.api.sshKeys.generate({
        name: `ansible-deploy-${(name || "repo").trim().slice(0, 20)}`,
        type: "ed25519",
        comment: "calico-ansible-deploy",
      });
      setKeys((prev) => [...prev, meta]);
      setDeployKeyId(meta.id);
      setNewPublicKey(meta.publicKey);
    } finally {
      setGenerating(false);
    }
  };

  const testAccess = async (): Promise<void> => {
    const conn = sshConnections.find((c) => c.id === sshConnectionId);
    if (!conn || !repoUrl.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await window.api.ansible.testGit(
        toControlNode(conn, sshConnections),
        repoUrl.trim(),
        deployKeyId || undefined,
      );
      setTestResult(res);
    } finally {
      setTesting(false);
    }
  };

  const canSave =
    name.trim() &&
    sshConnectionId &&
    (origin === "git" ? repoUrl.trim() : basePath.trim());

  const save = (): void => {
    const id = existing?.id ?? crypto.randomUUID();
    const entry: AnsibleSourceEntry = {
      id,
      name: name.trim(),
      sshConnectionId,
      origin,
      repoUrl: origin === "git" ? repoUrl.trim() : undefined,
      branch: origin === "git" ? branch.trim() || "main" : undefined,
      subdir: origin === "git" ? subdir.trim() || undefined : undefined,
      deployKeyId: origin === "git" ? deployKeyId || undefined : undefined,
      basePath: origin === "path" ? basePath.trim() : undefined,
      inventoryMode,
      inventoryFile:
        inventoryMode === "file"
          ? inventoryFile.trim() || "inventory"
          : undefined,
    };
    if (existing) updateAnsibleSource(entry);
    else addAnsibleSource(entry);
    onSaved(id);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px] bg-slate-900 border-slate-700/60 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-100">
            {existing ? "Editar fuente" : "Nueva fuente Ansible"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div>
            <label className={labelCls}>Nombre</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="p. ej. infra-prod"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Control node (conexión SSH)</label>
            <select
              value={sshConnectionId}
              onChange={(e) => setSshConnectionId(e.target.value)}
              className={inputCls}
            >
              {sshConnections.length === 0 && (
                <option value="">(no hay conexiones SSH)</option>
              )}
              {sshConnections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.username}@{c.host}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Origen de los playbooks</label>
            <div className="flex gap-2">
              {(["git", "path"] as const).map((o) => (
                <button
                  key={o}
                  onClick={() => setOrigin(o)}
                  className={`flex-1 text-sm py-1.5 rounded border transition-colors ${
                    origin === o
                      ? "border-accent-500 bg-accent-500/10 text-accent-200"
                      : "border-slate-700/50 text-gray-400 hover:border-slate-600"
                  }`}
                >
                  {o === "git" ? "Repo Git" : "Ruta en el control node"}
                </button>
              ))}
            </div>
          </div>

          {origin === "git" ? (
            <>
              <div>
                <label className={labelCls}>URL del repo</label>
                <input
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="git@github.com:org/ansible.git"
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className={labelCls}>Rama</label>
                  <input
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="main"
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <div className="flex-1">
                  <label className={labelCls}>Subcarpeta (opcional)</label>
                  <input
                    value={subdir}
                    onChange={(e) => setSubdir(e.target.value)}
                    placeholder="p. ej. playbooks"
                    className={`${inputCls} font-mono`}
                  />
                </div>
              </div>

              {/* Deploy key management */}
              <div className="rounded-md border border-slate-700/50 p-2.5 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-300">
                  <KeyRound size={13} className="text-accent-400" />
                  Deploy key (auth del control node contra el host git)
                </div>
                <select
                  value={deployKeyId}
                  onChange={(e) => setDeployKeyId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">
                    Ninguna (usar la config SSH del control node)
                  </option>
                  {keys.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name} ({k.fingerprint.slice(0, 22)}…)
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={generateDeployKey}
                    disabled={generating}
                    className="border-slate-700/50 text-gray-300 gap-1 text-xs"
                  >
                    {generating ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <KeyRound size={12} />
                    )}
                    Generar deploy key
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={testAccess}
                    disabled={testing || !repoUrl.trim()}
                    className="border-slate-700/50 text-gray-300 gap-1 text-xs"
                  >
                    {testing ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : null}
                    Probar acceso
                  </Button>
                </div>
                {newPublicKey && (
                  <div className="space-y-1">
                    <p className="text-[11px] text-amber-300">
                      Registra esta clave pública como deploy key en tu host git
                      (GitHub/GitLab), luego prueba el acceso:
                    </p>
                    <div className="flex items-start gap-1">
                      <textarea
                        readOnly
                        value={newPublicKey}
                        className="flex-1 bg-slate-800/80 border border-slate-700/50 rounded px-2 py-1 text-[11px] text-gray-200 font-mono h-16 resize-none"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(newPublicKey);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1500);
                        }}
                        className="p-1 text-gray-400 hover:text-accent-300"
                        title="Copiar"
                      >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                )}
                {testResult && (
                  <div
                    className={`text-[11px] rounded px-2 py-1 font-mono whitespace-pre-wrap break-all ${
                      testResult.ok
                        ? "text-emerald-300 bg-emerald-500/10 border border-emerald-500/30"
                        : "text-red-300 bg-red-500/10 border border-red-500/30"
                    }`}
                  >
                    {testResult.ok ? "✓ Acceso OK\n" : "✗ Sin acceso\n"}
                    {testResult.output || "(sin salida)"}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div>
              <label className={labelCls}>Ruta en el control node</label>
              <input
                value={basePath}
                onChange={(e) => setBasePath(e.target.value)}
                placeholder="/opt/ansible"
                className={`${inputCls} font-mono`}
              />
            </div>
          )}

          {/* Inventory */}
          <div>
            <label className={labelCls}>Inventario</label>
            <div className="flex gap-2 mb-2">
              {(["file", "auto"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setInventoryMode(m)}
                  className={`flex-1 text-sm py-1.5 rounded border transition-colors ${
                    inventoryMode === m
                      ? "border-accent-500 bg-accent-500/10 text-accent-200"
                      : "border-slate-700/50 text-gray-400 hover:border-slate-600"
                  }`}
                >
                  {m === "file"
                    ? "Fichero del repo/carpeta"
                    : "Auto (conexiones SSH)"}
                </button>
              ))}
            </div>
            {inventoryMode === "file" ? (
              <input
                value={inventoryFile}
                onChange={(e) => setInventoryFile(e.target.value)}
                placeholder="inventory/prod.ini"
                className={`${inputCls} font-mono`}
              />
            ) : (
              <p className="text-[11px] text-gray-500">
                Se generará un inventario a partir de tus conexiones SSH
                guardadas, agrupando por sus tags.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="border-slate-700/50 text-gray-300"
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!canSave}
            onClick={save}
            className="bg-accent-600/90 hover:bg-accent-600 text-white"
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
