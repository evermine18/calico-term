import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

interface TerminalPanelProps {
  tabId: string;
  active: boolean;
  onClose?: (id: string) => void;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  tabId,
  active,
  onClose = () => {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const isInitializedRef = useRef(false);

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
      theme: {
        background: "#1e1e1e",
        foreground: "#ffffff",
      },
      fontFamily: "Cascadia Code, monospace",
      fontSize: 14,
      // scrollback: 50000, // Optional: increase scrollback for large output
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());

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
    <div
      ref={containerRef}
      className="terminal-container flex-1 overflow-hidden h-full w-full"
      style={{ display: active ? "block" : "none" }}
    />
  );
};
