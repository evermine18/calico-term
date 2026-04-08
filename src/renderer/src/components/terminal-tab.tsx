import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { useTerminalContext } from "@renderer/contexts/terminal-context";
import useCopyNotification from "@renderer/hooks/useCopyNotification";
import CopyNotification from "./terminal/copy-notification";
import { useAppContext } from "@renderer/contexts/app-context";
import { ArrowDown } from "lucide-react";
import { isMacPlatform } from "@renderer/lib/keyboard";

interface TerminalPanelProps {
  tabId: string;
  active: boolean;
  tabTitle?: string;
  initialCommand?: string;
  onActivity?: () => void;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  tabId,
  active,
  tabTitle = "Terminal",
  initialCommand,
  onActivity,
}) => {
  const { setActive } = useTerminalContext();
  const { addCommandToHistory } = useAppContext();

  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const isInitializedRef = useRef(false);
  const activeRef = useRef(active);

  const [isScrolledUp, setIsScrolledUp] = useState(false);

  const { notificationState, copyText, handleComplete } = useCopyNotification();

  // Keep activeRef in sync so IPC handlers always see the latest value
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  // Exposing API
  const api: TerminalAPI = {
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

    const terminal = new Terminal({
      cursorBlink: true,
      allowProposedApi: true,
      scrollback: 50000,
      macOptionIsMeta: true,
      theme: {
        background: "#020617",
        foreground: "#e2e8f0",
        cursor: "#06b6d4",
        cursorAccent: "#020617",
        selectionBackground: "#06b6d4",
        selectionForeground: "#020617",
        black: "#1e293b",
        red: "#ef4444",
        green: "#10b981",
        yellow: "#f59e0b",
        blue: "#06b6d4",
        magenta: "#a855f7",
        cyan: "#22d3ee",
        white: "#cbd5e1",
        brightBlack: "#475569",
        brightRed: "#f87171",
        brightGreen: "#34d399",
        brightYellow: "#fbbf24",
        brightBlue: "#22d3ee",
        brightMagenta: "#c084fc",
        brightCyan: "#67e8f9",
        brightWhite: "#f1f5f9",
      },
      fontFamily: "Cascadia Code, Consolas, 'Courier New', monospace",
      fontSize: 14,
      lineHeight: 1.2,
    });

    terminal.onSelectionChange((_) => {
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
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());
    terminal.loadAddon(unicode11Addon);
    terminal.unicode.activeVersion = "11";

    if (isMacPlatform()) {
      terminal.attachCustomKeyEventHandler((event) => {
        if (event.type !== "keydown") return true;
        if (!event.ctrlKey || event.altKey || event.metaKey) return true;
        const code = event.code;
        if (!/^Key[A-Z]$/.test(code)) return true;

        const key = code.slice(3);

        event.preventDefault();
        window.electron.ipcRenderer.send("terminal-input", {
          tabId,
          data: String.fromCharCode(key.charCodeAt(0) - 64),
        });
        return false;
      });
    }

    terminal.onData((data) => {
      // Capturar comandos cuando se presiona Enter
      if (data === '\r') {
        const buffer = terminal.buffer.active;
        const cursorY = buffer.cursorY;
        const line = buffer.getLine(cursorY);

        if (line) {
          let lineText = line.translateToString(true);
          lineText = lineText.replace(/^\[?[\w\-\.]+@[\w\-\.]+.*?\]?\s*[\$#>]\s*/, '');
          lineText = lineText.replace(/^PS\s+[\w\:\\\>]+>\s*/, '');
          lineText = lineText.replace(/^C:\\.*?>\s*/, '');
          lineText = lineText.replace(/^.*?[$#>]\s*/, '');

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
    document.fonts.ready.then(safeFit);
    terminal.focus();

    window.electron.ipcRenderer.send("terminal-create", tabId);

    if (initialCommand) {
      const cmd = initialCommand;
      setTimeout(() => {
        window.electron.ipcRenderer.send("terminal-input", { tabId, data: cmd + "\r" });
      }, 900);
    }

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    return () => {
      setActive(null);
      resizeObserverRef.current?.disconnect();
      window.electron.ipcRenderer.removeListener("terminal-output", handleOutput);
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      isInitializedRef.current = false;
    };
  }, [tabId]);

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

  return (
    <>
      <div
        ref={containerRef}
        className="terminal-container flex-1 overflow-hidden h-full w-full"
        style={{ display: active ? "block" : "none" }}
      />

      {active && isScrolledUp && (
        <button
          onClick={handleScrollToBottom}
          title="Ir al final"
          className="absolute bottom-3 right-3 z-20 w-7 h-7 flex items-center justify-center rounded-full bg-slate-800/90 border border-slate-600/60 text-cyan-400 hover:bg-slate-700/90 hover:border-cyan-500/50 shadow-lg transition-all duration-150"
          style={{ boxShadow: '0 0 8px rgba(6,182,212,0.2)' }}
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
