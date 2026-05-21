import { Terminal } from "@xterm/xterm";

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

export function duplicateTab(
  tabId: string,
  tabs: any[],
  setTabs: React.Dispatch<React.SetStateAction<any[]>>,
  setActiveTab: (id: string) => void,
) {
  const tab = tabs.find((t) => t.id === tabId);
  if (tab) {
    const id = crypto.randomUUID();
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
