import { useMemo, useCallback, useRef } from "react";
import { TerminalContext } from "./context";

export const TerminalProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const activeRef = useRef<TerminalAPI | null>(null);

  const setActive = useCallback((api: TerminalAPI | null) => {
    activeRef.current = api;
  }, []);

  const getActive = useCallback(() => {
    return activeRef.current;
  }, []);

  const value: TerminalContextType = useMemo(
    () => ({
      setActive,
      getActive,
    }),
    [setActive, getActive]
  );

  return (
    <TerminalContext.Provider value={value}>
      {children}
    </TerminalContext.Provider>
  );
};
