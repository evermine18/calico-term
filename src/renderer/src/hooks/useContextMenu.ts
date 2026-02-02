import { useState, useEffect } from "react";
import { ContextMenuState } from "../types/tabs";

export function useContextMenu() {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  useEffect(() => {
    if (!contextMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".context-menu")) {
        setContextMenu(null);
      }
    };

    requestAnimationFrame(() => {
      document.addEventListener("click", handleClickOutside);
    });

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [contextMenu]);

  return { contextMenu, setContextMenu };
}
