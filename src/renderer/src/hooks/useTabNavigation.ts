import { useEffect } from "react";

interface UseTabNavigationProps {
  tabs: any[];
  activeTab: string | null;
  setActiveTab: (id: string) => void;
  setTabs: React.Dispatch<React.SetStateAction<any[]>>;
  closeTab: (id: string) => void;
  duplicateTab: (tabId: string) => void;
}

export function useTabNavigation({
  tabs,
  activeTab,
  setActiveTab,
  setTabs,
  closeTab,
  duplicateTab,
}: UseTabNavigationProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const currentIndex = tabs.findIndex((t) => t.id === activeTab);

      // Ctrl + Tab / Ctrl + Shift + Tab
      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        const nextIndex = e.shiftKey
          ? (currentIndex - 1 + tabs.length) % tabs.length
          : (currentIndex + 1) % tabs.length;
        setActiveTab(tabs[nextIndex]?.id);
      }

      // Ctrl + W - Close tab
      if (e.ctrlKey && e.key === "w") {
        e.preventDefault();
        if (activeTab && tabs.length > 1) closeTab(activeTab);
      }

      // Ctrl + Shift + D - Duplicate tab
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        if (activeTab) duplicateTab(activeTab);
      }

      // Ctrl + 1-9 - Go to specific tab
      if (e.ctrlKey && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (tabs[index]) setActiveTab(tabs[index].id);
      }

      // F2 - Rename active tab
      if (e.key === "F2" && activeTab) {
        e.preventDefault();
        const isAnyEditing = tabs.some((t) => t.mode === "edit");
        if (!isAnyEditing) {
          setTabs((prev) =>
            prev.map((t) => (t.id === activeTab ? { ...t, mode: "edit" } : t)),
          );
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tabs, activeTab, setActiveTab, setTabs, closeTab, duplicateTab]);
}
