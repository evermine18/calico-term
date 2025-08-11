import { useMemo, useState } from "react";
import { AppContext } from "./context";

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
  const [apiUrl, setApiUrl] = useState(localStorage.getItem("apiUrl") || "");
  const [selectedModel, setSelectedModel] = useState(
    localStorage.getItem("selectedModel") || ""
  );

  const value: AppContextType = useMemo(
    () => ({
      aiSidebarOpen,
      setAiSidebarOpen,
      apiUrl,
      setApiUrl: (url: string) => {
        localStorage.setItem("apiUrl", url);
        setApiUrl(url);
      },
      selectedModel,
      setSelectedModel: (model: string) => {
        localStorage.setItem("selectedModel", model);
        setSelectedModel(model);
      },
    }),
    [aiSidebarOpen]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
