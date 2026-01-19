import { Terminal } from "@xterm/xterm";

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
  id: string,
  tabs: any[],
  activeTab: string | null,
  setTabs: React.Dispatch<React.SetStateAction<any[]>>,
  setActiveTab: (id: string) => void,
) {
  if (tabs.length === 1) {
    if (!confirm("Close the last terminal? The window will remain open."))
      return;
  }

  window.electron?.ipcRenderer.send("terminal-kill", id);

  const currentIndex = tabs.findIndex((tab) => tab.id === id);
  const nextActiveIndex = currentIndex > 0 ? currentIndex - 1 : 1;

  setTabs((prev) => prev.filter((t) => t.id !== id));

  if (activeTab === id && tabs.length > 1) {
    setActiveTab(tabs[nextActiveIndex]?.id ?? tabs[0]?.id);
  }
}

export function closeOtherTabs(
  id: string,
  tabs: any[],
  setTabs: React.Dispatch<React.SetStateAction<any[]>>,
  setActiveTab: (id: string) => void,
) {
  tabs.forEach((tab) => {
    if (tab.id !== id) {
      window.electron?.ipcRenderer.send("terminal-kill", tab.id);
    }
  });
  setTabs((prev) => prev.filter((t) => t.id === id));
  setActiveTab(id);
}

export function closeTabsToRight(
  id: string,
  tabs: any[],
  setTabs: React.Dispatch<React.SetStateAction<any[]>>,
) {
  const index = tabs.findIndex((t) => t.id === id);
  tabs.slice(index + 1).forEach((tab) => {
    window.electron?.ipcRenderer.send("terminal-kill", tab.id);
  });
  setTabs((prev) => prev.slice(0, index + 1));
}

export function duplicateTab(
  tabId: string,
  tabs: any[],
  setTabs: React.Dispatch<React.SetStateAction<any[]>>,
  setActiveTab: (id: string) => void,
) {
  const tab = tabs.find((t) => t.id === tabId);
  if (tab) {
    const id = crypto.randomUUID();
    const newTab = {
      id,
      title: `${tab.title} (Copy)`,
      mode: tab.mode,
      terminal: new Terminal(),
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
