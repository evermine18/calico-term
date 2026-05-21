import { useAppContext } from "../../contexts/app-context";
import { shouldShowWorkspaceIdentity } from "../../lib/workspace-helpers";

export function WorkspaceChip() {
  const { workspaces, activeWorkspaceId, workspaceIdentity } = useAppContext();
  const ws = workspaces.find((w) => w.id === activeWorkspaceId);
  if (!shouldShowWorkspaceIdentity(workspaceIdentity, ws) || !ws) return null;

  const isProd = ws.environment === "prod";

  return (
    <span
      className="flex items-center gap-1.5"
      title={`Workspace: ${ws.name}${isProd ? " (PROD)" : ""}`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{
          backgroundColor: ws.color,
          boxShadow: `0 0 4px ${ws.color}aa`,
        }}
      />
      <span
        className="text-[10px] uppercase tracking-widest font-medium"
        style={{ color: ws.color }}
      >
        {ws.name}
      </span>
      {isProd && (
        <span className="text-[9px] font-mono tracking-wider px-1 rounded bg-red-500/15 text-red-300 border border-red-500/30">
          PROD
        </span>
      )}
    </span>
  );
}
