type TerminalAPI = {
  getVisibleText: () => string;
  getAllBufferText: () => string;
};

type TerminalContextType = {
  setActive: (api: TerminalAPI | null) => void;
  getActive: () => TerminalAPI | null;
};
