import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { useTerminalContext } from "@renderer/contexts/terminal-context";
import useCopyNotification from "@renderer/hooks/useCopyNotification";
import CopyNotification from "./terminal/copy-notification";

interface TerminalPanelProps {
  tabId: string;
  active: boolean;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  tabId,
  active,
}) => {
  const { setActive } = useTerminalContext();

  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const isInitializedRef = useRef(false);
  const { notificationState, copyText, handleComplete } = useCopyNotification();

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
      // Remove empty lines
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
    if (width === 0 || height === 0) return; // Avoid fitting when hidden

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
      // scrollback: 50000, // Optional: increase scrollback for large output
    });
    terminal.onSelectionChange((_) => {
      const text = terminal.getSelection();
      if (text) {
        copyText(text, null);
      }
    });
    const fitAddon = new FitAddon();
    const unicode11Addon = new Unicode11Addon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());
    terminal.loadAddon(unicode11Addon);
    terminal.unicode.activeVersion = "11";

    terminal.onData((data) => {
      window.electron.ipcRenderer.send("terminal-input", { tabId, data });
    });

    const handleOutput = (_: unknown, incomingId: string, data: string) => {
      if (incomingId === tabId) {
        terminal.write(data);
      }
    };

    window.electron.ipcRenderer.on("terminal-output", handleOutput);

    terminal.open(containerRef.current);
    document.fonts.ready.then(safeFit);
    terminal.focus();

    // Create PTY instance
    window.electron.ipcRenderer.send("terminal-create", tabId);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    return () => {
      setActive(null);
      resizeObserverRef.current?.disconnect();
      window.electron.ipcRenderer.removeListener(
        "terminal-output",
        handleOutput
      );
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

    // Disconnect any existing observer
    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = null;
    if (active) setActive(api);
    if (!active) return;

    // Ensure layout is ready
    requestAnimationFrame(() => {
      safeFit(); // Initial fit on activation

      const observer = new ResizeObserver((entries) => {
        const { width, height } = entries[0].contentRect;
        if (width && height) {
          // Minimal debounce via microtask
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

  return (
    <>
      <div
        ref={containerRef}
        className="terminal-container flex-1 overflow-hidden h-full w-full"
        style={{ display: active ? "block" : "none" }}
      />
      <CopyNotification
        isVisible={notificationState.isVisible}
        position={notificationState.position}
        onComplete={handleComplete}
      />
    </>
  );
};
