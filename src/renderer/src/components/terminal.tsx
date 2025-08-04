import React, { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
  onData?: (data: string) => void;
}

const TerminalComponent: React.FC<TerminalProps> = ({ onData }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current || termRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      theme: { background: "#1e1e1e", foreground: "#ffffff" },
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());

    const handleInput = (data: string) => {
      onData?.(data);
      window.electron.ipcRenderer.send("terminal-input", data);
    };

    const handleOutput = (_: unknown, data: string) => {
      terminal.write(data);
    };

    terminal.onData(handleInput);
    window.electron.ipcRenderer.on("terminal-output", handleOutput);

    const fit = () => {
      fitAddon.fit();
      window.electron.ipcRenderer.send("terminal-resize", {
        cols: terminal.cols,
        rows: terminal.rows,
      });
    };

    terminal.open(containerRef.current);
    fit();
    terminal.focus();
    window.addEventListener("resize", fit);

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
    };
  }, [onData]);

  return (
    <div ref={containerRef} className="terminal-container h-full w-full" />
  );
};

export default TerminalComponent;
