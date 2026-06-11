import { useEffect, useState } from "react";
import { TerminalPanel } from "./components/terminal-tab";
import { AppProvider } from "./contexts/app-context";
import { ThemeProvider } from "./components/theme-provider";
import {
  TerminalProvider,
  useTerminalContext,
} from "./contexts/terminal-context";
import { Minus, Square, X, TerminalSquare, Server } from "lucide-react";
import { AGENT_LAUNCHERS } from "./types/ai-agents";

/**
 * Single-terminal window spawned when a tab is "popped out" of the main app.
 * The PTY already runs in the main process (keyed by tabId); this view only
 * attaches to it via the existing TerminalPanel and repaints the inherited
 * scrollback. Chrome is intentionally minimal — no tab bar, no side panels.
 */
function DetachedContent(): React.JSX.Element {
  const { getById } = useTerminalContext();
  const [payload, setPayload] = useState<DetachPayload | null>(null);
  const [loaded, setLoaded] = useState(false);

  // tabId is also embedded in the URL; the full payload comes via handshake.
  const tabId = new URLSearchParams(window.location.search).get("tabId") ?? "";

  useEffect(() => {
    let cancelled = false;
    window.api.detach.getPayload().then((p) => {
      if (cancelled) return;
      setPayload(p);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // When the window is closing, hand the current scrollback back to main so
  // the tab can return to the source window with its full history.
  useEffect(() => {
    const off = window.api.detach.onSerializeRequest(() => {
      const serialized = getById(tabId)?.serialize() ?? "";
      window.api.detach.sendSerialized(serialized);
    });
    return off;
  }, [tabId, getById]);

  const title = payload?.title ?? "Terminal";
  const isSSH = !!payload?.isSSH;
  const agent = payload?.agentId
    ? AGENT_LAUNCHERS.find((a) => a.id === payload.agentId)
    : undefined;

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-gray-100">
      {/* Minimal title bar */}
      <div className="bg-slate-900/95 backdrop-blur-xl border-b border-slate-700/40 px-4 py-1.5 flex items-center gap-2 shadow-xl">
        <div className="drag-region flex flex-1 items-center gap-2 min-w-0">
          {agent ? (
            <span
              className="flex-shrink-0 text-[14px] leading-none font-semibold"
              style={{ color: `rgb(${agent.color.join(",")})` }}
              title={agent.name}
            >
              {agent.glyph}
            </span>
          ) : isSSH ? (
            <Server size={14} className="text-accent-400 flex-shrink-0" />
          ) : (
            <TerminalSquare
              size={14}
              className="text-accent-400 flex-shrink-0"
            />
          )}
          <span className="text-sm font-medium text-gray-300 truncate select-none">
            {title}
          </span>
        </div>
        {window.platform?.os === "linux" && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={() => window.api.windowControls.minimize()}
              className="flex items-center justify-center w-7 h-7 rounded text-gray-500 hover:bg-slate-700/60 hover:text-gray-300 transition-all duration-150"
              title="Minimize"
            >
              <Minus size={12} />
            </button>
            <button
              onClick={() => window.api.windowControls.maximize()}
              className="flex items-center justify-center w-7 h-7 rounded text-gray-500 hover:bg-slate-700/60 hover:text-gray-300 transition-all duration-150"
              title="Maximize"
            >
              <Square size={10} />
            </button>
            <button
              onClick={() => window.api.windowControls.close()}
              className="flex items-center justify-center w-7 h-7 rounded text-gray-500 hover:bg-red-500/20 hover:text-red-400 transition-all duration-150"
              title="Close"
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Terminal */}
      <div className="flex-1 bg-slate-950 relative overflow-hidden">
        {loaded && tabId && (
          <div className="absolute inset-0">
            <TerminalPanel
              tabId={tabId}
              active={true}
              tabTitle={title}
              initialSerialized={payload?.serialized}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function DetachedApp(): React.JSX.Element {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <AppProvider>
        <TerminalProvider>
          <DetachedContent />
        </TerminalProvider>
      </AppProvider>
    </ThemeProvider>
  );
}

export default DetachedApp;
