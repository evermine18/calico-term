import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { CustomTag, TabsSubmenuState } from '../../types/tabs';

interface TagsSubmenuProps {
  submenu: TabsSubmenuState;
  customTags: CustomTag[];
  tabs: any[];
  onTagSelect: (tagId: string | null) => void;
  onMouseLeave: () => void;
}

export function TagsSubmenu({
  submenu,
  customTags,
  tabs,
  onTagSelect,
  onMouseLeave
}: TagsSubmenuProps) {
  return createPortal(
    <div
      className="tags-submenu fixed bg-card/98 backdrop-blur-md border border-border rounded-lg shadow-2xl shadow-black/40 py-1.5 min-w-[160px] max-h-[300px] overflow-y-auto"
      style={{
        left: submenu.x,
        top: submenu.y,
        zIndex: 10000000
      }}
      onMouseLeave={onMouseLeave}
      onClick={(e) => e.stopPropagation()}
    >
      {customTags.length === 0 ? (
        <div className="px-3 py-2 text-xs text-muted-foreground/70 text-center">
          No tags created yet.
          <br />
          Create them in Settings
        </div>
      ) : (
        <>
          {customTags.map((tag) => {
            const currentTab = tabs.find((t) => t.id === submenu.tabId);
            const isActive = currentTab?.badge === tag.id;

            return (
              <button
                key={tag.id}
                className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors
                  ${isActive ? 'bg-accent/70' : 'hover:bg-accent/70'}`}
                style={{
                  color: isActive ? tag.color : undefined
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onTagSelect(isActive ? null : tag.id);
                }}
              >
                <div
                  className="w-3 h-3 rounded-full border border-border"
                  style={{ backgroundColor: tag.color }}
                />
                <span className={isActive ? 'font-medium' : ''}>{tag.name}</span>
                {isActive && <Check size={14} className="ml-auto" />}
              </button>
            );
          })}
        </>
      )}
    </div>,
    document.body
  );
}
