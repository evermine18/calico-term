import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";

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

export function ModelsSelector({
  url,
  apiKey,
  currentValue,
  onValueChange,
}: {
  url: string;
  apiKey: string;
  currentValue?: string;
  onValueChange?: (model: string) => void;
}) {
  const [models, setModels] = useState([]);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentValue || "");

  const fetchModels = async () => {
    try {
      const models = await window.electron.ipcRenderer.invoke(
        "get-ai-models",
        url,
        apiKey
      );
      setModels(models);
    } catch (error) {
      console.error("Error fetching models:", error);
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
          className="w-[200px] justify-between"
        >
          {value ? models.find((model) => model === value) : "Select model..."}
          <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
