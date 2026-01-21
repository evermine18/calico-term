import { Button } from "@renderer/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@renderer/components/ui/dialog";
import { Input } from "@renderer/components/ui/input";
import { Label } from "@renderer/components/ui/label";
import { ModelsSelector } from "./model-combobox";
import { useAppContext } from "@renderer/contexts/app-context";
import { useState, useEffect } from "react";
import { Eye, Plus, X, Edit2, Check } from "lucide-react";

interface Tag {
  id: string;
  name: string;
  color: string;
}

const TAGS_STORAGE_KEY = 'calico-term-tags';

export default function SettingsDialog({ children }) {
  const {
    apiUrl,
    setApiUrl,
    apiKey,
    setApiKey,
    selectedModel,
    setSelectedModel,
  } = useAppContext();
  const [localSettings, setLocalSettings] = useState({
    apiUrl: apiUrl || "",
    apiKey: apiKey || "",
    selectedModel: selectedModel || "",
  });
  const [open, setOpen] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#06b6d4");
  const [editingTagId, setEditingTagId] = useState<string | null>(null);

  // Load tags from localStorage
  useEffect(() => {
    const storedTags = localStorage.getItem(TAGS_STORAGE_KEY);
    if (storedTags) {
      setTags(JSON.parse(storedTags));
    }
  }, [open]);

  // Save tags to localStorage
  const saveTags = (updatedTags: Tag[]) => {
    localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(updatedTags));
    setTags(updatedTags);
    // Dispatch event to notify changes
    window.dispatchEvent(new Event('tags-updated'));
  };

  const addTag = () => {
    if (!newTagName.trim()) return;
    const newTag: Tag = {
      id: crypto.randomUUID(),
      name: newTagName.trim(),
      color: newTagColor,
    };
    saveTags([...tags, newTag]);
    setNewTagName("");
    setNewTagColor("#06b6d4");
  };

  const updateTag = (id: string, name: string, color: string) => {
    saveTags(tags.map(tag => tag.id === id ? { ...tag, name, color } : tag));
    setEditingTagId(null);
  };

  const deleteTag = (id: string) => {
    saveTags(tags.filter(tag => tag.id !== id));
  };

  const handleSave = () => {
    setApiUrl(localSettings.apiUrl);
    setApiKey(localSettings.apiKey);
    setSelectedModel(localSettings.selectedModel);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-hidden bg-slate-900 border-slate-700/40 shadow-xl">
        <DialogHeader className="border-b border-slate-700/40 pb-4">
          <DialogTitle className="text-gray-100 flex items-center gap-2">
            <div className="w-8 h-8 bg-cyan-500/20 border border-cyan-500/30 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </div>
            Settings
          </DialogTitle>
          <DialogDescription className="text-cyan-400/70 text-sm">
            Configure your application preferences and terminal tags
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto max-h-[calc(85vh-180px)] px-1">
          <div className="grid gap-5 py-4">
            {/* API Settings Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-gray-300 text-sm font-semibold">
                <div className="w-1 h-4 bg-cyan-500 rounded-full"></div>
                API Configuration
              </div>

              <div className="grid gap-2.5 pl-3">
                <Label htmlFor="api-url" className="text-gray-300 text-sm">Base API URL</Label>
                <Input
                  id="api-url"
                  name="Api Url"
                  defaultValue={localSettings.apiUrl}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, apiUrl: e.target.value })
                  }
                  className="bg-slate-800/60 border-slate-700/50 text-gray-100 focus:border-cyan-500/50 focus:ring-cyan-500/20"
                />
              </div>

              <div className="grid gap-2.5 pl-3">
                <Label htmlFor="api-key" className="text-gray-300 text-sm">API Key</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="api-key"
                    name="Api Key"
                    type={showApiKey ? "text" : "password"}
                    defaultValue={localSettings.apiKey}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, apiKey: e.target.value })
                    }
                    className="bg-slate-800/60 border-slate-700/50 text-gray-100 focus:border-cyan-500/50 focus:ring-cyan-500/20"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="bg-slate-800/60 border-slate-700/50 hover:bg-cyan-500/20 hover:text-cyan-300 hover:border-cyan-500/50"
                  >
                    <Eye size={16} />
                  </Button>
                </div>
              </div>

              <div className="grid gap-2.5 pl-3">
                <Label htmlFor="model" className="text-gray-300 text-sm">Model</Label>
                <ModelsSelector
                  url={localSettings.apiUrl}
                  apiKey={localSettings.apiKey}
                  currentValue={localSettings.selectedModel}
                  onValueChange={(model) =>
                    setLocalSettings({ ...localSettings, selectedModel: model })
                  }
                />
              </div>
            </div>

            {/* Tags Section */}
            <div className="space-y-4 pt-3 border-t border-slate-700/40">
              <div className="flex items-center gap-2 text-gray-300 text-sm font-semibold">
                <div className="w-1 h-4 bg-cyan-500 rounded-full"></div>
                Terminal Tags
              </div>
              <div className="text-xs text-gray-400 pl-3">
                Create custom tags to organize your terminals
              </div>

              {/* Add new tag */}
              <div className="flex gap-2 pl-3">
                <Input
                  placeholder="Tag name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  className="bg-slate-800/60 border-slate-700/50 text-gray-100 placeholder:text-gray-500 focus:border-cyan-500/50 focus:ring-cyan-500/20"
                />
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="w-12 h-9 rounded-md border border-slate-700/50 bg-slate-800/60 cursor-pointer"
                />
                <Button
                  onClick={addTag}
                  size="icon"
                  className="bg-slate-800/60 border border-slate-700/50 hover:bg-cyan-500/20 hover:text-cyan-300 hover:border-cyan-500/50 text-gray-400"
                >
                  <Plus size={16} />
                </Button>
              </div>

              {/* Tags list */}
              <div className="space-y-2 max-h-[200px] overflow-y-auto pl-3 pr-1 scrollbar-thin scrollbar-thumb-cyan-600/40 scrollbar-track-transparent">
                {tags.map(tag => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-2.5 p-2.5 rounded-md bg-slate-800/60 border border-slate-700/50 hover:border-slate-600/60 transition-colors"
                  >
                    {editingTagId === tag.id ? (
                      <>
                        <Input
                          value={tag.name}
                          onChange={(e) => {
                            setTags(tags.map(t => t.id === tag.id ? { ...t, name: e.target.value } : t));
                          }}
                          className="flex-1 h-8 bg-slate-900/60 border-slate-700/50 text-gray-100"
                        />
                        <input
                          type="color"
                          value={tag.color}
                          onChange={(e) => {
                            setTags(tags.map(t => t.id === tag.id ? { ...t, color: e.target.value } : t));
                          }}
                          className="w-10 h-8 rounded border border-slate-700/50 bg-slate-900/60 cursor-pointer"
                        />
                        <Button
                          onClick={() => updateTag(tag.id, tag.name, tag.color)}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20"
                        >
                          <Check size={14} />
                        </Button>
                      </>
                    ) : (
                      <>
                        <div
                          className="w-4 h-4 rounded-full border border-slate-600/60"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="flex-1 text-sm text-gray-200">{tag.name}</span>
                        <Button
                          onClick={() => setEditingTagId(tag.id)}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-cyan-300 hover:bg-cyan-500/20"
                        >
                          <Edit2 size={14} />
                        </Button>
                        <Button
                          onClick={() => deleteTag(tag.id)}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-red-400 hover:bg-red-500/20"
                        >
                          <X size={14} />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="border-t border-slate-700/40 pt-4 gap-2">
          <DialogClose asChild>
            <Button variant="outline" className="bg-slate-800/60 border-slate-700/50 hover:bg-slate-700/60 text-gray-300">
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleSave}
            className="bg-cyan-500/90 hover:bg-cyan-500 text-white shadow-sm"
          >
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
