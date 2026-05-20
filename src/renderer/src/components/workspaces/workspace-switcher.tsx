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
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-card/50 border border-border/60 text-[11px] text-foreground/80 hover:bg-accent transition-colors"
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
          {active.environment === "prod" && (
            <span className="px-1 rounded text-[9px] font-mono bg-red-500/20 text-red-300">
              PROD
            </span>
          )}
          <ChevronsUpDown size={11} className="text-muted-foreground/70" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-0 bg-card border-border/80"
        align="start"
      >
        <Command className="bg-transparent">
          <CommandInput
            placeholder="Search workspaces…"
            className="text-foreground"
          />
          <CommandList>
            <CommandEmpty className="py-4 text-center text-xs text-muted-foreground/70">
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
                  className="flex items-center gap-2 text-foreground data-[selected=true]:bg-accent-500/15 data-[selected=true]:text-accent-100"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: w.color }}
                  />
                  <span className="flex-1 truncate">{w.name}</span>
                  {w.environment === "prod" && (
                    <span className="text-[9px] font-mono text-red-400">
                      PROD
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
        <div className="border-t border-border/60 px-2 py-1.5 text-[10px] text-muted-foreground/70 flex items-center gap-1.5">
          <Layers size={10} />
          Manage in Settings → Workspaces
        </div>
      </PopoverContent>
    </Popover>
  );
}
