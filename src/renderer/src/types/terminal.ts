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
};
