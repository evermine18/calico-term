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
  Laptop,
  Loader2,
  ScrollText,
  RefreshCw,
  FileSearch,
  Save,
} from "lucide-react";
import { Button } from "@renderer/components/ui/button";
import AnsibleSourceForm from "./source-form";
import AddPlaybookDialog from "./add-playbook-dialog";

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
  preparing: "Preparing…",
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
    updateAnsiblePlaybook,
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
  const [playbookDialogOpen, setPlaybookDialogOpen] = useState(false);

  // Playbook discovery for the selected source.
  const [detected, setDetected] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // --limit autocomplete targets, loaded lazily from the source's inventory.
  const [invTargets, setInvTargets] = useState<{
    groups: string[];
    hosts: string[];
  }>({ groups: [], hosts: [] });
  const invLoadedKeyRef = useRef<string>("");

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
  const isLocal = source?.origin === "local";
  const controlNode =
    source && !isLocal
      ? sshConnections.find((c) => c.id === source.sshConnectionId)
      : null;
  // Local sources need no control node; everything else does.
  const canRun = isLocal || !!controlNode;

  // Merge scan results in as transient (unregistered) playbook entries, so they
  // are selectable and runnable without being persisted. Registering one (the
  // "+" on a detected row) turns it into a real AnsiblePlaybookEntry.
  const registeredPaths = new Set(playbooks.map((p) => p.relativePath));
  const detectedEntries: AnsiblePlaybookEntry[] = detected
    .filter((rel) => !registeredPaths.has(rel))
    .map((rel) => ({
      id: `detected:${rel}`,
      sourceId: source?.id ?? "",
      name: rel.split("/").pop()?.replace(/\.ya?ml$/i, "") ?? rel,
      relativePath: rel,
      defaultCheck: true,
    }));
  const shownPlaybooks = [...playbooks, ...detectedEntries];
  const playbook =
    shownPlaybooks.find((p) => p.id === selectedPlaybookId) ?? null;

  // Scan the selected source for playbooks. For remote sources the control node
  // must exist; git sources only return results once the repo has been synced
  // by a prior run.
  const runScan = async (src: AnsibleSourceEntry): Promise<void> => {
    const node =
      src.origin !== "local"
        ? sshConnections.find((c) => c.id === src.sshConnectionId)
        : undefined;
    if (src.origin !== "local" && !node) {
      setDetected([]);
      setScanError(null);
      return;
    }
    setScanning(true);
    setScanError(null);
    try {
      const res = await window.api.ansible.listPlaybooks({
        sourceId: src.id,
        origin: src.origin,
        conn: node ? toControlNode(node, sshConnections) : undefined,
        subdir: src.subdir,
        basePath: src.basePath,
        localPath: src.localPath,
      });
      if (res.ok) setDetected(res.playbooks);
      else {
        setDetected([]);
        setScanError(res.error ?? "Scan failed");
      }
    } catch (err) {
      setDetected([]);
      setScanError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  };

  // Lazily fetch the --limit autocomplete targets for a source (once per
  // source; triggered when the user focuses the limit field). Runs
  // `ansible-inventory --list` under the hood, so it's on-demand only.
  const loadInvTargets = async (src: AnsibleSourceEntry): Promise<void> => {
    if (invLoadedKeyRef.current === src.id) return;
    const node =
      src.origin !== "local"
        ? sshConnections.find((c) => c.id === src.sshConnectionId)
        : undefined;
    if (src.origin !== "local" && !node) return;
    invLoadedKeyRef.current = src.id;
    const res = await window.api.ansible.listInventory({
      sourceId: src.id,
      origin: src.origin,
      conn: node ? toControlNode(node, sshConnections) : undefined,
      subdir: src.subdir,
      basePath: src.basePath,
      localPath: src.localPath,
      inventoryMode: src.inventoryMode,
      inventoryFile: src.inventoryFile,
      inventoryHosts:
        src.inventoryMode === "auto"
          ? sshConnections.map((c) => ({
              name: c.name,
              host: c.host,
              port: c.port,
              username: c.username,
              tags: c.tags,
            }))
          : undefined,
    });
    if (res.ok) setInvTargets({ groups: res.groups, hosts: res.hosts });
    else invLoadedKeyRef.current = ""; // allow a retry after a failure
  };

  // Auto-scan whenever the selected source changes.
  useEffect(() => {
    setDetected([]);
    setScanError(null);
    setInvTargets({ groups: [], hosts: [] });
    invLoadedKeyRef.current = "";
    if (source) runScan(source);
  }, [selectedSourceId]);

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
    if (!source || !playbook || !canRun) return;
    // Remember the values used for this playbook so they're pre-filled next time.
    persistPlaybookDefaults();
    const runId = crypto.randomUUID();
    runIdRef.current = runId;
    setLines([]);
    setRunning(true);
    setPhase(isLocal ? "preparing" : "connecting");

    const payload: AnsibleRunPayload = {
      runId,
      sourceId: source.id,
      conn: controlNode
        ? toControlNode(controlNode, sshConnections)
        : undefined,
      origin: source.origin,
      repoUrl: source.repoUrl,
      branch: source.branch,
      deployKeyId: source.deployKeyId,
      subdir: source.subdir,
      basePath: source.basePath,
      localPath: source.localPath,
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

  const addManualPlaybook = (name: string, relativePath: string): void => {
    if (!source) return;
    const id = crypto.randomUUID();
    addAnsiblePlaybook({
      id,
      sourceId: source.id,
      name,
      relativePath,
      defaultCheck: true,
    });
    setPlaybookDialogOpen(false);
    setSelectedPlaybookId(id);
  };

  // Persist a detected (transient) playbook so it survives rescans and can carry
  // per-playbook run defaults.
  const registerDetected = (entry: AnsiblePlaybookEntry): void => {
    const id = crypto.randomUUID();
    addAnsiblePlaybook({ ...entry, id });
    setSelectedPlaybookId(id);
  };

  // Save the current --limit / -e / dry-run values as the selected playbook's
  // defaults (they re-seed the controls next time it's picked). If the playbook
  // was only detected, this also registers it.
  const persistPlaybookDefaults = (): void => {
    if (!playbook) return;
    const defaults = {
      defaultLimit: limit.trim() || undefined,
      defaultExtraVars: extraVars.trim() || undefined,
      defaultCheck: check,
    };
    if (playbook.id.startsWith("detected:")) {
      const id = crypto.randomUUID();
      addAnsiblePlaybook({ ...playbook, id, ...defaults });
      setSelectedPlaybookId(id);
    } else {
      updateAnsiblePlaybook({ ...playbook, ...defaults });
    }
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-surface/98 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-hairline/40 bg-panel/80">
        <div className="flex items-center gap-2 text-ink-muted">
          <ScrollText size={16} className="text-accent-400" />
          <span className="text-sm font-semibold tracking-wide">
            Ansible Runner
          </span>
        </div>
        <button
          onClick={onClose}
          className="flex items-center justify-center w-7 h-7 rounded text-ink-subtle hover:bg-elevated/60 hover:text-ink-muted transition-colors"
          title="Close"
        >
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Left: sources + playbooks */}
        <div className="w-72 flex-shrink-0 border-r border-hairline/40 flex flex-col bg-panel/40">
          <div className="flex items-center justify-between px-3 py-2 border-b border-hairline/30">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
              Sources
            </span>
            <button
              onClick={() => {
                setEditingSourceId(null);
                setSourceFormOpen(true);
              }}
              className="text-ink-muted hover:text-accent-300 transition-colors"
              title="New source"
            >
              <Plus size={15} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {ansibleSources.length === 0 && (
              <p className="px-3 py-3 text-xs text-ink-subtle">
                No sources yet. Create one to register a Git repo, a folder on
                a control node, or a playbook on this machine.
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
                      ? "border-accent-500 bg-elevated/60"
                      : "border-transparent hover:bg-elevated/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {s.origin === "git" ? (
                        <FolderGit2
                          size={13}
                          className="text-accent-400 flex-shrink-0"
                        />
                      ) : s.origin === "local" ? (
                        <Laptop
                          size={13}
                          className="text-ink-muted flex-shrink-0"
                        />
                      ) : (
                        <Server
                          size={13}
                          className="text-ink-muted flex-shrink-0"
                        />
                      )}
                      <span className="text-sm text-ink-muted truncate">
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
                        className="text-ink-subtle hover:text-ink-muted"
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
                        className="text-ink-subtle hover:text-danger"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 pl-5 text-[11px] text-ink-subtle truncate">
                    {s.origin === "local"
                      ? "Local machine"
                      : node
                        ? node.name
                        : "⚠ control node not found"}
                    {s.origin === "git" && s.branch && (
                      <span className="flex items-center gap-0.5 text-ink-subtle">
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
            <div className="border-t border-hairline/40 flex flex-col max-h-[45%]">
              <div className="flex items-center justify-between px-3 py-2 border-b border-hairline/30">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                  Playbooks
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => runScan(source)}
                    disabled={scanning}
                    className="text-ink-muted hover:text-accent-300 transition-colors disabled:opacity-40"
                    title="Rescan source for playbooks"
                  >
                    <RefreshCw
                      size={13}
                      className={scanning ? "animate-spin" : ""}
                    />
                  </button>
                  <button
                    onClick={() => setPlaybookDialogOpen(true)}
                    className="text-ink-muted hover:text-accent-300 transition-colors"
                    title="Add playbook manually"
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {shownPlaybooks.length === 0 && (
                  <p className="px-3 py-2 text-xs text-ink-subtle">
                    {scanning
                      ? "Scanning for playbooks…"
                      : scanError
                        ? `⚠ ${scanError}`
                        : "No playbooks detected. Rescan or add one manually with +."}
                  </p>
                )}
                {shownPlaybooks.map((p) => {
                  const active = p.id === selectedPlaybookId;
                  const isDetected = p.id.startsWith("detected:");
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPlaybookId(p.id)}
                      className={`group px-3 py-1.5 cursor-pointer border-l-2 ${
                        active
                          ? "border-accent-500 bg-elevated/60"
                          : "border-transparent hover:bg-elevated/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-ink-muted truncate flex items-center gap-1.5">
                          {isDetected && (
                            <FileSearch
                              size={12}
                              className="text-ink-subtle flex-shrink-0"
                            />
                          )}
                          {p.name}
                        </span>
                        {isDetected ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              registerDetected(p);
                            }}
                            className="text-ink-subtle hover:text-accent-300 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Add to this source"
                          >
                            <Plus size={13} />
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Delete "${p.name}"?`)) {
                                deleteAnsiblePlaybook(p.id);
                                if (selectedPlaybookId === p.id)
                                  setSelectedPlaybookId(null);
                              }
                            }}
                            className="text-ink-subtle hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      <div className="pl-0 text-[11px] text-ink-subtle font-mono truncate">
                        {p.relativePath}
                        {isDetected && (
                          <span className="ml-1.5 not-italic text-ink-subtle/70">
                            · detected
                          </span>
                        )}
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
          <div className="px-4 py-3 border-b border-hairline/40 bg-panel/30 space-y-2.5">
            {!playbook ? (
              <p className="text-sm text-ink-subtle">
                Select a playbook on the left to run it.
              </p>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-ink-muted font-medium">
                    {playbook.name}
                  </span>
                  <span className="text-xs text-ink-subtle font-mono">
                    {playbook.relativePath}
                  </span>
                  {phase && (
                    <span
                      className={`ml-auto text-[11px] px-2 py-0.5 rounded-full border ${
                        phase === "error"
                          ? "text-danger border-danger/40 bg-danger/10"
                          : phase === "done"
                            ? "text-success border-success/40 bg-success/10"
                            : "text-accent-300 border-accent-500/40 bg-accent-500/10"
                      }`}
                    >
                      {STATUS_LABEL[phase] ?? phase}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                    <span>--limit</span>
                    <input
                      value={limit}
                      onChange={(e) => setLimit(e.target.value)}
                      onFocus={() => source && loadInvTargets(source)}
                      list="ansible-limit-targets"
                      placeholder="empty = all"
                      title="Restrict to a host/group. Empty runs every host the playbook targets."
                      className="bg-elevated/60 border border-hairline/50 rounded px-2 py-1 text-xs text-ink font-mono w-40 focus:outline-none focus:border-accent-500/60"
                    />
                    <datalist id="ansible-limit-targets">
                      {invTargets.groups.map((g) => (
                        <option key={`g:${g}`} value={g} label="group" />
                      ))}
                      {invTargets.hosts.map((h) => (
                        <option key={`h:${h}`} value={h} label="host" />
                      ))}
                    </datalist>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-ink-muted flex-1 min-w-[180px]">
                    <span>-e</span>
                    <input
                      value={extraVars}
                      onChange={(e) => setExtraVars(e.target.value)}
                      placeholder='var=value or "@vars.yml"'
                      className="bg-elevated/60 border border-hairline/50 rounded px-2 py-1 text-xs text-ink font-mono flex-1 focus:outline-none focus:border-accent-500/60"
                    />
                  </label>
                  <label
                    className={`flex items-center gap-1.5 text-xs cursor-pointer px-2 py-1 rounded border ${
                      check
                        ? "text-warning border-warning/40 bg-warning/10"
                        : "text-ink-muted border-hairline/50"
                    }`}
                    title="Dry-run (--check): applies no changes"
                  >
                    <input
                      type="checkbox"
                      checked={check}
                      onChange={(e) => setCheck(e.target.checked)}
                      className="accent-warning"
                    />
                    dry-run
                  </label>
                  {!running && (
                    <button
                      onClick={persistPlaybookDefaults}
                      title="Save these values as this playbook's defaults"
                      className="flex items-center gap-1 text-[11px] text-ink-muted hover:text-accent-300 border border-hairline/50 rounded px-2 py-1 transition-colors"
                    >
                      <Save size={12} /> Defaults
                    </button>
                  )}
                  {running ? (
                    <Button
                      size="sm"
                      onClick={cancelRun}
                      className="bg-danger/90 hover:bg-danger text-on-accent gap-1"
                    >
                      <Square size={13} /> Cancel
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={startRun}
                      disabled={!canRun}
                      className="bg-accent-600/90 hover:bg-accent-600 text-on-accent gap-1"
                    >
                      <Play size={13} />
                      {check ? "Dry-run" : "Run"}
                    </Button>
                  )}
                </div>
                {!canRun && (
                  <p className="text-[11px] text-danger">
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
            className="flex-1 overflow-y-auto bg-surface px-4 py-3 font-mono text-xs leading-relaxed"
          >
            {lines.length === 0 ? (
              <p className="text-ink-subtle">
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
                      ? "text-danger"
                      : l.stream === "meta"
                        ? "text-success"
                        : "text-ink-muted"
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

      {playbookDialogOpen && (
        <AddPlaybookDialog
          onClose={() => setPlaybookDialogOpen(false)}
          onAdd={addManualPlaybook}
        />
      )}
    </div>
  );
}
