import { createContext, useContext } from "react";

export const TerminalContext = createContext<TerminalContextType | undefined>(
  undefined
);

export function useTerminalContext(): TerminalContextType {
  const context = useContext(TerminalContext);
  if (context === undefined) {
    throw new Error(
      "useTerminalContext must be used within a TerminalProvider"
    );
  }
  return context;
}
