type TerminalAPI = {
  getVisibleText: () => string;
  getAllBufferText: () => string;
  sendInput: (cmd: string) => void;
  // Full xterm buffer serialized with escape sequences (for pop-out scrollback).
  serialize: () => string;
};

type TerminalContextType = {
  setActive: (api: TerminalAPI | null) => void;
  getActive: () => TerminalAPI | null;
  // Per-tab registry so any tab (not just the active one) can be serialized,
  // e.g. when popping out a background tab via its context menu.
  register: (tabId: string, api: TerminalAPI | null) => void;
  getById: (tabId: string) => TerminalAPI | null;
};
