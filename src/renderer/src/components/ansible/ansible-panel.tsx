import { useEffect, useRef, useState } from "react";
import { useAppContext } from "@renderer/contexts/app-context";
import {
  Play,
  Square,
  Plus,
  Pencil,
  Trash2,
  X,
  GitBranch,
  FolderGit2,
  Server,
  Loader2,
  ScrollText,
} from "lucide-react";
import { Button } from "@renderer/components/ui/button";
import AnsibleSourceForm from "./source-form";

type OutLine = { text: string; stream: "stdout" | "stderr" | "meta" };

// Map a saved SSH connection (with its jump-host chain) to the control-node
// shape the main process expects. Mirrors the metrics mapping in App.tsx.
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

const STATUS_LABEL: Record<string, string> = {
  connecting: "Connecting…",
  "installing-key": "Installing deploy key…",
  "syncing-repo": "Syncing repo…",
  running: "Running…",
  done: "Done",
  error: "Error",
};

export default function AnsiblePanel({
  onClose,
}: {
  onClose: () => void;
}): React.JSX.Element {
  const {
    ansibleSources,
    deleteAnsibleSource,
    ansiblePlaybooks,
    addAnsiblePlaybook,
    deleteAnsiblePlaybook,
    sshConnections,
  } = useAppContext();

  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(
    ansibleSources[0]?.id ?? null,
  );
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string | null>(
    null,
  );
  const [sourceFormOpen, setSourceFormOpen] = useState(false);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);

  // Run state
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [lines, setLines] = useState<OutLine[]>([]);
  const runIdRef = useRef<string | null>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  // Per-run overrides (seeded from the playbook defaults).
  const [limit, setLimit] = useState("");
  const [extraVars, setExtraVars] = useState("");
  const [check, setCheck] = useState(true);

  const source = ansibleSources.find((s) => s.id === selectedSourceId) ?? null;
  const playbooks = ansiblePlaybooks.filter(
    (p) => p.sourceId === selectedSourceId,
  );
  const playbook = playbooks.find((p) => p.id === selectedPlaybookId) ?? null;
  const controlNode = source
    ? sshConnections.find((c) => c.id === source.sshConnectionId)
    : null;

  // Seed run overrides whenever the selected playbook changes.
  useEffect(() => {
    if (!playbook) return;
    setLimit(playbook.defaultLimit ?? "");
    setExtraVars(playbook.defaultExtraVars ?? "");
    setCheck(playbook.defaultCheck ?? true);
  }, [selectedPlaybookId]);

  // Auto-scroll the console as output streams in.
  useEffect(() => {
    const el = consoleRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  // Subscribe to run events for the lifetime of the panel.
  useEffect(() => {
    const offOut = window.api.ansible.onOutput((d) => {
      if (d.runId !== runIdRef.current) return;
      setLines((prev) => [...prev, { text: d.line, stream: d.stream }]);
    });
    const offStatus = window.api.ansible.onStatus((d) => {
      if (d.runId !== runIdRef.current) return;
      setPhase(d.phase);
    });
    const offDone = window.api.ansible.onDone((d) => {
      if (d.runId !== runIdRef.current) return;
      setRunning(false);
      if (d.error) {
        setLines((prev) => [
          ...prev,
          { text: `✗ ${d.error}`, stream: "stderr" },
        ]);
        setPhase("error");
      } else {
        setLines((prev) => [
          ...prev,
          {
            text:
              d.code === 0
                ? "✓ Playbook finished (exit 0)"
                : `✗ Playbook exited with code ${d.code}`,
            stream: d.code === 0 ? "meta" : "stderr",
          },
        ]);
      }
      runIdRef.current = null;
    });
    return () => {
      offOut();
      offStatus();
      offDone();
    };
  }, []);

  const startRun = async (): Promise<void> => {
    if (!source || !playbook || !controlNode) return;
    const runId = crypto.randomUUID();
    runIdRef.current = runId;
    setLines([]);
    setRunning(true);
    setPhase("connecting");

    const payload: AnsibleRunPayload = {
      runId,
      sourceId: source.id,
      conn: toControlNode(controlNode, sshConnections),
      origin: source.origin,
      repoUrl: source.repoUrl,
      branch: source.branch,
      deployKeyId: source.deployKeyId,
      subdir: source.subdir,
      basePath: source.basePath,
      playbook: playbook.relativePath,
      inventoryMode: source.inventoryMode,
      inventoryFile: source.inventoryFile,
      inventoryHosts:
        source.inventoryMode === "auto"
          ? sshConnections.map((c) => ({
              name: c.name,
              host: c.host,
              port: c.port,
              username: c.username,
              tags: c.tags,
            }))
          : undefined,
      limit: limit.trim() || undefined,
      extraVars: extraVars.trim() || undefined,
      check,
    };

    const res = await window.api.ansible.startRun(payload);
    if (!res.ok) {
      setRunning(false);
      setLines([
        { text: `✗ ${res.error ?? "Failed to start"}`, stream: "stderr" },
      ]);
      setPhase("error");
      runIdRef.current = null;
    }
  };

  const cancelRun = (): void => {
    if (runIdRef.current) window.api.ansible.cancelRun(runIdRef.current);
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-slate-950/98 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/40 bg-slate-900/80">
        <div className="flex items-center gap-2 text-gray-200">
          <ScrollText size={16} className="text-accent-400" />
          <span className="text-sm font-semibold tracking-wide">
            Ansible Runner
          </span>
        </div>
        <button
          onClick={onClose}
          className="flex items-center justify-center w-7 h-7 rounded text-gray-500 hover:bg-slate-700/60 hover:text-gray-200 transition-colors"
          title="Close"
        >
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Left: sources + playbooks */}
        <div className="w-72 flex-shrink-0 border-r border-slate-700/40 flex flex-col bg-slate-900/40">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/30">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Sources
            </span>
            <button
              onClick={() => {
                setEditingSourceId(null);
                setSourceFormOpen(true);
              }}
              className="text-gray-400 hover:text-accent-300 transition-colors"
              title="New source"
            >
              <Plus size={15} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {ansibleSources.length === 0 && (
              <p className="px-3 py-3 text-xs text-gray-600">
                No sources yet. Create one to register a Git repo or a folder
                on the control node.
              </p>
            )}
            {ansibleSources.map((s) => {
              const node = sshConnections.find(
                (c) => c.id === s.sshConnectionId,
              );
              const active = s.id === selectedSourceId;
              return (
                <div
                  key={s.id}
                  onClick={() => {
                    setSelectedSourceId(s.id);
                    setSelectedPlaybookId(null);
                  }}
                  className={`group px-3 py-2 cursor-pointer border-l-2 ${
                    active
                      ? "border-accent-500 bg-slate-800/60"
                      : "border-transparent hover:bg-slate-800/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {s.origin === "git" ? (
                        <FolderGit2
                          size={13}
                          className="text-accent-400 flex-shrink-0"
                        />
                      ) : (
                        <Server
                          size={13}
                          className="text-gray-400 flex-shrink-0"
                        />
                      )}
                      <span className="text-sm text-gray-200 truncate">
                        {s.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingSourceId(s.id);
                          setSourceFormOpen(true);
                        }}
                        className="text-gray-500 hover:text-gray-200"
                        title="Edit"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            window.confirm(`Delete source "${s.name}"?`)
                          ) {
                            deleteAnsibleSource(s.id);
                            if (selectedSourceId === s.id)
                              setSelectedSourceId(null);
                          }
                        }}
                        className="text-gray-500 hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 pl-5 text-[11px] text-gray-600 truncate">
                    {node ? node.name : "⚠ control node not found"}
                    {s.origin === "git" && s.branch && (
                      <span className="flex items-center gap-0.5 text-gray-600">
                        <GitBranch size={10} /> {s.branch}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Playbooks of the selected source */}
          {source && (
            <div className="border-t border-slate-700/40 flex flex-col max-h-[45%]">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/30">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Playbooks
                </span>
                <button
                  onClick={() => {
                    const name = window.prompt("Playbook name:");
                    if (!name) return;
                    const relativePath = window.prompt(
                      "Relative path (e.g. site.yml or plays/deploy.yml):",
                      name.endsWith(".yml") ? name : `${name}.yml`,
                    );
                    if (!relativePath) return;
                    addAnsiblePlaybook({
                      id: crypto.randomUUID(),
                      sourceId: source.id,
                      name,
                      relativePath,
                      defaultCheck: true,
                    });
                  }}
                  className="text-gray-400 hover:text-accent-300 transition-colors"
                  title="Add playbook"
                >
                  <Plus size={15} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {playbooks.length === 0 && (
                  <p className="px-3 py-2 text-xs text-gray-600">
                    No playbooks in this source.
                  </p>
                )}
                {playbooks.map((p) => {
                  const active = p.id === selectedPlaybookId;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPlaybookId(p.id)}
                      className={`group px-3 py-1.5 cursor-pointer border-l-2 ${
                        active
                          ? "border-accent-500 bg-slate-800/60"
                          : "border-transparent hover:bg-slate-800/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-gray-200 truncate">
                          {p.name}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete "${p.name}"?`)) {
                              deleteAnsiblePlaybook(p.id);
                              if (selectedPlaybookId === p.id)
                                setSelectedPlaybookId(null);
                            }
                          }}
                          className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div className="pl-0 text-[11px] text-gray-600 font-mono truncate">
                        {p.relativePath}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: run console */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Run controls */}
          <div className="px-4 py-3 border-b border-slate-700/40 bg-slate-900/30 space-y-2.5">
            {!playbook ? (
              <p className="text-sm text-gray-500">
                Select a playbook on the left to run it.
              </p>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-200 font-medium">
                    {playbook.name}
                  </span>
                  <span className="text-xs text-gray-600 font-mono">
                    {playbook.relativePath}
                  </span>
                  {phase && (
                    <span
                      className={`ml-auto text-[11px] px-2 py-0.5 rounded-full border ${
                        phase === "error"
                          ? "text-red-300 border-red-500/40 bg-red-500/10"
                          : phase === "done"
                            ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10"
                            : "text-accent-300 border-accent-500/40 bg-accent-500/10"
                      }`}
                    >
                      {STATUS_LABEL[phase] ?? phase}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-gray-400">
                    <span>--limit</span>
                    <input
                      value={limit}
                      onChange={(e) => setLimit(e.target.value)}
                      placeholder="host or group"
                      className="bg-slate-800/60 border border-slate-700/50 rounded px-2 py-1 text-xs text-gray-100 font-mono w-40 focus:outline-none focus:border-accent-500/60"
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-400 flex-1 min-w-[180px]">
                    <span>-e</span>
                    <input
                      value={extraVars}
                      onChange={(e) => setExtraVars(e.target.value)}
                      placeholder='var=value or "@vars.yml"'
                      className="bg-slate-800/60 border border-slate-700/50 rounded px-2 py-1 text-xs text-gray-100 font-mono flex-1 focus:outline-none focus:border-accent-500/60"
                    />
                  </label>
                  <label
                    className={`flex items-center gap-1.5 text-xs cursor-pointer px-2 py-1 rounded border ${
                      check
                        ? "text-amber-300 border-amber-500/40 bg-amber-500/10"
                        : "text-gray-400 border-slate-700/50"
                    }`}
                    title="Dry-run (--check): applies no changes"
                  >
                    <input
                      type="checkbox"
                      checked={check}
                      onChange={(e) => setCheck(e.target.checked)}
                      className="accent-amber-500"
                    />
                    dry-run
                  </label>
                  {running ? (
                    <Button
                      size="sm"
                      onClick={cancelRun}
                      className="bg-red-600/90 hover:bg-red-600 text-white gap-1"
                    >
                      <Square size={13} /> Cancel
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={startRun}
                      disabled={!controlNode}
                      className="bg-accent-600/90 hover:bg-accent-600 text-white gap-1"
                    >
                      <Play size={13} />
                      {check ? "Dry-run" : "Run"}
                    </Button>
                  )}
                </div>
                {!controlNode && (
                  <p className="text-[11px] text-red-400">
                    This source's control node no longer exists. Edit the
                    source and pick a valid SSH connection.
                  </p>
                )}
              </>
            )}
          </div>

          {/* Console */}
          <div
            ref={consoleRef}
            className="flex-1 overflow-y-auto bg-slate-950 px-4 py-3 font-mono text-xs leading-relaxed"
          >
            {lines.length === 0 ? (
              <p className="text-gray-700">
                {running ? (
                  <span className="flex items-center gap-1.5 text-accent-400">
                    <Loader2 size={12} className="animate-spin" /> starting…
                  </span>
                ) : (
                  "Playbook output will appear here."
                )}
              </p>
            ) : (
              lines.map((l, i) => (
                <div
                  key={i}
                  className={`whitespace-pre-wrap break-all ${
                    l.stream === "stderr"
                      ? "text-red-300"
                      : l.stream === "meta"
                        ? "text-emerald-400"
                        : "text-gray-300"
                  }`}
                >
                  {l.text}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {sourceFormOpen && (
        <AnsibleSourceForm
          sourceId={editingSourceId}
          onClose={() => setSourceFormOpen(false)}
          onSaved={(id) => {
            setSelectedSourceId(id);
            setSelectedPlaybookId(null);
            setSourceFormOpen(false);
          }}
        />
      )}
    </div>
  );
}
