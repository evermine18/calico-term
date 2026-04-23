import { useEffect, useRef } from "react";
import { PaneLeaf, PaneSplit, SplitNode } from "@renderer/types/terminal";
import { TerminalPanel } from "./terminal-tab";
import { Columns2, Rows2, X } from "lucide-react";

interface SharedProps {
  tabId: string;
  tabVisible: boolean;
  focusedPaneId: string | null;
  onPaneFocus: (paneId: string) => void;
  onSplitHorizontal: (paneId: string) => void;
  onSplitVertical: (paneId: string) => void;
  onClosePane: (paneId: string) => void;
  onActivity: () => void;
  onRatioChange: (paneId: string, newRatio: number) => void;
  tabTitle?: string;
}

// Leaf component — always has the same hooks
function PaneLeafView({
  node,
  tabId,
  tabVisible,
  focusedPaneId,
  onPaneFocus,
  onSplitHorizontal,
  onSplitVertical,
  onClosePane,
  onActivity,
  tabTitle,
}: SharedProps & { node: PaneLeaf }) {
  const isFocused = focusedPaneId === node.paneId;

  return (
    <div className="relative w-full h-full group">
      <TerminalPanel
        paneId={node.paneId}
        tabId={tabId}
        tabVisible={tabVisible}
        paneFocused={isFocused}
        tabTitle={tabTitle}
        initialCommand={node.initialCommand}
        onActivity={onActivity}
        onFocus={() => onPaneFocus(node.paneId)}
      />

      {/* Pane action overlay — visible on hover */}
      {tabVisible && (
        <div className="absolute top-1.5 right-1.5 z-30 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSplitHorizontal(node.paneId);
            }}
            title="Split horizontal (Cmd+D)"
            className="flex items-center justify-center w-6 h-6 rounded bg-slate-800/90 border border-slate-600/60 text-gray-400 hover:text-accent-300 hover:border-accent-500/50 transition-colors"
          >
            <Columns2 size={12} />
          </button>
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSplitVertical(node.paneId);
            }}
            title="Split vertical (Cmd+Shift+D)"
            className="flex items-center justify-center w-6 h-6 rounded bg-slate-800/90 border border-slate-600/60 text-gray-400 hover:text-accent-300 hover:border-accent-500/50 transition-colors"
          >
            <Rows2 size={12} />
          </button>
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClosePane(node.paneId);
            }}
            title="Close pane"
            className="flex items-center justify-center w-6 h-6 rounded bg-slate-800/90 border border-slate-600/60 text-gray-400 hover:text-red-400 hover:border-red-500/50 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Focus indicator */}
      {isFocused && (
        <div className="absolute inset-0 pointer-events-none border border-accent-500/30 rounded-sm z-10" />
      )}
    </div>
  );
}

// Split component — always has the same hooks
function PaneSplitView({
  node,
  tabId,
  tabVisible,
  focusedPaneId,
  onPaneFocus,
  onSplitHorizontal,
  onSplitVertical,
  onClosePane,
  onActivity,
  onRatioChange,
  tabTitle,
}: SharedProps & { node: PaneSplit }) {
  const containerRef = useRef<HTMLDivElement>(null!);
  const firstChildRef = useRef<HTMLDivElement>(null!);
  const dividerRef = useRef<HTMLDivElement>(null!);
  const isHorizontal = node.direction === "horizontal";

  // Keep a ref to current values so the drag closure is always fresh
  const ratioRef = useRef(node.ratio);
  const onRatioChangeRef = useRef(onRatioChange);
  const firstPaneIdRef = useRef(
    node.first.type === "leaf" ? node.first.paneId : collectFirstLeafId(node.first),
  );
  ratioRef.current = node.ratio;
  onRatioChangeRef.current = onRatioChange;
  firstPaneIdRef.current =
    node.first.type === "leaf" ? node.first.paneId : collectFirstLeafId(node.first);

  // Attach drag via native listeners on window so xterm canvas can't block them
  useEffect(() => {
    const divider = dividerRef.current;
    if (!divider) return;

    let dragging = false;
    let startPos = 0;
    let startRatio = 0;
    let liveRatio = 0;

    function onPointerDown(e: PointerEvent) {
      e.preventDefault();
      dragging = true;
      document.body.dataset.splitterDragging = '1';
      startPos = isHorizontal ? e.clientX : e.clientY;
      startRatio = ratioRef.current;
      liveRatio = startRatio;
    }

    function onPointerMove(e: PointerEvent) {
      if (!dragging || !containerRef.current || !firstChildRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const size = isHorizontal ? rect.width : rect.height;
      if (size === 0) return;
      const delta = (isHorizontal ? e.clientX : e.clientY) - startPos;
      liveRatio = Math.min(0.9, Math.max(0.1, startRatio + delta / size));
      // Direct DOM update — no React re-render during drag
      firstChildRef.current.style.flexBasis = `${liveRatio * 100}%`;
    }

    function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      delete document.body.dataset.splitterDragging;
      // Notify terminals to do a single fit now that drag is complete
      window.dispatchEvent(new CustomEvent('splitter-drag-end'));
      // Single state commit on release
      onRatioChangeRef.current(firstPaneIdRef.current, liveRatio);
    }

    divider.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      divider.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [isHorizontal]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full flex ${isHorizontal ? "flex-row" : "flex-col"}`}
    >
      {/* First child — flex-basis drives the split ratio */}
      <div
        ref={firstChildRef}
        style={{
          flexBasis: `${node.ratio * 100}%`,
          flexGrow: 0,
          flexShrink: 0,
          overflow: "hidden",
          minWidth: 0,
          minHeight: 0,
        }}
      >
        <SplitPaneContainer
          node={node.first}
          tabId={tabId}
          tabVisible={tabVisible}
          focusedPaneId={focusedPaneId}
          onPaneFocus={onPaneFocus}
          onSplitHorizontal={onSplitHorizontal}
          onSplitVertical={onSplitVertical}
          onClosePane={onClosePane}
          onActivity={onActivity}
          onRatioChange={onRatioChange}
          tabTitle={tabTitle}
        />
      </div>

      {/* Drag divider */}
      <div
        ref={dividerRef}
        className={`
          flex-shrink-0 bg-slate-700/40 hover:bg-accent-500/50 active:bg-accent-500/70
          transition-colors duration-100 z-20 select-none
          ${isHorizontal ? "w-1 cursor-col-resize" : "h-1 cursor-row-resize"}
        `}
      />

      {/* Second child — takes remaining space */}
      <div
        style={{
          flexBasis: 0,
          flexGrow: 1,
          flexShrink: 1,
          overflow: "hidden",
          minWidth: 0,
          minHeight: 0,
        }}
      >
        <SplitPaneContainer
          node={node.second}
          tabId={tabId}
          tabVisible={tabVisible}
          focusedPaneId={focusedPaneId}
          onPaneFocus={onPaneFocus}
          onSplitHorizontal={onSplitHorizontal}
          onSplitVertical={onSplitVertical}
          onClosePane={onClosePane}
          onActivity={onActivity}
          onRatioChange={onRatioChange}
          tabTitle={tabTitle}
        />
      </div>
    </div>
  );
}

// Router — delegates to the correct component based on node type
export function SplitPaneContainer(props: SharedProps & { node: SplitNode }) {
  if (props.node.type === "leaf") {
    return <PaneLeafView {...props} node={props.node} />;
  }
  return <PaneSplitView {...props} node={props.node} />;
}

function collectFirstLeafId(node: SplitNode): string {
  if (node.type === "leaf") return node.paneId;
  return collectFirstLeafId(node.first);
}
