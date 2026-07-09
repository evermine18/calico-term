import { Terminal } from "@xterm/xterm";
import {
  AgentLauncher,
  agentRunString,
  agentBanner,
} from "@renderer/types/ai-agents";
import { buildSSHCommand } from "@renderer/types/ssh";

type SSHConnLike = {
  id: string;
  credentialId?: string;
  hasPassword?: boolean;
  passwordRef?: { provider: "op" | "bw" | "vault" | "aws"; ref: string };
};

/**
 * Re-prime SSH password injection and tab→conn mapping for a tab. Used both
 * on first connect and on reconnect after a dropped session. Does NOT send
 * the SSH command itself.
 */
export async function armSSHSession(
  tabId: string,
  conn: SSHConnLike,
): Promise<void> {
  if (conn.credentialId) {
    window.electron.ipcRenderer.send(
      "ssh-session-init",
      tabId,
      "vault-" + conn.credentialId,
    );
  } else if (conn.passwordRef) {
    const ok = await window.api.secrets.primeForSSHSession(
      conn.id,
      conn.passwordRef.provider,
      conn.passwordRef.ref,
    );
    if (ok) {
      window.electron.ipcRenderer.send("ssh-session-init", tabId, conn.id);
    }
  } else if (conn.hasPassword) {
    window.electron.ipcRenderer.send("ssh-session-init", tabId, conn.id);
  }
  // Re-register tab→conn mapping (alerts, guardrails, ssh-disconnect detection).
  window.api.guardrails.setTabConn(tabId, conn.id);
  window.api.alerts.setTabConn(tabId, conn.id);
}

/**
 * Build the `<arg>` in `ssh … <arg>` that runs an agent (optionally inside
 * `folder`) on the remote host.
 *
 * Two problems this solves:
 *  1. `ssh host cmd` runs a NON-login, NON-interactive shell, which does not
 *     source ~/.bash_profile / ~/.bashrc / ~/.zshrc — exactly where nvm,
 *     npm-global and ~/.local/bin put things like `claude` on PATH. So we run
 *     the agent through `exec "$SHELL" -ilc "<agent>"`: a login + interactive
 *     shell that reproduces an interactive SSH session's environment. (`$SHELL`
 *     expands remotely to the user's actual shell — bash, zsh, …)
 *  2. The whole command is wrapped in single quotes as ONE argument so the
 *     LOCAL shell never parses it — critical on Windows, whose PowerShell has
 *     no `&&` operator and would choke on `cd … && claude`. Single quotes are
 *     literal in PowerShell, bash and zsh alike.
 *
 * A leading `~` in `folder` is rewritten to `$HOME` because the remote shell
 * does not expand `~` inside the double quotes that protect paths with spaces.
 */
function buildRemoteAgentCommand(run: string, folder: string | null): string {
  const agent = run.replace(/(["\\$`])/g, "\\$1");
  const login = `exec "$SHELL" -ilc "${agent}"`;
  let remote = login;
  if (folder) {
    const path = /^~(\/|$)/.test(folder) ? "$HOME" + folder.slice(1) : folder;
    const escapedPath = path.replace(/(["\\])/g, "\\$1");
    remote = `cd "${escapedPath}" && ${login}`;
  }
  return `'${remote.replace(/'/g, `'\\''`)}'`;
}

/**
 * Open a new tab that launches an external CLI agent (Claude Code, Codex, …)
 * in a chosen working directory. When `conn` is provided the agent runs on that
 * SSH host under a forced TTY (reusing the same password-injection / disconnect
 * plumbing as a plain SSH tab); otherwise it runs in a local shell. Mirrors the
 * SSH `onConnect` flow.
 *
 * `folder` is a local path (sets the PTY cwd) for local runs, or a remote path
 * (prepended as `cd "<path>" && …`) for SSH runs. Empty means "default dir".
 */
export async function launchAgentTab(
  agent: AgentLauncher,
  conn: SSHConnectionEntry | null,
  jumpChain: SSHConnectionEntry[],
  folder: string | null,
  setTabs: React.Dispatch<React.SetStateAction<any[]>>,
  setActiveTab: (id: string) => void,
): Promise<void> {
  const id = crypto.randomUUID();
  const run = agentRunString(agent);
  const banner = agentBanner(agent);
  const newTab = conn
    ? {
        id,
        title: `${agent.name} · ${conn.name}`,
        mode: "normal" as const,
        terminal: new Terminal(),
        initialCommand: buildSSHCommand(conn, jumpChain, {
          forceTty: true,
          remoteCommand: buildRemoteAgentCommand(run, folder),
        }),
        badge: conn.tags?.[0] ?? null,
        isSSH: true,
        connId: conn.id,
        agentBanner: banner,
        agentId: agent.id,
      }
    : {
        id,
        title: agent.name,
        mode: "normal" as const,
        terminal: new Terminal(),
        initialCommand: run,
        cwd: folder ?? undefined,
        agentBanner: banner,
        agentId: agent.id,
      };

  // Arm password-injection + alert/guardrail scoping BEFORE the terminal mounts.
  if (conn) await armSSHSession(id, conn);
  setTabs((prev) => [...prev, newTab]);
  setActiveTab(id);
}

export function updateTabTitle(
  id: string,
  title: string,
  setTabs: React.Dispatch<React.SetStateAction<any[]>>,
) {
  setTabs((prev) =>
    prev.map((tab) => (tab.id === id ? { ...tab, title } : tab)),
  );
}

export function closeTab(
  id: string,
  tabs: any[],
  activeTab: string | null,
  setTabs: React.Dispatch<React.SetStateAction<any[]>>,
  setActiveTab: (id: string) => void,
) {
  window.electron?.ipcRenderer.send("terminal-kill", id);
  window.api?.sftp?.disconnect(id);

  const currentIndex = tabs.findIndex((tab) => tab.id === id);
  const nextActiveIndex = currentIndex > 0 ? currentIndex - 1 : 1;

  setTabs((prev) => prev.filter((t) => t.id !== id));

  if (activeTab === id && tabs.length > 1) {
    setActiveTab(tabs[nextActiveIndex]?.id ?? tabs[0]?.id);
  }
}

/**
 * Pop a tab out into its own window. Unlike closeTab this MUST NOT kill the
 * PTY — the shell keeps running in main and the detached window re-attaches to
 * it. `serialized` carries the current scrollback so history follows the tab.
 */
export function detachTab(
  tabId: string,
  tabs: any[],
  activeTab: string | null,
  setTabs: React.Dispatch<React.SetStateAction<any[]>>,
  setActiveTab: (id: string) => void,
  serialized: string,
) {
  const tab = tabs.find((t) => t.id === tabId);
  if (!tab) return;

  window.api.detach.open({
    tabId,
    title: tab.title,
    isSSH: !!tab.isSSH,
    connId: tab.connId,
    agentId: tab.agentId,
    serialized,
  });

  const currentIndex = tabs.findIndex((t) => t.id === tabId);
  const nextActiveIndex = currentIndex > 0 ? currentIndex - 1 : 1;

  setTabs((prev) => prev.filter((t) => t.id !== tabId));

  if (activeTab === tabId && tabs.length > 1) {
    setActiveTab(tabs[nextActiveIndex]?.id ?? tabs[0]?.id);
  }
}

export function closeOtherTabs(
  id: string,
  tabs: any[],
  setTabs: React.Dispatch<React.SetStateAction<any[]>>,
  setActiveTab: (id: string) => void,
) {
  tabs.forEach((tab) => {
    if (tab.id !== id) {
      window.electron?.ipcRenderer.send("terminal-kill", tab.id);
      window.api?.sftp?.disconnect(tab.id);
    }
  });
  setTabs((prev) => prev.filter((t) => t.id === id));
  setActiveTab(id);
}

export function closeTabsToRight(
  id: string,
  tabs: any[],
  setTabs: React.Dispatch<React.SetStateAction<any[]>>,
) {
  const index = tabs.findIndex((t) => t.id === id);
  tabs.slice(index + 1).forEach((tab) => {
    window.electron?.ipcRenderer.send("terminal-kill", tab.id);
    window.api?.sftp?.disconnect(tab.id);
  });
  setTabs((prev) => prev.slice(0, index + 1));
}

export async function duplicateTab(
  tabId: string,
  tabs: any[],
  setTabs: React.Dispatch<React.SetStateAction<any[]>>,
  setActiveTab: (id: string) => void,
  sshConnections: SSHConnectionEntry[] = [],
) {
  const tab = tabs.find((t) => t.id === tabId);
  if (!tab) return;

  const id = crypto.randomUUID();

  // SSH tab: re-open a fresh connection instead of a bare local shell. We rebuild
  // the ssh command from the tab's connection (and its jump chain) and re-arm
  // password injection + alert/guardrail scoping for the NEW tab id — that
  // priming is keyed by tab id, so the duplicate needs its own arming.
  if (tab.isSSH && tab.connId) {
    const conn = sshConnections.find((c) => c.id === tab.connId);
    if (conn) {
      const jumpChain = (conn.jumpHostIds ?? [])
        .map((jid) => sshConnections.find((c) => c.id === jid))
        .filter((c): c is SSHConnectionEntry => !!c);
      const newTab = {
        id,
        title: `${tab.title} (Copy)`,
        mode: tab.mode,
        terminal: new Terminal(),
        initialCommand: buildSSHCommand(conn, jumpChain),
        badge: tab.badge || null,
        isSSH: true,
        connId: conn.id,
      };
      // Arm password-injection + scoping BEFORE the terminal mounts.
      await armSSHSession(id, conn);
      setTabs((prev) => [...prev, newTab]);
      setActiveTab(id);
      return;
    }
  }

  // Plain tab (or an SSH tab whose connection no longer exists): fresh local shell.
  const newTab = {
    id,
    title: `${tab.title} (Copy)`,
    mode: tab.mode,
    terminal: new Terminal(),
    badge: tab.badge || null,
  };
  setTabs((prev) => [...prev, newTab]);
  setActiveTab(id);
}

export function setBadge(
  tabId: string,
  tagId: string | null,
  setTabs: React.Dispatch<React.SetStateAction<any[]>>,
) {
  setTabs((prev) =>
    prev.map((t) => (t.id === tabId ? { ...t, badge: tagId } : t)),
  );
}
