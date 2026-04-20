import { TerminalTab } from "@renderer/types/terminal";
import { collectLeafIds, createLeaf } from "./pane-operations";

export function updateTabTitle(
  id: string,
  title: string,
  setTabs: React.Dispatch<React.SetStateAction<any[]>>,
) {
  setTabs((prev) =>
    prev.map((tab) => (tab.id === id ? { ...tab, title } : tab)),
  );
}

export function closeTab(
  tab: TerminalTab,
  tabs: TerminalTab[],
  activeTab: string | null,
  setTabs: React.Dispatch<React.SetStateAction<any[]>>,
  setActiveTab: (id: string) => void,
) {
  collectLeafIds(tab.rootPane).forEach((paneId) => {
    window.electron?.ipcRenderer.send("terminal-kill", paneId);
  });

  const currentIndex = tabs.findIndex((t) => t.id === tab.id);
  const nextActiveIndex = currentIndex > 0 ? currentIndex - 1 : 1;

  setTabs((prev) => prev.filter((t) => t.id !== tab.id));

  if (activeTab === tab.id && tabs.length > 1) {
    setActiveTab(tabs[nextActiveIndex]?.id ?? tabs[0]?.id);
  }
}

export function closeOtherTabs(
  id: string,
  tabs: TerminalTab[],
  setTabs: React.Dispatch<React.SetStateAction<any[]>>,
  setActiveTab: (id: string) => void,
) {
  tabs.forEach((tab) => {
    if (tab.id !== id) {
      collectLeafIds(tab.rootPane).forEach((paneId) => {
        window.electron?.ipcRenderer.send("terminal-kill", paneId);
      });
    }
  });
  setTabs((prev) => prev.filter((t) => t.id === id));
  setActiveTab(id);
}

export function closeTabsToRight(
  id: string,
  tabs: TerminalTab[],
  setTabs: React.Dispatch<React.SetStateAction<any[]>>,
) {
  const index = tabs.findIndex((t) => t.id === id);
  tabs.slice(index + 1).forEach((tab) => {
    collectLeafIds(tab.rootPane).forEach((paneId) => {
      window.electron?.ipcRenderer.send("terminal-kill", paneId);
    });
  });
  setTabs((prev) => prev.slice(0, index + 1));
}

export function duplicateTab(
  tabId: string,
  tabs: TerminalTab[],
  setTabs: React.Dispatch<React.SetStateAction<any[]>>,
  setActiveTab: (id: string) => void,
) {
  const tab = tabs.find((t) => t.id === tabId);
  if (tab) {
    const id = crypto.randomUUID();
    const leaf = createLeaf();
    const newTab: TerminalTab = {
      id,
      title: `${tab.title} (Copy)`,
      mode: tab.mode,
      rootPane: leaf,
      focusedPaneId: leaf.paneId,
      badge: tab.badge || null,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTab(id);
  }
}

export function setBadge(
  tabId: string,
  tagId: string | null,
  setTabs: React.Dispatch<React.SetStateAction<any[]>>,
) {
  setTabs((prev) =>
    prev.map((t) => (t.id === tabId ? { ...t, badge: tagId } : t)),
  );
}
