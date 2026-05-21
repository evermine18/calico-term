export type SSHSecretRef = {
  provider: "op" | "bw" | "vault" | "aws";
  ref: string;
};

export type SSHConnection = {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  /** Path to a private key on disk (legacy / external keys). */
  identityFile?: string;
  /** ID of a key managed by the internal SSH key manager. */
  identityKeyId?: string;
  /** Ordered list of SSH connection IDs to jump through before reaching `host`. */
  jumpHostIds?: string[];
  hasPassword?: boolean;
  /** Reference to a secret in an external manager. Resolved just-in-time. */
  passwordRef?: SSHSecretRef;
  tags?: string[];
};

export function buildSSHCommand(conn: SSHConnection, jumps?: SSHConnection[]): string {
  const parts = ["ssh"];
  if (conn.identityFile) parts.push("-i", conn.identityFile);
  if (conn.port !== 22) parts.push("-p", String(conn.port));
  if (jumps && jumps.length > 0) {
    const chain = jumps
      .map((j) => {
        const userHost = `${j.username}@${j.host}`;
        return j.port !== 22 ? `${userHost}:${j.port}` : userHost;
      })
      .join(",");
    parts.push("-J", chain);
  }
  parts.push(`${conn.username}@${conn.host}`);
  return parts.join(" ");
}
