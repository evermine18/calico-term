import { useAppContext } from "@renderer/contexts/app-context";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@renderer/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@renderer/components/ui/command";
import { Check, ChevronsUpDown, Layers } from "lucide-react";

const ENV_LABEL: Record<string, string> = {
  dev: "DEV",
  staging: "STG",
  prod: "PROD",
  other: "",
};

export function WorkspaceSwitcher() {
  const {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    workspaceSwitcherOpen,
    setWorkspaceSwitcherOpen,
  } = useAppContext();
  const active =
    workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];

  if (!active) return null;

  return (
    <Popover open={workspaceSwitcherOpen} onOpenChange={setWorkspaceSwitcherOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-800/60 border border-slate-700/40 text-[11px] text-gray-300 hover:bg-slate-700/60 transition-colors"
          title="Switch workspace"
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: active.color,
              boxShadow: `0 0 5px ${active.color}99`,
            }}
          />
          <span className="font-medium tracking-wide">{active.name}</span>
          {active.environment && active.environment !== "other" && (
            <span
              className={`px-1 rounded text-[9px] font-mono ${
                active.environment === "prod"
                  ? "bg-red-500/20 text-red-300"
                  : active.environment === "staging"
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-emerald-500/20 text-emerald-300"
              }`}
            >
              {ENV_LABEL[active.environment]}
            </span>
          )}
          <ChevronsUpDown size={11} className="text-gray-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-0 bg-slate-900 border-slate-700/50"
        align="start"
      >
        <Command className="bg-transparent">
          <CommandInput
            placeholder="Search workspaces…"
            className="text-gray-200"
          />
          <CommandList>
            <CommandEmpty className="py-4 text-center text-xs text-gray-500">
              No workspaces.
            </CommandEmpty>
            <CommandGroup>
              {workspaces.map((w) => (
                <CommandItem
                  key={w.id}
                  value={w.name}
                  onSelect={() => {
                    setActiveWorkspaceId(w.id);
                    setWorkspaceSwitcherOpen(false);
                  }}
                  className="flex items-center gap-2 text-gray-200 data-[selected=true]:bg-accent-500/15 data-[selected=true]:text-accent-100"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: w.color }}
                  />
                  <span className="flex-1 truncate">{w.name}</span>
                  {w.environment && w.environment !== "other" && (
                    <span className="text-[9px] font-mono text-gray-500">
                      {ENV_LABEL[w.environment]}
                    </span>
                  )}
                  {w.id === activeWorkspaceId && (
                    <Check size={12} className="text-accent-400" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="border-t border-slate-700/40 px-2 py-1.5 text-[10px] text-gray-500 flex items-center gap-1.5">
          <Layers size={10} />
          Manage in Settings → Workspaces
        </div>
      </PopoverContent>
    </Popover>
  );
}
