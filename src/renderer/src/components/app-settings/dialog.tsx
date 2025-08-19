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
import { useState } from "react";
import { Eye } from "lucide-react";

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

  const handleSave = () => {
    setApiUrl(localSettings.apiUrl);
    setApiKey(localSettings.apiKey);
    setSelectedModel(localSettings.selectedModel);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
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
