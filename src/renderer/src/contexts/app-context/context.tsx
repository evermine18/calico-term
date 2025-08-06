import { createContext, useContext } from "react";

export const AppContext = createContext<AppContextType | undefined>(undefined);

export function useAppContext(): AppContextType {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
}
