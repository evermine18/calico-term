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
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-elevated/60 border border-hairline/40 text-[11px] text-ink-muted hover:bg-elevated/60 transition-colors"
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
            <span className="px-1 rounded text-[9px] font-mono bg-danger/20 text-danger">
              PROD
            </span>
          )}
          <ChevronsUpDown size={11} className="text-ink-subtle" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-0 bg-panel border-hairline/50"
        align="start"
      >
        <Command className="bg-transparent">
          <CommandInput
            placeholder="Search workspaces…"
            className="text-ink"
          />
          <CommandList>
            <CommandEmpty className="py-4 text-center text-xs text-ink-subtle">
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
                  className="flex items-center gap-2 text-ink data-[selected=true]:bg-accent-500/15 data-[selected=true]:text-ink"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: w.color }}
                  />
                  <span className="flex-1 truncate">{w.name}</span>
                  {w.environment === "prod" && (
                    <span className="text-[9px] font-mono text-danger">
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
        <div className="border-t border-hairline/40 px-2 py-1.5 text-[10px] text-ink-subtle flex items-center gap-1.5">
          <Layers size={10} />
          Manage in Settings → Workspaces
        </div>
      </PopoverContent>
    </Popover>
  );
}
