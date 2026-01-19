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
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Make changes to your settings here. Click save when you&apos;re
            done.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-3">
            <Label htmlFor="api-url">Base API URL</Label>
            <Input
              id="api-url"
              name="Api Url"
              defaultValue={localSettings.apiUrl}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, apiUrl: e.target.value })
              }
            />
          </div>
          <div className="grid gap-3">
            <Label htmlFor="api-key">API Key</Label>
            <div className="flex items-center gap-2">
              <Input
                id="api-key"
                name="Api Key"
                type={showApiKey ? "text" : "password"}
                defaultValue={localSettings.apiKey}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, apiKey: e.target.value })
                }
              />
              <Button
                variant="outline"
                onClick={() => {
                  setShowApiKey(!showApiKey);
                }}
              >
                <Eye />
              </Button>
            </div>
          </div>
          <div className="grid gap-3">
            <Label htmlFor="model">Model</Label>
            <ModelsSelector
              url={localSettings.apiUrl}
              apiKey={localSettings.apiKey}
              currentValue={localSettings.selectedModel}
              onValueChange={(model) =>
                setLocalSettings({ ...localSettings, selectedModel: model })
              }
            />
          </div>

          {/* Tags Section */}
          <div className="grid gap-3 pt-4 border-t border-slate-700/50">
            <Label>Terminal Tags</Label>
            <div className="text-sm text-gray-400">
              Create custom tags to organize your terminals
            </div>

            {/* Add new tag */}
            <div className="flex gap-2">
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
              />
              <input
                type="color"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="w-12 h-10 rounded border border-slate-700 bg-slate-900 cursor-pointer"
              />
              <Button
                onClick={addTag}
                variant="outline"
                size="icon"
              >
                <Plus size={16} />
              </Button>
            </div>

            {/* Tags list */}
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {tags.map(tag => (
                <div
                  key={tag.id}
                  className="flex items-center gap-2 p-2 rounded bg-slate-800/50 border border-slate-700/50"
                >
                  {editingTagId === tag.id ? (
                    <>
                      <Input
                        value={tag.name}
                        onChange={(e) => {
                          setTags(tags.map(t => t.id === tag.id ? { ...t, name: e.target.value } : t));
                        }}
                        className="flex-1 h-8"
                      />
                      <input
                        type="color"
                        value={tag.color}
                        onChange={(e) => {
                          setTags(tags.map(t => t.id === tag.id ? { ...t, color: e.target.value } : t));
                        }}
                        className="w-10 h-8 rounded border border-slate-700 bg-slate-900 cursor-pointer"
                      />
                      <Button
                        onClick={() => updateTag(tag.id, tag.name, tag.color)}
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                      >
                        <Check size={14} />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div
                        className="w-4 h-4 rounded-full border border-slate-600"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="flex-1 text-sm">{tag.name}</span>
                      <Button
                        onClick={() => setEditingTagId(tag.id)}
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                      >
                        <Edit2 size={14} />
                      </Button>
                      <Button
                        onClick={() => deleteTag(tag.id)}
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-400 hover:text-red-300"
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
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
