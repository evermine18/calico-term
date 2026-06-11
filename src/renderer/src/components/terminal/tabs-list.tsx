import { useState, useRef } from "react";
import { TabItem } from "./tab-item";
import { TabContextMenu } from "./tab-context-menu";
import { TagsSubmenu } from "./tags-submenu";
import { useTabNavigation } from "../../hooks/useTabNavigation";
import { useTags } from "../../hooks/useTags";
import { useContextMenu } from "../../hooks/useContextMenu";
import { TabsSubmenuState } from "../../types/tabs";
import * as tabOps from "../../lib/tab-operations";

export default function TabsList({
  tabs,
  setTabs,
  activeTab,
  setActiveTab,
  onDetachTab,
}) {
  const [draggedTab, setDraggedTab] = useState<string | null>(null);
  const [tagsSubmenu, setTagsSubmenu] = useState<TabsSubmenuState | null>(null);
  // Whether the in-progress drag ended on another tab (reorder) vs. outside.
  const droppedOnTabRef = useRef(false);

  const customTags = useTags();
  const { contextMenu, setContextMenu } = useContextMenu();

  // Tab operation handlers
  const handleCloseTab = (id: string) => {
    tabOps.closeTab(id, tabs, activeTab, setTabs, setActiveTab);
  };

  const handleDuplicateTab = (tabId: string) => {
    tabOps.duplicateTab(tabId, tabs, setTabs, setActiveTab);
  };

  const handleCloseOtherTabs = (id: string) => {
    tabOps.closeOtherTabs(id, tabs, setTabs, setActiveTab);
  };

  const handleCloseTabsToRight = (id: string) => {
    tabOps.closeTabsToRight(id, tabs, setTabs);
  };

  const handleUpdateTabTitle = (id: string, title: string) => {
    tabOps.updateTabTitle(id, title, setTabs);
  };

  const handleSetBadge = (tabId: string, tagId: string | null) => {
    tabOps.setBadge(tabId, tagId, setTabs);
  };

  // Keyboard navigation
  useTabNavigation({
    tabs,
    activeTab,
    setActiveTab,
    setTabs,
    closeTab: handleCloseTab,
    duplicateTab: handleDuplicateTab,
  });

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, tabId: string) => {
    droppedOnTabRef.current = false;
    setDraggedTab(tabId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", tabId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetTabId: string) => {
    e.preventDefault();
    // A drop landing on any tab is an in-bar reorder, never a pop-out.
    droppedOnTabRef.current = true;
    if (!draggedTab || draggedTab === targetTabId) return;

    const draggedIndex = tabs.findIndex((t) => t.id === draggedTab);
    const targetIndex = tabs.findIndex((t) => t.id === targetTabId);

    const newTabs = [...tabs];
    const [removed] = newTabs.splice(draggedIndex, 1);
    newTabs.splice(targetIndex, 0, removed);

    setTabs(newTabs);
    setDraggedTab(null);
  };

  // If a tab is released outside the window (not dropped on another tab),
  // pop it out into its own window.
  const handleDragEnd = (e: React.DragEvent) => {
    const dropped = droppedOnTabRef.current;
    const id = draggedTab;
    droppedOnTabRef.current = false;
    setDraggedTab(null);
    if (dropped || !id) return;
    const outside =
      e.clientX <= 0 ||
      e.clientY <= 0 ||
      e.clientX >= window.innerWidth ||
      e.clientY >= window.innerHeight;
    if (outside) onDetachTab(id);
  };

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, tabId });
  };

  const handleTagsHover = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!contextMenu) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTagsSubmenu({
      x: rect.right + 5,
      y: rect.top,
      tabId: contextMenu.tabId,
    });
  };

  const handleTagsLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget?.closest(".tags-submenu")) {
      setTagsSubmenu(null);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1.5 flex-1 overflow-x-auto scrollbar-thin scrollbar-thumb-accent-600/40 scrollbar-track-transparent pt-2.5">
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={activeTab === tab.id}
            isDragged={draggedTab === tab.id}
            canClose={true}
            customTags={customTags}
            onSelect={() => setActiveTab(tab.id)}
            onDoubleClick={() => {
              setTabs((prev) =>
                prev.map((t) => (t.id === tab.id ? { ...t, mode: "edit" } : t)),
              );
            }}
            onMiddleClick={() => {
              if (tabs.length > 1) handleCloseTab(tab.id);
            }}
            onContextMenu={(e) => handleContextMenu(e, tab.id)}
            onDragStart={(e) => handleDragStart(e, tab.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, tab.id)}
            onDragEnd={handleDragEnd}
            onTitleChange={handleUpdateTabTitle}
            onFinishEdit={() => {
              setTabs((prev) =>
                prev.map((t) =>
                  t.id === tab.id ? { ...t, mode: "normal" } : t,
                ),
              );
            }}
            onClose={() => handleCloseTab(tab.id)}
          />
        ))}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <TabContextMenu
          contextMenu={contextMenu}
          canCloseTab={tabs.length > 1}
          canCloseOthers={tabs.length > 1}
          canCloseToRight={
            tabs.findIndex((t) => t.id === contextMenu.tabId) < tabs.length - 1
          }
          onRename={() => {
            setTabs((prev) =>
              prev.map((t) =>
                t.id === contextMenu.tabId ? { ...t, mode: "edit" } : t,
              ),
            );
            setContextMenu(null);
          }}
          onDuplicate={() => {
            handleDuplicateTab(contextMenu.tabId);
            setContextMenu(null);
          }}
          onDetach={() => {
            onDetachTab(contextMenu.tabId);
            setContextMenu(null);
          }}
          onClose={() => {
            if (tabs.length > 1) {
              handleCloseTab(contextMenu.tabId);
              setContextMenu(null);
            }
          }}
          onCloseOthers={() => {
            if (tabs.length > 1) {
              handleCloseOtherTabs(contextMenu.tabId);
              setContextMenu(null);
            }
          }}
          onCloseToRight={() => {
            const tabIndex = tabs.findIndex((t) => t.id === contextMenu.tabId);
            if (tabIndex < tabs.length - 1) {
              handleCloseTabsToRight(contextMenu.tabId);
              setContextMenu(null);
            }
          }}
          onTagsHover={handleTagsHover}
          onTagsLeave={handleTagsLeave}
        />
      )}

      {/* Tags Submenu */}
      {tagsSubmenu && (
        <TagsSubmenu
          submenu={tagsSubmenu}
          customTags={customTags}
          tabs={tabs}
          onTagSelect={(tagId) => {
            handleSetBadge(tagsSubmenu.tabId, tagId);
            setTagsSubmenu(null);
            setContextMenu(null);
          }}
          onMouseLeave={() => setTagsSubmenu(null)}
        />
      )}
    </>
  );
}
