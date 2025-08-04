import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { useEffect, useRef } from "react";
import "@xterm/xterm/css/xterm.css";

export const TerminalTab: React.FC<{
  tabId: string;
  active: boolean;
  onClose?: (id: string) => void;
}> = ({ tabId, active, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const initializedRef = useRef(false); // Prevents re-initialization
  onClose = onClose || (() => {});

  useEffect(() => {
    if (!containerRef.current) return;
    if (initializedRef.current) return; // Prevents double initialization on the same mount

    initializedRef.current = true;

    const terminal = new Terminal({
      cursorBlink: true,
      theme: { background: "#1e1e1e", foreground: "#ffffff" },
      fontFamily: "Cascadia Code, monospace",
      fontSize: 14,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());

    const handleInput = (data: string) => {
      window.electron.ipcRenderer.send("terminal-input", { tabId, data });
    };

    const handleOutput = (_: unknown, incomingId: string, data: string) => {
      if (incomingId === tabId) terminal.write(data);
    };

    terminal.onData(handleInput);
    window.electron.ipcRenderer.on("terminal-output", handleOutput);

    const fit = () => {
      fitAddon.fit();
      window.electron.ipcRenderer.send("terminal-resize", {
        tabId,
        cols: terminal.cols,
        rows: terminal.rows,
      });
    };

    terminal.open(containerRef.current);
    fit();
    terminal.focus();
    window.addEventListener("resize", fit);

    // Create the PTY in the main process (ignored if it already exists)
    window.electron.ipcRenderer.send("terminal-create", tabId);

    termRef.current = terminal;
    fitRef.current = fitAddon;

    return () => {
      window.removeEventListener("resize", fit);
      window.electron.ipcRenderer.removeListener(
        "terminal-output",
        handleOutput
      );
      terminal.dispose();
      termRef.current = null;
      fitRef.current = null;

      // IMPORTANT: Release the flag for the second mount in StrictMode
      initializedRef.current = false;

      // Do NOT kill the PTY here
      // window.electron.ipcRenderer.send("terminal-kill", tabId);
    };
  }, [tabId]);

  // If the tab is active, adjust and focus.
  useEffect(() => {
    if (active) {
      termRef.current?.focus();
      fitRef.current?.fit();
    }
  }, [active]);

  return (
    <div
      ref={containerRef}
      className="terminal-container flex-1 overflow-hidden  h-full w-full"
      style={{ display: active ? "block" : "none" }}
    />
  );
};
