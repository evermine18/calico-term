export type WorkspaceEnvironment = "dev" | "staging" | "prod" | "other";

export type Snippet = {
  id: string;
  name: string;
  command: string;
};

export type Workspace = {
  id: string;
  name: string;
  /** Hex color used for the header stripe and tab dot. */
  color: string;
  environment?: WorkspaceEnvironment;
  /** IDs of SSH connections that belong to this workspace. */
  sshConnectionIds: string[];
  /** Keys of env vars (resolved from the env vault) attached to this workspace. */
  envVarKeys?: string[];
  /** IDs of alert rules attached to this workspace. */
  alertRuleIds?: string[];
  snippets?: Snippet[];
};

export const DEFAULT_WORKSPACE_ID = "ws-personal";

export function defaultWorkspace(
  sshConnectionIds: string[] = [],
): Workspace {
  return {
    id: DEFAULT_WORKSPACE_ID,
    name: "Personal",
    color: "#06b6d4",
    environment: "other",
    sshConnectionIds,
  };
}

export function workspaceEnvLabel(env?: WorkspaceEnvironment): string {
  switch (env) {
    case "dev":
      return "DEV";
    case "staging":
      return "STAGING";
    case "prod":
      return "PROD";
    default:
      return "";
  }
}
