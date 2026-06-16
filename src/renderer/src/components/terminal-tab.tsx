import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import "@xterm/xterm/css/xterm.css";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { SerializeAddon } from "@xterm/addon-serialize";
import { useTerminalContext } from "@renderer/contexts/terminal-context";
import useCopyNotification from "@renderer/hooks/useCopyNotification";
import CopyNotification from "./terminal/copy-notification";
import { TerminalSearchBar } from "./terminal/terminal-search-bar";
import { useAppContext } from "@renderer/contexts/app-context";
import {
  ArrowDown,
  Copy,
  ClipboardPaste,
  TextSelect,
  Eraser,
  Search,
} from "lucide-react";
import { isMacPlatform } from "@renderer/lib/keyboard";

const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 32;
const DEFAULT_FONT_SIZE = 14;

// Tracks which tabs have already had their `initialCommand` sent. Lives at
// module scope so React StrictMode's double-invocation of effects in dev does
// not schedule the command twice — the second copy would otherwise queue in
// the local shell's stdin and re-run when the SSH session exits, producing a
// spurious auto-reconnect after logout.
const initialCommandSentTabs = new Set<string>();

interface TerminalPanelProps {
  tabId: string;
  active: boolean;
  tabTitle?: string;
  initialCommand?: string;
  onActivity?: () => void;
  envScopes?: string[];
  // Scrollback (xterm-serialized) to paint before attaching, used when a tab
  // is re-mounted in a detached window so its history carries over.
  initialSerialized?: string;
  // Per-tab working directory for the PTY (overrides the global default cwd).
  cwd?: string;
  // ANSI "logo" written to the terminal at launch (agent tabs).
  agentBanner?: string;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  tabId,
  active,
  tabTitle = "Terminal",
  initialCommand,
  onActivity,
  envScopes,
  initialSerialized,
  cwd,
  agentBanner,
}) => {
  const { setActive, register } = useTerminalContext();
  const {
    addCommandToHistory,
    terminalFontFamily,
    terminalFontSize,
    terminalLineHeight,
    cursorStyle,
    cursorBlink,
    scrollback,
    defaultShell,
    defaultCwd,
    setTerminalFontSize,
  } = useAppContext();

  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const serializeAddonRef = useRef<SerializeAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const isInitializedRef = useRef(false);
  const activeRef = useRef(active);
  // Current font size, mirrored to a ref so the (run-once) key handler can read
  // the latest value for Ctrl +/- zoom without re-binding.
  const fontSizeRef = useRef(terminalFontSize);
  // Mirror search state so the (run-once) selection handler can suppress
  // auto-copy while searching — the search addon selects matches itself.
  const searchOpenRef = useRef(false);

  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCount, setSearchCount] = useState<number | undefined>(undefined);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    fontSizeRef.current = terminalFontSize;
  }, [terminalFontSize]);

  useEffect(() => {
    searchOpenRef.current = searchOpen;
  }, [searchOpen]);

  const { notificationState, copyText, handleComplete } = useCopyNotification();

  // Keep activeRef in sync so IPC handlers always see the latest value
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  // Exposing API
  const api: TerminalAPI = {
    sendInput(cmd: string) {
      window.electron.ipcRenderer.send("terminal-input", {
        tabId,
        data: cmd + "\r",
      });
    },
    getVisibleText() {
      const t = terminalRef.current!;
      const b = t.buffer.active;
      const start = b.viewportY;
      const end = start + t.rows - 1;
      let out = "";
      for (let y = start; y <= end; y++) {
        out += (b.getLine(y)?.translateToString(true) ?? "") + "\n";
      }
      out = out.replace(/^\n/gm, "");
      return out;
    },
    getAllBufferText() {
      const t = terminalRef.current!;
      const b = t.buffer.active;
      let out = "";
      for (let y = 0; y < b.length; y++) {
        out += (b.getLine(y)?.translateToString(true) ?? "") + "\n";
      }
      return out;
    },
    serialize() {
      return serializeAddonRef.current?.serialize() ?? "";
    },
  };

  /**
   * Safely fits the terminal to the container size.
   * Skips fitting when container is not visible.
   */
  const safeFit = () => {
    const container = containerRef.current;
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;

    if (!container || !terminal || !fitAddon) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    fitAddon.fit();
    terminal.refresh(0, terminal.buffer.active.length - 1);

    window.electron.ipcRenderer.send("terminal-resize", {
      tabId,
      cols: terminal.cols,
      rows: terminal.rows,
    });
  };

  /**
   * Initialize the terminal instance and event listeners.
   */
  useEffect(() => {
    if (!containerRef.current || isInitializedRef.current) return;

    isInitializedRef.current = true;

    const cssVar = (v: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(v).trim();
    const accent400 = cssVar("--accent-400") || "#22d3ee";
    const accent500 = cssVar("--accent-500") || "#06b6d4";
    const accent300 = cssVar("--accent-300") || "#67e8f9";

    const terminal = new Terminal({
      cursorBlink,
      cursorStyle,
      allowProposedApi: true,
      scrollback,
      macOptionIsMeta: true,
      theme: {
        background: "#020617",
        foreground: "#e2e8f0",
        cursor: accent500,
        cursorAccent: "#020617",
        selectionBackground: accent500,
        selectionForeground: "#020617",
        black: "#1e293b",
        red: "#ef4444",
        green: "#10b981",
        yellow: "#f59e0b",
        blue: accent500,
        magenta: "#a855f7",
        cyan: accent400,
        white: "#cbd5e1",
        brightBlack: "#475569",
        brightRed: "#f87171",
        brightGreen: "#34d399",
        brightYellow: "#fbbf24",
        brightBlue: accent400,
        brightMagenta: "#c084fc",
        brightCyan: accent300,
        brightWhite: "#f1f5f9",
      },
      fontFamily: terminalFontFamily,
      fontSize: terminalFontSize,
      lineHeight: terminalLineHeight,
      // scrollback: 50000, // Optional: increase scrollback for large output
    });

    terminal.onSelectionChange((_) => {
      // Don't auto-copy while searching — match highlights select text too.
      if (searchOpenRef.current) return;
      const text = terminal.getSelection();
      if (text) {
        copyText(text, null);
      }
    });

    // Track scroll position for the scroll-to-bottom button
    terminal.onScroll(() => {
      const b = terminal.buffer.active;
      const atBottom = b.viewportY >= b.length - terminal.rows;
      setIsScrolledUp(!atBottom);
    });

    const fitAddon = new FitAddon();
    const unicode11Addon = new Unicode11Addon();
    const serializeAddon = new SerializeAddon();
    const searchAddon = new SearchAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());
    terminal.loadAddon(unicode11Addon);
    terminal.loadAddon(serializeAddon);
    terminal.loadAddon(searchAddon);
    terminal.unicode.activeVersion = "11";
    searchAddon.onDidChangeResults((r) => {
      setSearchCount(r ? r.resultCount : undefined);
    });

    terminal.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown") return true;
      const mod = event.ctrlKey || event.metaKey;

      // Runtime font zoom: Ctrl/Cmd with +, -, or 0 (reset).
      if (mod && !event.altKey) {
        if (event.key === "=" || event.key === "+") {
          setTerminalFontSize(Math.min(MAX_FONT_SIZE, fontSizeRef.current + 1));
          event.preventDefault();
          return false;
        }
        if (event.key === "-" || event.key === "_") {
          setTerminalFontSize(Math.max(MIN_FONT_SIZE, fontSizeRef.current - 1));
          event.preventDefault();
          return false;
        }
        if (event.key === "0") {
          setTerminalFontSize(DEFAULT_FONT_SIZE);
          event.preventDefault();
          return false;
        }
      }

      // Open in-terminal search: Ctrl+Shift+F (or Cmd+F on macOS).
      const isSearch =
        (mod && event.shiftKey && (event.key === "F" || event.key === "f")) ||
        (isMacPlatform() &&
          event.metaKey &&
          !event.shiftKey &&
          (event.key === "f" || event.key === "F"));
      if (isSearch) {
        setSearchOpen(true);
        event.preventDefault();
        return false;
      }

      // macOS: map Ctrl+<letter> to the control character (so e.g. Ctrl+C
      // still sends SIGINT when Cmd is the platform meta key).
      if (
        isMacPlatform() &&
        event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        /^Key[A-Z]$/.test(event.code)
      ) {
        const key = event.code.slice(3);
        event.preventDefault();
        window.electron.ipcRenderer.send("terminal-input", {
          tabId,
          data: String.fromCharCode(key.charCodeAt(0) - 64),
        });
        return false;
      }

      return true;
    });

    terminal.onData((data) => {
      // Capturar comandos cuando se presiona Enter
      if (data === "\r") {
        // Read the current line from the terminal buffer
        const buffer = terminal.buffer.active;
        const cursorY = buffer.cursorY;
        const line = buffer.getLine(cursorY);

        if (line) {
          let lineText = line.translateToString(true);

          // Clean the prompt and special characters
          // Detect common prompt patterns and remove them
          lineText = lineText.replace(
            /^\[?[\w\-\.]+@[\w\-\.]+.*?\]?\s*[\$#>]\s*/,
            "",
          ); // bash/zsh style
          lineText = lineText.replace(/^PS\s+[\w\:\\\>]+>\s*/, ""); // PowerShell style
          lineText = lineText.replace(/^C:\\.*?>\s*/, ""); // Windows cmd style
          lineText = lineText.replace(/^.*?[$#>]\s*/, ""); // Generic prompt

          const cmd = lineText.trim();
          if (cmd && cmd.length > 0) {
            addCommandToHistory(cmd, tabId, tabTitle);
          }
        }
      }

      window.electron.ipcRenderer.send("terminal-input", { tabId, data });
    });

    const handleOutput = (_: unknown, incomingId: string, data: string) => {
      if (incomingId === tabId) {
        terminal.write(data);
        if (!activeRef.current) {
          onActivity?.();
        }
      }
    };

    window.electron.ipcRenderer.on("terminal-output", handleOutput);

    terminal.open(containerRef.current);
    // Repaint inherited scrollback before attaching so a popped-out window
    // shows the prior history above the live PTY output.
    if (initialSerialized) {
      terminal.write(initialSerialized);
    }
    // Paint the agent "logo" before any PTY output so it sits at the top.
    if (agentBanner) {
      terminal.write(agentBanner);
    }
    document.fonts.ready.then(safeFit);
    terminal.focus();

    // Create PTY instance
    window.electron.ipcRenderer.send("terminal-create", tabId, {
      shell: defaultShell || undefined,
      cwd: cwd || defaultCwd || undefined,
      envScopes: envScopes && envScopes.length ? envScopes : undefined,
    });

    if (initialCommand && !initialCommandSentTabs.has(tabId)) {
      initialCommandSentTabs.add(tabId);
      const cmd = initialCommand;
      setTimeout(() => {
        window.electron.ipcRenderer.send("terminal-input", {
          tabId,
          data: cmd + "\r",
        });
      }, 900);
    }

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    serializeAddonRef.current = serializeAddon;
    searchAddonRef.current = searchAddon;
    // Make this tab serializable from anywhere (e.g. pop-out of a background tab).
    register(tabId, api);

    return () => {
      setActive(null);
      register(tabId, null);
      resizeObserverRef.current?.disconnect();
      window.electron.ipcRenderer.removeListener(
        "terminal-output",
        handleOutput,
      );
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      serializeAddonRef.current = null;
      searchAddonRef.current = null;
      isInitializedRef.current = false;
    };
  }, [tabId]);

  // Re-run the search as the query changes (live find-as-you-type).
  useEffect(() => {
    const addon = searchAddonRef.current;
    if (!addon) return;
    if (searchOpen && searchQuery) {
      addon.findNext(searchQuery);
    } else {
      addon.clearDecorations();
      setSearchCount(undefined);
    }
  }, [searchQuery, searchOpen]);

  /**
   * Attach resize observer only when the tab is active.
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = null;
    if (active) setActive(api);
    if (!active) return;

    requestAnimationFrame(() => {
      safeFit();

      const observer = new ResizeObserver((entries) => {
        const { width, height } = entries[0].contentRect;
        if (width && height) {
          Promise.resolve().then(safeFit);
        }
      });

      observer.observe(container);
      resizeObserverRef.current = observer;
    });
  }, [active]);

  /**
   * Live-update xterm options when terminal settings change in context.
   */
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.options.fontFamily = terminalFontFamily;
    terminal.options.fontSize = terminalFontSize;
    terminal.options.lineHeight = terminalLineHeight;
    terminal.options.cursorStyle = cursorStyle;
    terminal.options.cursorBlink = cursorBlink;
    terminal.options.scrollback = scrollback;
    fitAddonRef.current?.fit();
  }, [
    terminalFontFamily,
    terminalFontSize,
    terminalLineHeight,
    cursorStyle,
    cursorBlink,
    scrollback,
  ]);

  /**
   * Focus the terminal when tab becomes active.
   */
  useEffect(() => {
    if (active) {
      terminalRef.current?.focus();
    }
  }, [active]);

  const handleScrollToBottom = () => {
    terminalRef.current?.scrollToBottom();
    setIsScrolledUp(false);
  };

  const closeCtxMenu = () => setCtxMenu(null);
  const ctxCopy = () => {
    const sel = terminalRef.current?.getSelection();
    if (sel) navigator.clipboard.writeText(sel);
    closeCtxMenu();
  };
  const ctxPaste = async () => {
    const text = await navigator.clipboard.readText();
    if (text)
      window.electron.ipcRenderer.send("terminal-input", { tabId, data: text });
    closeCtxMenu();
  };
  const ctxSelectAll = () => {
    terminalRef.current?.selectAll();
    closeCtxMenu();
  };
  const ctxClear = () => {
    terminalRef.current?.clear();
    closeCtxMenu();
  };
  const ctxFind = () => {
    setSearchOpen(true);
    closeCtxMenu();
  };

  const hasSelection = !!terminalRef.current?.hasSelection();

  return (
    <>
      <div
        ref={containerRef}
        className="terminal-container flex-1 overflow-hidden h-full w-full"
        style={{ display: active ? "block" : "none" }}
        onContextMenu={(e) => {
          e.preventDefault();
          setCtxMenu({ x: e.clientX, y: e.clientY });
        }}
      />

      {active && searchOpen && (
        <TerminalSearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          onFindNext={() =>
            searchQuery && searchAddonRef.current?.findNext(searchQuery)
          }
          onFindPrev={() =>
            searchQuery && searchAddonRef.current?.findPrevious(searchQuery)
          }
          onClose={() => {
            setSearchOpen(false);
            setSearchQuery("");
          }}
          resultCount={searchCount}
        />
      )}

      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeCtxMenu} />
          <div
            className="fixed z-50 min-w-[160px] py-1 rounded-md border border-slate-700/60 bg-slate-900/97 shadow-xl shadow-black/40 backdrop-blur-md text-sm text-gray-200"
            style={{ top: ctxMenu.y, left: ctxMenu.x }}
          >
            <CtxItem
              icon={<Copy size={13} />}
              label="Copiar"
              shortcut="Ctrl+Shift+C"
              disabled={!hasSelection}
              onClick={ctxCopy}
            />
            <CtxItem
              icon={<ClipboardPaste size={13} />}
              label="Pegar"
              shortcut="Ctrl+Shift+V"
              onClick={ctxPaste}
            />
            <CtxItem
              icon={<TextSelect size={13} />}
              label="Seleccionar todo"
              onClick={ctxSelectAll}
            />
            <div className="my-1 border-t border-slate-700/50" />
            <CtxItem
              icon={<Search size={13} />}
              label="Buscar"
              shortcut="Ctrl+Shift+F"
              onClick={ctxFind}
            />
            <CtxItem
              icon={<Eraser size={13} />}
              label="Limpiar"
              onClick={ctxClear}
            />
          </div>
        </>
      )}

      {active && isScrolledUp && (
        <button
          onClick={handleScrollToBottom}
          title="Ir al final"
          className="absolute bottom-3 right-3 z-20 w-7 h-7 flex items-center justify-center rounded-full bg-slate-800/90 border border-slate-600/60 text-cyan-400 hover:bg-slate-700/90 hover:border-cyan-500/50 shadow-lg transition-all duration-150"
          style={{ boxShadow: "0 0 8px rgba(6,182,212,0.2)" }}
        >
          <ArrowDown size={13} />
        </button>
      )}

      <CopyNotification
        isVisible={notificationState.isVisible}
        position={notificationState.position}
        onComplete={handleComplete}
      />
    </>
  );
};

function CtxItem({
  icon,
  label,
  shortcut,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-700/50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
    >
      <span className="text-gray-400 flex-shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="text-[10px] text-gray-600 font-mono">{shortcut}</span>
      )}
    </button>
  );
}
