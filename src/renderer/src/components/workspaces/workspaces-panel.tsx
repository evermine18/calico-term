import { useState } from "react";
import { useAppContext } from "@renderer/contexts/app-context";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import { Label } from "@renderer/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@renderer/components/ui/select";
import {
  Plus,
  Trash2,
  Download,
  Upload,
  Layers,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import {
  exportWorkspaceFile,
  importWorkspaceFile,
  type WorkspaceBundle,
} from "./export-import";

export function WorkspacesPanel() {
  const {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    addWorkspace,
    updateWorkspace,
    deleteWorkspace,
    sshConnections,
    assignConnectionToWorkspace,
    addSSHConnection,
  } = useAppContext();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [exportTarget, setExportTarget] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const editing = workspaces.find((w) => w.id === editingId) ?? null;

  const createNew = () => {
    const id = `ws-${crypto.randomUUID().slice(0, 8)}`;
    addWorkspace({
      id,
      name: "New workspace",
      color: "#8b5cf6",
      environment: "dev",
      sshConnectionIds: [],
    });
    setEditingId(id);
  };

  const handleExport = async () => {
    if (!exportTarget) return;
    const ws = workspaces.find((w) => w.id === exportTarget);
    if (!ws) return;
    setBusy(true);
    setMessage(null);
    try {
      const conns = sshConnections.filter((c) =>
        ws.sshConnectionIds.includes(c.id),
      );
      const path = await exportWorkspaceFile(ws, conns, passphrase || null);
      if (path) setMessage(`Exported to ${path}`);
    } catch (e) {
      setMessage(`Error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      setPassphrase("");
      setExportTarget(null);
    }
  };

  const handleImport = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const bundle: WorkspaceBundle | null = await importWorkspaceFile(
        passphrase || null,
      );
      if (!bundle) {
        setBusy(false);
        return;
      }
      // Avoid id collisions: regenerate ids if existing.
      const wsId = workspaces.some((w) => w.id === bundle.workspace.id)
        ? `ws-${crypto.randomUUID().slice(0, 8)}`
        : bundle.workspace.id;
      const connIdMap = new Map<string, string>();
      for (const c of bundle.connections) {
        const newId = sshConnections.some((x) => x.id === c.id)
          ? crypto.randomUUID()
          : c.id;
        connIdMap.set(c.id, newId);
        addSSHConnection({ ...c, id: newId, hasPassword: false });
      }
      addWorkspace({
        ...bundle.workspace,
        id: wsId,
        sshConnectionIds: bundle.workspace.sshConnectionIds.map(
          (id) => connIdMap.get(id) ?? id,
        ),
      });
      setMessage(`Imported workspace "${bundle.workspace.name}"`);
    } catch (e) {
      setMessage(`Error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      setPassphrase("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-300 text-sm font-semibold flex items-center gap-1.5">
            <Layers size={14} />
            Workspaces
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Group SSH connections by environment. The active workspace colours
            the header stripe and filters Home.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={handleImport}
            disabled={busy}
            className="bg-slate-800/60 border-slate-700/50 text-gray-300 hover:bg-slate-700/60 gap-1"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            Import
          </Button>
          <Button
            size="sm"
            onClick={createNew}
            className="bg-accent-500/90 hover:bg-accent-500 text-white gap-1"
          >
            <Plus size={13} />
            New
          </Button>
        </div>
      </div>

      {message && (
        <div className="text-[11px] text-gray-400 bg-slate-800/50 border border-slate-700/40 rounded px-2 py-1.5 break-all">
          {message}
        </div>
      )}

      <div className="space-y-1.5">
        {workspaces.map((w) => {
          const isActive = w.id === activeWorkspaceId;
          const isEditing = editingId === w.id;
          return (
            <div
              key={w.id}
              className={`rounded-md border ${
                isActive
                  ? "bg-accent-500/5 border-accent-500/30"
                  : "bg-slate-800/40 border-slate-700/40"
              }`}
            >
              <div className="flex items-center gap-2 p-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: w.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-200 truncate">{w.name}</div>
                  <div className="text-[10px] text-gray-500 flex items-center gap-2">
                    <span>{w.sshConnectionIds.length} connections</span>
                    {w.environment === "prod" && (
                      <span className="text-red-400 flex items-center gap-0.5">
                        <ShieldAlert size={9} /> PROD
                      </span>
                    )}
                  </div>
                </div>
                {!isActive && (
                  <button
                    onClick={() => setActiveWorkspaceId(w.id)}
                    className="text-[11px] text-accent-400 hover:text-accent-300 px-1.5 py-0.5"
                  >
                    Activate
                  </button>
                )}
                <button
                  onClick={() => setExportTarget(w.id)}
                  className="text-gray-500 hover:text-gray-300 p-1"
                  title="Export"
                >
                  <Download size={13} />
                </button>
                <button
                  onClick={() => setEditingId(isEditing ? null : w.id)}
                  className="text-[11px] text-gray-400 hover:text-accent-300 px-1.5 py-0.5"
                >
                  {isEditing ? "Done" : "Edit"}
                </button>
                {w.id !== "ws-personal" && (
                  <button
                    onClick={() => deleteWorkspace(w.id)}
                    className="text-gray-500 hover:text-red-400 p-1"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              {isEditing && editing && editing.id === w.id && (
                <div className="border-t border-slate-700/40 p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-1">
                      <Label className="text-[11px] text-gray-400">Name</Label>
                      <Input
                        value={editing.name}
                        onChange={(e) =>
                          updateWorkspace({ ...editing, name: e.target.value })
                        }
                        className="h-8 bg-slate-800/60 border-slate-700/50 text-gray-100 text-sm"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-[11px] text-gray-400">Color</Label>
                      <input
                        type="color"
                        value={editing.color}
                        onChange={(e) =>
                          updateWorkspace({ ...editing, color: e.target.value })
                        }
                        className="h-8 w-full rounded-md border border-slate-700/50 bg-slate-800/60 cursor-pointer"
                      />
                    </div>
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-[11px] text-gray-400">
                      Environment
                    </Label>
                    <Select
                      value={editing.environment ?? "other"}
                      onValueChange={(v) =>
                        updateWorkspace({
                          ...editing,
                          environment: v as WorkspaceEntry["environment"],
                        })
                      }
                    >
                      <SelectTrigger className="h-8 bg-slate-800/60 border-slate-700/50 text-gray-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700/50">
                        <SelectItem value="dev">Development</SelectItem>
                        <SelectItem value="staging">Staging</SelectItem>
                        <SelectItem value="prod">Production</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-[11px] text-gray-400">
                      SSH Connections
                    </Label>
                    <div className="max-h-40 overflow-y-auto rounded border border-slate-700/40 bg-slate-900/40 divide-y divide-slate-800/40">
                      {sshConnections.length === 0 && (
                        <div className="px-2 py-3 text-[11px] text-gray-500 text-center">
                          No SSH connections yet.
                        </div>
                      )}
                      {sshConnections.map((c) => {
                        const checked = editing.sshConnectionIds.includes(c.id);
                        return (
                          <label
                            key={c.id}
                            className="flex items-center gap-2 px-2 py-1.5 text-[12px] text-gray-300 hover:bg-slate-800/40 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                assignConnectionToWorkspace(c.id, editing.id)
                              }
                              className="accent-accent-500"
                            />
                            <span className="flex-1 truncate">{c.name}</span>
                            <span className="text-[10px] text-gray-500 font-mono">
                              {c.username}@{c.host}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {exportTarget && (
        <div className="rounded-md border border-accent-500/30 bg-accent-500/5 p-3 space-y-2">
          <div className="text-[11px] text-gray-300">
            Optional passphrase (PBKDF2 + AES-GCM). Leave blank to export
            without encryption. Secrets are never included; only connection
            metadata.
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="password"
              placeholder="Passphrase (optional)"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="h-8 bg-slate-800/60 border-slate-700/50 text-gray-100 text-sm"
            />
            <Button
              size="sm"
              onClick={handleExport}
              disabled={busy}
              className="bg-accent-500/90 hover:bg-accent-500 text-white"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : "Export"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setExportTarget(null);
                setPassphrase("");
              }}
              className="bg-slate-800/60 border-slate-700/50 text-gray-300"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
