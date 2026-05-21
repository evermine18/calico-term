export function workspaceForConnection(
  workspaces: WorkspaceEntry[],
  activeWorkspaceId: string,
  connId: string | undefined,
): WorkspaceEntry | null {
  if (!connId) return null;
  const owning = workspaces.filter((w) => w.sshConnectionIds.includes(connId));
  if (owning.length === 0) return null;
  return owning.find((w) => w.id === activeWorkspaceId) ?? owning[0];
}

export function shouldShowWorkspaceIdentity(
  mode: WorkspaceIdentityMode,
  workspace: { environment?: WorkspaceEnvironmentEntry } | null | undefined,
): boolean {
  if (!workspace) return false;
  if (mode === "off") return false;
  if (mode === "prod-only") return workspace.environment === "prod";
  return true;
}
