import { Terminal } from "@xterm/xterm";
import { Check, Pencil, TerminalSquare, X, Copy, Edit2, XCircle } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function TabsList({ tabs, setTabs, activeTab, setActiveTab }) {
  const [draggedTab, setDraggedTab] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const dragCounter = useRef(0);

  // Cerrar menú contextual al hacer click fuera
  useEffect(() => {
    if (!contextMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Solo cerrar si el click NO está dentro del menú contextual
      if (!target.closest('.context-menu')) {
        setContextMenu(null);
      }
    };

    // Esperar un frame para que el evento de apertura termine
    requestAnimationFrame(() => {
      document.addEventListener('click', handleClickOutside);
    });

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [contextMenu]);

  // Navegación por teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const currentIndex = tabs.findIndex((t) => t.id === activeTab);

      // Ctrl + Tab / Ctrl + Shift + Tab
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        const nextIndex = e.shiftKey
          ? (currentIndex - 1 + tabs.length) % tabs.length
          : (currentIndex + 1) % tabs.length;
        setActiveTab(tabs[nextIndex]?.id);
      }

      // Ctrl + W - Cerrar tab
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        if (activeTab && tabs.length > 1) closeTab(activeTab);
      }

      // Ctrl + Shift + D - Duplicar tab
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        if (activeTab) duplicateTab(activeTab);
      }

      // Ctrl + 1-9 - Ir a tab específica
      if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (tabs[index]) setActiveTab(tabs[index].id);
      }

      // F2 - Renombrar tab activa
      if (e.key === 'F2' && activeTab) {
        e.preventDefault();
        // Solo permitir renombrar si ninguna tab está en modo edición
        const isAnyEditing = tabs.some((t) => t.mode === "edit");
        if (!isAnyEditing) {
          setTabs((prev) =>
            prev.map((t) => (t.id === activeTab ? { ...t, mode: "edit" } : t))
          );
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tabs, activeTab]);

  const updateTabTitle = (id: string, title: string) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === id ? { ...tab, title } : tab))
    );
  };

  const closeTab = (id: string) => {
    if (tabs.length === 1) {
      // Confirmación solo para la última tab
      if (!confirm('Close the last terminal? The window will remain open.')) return;
    }

    window.electron?.ipcRenderer.send("terminal-kill", id);

    const currentIndex = tabs.findIndex((tab) => tab.id === id);
    const nextActiveIndex = currentIndex > 0 ? currentIndex - 1 : 1;

    setTabs((prev) => prev.filter((t) => t.id !== id));

    if (activeTab === id && tabs.length > 1) {
      setActiveTab(tabs[nextActiveIndex]?.id ?? tabs[0]?.id);
    }
  };

  const closeOtherTabs = (id: string) => {
    tabs.forEach((tab) => {
      if (tab.id !== id) {
        window.electron?.ipcRenderer.send("terminal-kill", tab.id);
      }
    });
    setTabs((prev) => prev.filter((t) => t.id === id));
    setActiveTab(id);
  };

  const closeTabsToRight = (id: string) => {
    const index = tabs.findIndex((t) => t.id === id);
    tabs.slice(index + 1).forEach((tab) => {
      window.electron?.ipcRenderer.send("terminal-kill", tab.id);
    });
    setTabs((prev) => prev.slice(0, index + 1));
  };

  const duplicateTab = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) {
      const id = crypto.randomUUID();
      const newTab = {
        id,
        title: `${tab.title} (Copy)`,
        mode: tab.mode,
        terminal: new Terminal(),
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTab(id);
    }
  };

  const handleDragStart = (e: React.DragEvent, tabId: string) => {
    setDraggedTab(tabId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tabId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetTabId: string) => {
    e.preventDefault();
    if (!draggedTab || draggedTab === targetTabId) return;

    const draggedIndex = tabs.findIndex((t) => t.id === draggedTab);
    const targetIndex = tabs.findIndex((t) => t.id === targetTabId);

    const newTabs = [...tabs];
    const [removed] = newTabs.splice(draggedIndex, 1);
    newTabs.splice(targetIndex, 0, removed);

    setTabs(newTabs);
    setDraggedTab(null);
  };

  const handleDragEnd = () => {
    setDraggedTab(null);
  };

  return (
    <>
      <div className="flex items-center gap-1.5 flex-1 overflow-x-auto scrollbar-thin scrollbar-thumb-cyan-600/40 scrollbar-track-transparent">
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            draggable={tab.mode === "normal"}
            onDragStart={(e) => handleDragStart(e, tab.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, tab.id)}
            onDragEnd={handleDragEnd}
            onMouseEnter={() => setHoveredTab(tab.id)}
            onMouseLeave={() => setHoveredTab(null)}
            title={tab.title}
            className={`tab-item
                relative group flex items-center gap-2 px-3 py-2 rounded-lg
                text-sm font-medium border-l-[3px] border-r border-t border-b
                min-w-[110px] max-w-[200px] flex-shrink-0 cursor-pointer
                backdrop-blur-md transition-all duration-100
                ${draggedTab === tab.id ? 'opacity-50' : ''}
                ${activeTab === tab.id
                ? "bg-gradient-to-br from-slate-800/95 to-slate-800/90 text-gray-100 border-l-cyan-400 border-r-slate-700/50 border-t-slate-700/50 border-b-slate-700/50 shadow-xl shadow-cyan-500/20 z-10"
                : "bg-slate-900/60 text-gray-400 border-l-slate-700/50 border-r-slate-700/30 border-t-slate-700/30 border-b-slate-700/30 hover:bg-slate-800/70 hover:text-cyan-100 hover:border-l-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/10"
              }
              `}
            onClick={() => setActiveTab(tab.id)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setTabs((prev) =>
                prev.map((t) => (t.id === tab.id ? { ...t, mode: "edit" } : t))
              );
            }}
            onMouseDown={(e) => {
              // Middle-click para cerrar
              if (e.button === 1 && tabs.length > 1) {
                e.preventDefault();
                closeTab(tab.id);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Context menu triggered for tab:', tab.id);
              const menuData = { x: e.clientX, y: e.clientY, tabId: tab.id };
              console.log('Setting context menu:', menuData);
              setContextMenu(menuData);
            }}
          >
            {/* Terminal Icon */}
            <div
              className={`flex-shrink-0 transition-colors duration-100 ${activeTab === tab.id
                ? "text-cyan-400"
                : "text-slate-500 group-hover:text-cyan-400/70"
                }`}
            >
              <TerminalSquare size={14} strokeWidth={2} />
            </div>

            {/* Tab title */}
            {tab.mode === "edit" ? (
              <>
                <span
                  id={`tab-title-measure-${tab.id}`}
                  style={{
                    position: "absolute",
                    visibility: "hidden",
                    whiteSpace: "pre",
                    fontSize: "1rem",
                    fontFamily: "inherit",
                    fontWeight: "500",
                    padding: "0",
                  }}
                >
                  {tab.title || " "}
                </span>
                <input
                  value={tab.title}
                  onChange={(e) => updateTabTitle(tab.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      setTabs((prev) =>
                        prev.map((t) =>
                          t.id === tab.id ? { ...t, mode: "normal" } : t
                        )
                      );
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      e.stopPropagation();
                      setTabs((prev) =>
                        prev.map((t) =>
                          t.id === tab.id ? { ...t, mode: "normal" } : t
                        )
                      );
                    }
                  }}
                  className="bg-slate-900/60 border border-cyan-500/50 rounded px-2 py-0.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500"
                  style={{
                    width: `calc(${document.getElementById(`tab-title-measure-${tab.id}`)?.offsetWidth || 50}px + 1ch)`,
                    minWidth: "40px",
                    maxWidth: "180px",
                  }}
                  autoFocus
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setTabs((prev) =>
                      prev.map((t) =>
                        t.id === tab.id ? { ...t, mode: "normal" } : t
                      )
                    );
                  }}
                  className="w-5 h-5 rounded flex items-center justify-center text-gray-500 
                           hover:text-green-400 hover:bg-green-500/15 transition-colors duration-75"
                  title="Apply title"
                >
                  <Check size={14} />
                </button>
              </>
            ) : (
              <span className="truncate flex-1 select-none font-medium">{tab.title}</span>
            )}

            {/* Action buttons */}
            {tab.mode === "normal" && tabs.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                onContextMenu={(e) => {
                  e.stopPropagation();
                  // Permitir que el evento del padre maneje el menú
                }}
                className={`w-5 h-5 rounded flex items-center justify-center text-gray-500 
                         hover:text-red-400 hover:bg-red-500/15 transition-colors duration-75 ${activeTab === tab.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                title="Close (Ctrl+W)"
              >
                <X size={12} />
              </button>
            )}

          </div>
        ))}
      </div>

      {/* Menú Contextual */}
      {contextMenu && createPortal(
        (() => {
          console.log('Rendering context menu:', contextMenu);
          return (
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
                  setTabs((prev) =>
                    prev.map((t) =>
                      t.id === contextMenu.tabId ? { ...t, mode: "edit" } : t
                    )
                  );
                  setContextMenu(null);
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
                  duplicateTab(contextMenu.tabId);
                  setContextMenu(null);
                }}
              >
                <Copy size={14} />
                <span>Duplicate</span>
                <span className="ml-auto text-xs text-gray-500">Ctrl+Shift+D</span>
              </button>
              <div className="h-px bg-slate-700/50 my-1.5"></div>
              <button
                className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-slate-700/50 hover:text-red-400 flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={(e) => {
                  e.stopPropagation();
                  if (tabs.length > 1) {
                    closeTab(contextMenu.tabId);
                    setContextMenu(null);
                  }
                }}
                disabled={tabs.length === 1}
              >
                <X size={14} />
                <span>Close</span>
                <span className="ml-auto text-xs text-gray-500">Ctrl+W</span>
              </button>
              <button
                className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-slate-700/50 hover:text-red-400 flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={(e) => {
                  e.stopPropagation();
                  if (tabs.length > 1) {
                    closeOtherTabs(contextMenu.tabId);
                    setContextMenu(null);
                  }
                }}
                disabled={tabs.length === 1}
              >
                <XCircle size={14} />
                <span>Close Others</span>
              </button>
              <button
                className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-slate-700/50 hover:text-red-400 flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={(e) => {
                  e.stopPropagation();
                  const tabIndex = tabs.findIndex((t) => t.id === contextMenu.tabId);
                  if (tabIndex < tabs.length - 1) {
                    closeTabsToRight(contextMenu.tabId);
                    setContextMenu(null);
                  }
                }}
                disabled={tabs.findIndex((t) => t.id === contextMenu.tabId) === tabs.length - 1}
              >
                <XCircle size={14} />
                <span>Close to the Right</span>
              </button>
            </div>
          );
        })(),
        document.body
      )}
    </>
  );
}
