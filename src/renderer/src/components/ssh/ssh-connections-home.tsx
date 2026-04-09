import { useState } from "react";
import { Plus, Server, Pencil, Trash2, Terminal, KeyRound, ChevronDown, ChevronRight } from "lucide-react";
import { useAppContext } from "@renderer/contexts/app-context";
import SSHDialog from "./ssh-dialog";
import { useTags } from "@renderer/hooks/useTags";
import { CustomTag } from "@renderer/types/tabs";

type Props = {
  onConnect: (conn: SSHConnectionEntry) => void;
};

const UNTAGGED_ID = "__untagged__";

type Group = {
  id: string;
  tag: CustomTag | null;
  connections: SSHConnectionEntry[];
};

function buildGroups(
  connections: SSHConnectionEntry[],
  allTags: CustomTag[]
): Group[] {
  const groups: Group[] = [];

  for (const tag of allTags) {
    const matched = connections.filter((c) => c.tags?.includes(tag.id));
    if (matched.length > 0) {
      groups.push({ id: tag.id, tag, connections: matched });
    }
  }

  const untagged = connections.filter(
    (c) => !c.tags || c.tags.length === 0
  );
  if (untagged.length > 0) {
    groups.push({ id: UNTAGGED_ID, tag: null, connections: untagged });
  }

  return groups;
}

export default function SSHConnectionsHome({ onConnect }: Props) {
  const { sshConnections, deleteSSHConnection } = useAppContext();
  const allTags = useTags();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editConn, setEditConn] = useState<SSHConnectionEntry | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem("ssh-accordion-state");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const openAdd = () => {
    setEditConn(null);
    setDialogOpen(true);
  };

  const openEdit = (conn: SSHConnectionEntry) => {
    setEditConn(conn);
    setDialogOpen(true);
  };

  const handleDelete = (id: string, hasPassword?: boolean) => {
    if (confirm("Delete this SSH connection?")) {
      deleteSSHConnection(id);
      if (hasPassword) {
        window.electron.ipcRenderer.send("ssh-password-delete", id);
      }
    }
  };

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [groupId]: !(prev[groupId] ?? true) };
      localStorage.setItem("ssh-accordion-state", JSON.stringify(next));
      return next;
    });
  };

  const isGroupOpen = (groupId: string) => openGroups[groupId] ?? true;

  const groups = buildGroups(sshConnections, allTags);

  return (
    <>
      <SSHDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editConnection={editConn}
      />

      <div className="h-full flex flex-col items-center overflow-y-auto relative">
        {/* Radial glow behind hero */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at top, rgba(var(--accent-rgb),0.06) 0%, transparent 70%)' }}
        />

        <div className="my-auto flex flex-col items-center w-full px-8 py-12">

          {/* Hero icon */}
          <div className="mb-8 flex flex-col items-center gap-4 relative">
            <div
              className="w-16 h-16 rounded-2xl bg-slate-900/80 border border-accent-500/20 flex items-center justify-center"
              style={{ boxShadow: '0 0 30px rgba(var(--accent-rgb),0.12), inset 0 1px 0 rgba(var(--accent-rgb),0.1)' }}
            >
              <Terminal className="w-8 h-8 text-accent-400" style={{ filter: 'drop-shadow(0 0 8px rgba(var(--accent-rgb),0.6))' }} />
            </div>
            <div className="text-center">
              <h2 className="text-base font-semibold tracking-widest text-gray-300">
                <span className="text-accent-400">calico</span>
                <span className="text-slate-600 mx-1">/</span>
                <span>term</span>
              </h2>
              <p className="text-xs text-gray-600 mt-1 tracking-wide">
                open a terminal or connect to a saved ssh server
              </p>
            </div>
          </div>

          {/* SSH Connections */}
          <div className="w-full max-w-2xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-widest text-gray-500 font-semibold">
                SSH Connections
              </span>
              <button
                onClick={openAdd}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                bg-accent-600/20 text-accent-400 border border-accent-600/30
                hover:bg-accent-600/30 hover:border-accent-500/50 transition-all duration-150"
              >
                <Plus size={13} />
                New Connection
              </button>
            </div>

            {sshConnections.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center gap-3 py-10 rounded-xl
                border border-dashed border-slate-700/60 text-gray-500"
              >
                <Server size={28} className="opacity-40" />
                <p className="text-sm">No saved connections yet</p>
                <button
                  onClick={openAdd}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium
                  bg-slate-800/60 border border-slate-700/50 text-gray-400
                  hover:bg-accent-500/10 hover:text-accent-300 hover:border-accent-500/40
                  transition-all duration-150"
                >
                  <Plus size={15} />
                  Add your first connection
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {groups.map((group) => (
                  <TagGroup
                    key={group.id}
                    group={group}
                    isOpen={isGroupOpen(group.id)}
                    onToggle={() => toggleGroup(group.id)}
                    onConnect={onConnect}
                    onEdit={openEdit}
                    onDelete={(id, hasPassword) => handleDelete(id, hasPassword)}
                  />
                ))}

                {/* Add more */}
                <button
                  onClick={openAdd}
                  className="flex items-center justify-center gap-2 h-10 rounded-xl
                  border border-dashed border-slate-700/60 text-gray-600
                  hover:border-accent-600/40 hover:text-accent-500/70
                  transition-all duration-150 text-sm"
                >
                  <Plus size={15} />
                  Add connection
                </button>
              </div>
            )}
          </div>

          {/* Hint */}
          <p className="mt-8 text-[11px] text-gray-700 tracking-wide">
            press{" "}
            <kbd className="px-1.5 py-0.5 bg-slate-800/50 border border-slate-700/40 rounded text-accent-400/60 text-[10px]">
              +
            </kbd>{" "}
            in the tab bar to open a local terminal
          </p>

        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// TagGroup accordion
// ---------------------------------------------------------------------------

type TagGroupProps = {
  group: Group;
  isOpen: boolean;
  onToggle: () => void;
  onConnect: (conn: SSHConnectionEntry) => void;
  onEdit: (conn: SSHConnectionEntry) => void;
  onDelete: (id: string, hasPassword?: boolean) => void;
};

function TagGroup({ group, isOpen, onToggle, onConnect, onEdit, onDelete }: TagGroupProps) {
  const { tag, connections } = group;
  const color = tag?.color ?? "#64748b"; // slate-500 for untagged
  const label = tag?.name ?? "Untagged";
  const preview = connections
    .slice(0, 3)
    .map((c) => c.name)
    .join(" · ");
  const hasMore = connections.length > 3;

  return (
    <div className="rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Accordion header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-2.5
          bg-slate-800/60 hover:bg-slate-800/90 transition-colors duration-150 text-left"
      >
        {/* Color dot */}
        <span
          className="flex-shrink-0 w-2 h-2 rounded-full"
          style={{ backgroundColor: color }}
        />

        {/* Tag name */}
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color }}>
          {label}
        </span>

        {/* Count badge */}
        <span
          className="flex-shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium border"
          style={{
            backgroundColor: `${color}18`,
            color,
            borderColor: `${color}40`,
          }}
        >
          {connections.length}
        </span>

        {/* Mini preview — only when collapsed */}
        {!isOpen && (
          <span className="flex-1 min-w-0 text-xs text-gray-600 truncate">
            {preview}{hasMore ? " …" : ""}
          </span>
        )}

        <span className="ml-auto flex-shrink-0 text-gray-500">
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>

      {/* Accordion body */}
      <div
        className="transition-all duration-200 ease-in-out"
        style={{ display: isOpen ? undefined : "none" }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3">
          {connections.map((conn) => (
            <SSHConnectionCard
              key={conn.id}
              conn={conn}
              showTags={!tag} // show tag chips only in Untagged group
              onConnect={onConnect}
              onEdit={onEdit}
              onDelete={(id) => onDelete(id, conn.hasPassword)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

type CardProps = {
  conn: SSHConnectionEntry;
  showTags: boolean;
  onConnect: (conn: SSHConnectionEntry) => void;
  onEdit: (conn: SSHConnectionEntry) => void;
  onDelete: (id: string) => void;
};

function SSHConnectionCard({ conn, showTags, onConnect, onEdit, onDelete }: CardProps) {
  const customTags = useTags();
  const assignedTags = customTags.filter((t) => conn.tags?.includes(t.id));
  return (
    <div
      className="group relative flex items-center gap-3 p-3.5 rounded-xl
        bg-slate-800/50 border border-slate-700/50
        hover:bg-slate-800/80 hover:border-slate-600/60
        transition-all duration-150 cursor-pointer"
      onClick={() => onConnect(conn)}
    >
      {/* Icon */}
      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-accent-500/10 border border-accent-500/20 flex items-center justify-center">
        <Server size={16} className="text-accent-400/80" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-gray-200 truncate">{conn.name}</p>
          {conn.hasPassword && (
            <KeyRound size={10} className="text-accent-400/60 flex-shrink-0" aria-label="Password saved" />
          )}
        </div>
        <p className="text-xs text-gray-500 font-mono truncate mt-0.5">
          {conn.username}@{conn.host}
          {conn.port !== 22 ? `:${conn.port}` : ""}
        </p>
        {showTags && assignedTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {assignedTags.map((tag) => (
              <span
                key={tag.id}
                className="px-1.5 py-0.5 rounded-full text-[10px] font-medium border"
                style={{
                  backgroundColor: `${tag.color}18`,
                  color: tag.color,
                  borderColor: `${tag.color}50`,
                }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions — visible on hover */}
      <div
        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          title="Edit"
          onClick={() => onEdit(conn)}
          className="p-1.5 rounded-md text-gray-500 hover:text-accent-400 hover:bg-slate-700/60 transition-colors"
        >
          <Pencil size={13} />
        </button>
        <button
          title="Delete"
          onClick={() => onDelete(conn.id)}
          className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-slate-700/60 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Connect indicator on hover */}
      <div className="absolute inset-0 rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <div className="absolute inset-0 rounded-xl ring-1 ring-accent-500/20" />
      </div>
    </div>
  );
}
