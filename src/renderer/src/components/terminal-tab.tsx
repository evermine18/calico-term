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
  paneId: string;
  tabId: string;
  tabVisible: boolean;
  paneFocused: boolean;
  tabTitle?: string;
  initialCommand?: string;
  onActivity?: () => void;
  onFocus?: () => void;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  paneId,
  tabId,
  tabVisible,
  paneFocused,
  tabTitle = "Terminal",
  initialCommand,
  onActivity,
  onFocus,
}) => {
  const { setActive } = useTerminalContext();
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
  } = useAppContext();

  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const fitRafRef = useRef<number | null>(null);
  const dragEndListenerRef = useRef<(() => void) | null>(null);
  const isInitializedRef = useRef(false);
  const initialCmdTimerRef = useRef<number | null>(null);
  const paneFocusedRef = useRef(paneFocused);

  const [isScrolledUp, setIsScrolledUp] = useState(false);

  const { notificationState, copyText, handleComplete } = useCopyNotification();

  useEffect(() => {
    paneFocusedRef.current = paneFocused;
  }, [paneFocused]);

  const api: TerminalAPI = {
    sendInput(cmd: string) {
      window.electron.ipcRenderer.send("terminal-input", {
        paneId,
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
  };

  const safeFit = () => {
    const container = containerRef.current;
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;

    if (!container || !terminal || !fitAddon) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    const b = terminal.buffer.active;
    const wasAtBottom = b.viewportY >= b.length - terminal.rows;

    fitAddon.fit();

    // After resize the viewport position may not update automatically — if the
    // user was already at the bottom, keep them there so content isn't "lost".
    if (wasAtBottom) {
      terminal.scrollToBottom();
    }

    window.electron.ipcRenderer.send("terminal-resize", {
      paneId,
      cols: terminal.cols,
      rows: terminal.rows,
    });
  };

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
    });

    terminal.onSelectionChange((_) => {
      const text = terminal.getSelection();
      if (text) {
        copyText(text, null);
      }
    });

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
          paneId,
          data: String.fromCharCode(key.charCodeAt(0) - 64),
        });
        return false;
      });
    }

    terminal.onData((data) => {
      if (data === "\r") {
        const buffer = terminal.buffer.active;
        const cursorY = buffer.cursorY;
        const line = buffer.getLine(cursorY);

        if (line) {
          let lineText = line.translateToString(true);
          lineText = lineText.replace(
            /^\[?[\w\-\.]+@[\w\-\.]+.*?\]?\s*[\$#>]\s*/,
            "",
          );
          lineText = lineText.replace(/^PS\s+[\w\:\\\>]+>\s*/, "");
          lineText = lineText.replace(/^C:\\.*?>\s*/, "");
          lineText = lineText.replace(/^.*?[$#>]\s*/, "");

          const cmd = lineText.trim();
          if (cmd && cmd.length > 0) {
            addCommandToHistory(cmd, tabId, tabTitle);
          }
        }
      }

      window.electron.ipcRenderer.send("terminal-input", { paneId, data });
    });

    const handleOutput = (_: unknown, incomingId: string, data: string) => {
      if (incomingId === paneId) {
        terminal.write(data);
        if (!paneFocusedRef.current) {
          onActivity?.();
        }
      }
    };

    window.electron.ipcRenderer.on("terminal-output", handleOutput);

    terminal.open(containerRef.current);
    document.fonts.ready.then(safeFit);
    terminal.focus();

    window.electron.ipcRenderer.send("terminal-create", paneId, {
      shell: defaultShell || undefined,
      cwd: defaultCwd || undefined,
    });

    if (initialCommand) {
      const cmd = initialCommand;
      initialCmdTimerRef.current = window.setTimeout(() => {
        initialCmdTimerRef.current = null;
        window.electron.ipcRenderer.send("terminal-input", {
          paneId,
          data: cmd + "\r",
        });
      }, 900);
    }

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    return () => {
      if (initialCmdTimerRef.current !== null) {
        clearTimeout(initialCmdTimerRef.current);
        initialCmdTimerRef.current = null;
      }
      if (fitRafRef.current !== null) clearTimeout(fitRafRef.current);
      if (dragEndListenerRef.current) {
        window.removeEventListener('splitter-drag-end', dragEndListenerRef.current);
        dragEndListenerRef.current = null;
      }
      resizeObserverRef.current?.disconnect();
      window.electron.ipcRenderer.removeListener(
        "terminal-output",
        handleOutput,
      );
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      isInitializedRef.current = false;
    };
  }, [paneId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = null;
    if (dragEndListenerRef.current) {
      window.removeEventListener('splitter-drag-end', dragEndListenerRef.current);
      dragEndListenerRef.current = null;
    }

    if (paneFocused) {
      setActive(api);
    }

    if (!tabVisible) return;

    requestAnimationFrame(() => {
      safeFit();

      const observer = new ResizeObserver((entries) => {
        const { width, height } = entries[0].contentRect;
        // Skip fit while a splitter is being dragged — do it on drag-end instead
        if (!width || !height || document.body.dataset.splitterDragging) return;
        // Debounce with setTimeout so that during a multi-frame resize (e.g.
        // window drag) only the final stable size triggers a fit. RAF fires
        // once per frame so it can't cancel previous calls across frames.
        if (fitRafRef.current !== null) clearTimeout(fitRafRef.current);
        fitRafRef.current = window.setTimeout(() => {
          fitRafRef.current = null;
          safeFit();
        }, 50);
      });

      observer.observe(container);
      resizeObserverRef.current = observer;

      const onDragEnd = () => safeFit();
      window.addEventListener('splitter-drag-end', onDragEnd);
      dragEndListenerRef.current = onDragEnd;
    });
  }, [tabVisible]);

  useEffect(() => {
    if (paneFocused) {
      setActive(api);
      terminalRef.current?.focus();
    }
  }, [paneFocused]);

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

  const handleScrollToBottom = () => {
    terminalRef.current?.scrollToBottom();
    setIsScrolledUp(false);
  };

  return (
    <>
      <div
        ref={containerRef}
        className="terminal-container flex-1 overflow-hidden h-full w-full"
        onMouseDown={() => onFocus?.()}
      />

      {paneFocused && isScrolledUp && (
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
