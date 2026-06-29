import { useAppContext } from "@renderer/contexts/app-context";

type Option = {
  value: WorkspaceIdentityMode;
  label: string;
  description: string;
};

const OPTIONS: Option[] = [
  {
    value: "off",
    label: "Off",
    description: "No workspace color anywhere. Cleanest look.",
  },
  {
    value: "subtle",
    label: "Subtle",
    description:
      "Chip in the status bar + colored accent on the active tab. Recommended.",
  },
  {
    value: "strong",
    label: "Strong",
    description:
      "Chip in the status bar + colored accent and a soft tint on the active tab.",
  },
  {
    value: "prod-only",
    label: "Prod only",
    description:
      "Show identity only when the workspace environment is production.",
  },
];

export function WorkspaceIdentityPanel() {
  const { workspaceIdentity, setWorkspaceIdentity, workspaces, activeWorkspaceId } =
    useAppContext();
  const activeWs =
    workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-ink-muted text-sm font-semibold">Workspace Identity</p>
        <p className="text-xs text-ink-muted mt-1">
          Controls how strongly the active workspace is signaled visually. Changes
          apply instantly.
        </p>
      </div>

      <div className="grid gap-2">
        {OPTIONS.map((opt) => {
          const selected = workspaceIdentity === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setWorkspaceIdentity(opt.value)}
              className={`text-left p-3 rounded-lg border transition-colors ${
                selected
                  ? "bg-accent-500/10 border-accent-500/50"
                  : "bg-elevated/40 border-hairline/40 hover:bg-elevated/70 hover:border-hairline/60"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                    selected
                      ? "border-accent-400"
                      : "border-hairline"
                  }`}
                >
                  {selected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-400" />
                  )}
                </span>
                <span className="text-sm font-medium text-ink-muted">
                  {opt.label}
                </span>
              </div>
              <p className="text-xs text-ink-muted mt-1.5 ml-5">
                {opt.description}
              </p>
            </button>
          );
        })}
      </div>

      {activeWs && (
        <div className="pt-3 border-t border-hairline/40">
          <p className="text-xs text-ink-muted mb-2">
            Active workspace preview
          </p>
          <div className="flex items-center gap-3 p-3 rounded-md bg-elevated/40 border border-hairline/40">
            <span
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: activeWs.color,
                boxShadow: `0 0 6px ${activeWs.color}aa`,
              }}
            />
            <span
              className="text-xs uppercase tracking-widest font-medium"
              style={{ color: activeWs.color }}
            >
              {activeWs.name}
            </span>
            {activeWs.environment === "prod" && (
              <span className="text-[9px] font-mono tracking-wider px-1.5 py-0.5 rounded border bg-danger/15 text-danger border-danger/30">
                PROD
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
