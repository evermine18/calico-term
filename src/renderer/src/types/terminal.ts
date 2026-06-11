import { Terminal } from "@xterm/xterm";

export type TerminalTab = {
  id: string;
  title: string;
  mode: "normal" | "edit";
  terminal: Terminal;
  initialCommand?: string;
  badge?: string | null;
  hasActivity?: boolean;
  isSSH?: boolean;
  connId?: string;
  /** Per-tab working directory for the PTY (e.g. the folder an agent runs in). */
  cwd?: string;
  /** ANSI "logo" written to the terminal at launch (agent tabs). */
  agentBanner?: string;
  /** Catalog id of the CLI agent this tab runs, if any (drives the tab icon). */
  agentId?: string;
};
