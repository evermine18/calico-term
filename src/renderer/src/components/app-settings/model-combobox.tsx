import { CheckIcon, ChevronsUpDownIcon, Loader2 } from "lucide-react";

import { cn } from "@renderer/lib/utils";
import { Button } from "@renderer/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@renderer/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@renderer/components/ui/popover";
import { useEffect, useState } from "react";

type FetchStatus = "idle" | "loading" | "success" | "error";

export function ModelsSelector({
  url,
  apiKey,
  currentValue,
  onValueChange,
  onStatusChange,
}: {
  url: string;
  apiKey: string;
  currentValue?: string;
  onValueChange?: (model: string) => void;
  onStatusChange?: (status: FetchStatus, error?: string) => void;
}) {
  const [models, setModels] = useState([]);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentValue || "");
  const [status, setStatus] = useState<FetchStatus>("idle");

  const updateStatus = (s: FetchStatus, error?: string) => {
    setStatus(s);
    onStatusChange?.(s, error);
  };

  const fetchModels = async () => {
    if (!url || !apiKey) {
      updateStatus("idle");
      setModels([]);
      return;
    }
    updateStatus("loading");
    try {
      const result = await window.electron.ipcRenderer.invoke(
        "get-ai-models",
        url,
        apiKey
      );
      setModels(result);
      updateStatus("success");
    } catch (error: any) {
      console.error("Error fetching models:", error);
      setModels([]);
      const msg = error?.message ?? String(error);
      updateStatus("error", msg);
    }
  };

  useEffect(() => {
    if (onValueChange) {
      onValueChange(value);
    }
  }, [value]);

  useEffect(() => {
    fetchModels();
  }, [url, apiKey]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={status === "loading"}
          className="w-full justify-between bg-slate-800/60 border-slate-700/50 text-gray-100 hover:bg-slate-800 focus:border-cyan-500/50 disabled:opacity-60"
        >
          <span className="truncate">
            {status === "loading"
              ? "Fetching models…"
              : value
                ? models.find((model) => model === value) ?? value
                : "Select model…"}
          </span>
          {status === "loading" ? (
            <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin text-cyan-400" />
          ) : (
            <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search model..." />
          <CommandList>
            <CommandEmpty>No model found.</CommandEmpty>
            <CommandGroup>
              {models.map((model) => (
                <CommandItem
                  key={model}
                  value={model}
                  onSelect={(currentValue) => {
                    setValue(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                >
                  <CheckIcon
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === model ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {model}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
