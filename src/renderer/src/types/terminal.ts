import { Terminal } from "@xterm/xterm";

export type PaneLeaf = {
  type: "leaf";
  paneId: string;
  terminal: Terminal;
  initialCommand?: string;
  isSSH?: boolean;
};

export type PaneSplit = {
  type: "split";
  direction: "horizontal" | "vertical";
  ratio: number;
  first: SplitNode;
  second: SplitNode;
};

export type SplitNode = PaneLeaf | PaneSplit;

export type TerminalTab = {
  id: string;
  title: string;
  mode: "normal" | "edit";
  rootPane: SplitNode;
  focusedPaneId: string;
  badge?: string | null;
  hasActivity?: boolean;
  isSSH?: boolean;
};
