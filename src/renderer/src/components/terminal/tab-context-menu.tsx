import { createPortal } from "react-dom";
import {
  Edit2,
  Copy,
  ExternalLink,
  X,
  XCircle,
  Tag,
  ChevronRight,
} from "lucide-react";
import { ContextMenuState } from "../../types/tabs";

interface TabContextMenuProps {
  contextMenu: ContextMenuState;
  canCloseTab: boolean;
  canCloseOthers: boolean;
  canCloseToRight: boolean;
  onRename: () => void;
  onDuplicate: () => void;
  onDetach: () => void;
  onClose: () => void;
  onCloseOthers: () => void;
  onCloseToRight: () => void;
  onTagsHover: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onTagsLeave: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export function TabContextMenu({
  contextMenu,
  canCloseTab,
  canCloseOthers,
  canCloseToRight,
  onRename,
  onDuplicate,
  onDetach,
  onClose,
  onCloseOthers,
  onCloseToRight,
  onTagsHover,
  onTagsLeave,
}: TabContextMenuProps) {
  return createPortal(
    <div
      className="context-menu fixed bg-elevated/98 backdrop-blur-md border border-hairline/60 rounded-lg shadow-2xl shadow-black/40 py-1.5 min-w-[180px]"
      style={{
        left: contextMenu.x,
        top: contextMenu.y,
        zIndex: 9999999,
      }}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="w-full px-3 py-2 text-left text-sm text-ink-muted hover:bg-elevated/50 hover:text-accent-300 flex items-center gap-2 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          onRename();
        }}
      >
        <Edit2 size={14} />
        <span>Rename</span>
        <span className="ml-auto text-xs text-ink-subtle">F2</span>
      </button>
      <button
        className="w-full px-3 py-2 text-left text-sm text-ink-muted hover:bg-elevated/50 hover:text-accent-300 flex items-center gap-2 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          onDuplicate();
        }}
      >
        <Copy size={14} />
        <span>Duplicate</span>
        <span className="ml-auto text-xs text-ink-subtle">Ctrl+Shift+D</span>
      </button>
      <button
        className="w-full px-3 py-2 text-left text-sm text-ink-muted hover:bg-elevated/50 hover:text-accent-300 flex items-center gap-2 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          onDetach();
        }}
      >
        <ExternalLink size={14} />
        <span>Open in New Window</span>
      </button>

      <div className="h-px bg-hairline/50 my-1.5"></div>

      {/* Tags submenu trigger */}
      <button
        className="w-full px-3 py-2 text-left text-sm text-ink-muted hover:bg-elevated/50 hover:text-accent-300 flex items-center gap-2 transition-colors relative"
        onMouseEnter={onTagsHover}
        onMouseLeave={onTagsLeave}
      >
        <Tag size={14} />
        <span>Tags</span>
        <ChevronRight size={14} className="ml-auto" />
      </button>

      <div className="h-px bg-hairline/50 my-1.5"></div>

      <button
        className="w-full px-3 py-2 text-left text-sm text-ink-muted hover:bg-elevated/50 hover:text-danger flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={(e) => {
          e.stopPropagation();
          if (canCloseTab) onClose();
        }}
        disabled={!canCloseTab}
      >
        <X size={14} />
        <span>Close</span>
        <span className="ml-auto text-xs text-ink-subtle">Ctrl+W</span>
      </button>
      <button
        className="w-full px-3 py-2 text-left text-sm text-ink-muted hover:bg-elevated/50 hover:text-danger flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={(e) => {
          e.stopPropagation();
          if (canCloseOthers) onCloseOthers();
        }}
        disabled={!canCloseOthers}
      >
        <XCircle size={14} />
        <span>Close Others</span>
      </button>
      <button
        className="w-full px-3 py-2 text-left text-sm text-ink-muted hover:bg-elevated/50 hover:text-danger flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={(e) => {
          e.stopPropagation();
          if (canCloseToRight) onCloseToRight();
        }}
        disabled={!canCloseToRight}
      >
        <XCircle size={14} />
        <span>Close to the Right</span>
      </button>
    </div>,
    document.body,
  );
}
