import { useEffect } from "react";
import { isEditableTarget, isMacPlatform, isPrimaryModifier } from "@renderer/lib/keyboard";

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
      if (isEditableTarget(e.target)) return;

      const currentIndex = tabs.findIndex((t) => t.id === activeTab);

      // Ctrl + Tab / Ctrl + Shift + Tab
      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        const nextIndex = e.shiftKey
          ? (currentIndex - 1 + tabs.length) % tabs.length
          : (currentIndex + 1) % tabs.length;
        setActiveTab(tabs[nextIndex]?.id);
      }

      // Use the platform primary modifier so Ctrl remains available to the shell on macOS.
      if (isPrimaryModifier(e) && e.key.toLowerCase() === "w") {
        e.preventDefault();
        if (activeTab) closeTab(activeTab);
      }

      if (isPrimaryModifier(e) && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (activeTab) duplicateTab(activeTab);
      }

      if (isPrimaryModifier(e) && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (tabs[index]) setActiveTab(tabs[index].id);
      }

      // macOS doesn't expose Cmd+Tab to apps, so keep Ctrl+Tab there and use Cmd+Shift+[ / ].
      if (
        isMacPlatform() &&
        isPrimaryModifier(e) &&
        e.shiftKey &&
        (e.key === "[" || e.key === "]")
      ) {
        e.preventDefault();
        const nextIndex =
          e.key === "["
            ? (currentIndex - 1 + tabs.length) % tabs.length
            : (currentIndex + 1) % tabs.length;
        setActiveTab(tabs[nextIndex]?.id);
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
