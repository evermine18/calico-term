export type SSHSecretRef = {
  provider: "op" | "bw" | "vault" | "aws";
  ref: string;
};

/**
 * A saved SSH port forward, applied as an `-L`/`-R`/`-D` flag when connecting.
 * - `local` (-L): listen on `bindPort` locally, forward to `destHost:destPort` via the server.
 * - `remote` (-R): listen on `bindPort` on the server, forward to `destHost:destPort` locally.
 * - `dynamic` (-D): open a SOCKS proxy on `bindPort` (dest fields unused).
 */
export type SSHForward = {
  type: "local" | "remote" | "dynamic";
  /** Optional bind address; defaults to localhost when omitted. */
  bindAddress?: string;
  bindPort: number;
  /** Required for `local`/`remote`; ignored for `dynamic`. */
  destHost?: string;
  destPort?: number;
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
  /** Saved port forwards applied as `-L`/`-R`/`-D` flags on connect. */
  forwards?: SSHForward[];
};

export function buildSSHCommand(
  conn: SSHConnection,
  jumps?: SSHConnection[],
  opts?: { remoteCommand?: string; forceTty?: boolean },
): string {
  const parts = ["ssh"];
  // `-t` and other options must precede the destination.
  if (opts?.forceTty) parts.push("-t");
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
  // Port forwards (-L/-R/-D) must precede the destination, like the flags above.
  for (const f of conn.forwards ?? []) {
    const bind = f.bindAddress ? `${f.bindAddress}:` : "";
    if (f.type === "dynamic") {
      parts.push("-D", `${bind}${f.bindPort}`);
    } else {
      parts.push(
        f.type === "local" ? "-L" : "-R",
        `${bind}${f.bindPort}:${f.destHost}:${f.destPort}`,
      );
    }
  }
  parts.push(`${conn.username}@${conn.host}`);
  // A remote command goes AFTER the destination.
  if (opts?.remoteCommand) parts.push(opts.remoteCommand);
  return parts.join(" ");
}
