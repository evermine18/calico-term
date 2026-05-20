import { TerminalSquare, Server, X } from 'lucide-react';
import { TabBadge } from './tab-badge';
import { TabEditInput } from './tab-edit-input';
import { CustomTag } from '../../types/tabs';
import { useAppContext } from '../../contexts/app-context';
import {
  shouldShowWorkspaceIdentity,
  workspaceForConnection,
} from '../../lib/workspace-helpers';

function WorkspaceDot({ connId }: { connId?: string }) {
  const { workspaces, activeWorkspaceId } = useAppContext();
  if (!connId) return null;
  const owning = workspaces.filter((w) =>
    w.sshConnectionIds.includes(connId),
  );
  if (owning.length === 0) return null;
  // Prefer the active workspace when the connection belongs to several.
  const ws =
    owning.find((w) => w.id === activeWorkspaceId) ?? owning[0];
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

function useTabAccent(connId?: string): {
  borderColor: string | undefined;
  tintBg: string | undefined;
} {
  const { workspaces, activeWorkspaceId, workspaceIdentity } = useAppContext();
  const ws = workspaceForConnection(workspaces, activeWorkspaceId, connId);
  if (!shouldShowWorkspaceIdentity(workspaceIdentity, ws) || !ws) {
    return { borderColor: undefined, tintBg: undefined };
  }
  return {
    borderColor: ws.color,
    tintBg: workspaceIdentity === "strong" ? `${ws.color}14` : undefined,
  };
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
  onDragEnd: () => void;
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
  onClose
}: TabItemProps) {
  const accent = useTabAccent(tab.connId);
  const accentStyle: React.CSSProperties = {};
  if (accent.borderColor) {
    accentStyle.borderLeftColor = isActive
      ? accent.borderColor
      : `${accent.borderColor}80`;
  }
  if (isActive && accent.tintBg) {
    accentStyle.backgroundColor = accent.tintBg;
  }
  return (
    <div key={tab.id} className="relative flex flex-col">
      <div
        draggable={tab.mode === 'normal'}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        title={tab.title}
        style={accentStyle}
        className={`tab-item
          relative group flex items-center gap-2 px-3 py-2 rounded-lg
          text-sm font-medium border-l-[3px] border-r border-t border-b
          min-w-[110px] max-w-[200px] flex-shrink-0 cursor-pointer
          backdrop-blur-md transition-all duration-100
          ${isDragged ? 'opacity-50' : ''}
          ${isActive
            ? `bg-gradient-to-br from-slate-800/95 to-slate-800/90 text-gray-100 ${accent.borderColor ? '' : 'border-l-cyan-400'} border-r-slate-700/50 border-t-slate-700/50 border-b-slate-700/50 shadow-xl shadow-accent-500/20 z-10`
            : `bg-slate-900/60 text-gray-400 ${accent.borderColor ? '' : 'border-l-slate-700/50'} border-r-slate-700/30 border-t-slate-700/30 border-b-slate-700/30 hover:bg-slate-800/70 hover:text-accent-100 ${accent.borderColor ? '' : 'hover:border-l-cyan-400/50'} hover:shadow-lg hover:shadow-accent-500/10`
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
        <TabBadge badge={tab.badge} customTags={customTags} isActive={isActive} />

        {/* Activity indicator: pulsing dot when tab has background output */}
        {tab.hasActivity && !isActive && (
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse z-10"
            style={{ boxShadow: '0 0 4px rgba(6,182,212,0.8)' }}
          />
        )}

        {/* Terminal / SSH Icon */}
        <div
          className={`flex-shrink-0 transition-colors duration-100 ${isActive ? 'text-accent-400' : 'text-slate-500 group-hover:text-accent-400/70'
            }`}
        >
          {tab.isSSH
            ? <Server size={14} strokeWidth={2} />
            : <TerminalSquare size={14} strokeWidth={2} />
          }
        </div>
        <WorkspaceDot connId={tab.connId} />


        {/* Tab title */}
        {tab.mode === 'edit' ? (
          <TabEditInput
            tabId={tab.id}
            title={tab.title}
            onTitleChange={onTitleChange}
            onFinishEdit={onFinishEdit}
          />
        ) : (
          <span className="truncate flex-1 select-none font-medium">{tab.title}</span>
        )}

        {/* Close button */}
        {tab.mode === 'normal' && canClose && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            onContextMenu={(e) => {
              e.stopPropagation();
            }}
            className={`w-5 h-5 rounded flex items-center justify-center text-gray-500 
                       hover:text-red-400 hover:bg-red-500/15 transition-colors duration-75 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
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
