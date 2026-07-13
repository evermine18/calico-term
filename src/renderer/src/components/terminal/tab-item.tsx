import { TerminalSquare, Server, X } from "lucide-react";
import { AGENT_LAUNCHERS } from "../../types/ai-agents";
import { TabBadge } from "./tab-badge";
import { TabEditInput } from "./tab-edit-input";
import { CustomTag } from "../../types/tabs";
import { useAppContext } from "../../contexts/app-context";

function WorkspaceDot({ connId }: { connId?: string }) {
  const { workspaces, activeWorkspaceId } = useAppContext();
  if (!connId) return null;
  const owning = workspaces.filter((w) => w.sshConnectionIds.includes(connId));
  if (owning.length === 0) return null;
  // Prefer the active workspace when the connection belongs to several.
  const ws = owning.find((w) => w.id === activeWorkspaceId) ?? owning[0];
  const tooltip =
    owning.length === 1
      ? `Workspace: ${ws.name}${ws.environment === "prod" ? " (PROD)" : ""}`
      : `Workspaces: ${owning.map((w) => w.name).join(", ")}`;
  return (
    <span
      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
      style={{
        backgroundColor: ws.color,
        boxShadow: `0 0 4px ${ws.color}aa`,
      }}
      title={tooltip}
    />
  );
}

interface TabItemProps {
  tab: any;
  isActive: boolean;
  isDragged: boolean;
  canClose: boolean;
  customTags: CustomTag[];
  onSelect: () => void;
  onDoubleClick: () => void;
  onMiddleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onTitleChange: (id: string, title: string) => void;
  onFinishEdit: () => void;
  onClose: () => void;
}

export function TabItem({
  tab,
  isActive,
  isDragged,
  canClose,
  customTags,
  onSelect,
  onDoubleClick,
  onMiddleClick,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onTitleChange,
  onFinishEdit,
  onClose,
}: TabItemProps) {
  const agent = tab.agentId
    ? AGENT_LAUNCHERS.find((a) => a.id === tab.agentId)
    : undefined;

  return (
    <div
      key={tab.id}
      className="relative flex flex-col flex-1 basis-0 min-w-[120px] max-w-[200px]"
    >
      <div
        draggable={tab.mode === "normal"}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        title={tab.title}
        className={`tab-item
          relative group flex items-center gap-2 px-3 py-2 rounded-lg
          text-sm font-medium border-l border-r border-t border-b
          w-full min-w-0 cursor-pointer
          backdrop-blur-md transition-all duration-100
          ${isDragged ? "opacity-50" : ""}
          ${
            isActive
              ? `bg-gradient-to-br from-elevated/95 to-elevated/90 border-accent-600 text-ink z-10`
              : `bg-panel/60 text-ink-muted border-hairline/50 hover:border-transparent hover:bg-elevated/70 hover:text-accent-100 `
          }
        `}
        onClick={onSelect}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onDoubleClick();
        }}
        onMouseDown={(e) => {
          if (e.button === 1) {
            e.preventDefault();
            onMiddleClick();
          }
        }}
        onContextMenu={onContextMenu}
      >
        <TabBadge
          badge={tab.badge}
          customTags={customTags}
          isActive={isActive}
        />

        {/* Activity indicator: pulsing dot when tab has background output */}
        {tab.hasActivity && !isActive && (
          <span
            className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-accent-400 animate-pulse z-10"
            style={{ boxShadow: "0 0 4px rgba(var(--accent-rgb),0.8)" }}
          />
        )}

        {/* Agent glyph / SSH / Terminal icon */}
        <div
          className={`flex-shrink-0 transition-colors duration-100 ${
            isActive
              ? "text-accent-400"
              : "text-ink-subtle group-hover:text-accent-400/70"
          }`}
        >
          {agent ? (
            <span
              className="block text-[14px] leading-none font-semibold"
              style={{
                color: `rgb(${agent.color.join(",")})`,
                opacity: isActive ? 1 : 0.75,
              }}
              title={agent.name}
            >
              {agent.glyph}
            </span>
          ) : tab.isSSH ? (
            <Server size={14} strokeWidth={2} />
          ) : (
            <TerminalSquare size={14} strokeWidth={2} />
          )}
        </div>
        <WorkspaceDot connId={tab.connId} />

        {/* Tab title */}
        {tab.mode === "edit" ? (
          <TabEditInput
            tabId={tab.id}
            title={tab.title}
            onTitleChange={onTitleChange}
            onFinishEdit={onFinishEdit}
          />
        ) : (
          <span className="truncate flex-1 select-none font-medium">
            {tab.title}
          </span>
        )}

        {/* Close button */}
        {tab.mode === "normal" && canClose && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            onContextMenu={(e) => {
              e.stopPropagation();
            }}
            className={`w-5 h-5 rounded flex items-center justify-center text-ink-subtle
                       hover:text-danger hover:bg-danger/15 transition-colors duration-75 ${
                         isActive
                           ? "opacity-100"
                           : "opacity-0 group-hover:opacity-100"
                       }`}
            title="Close (Ctrl+W)"
          >
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
