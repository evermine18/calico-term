type TerminalAPI = {
  getVisibleText: () => string;
  getAllBufferText: () => string;
  sendInput: (cmd: string) => void;
};

type TerminalContextType = {
  setActive: (api: TerminalAPI | null) => void;
  getActive: () => TerminalAPI | null;
};
