import { useMemo, useCallback, useRef } from "react";
import { TerminalContext } from "./context";

export const TerminalProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const activeRef = useRef<TerminalAPI | null>(null);
  const byIdRef = useRef<Map<string, TerminalAPI>>(new Map());

  const setActive = useCallback((api: TerminalAPI | null) => {
    activeRef.current = api;
  }, []);

  const getActive = useCallback(() => {
    return activeRef.current;
  }, []);

  const register = useCallback((tabId: string, api: TerminalAPI | null) => {
    if (api) byIdRef.current.set(tabId, api);
    else byIdRef.current.delete(tabId);
  }, []);

  const getById = useCallback((tabId: string) => {
    return byIdRef.current.get(tabId) ?? null;
  }, []);

  const value: TerminalContextType = useMemo(
    () => ({
      setActive,
      getActive,
      register,
      getById,
    }),
    [setActive, getActive, register, getById],
  );

  return (
    <TerminalContext.Provider value={value}>
      {children}
    </TerminalContext.Provider>
  );
};
