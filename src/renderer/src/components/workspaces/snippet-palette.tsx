import { useMemo } from "react";
import { useAppContext } from "@renderer/contexts/app-context";
import { useTerminalContext } from "@renderer/contexts/terminal-context";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@renderer/components/ui/command";
import { TerminalSquare, Layers } from "lucide-react";

type Item = {
  id: string;
  name: string;
  command: string;
  description?: string;
  workspaceName: string;
  workspaceColor: string;
  fromActive: boolean;
};

export function SnippetPalette() {
  const {
    workspaces,
    activeWorkspaceId,
    snippetPaletteOpen,
    setSnippetPaletteOpen,
  } = useAppContext();
  const { getActive } = useTerminalContext();

  const items: Item[] = useMemo(() => {
    const out: Item[] = [];
    for (const w of workspaces) {
      for (const s of w.snippets ?? []) {
        out.push({
          id: `${w.id}:${s.id}`,
          name: s.name,
          command: s.command,
          description: s.description,
          workspaceName: w.name,
          workspaceColor: w.color,
          fromActive: w.id === activeWorkspaceId,
        });
      }
    }
    // Active workspace snippets first
    out.sort((a, b) => Number(b.fromActive) - Number(a.fromActive));
    return out;
  }, [workspaces, activeWorkspaceId]);

  const run = (cmd: string) => {
    setSnippetPaletteOpen(false);
    // Defer one frame so the dialog close doesn't steal focus from the term.
    requestAnimationFrame(() => {
      getActive()?.sendInput(cmd);
    });
  };

  return (
    <CommandDialog
      open={snippetPaletteOpen}
      onOpenChange={setSnippetPaletteOpen}
    >
      <CommandInput placeholder="Search snippets…" />
      <CommandList>
        <CommandEmpty className="py-6 text-center text-xs text-gray-500">
          {workspaces.some((w) => (w.snippets ?? []).length)
            ? "No matching snippet."
            : "No snippets yet — add some in Settings → Workspaces."}
        </CommandEmpty>
        {items.length > 0 && (
          <CommandGroup heading="Snippets">
            {items.map((s) => (
              <CommandItem
                key={s.id}
                value={`${s.name} ${s.command} ${s.workspaceName}`}
                onSelect={() => run(s.command)}
                className="flex items-start gap-2 py-2"
              >
                <TerminalSquare
                  size={13}
                  className="mt-0.5 text-accent-400 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-100 truncate">
                    {s.name}
                  </div>
                  <div className="font-mono text-[11px] text-gray-500 truncate">
                    {s.command}
                  </div>
                  {s.description && (
                    <div className="text-[10px] text-gray-600 truncate">
                      {s.description}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-gray-500 shrink-0">
                  <Layers size={10} />
                  <span
                    className="px-1 rounded"
                    style={{
                      backgroundColor: `${s.workspaceColor}22`,
                      color: s.workspaceColor,
                    }}
                  >
                    {s.workspaceName}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
