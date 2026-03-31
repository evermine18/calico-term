export type SSHConnection = {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  identityFile?: string;
  hasPassword?: boolean;
  tags?: string[];
};

export function buildSSHCommand(conn: SSHConnection): string {
  const parts = ["ssh"];
  if (conn.identityFile) parts.push("-i", conn.identityFile);
  if (conn.port !== 22) parts.push("-p", String(conn.port));
  parts.push(`${conn.username}@${conn.host}`);
  return parts.join(" ");
}
