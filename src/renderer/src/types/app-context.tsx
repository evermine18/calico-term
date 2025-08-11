type AppContextType = {
  aiSidebarOpen: boolean;
  setAiSidebarOpen: (open: boolean) => void;
  apiUrl: string;
  setApiUrl: (url: string) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
};
