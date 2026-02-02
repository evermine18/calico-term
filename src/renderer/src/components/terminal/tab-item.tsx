import { TerminalSquare, X } from 'lucide-react';
import { TabBadge } from './tab-badge';
import { TabEditInput } from './tab-edit-input';
import { CustomTag } from '../../types/tabs';

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
  return (
    <div key={tab.id} className="relative flex flex-col">
      <div
        draggable={tab.mode === 'normal'}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        title={tab.title}
        className={`tab-item
          relative group flex items-center gap-2 px-3 py-2 rounded-lg
          text-sm font-medium border-l-[3px] border-r border-t border-b
          min-w-[110px] max-w-[200px] flex-shrink-0 cursor-pointer
          backdrop-blur-md transition-all duration-100
          ${isDragged ? 'opacity-50' : ''}
          ${isActive
            ? 'bg-gradient-to-br from-slate-800/95 to-slate-800/90 text-gray-100 border-l-cyan-400 border-r-slate-700/50 border-t-slate-700/50 border-b-slate-700/50 shadow-xl shadow-cyan-500/20 z-10'
            : 'bg-slate-900/60 text-gray-400 border-l-slate-700/50 border-r-slate-700/30 border-t-slate-700/30 border-b-slate-700/30 hover:bg-slate-800/70 hover:text-cyan-100 hover:border-l-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/10'
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

        {/* Terminal Icon */}
        <div
          className={`flex-shrink-0 transition-colors duration-100 ${isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-cyan-400/70'
            }`}
        >
          <TerminalSquare size={14} strokeWidth={2} />
        </div>

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
