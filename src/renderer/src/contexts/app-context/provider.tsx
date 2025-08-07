import { useMemo, useState } from "react";
import { AppContext } from "./context";

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);

  const value: AppContextType = useMemo(
    () => ({
      aiSidebarOpen,
      setAiSidebarOpen,
    }),
    [aiSidebarOpen]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
