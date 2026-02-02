import { createPortal } from 'react-dom';
import { Edit2, Copy, X, XCircle, Tag, ChevronRight } from 'lucide-react';
import { ContextMenuState } from '../../types/tabs';

interface TabContextMenuProps {
  contextMenu: ContextMenuState;
  canCloseTab: boolean;
  canCloseOthers: boolean;
  canCloseToRight: boolean;
  onRename: () => void;
  onDuplicate: () => void;
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
  onClose,
  onCloseOthers,
  onCloseToRight,
  onTagsHover,
  onTagsLeave
}: TabContextMenuProps) {
  return createPortal(
    <div
      className="context-menu fixed bg-slate-800/98 backdrop-blur-md border border-slate-700/60 rounded-lg shadow-2xl shadow-black/40 py-1.5 min-w-[180px]"
      style={{
        left: contextMenu.x,
        top: contextMenu.y,
        zIndex: 9999999
      }}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-slate-700/50 hover:text-cyan-300 flex items-center gap-2 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          onRename();
        }}
      >
        <Edit2 size={14} />
        <span>Rename</span>
        <span className="ml-auto text-xs text-gray-500">F2</span>
      </button>
      <button
        className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-slate-700/50 hover:text-cyan-300 flex items-center gap-2 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          onDuplicate();
        }}
      >
        <Copy size={14} />
        <span>Duplicate</span>
        <span className="ml-auto text-xs text-gray-500">Ctrl+Shift+D</span>
      </button>

      <div className="h-px bg-slate-700/50 my-1.5"></div>

      {/* Tags submenu trigger */}
      <button
        className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-slate-700/50 hover:text-cyan-300 flex items-center gap-2 transition-colors relative"
        onMouseEnter={onTagsHover}
        onMouseLeave={onTagsLeave}
      >
        <Tag size={14} />
        <span>Tags</span>
        <ChevronRight size={14} className="ml-auto" />
      </button>

      <div className="h-px bg-slate-700/50 my-1.5"></div>

      <button
        className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-slate-700/50 hover:text-red-400 flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={(e) => {
          e.stopPropagation();
          if (canCloseTab) onClose();
        }}
        disabled={!canCloseTab}
      >
        <X size={14} />
        <span>Close</span>
        <span className="ml-auto text-xs text-gray-500">Ctrl+W</span>
      </button>
      <button
        className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-slate-700/50 hover:text-red-400 flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
        className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-slate-700/50 hover:text-red-400 flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
    document.body
  );
}
