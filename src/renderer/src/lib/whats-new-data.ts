import {
  Bot,
  FolderKanban,
  KeyRound,
  FileCode2,
  Activity,
  Settings2,
  PictureInPicture2,
  PlugZap,
  ServerCog,
  Search,
  AppWindow,
  SunMoon,
  Waypoints,
  Copy,
  type LucideIcon,
} from "lucide-react";

export interface WhatsNewSection {
  id: string;
  title: string;
  icon: LucideIcon;
  accent: string;
  items: string[];
}

export interface WhatsNewVersion {
  version: string;
  date: string;
  tagline?: string;
  sections: WhatsNewSection[];
}

// Bump APP_VERSION when shipping a release whose changes should re-trigger
// the What's New dialog. Must match `version` in package.json.
export const APP_VERSION = "2.3.0";

export const WHATS_NEW_STORAGE_KEY = "calico-term:whats-new-seen-version";

export const WHATS_NEW: WhatsNewVersion[] = [
  {
    version: "2.3.0",
    date: "2026-07-13",
    tagline:
      "A polished light mode, SSH tunnels, local Ansible playbooks, and smarter tabs.",
    sections: [
      {
        id: "light-mode",
        title: "Light Mode",
        icon: SunMoon,
        accent: "bg-amber-500/15 text-amber-300 border-amber-500/30",
        items: [
          "A refined light theme across the whole app — chrome, terminal, and the SFTP editor.",
          "Pick Light, Dark, or System from Appearance settings; the six accent colors adapt to both.",
          "The terminal, cursor, and ANSI palette all repaint to match the active mode.",
        ],
      },
      {
        id: "ssh-forwarding",
        title: "SSH Port Forwarding",
        icon: Waypoints,
        accent: "bg-sky-500/15 text-sky-300 border-sky-500/30",
        items: [
          "Save local (-L), remote (-R), and dynamic SOCKS (-D) tunnels per SSH connection.",
          "Tunnels apply automatically on connect and stay up for the life of the session.",
          "A tunnel indicator on each connection card shows how many are configured.",
        ],
      },
      {
        id: "ansible-local",
        title: "Local Ansible",
        icon: ServerCog,
        accent: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
        items: [
          "Run Ansible playbooks straight from your local machine, no SSH control node required.",
          "Auto-detect a local Ansible install and scan a path for playbooks and inventory.",
          "Register playbooks manually with default limits, extra vars, and check mode.",
        ],
      },
      {
        id: "tabs",
        title: "Smarter Tabs",
        icon: Copy,
        accent: "bg-violet-500/15 text-violet-300 border-violet-500/30",
        items: [
          "Duplicate a tab and keep its SSH connection — no need to reconnect by hand.",
          "Reworked tab and header styling for crisp rendering in both light and dark modes.",
        ],
      },
    ],
  },
  {
    version: "2.2.0",
    date: "2026-06-16",
    tagline:
      "Let coding agents drive your terminals over MCP, run Ansible playbooks, and more.",
    sections: [
      {
        id: "mcp",
        title: "MCP Server",
        icon: PlugZap,
        accent: "bg-violet-500/15 text-violet-300 border-violet-500/30",
        items: [
          "Calico Term now runs a local MCP server so coding agents can drive your terminals.",
          "Exposes tools to list terminals, read output, execute commands, and send keystrokes.",
          "Copy-paste connection setup for Claude Code, Codex, Gemini CLI, and OpenCode.",
          "Every agent action waits for your approval — with an opt-in accept-all per session.",
          "Token-secured on a configurable port; regenerate the token anytime.",
        ],
      },
      {
        id: "ansible",
        title: "Ansible Runner",
        icon: ServerCog,
        accent: "bg-rose-500/15 text-rose-300 border-rose-500/30",
        items: [
          "Manage Ansible sources from a git repo or an existing path on an SSH control node.",
          "Register playbooks with default limits, extra vars, and check mode.",
          "Start, monitor, and cancel runs with live output.",
          "Auto-detected or file-based inventory, with managed deploy keys for git auth.",
        ],
      },
      {
        id: "terminal-sftp",
        title: "Terminal & SFTP",
        icon: Search,
        accent: "bg-sky-500/15 text-sky-300 border-sky-500/30",
        items: [
          "Search inside the terminal with a dedicated search bar and keyboard shortcuts.",
          "Right-click context menu: copy, paste, select all, search, and clear.",
          "Adjust the terminal font size on the fly with keyboard shortcuts.",
          "Drag files from your file manager straight into the SFTP browser to upload.",
        ],
      },
      {
        id: "windows-sessions",
        title: "Windows & Sessions",
        icon: AppWindow,
        accent: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
        items: [
          "Launch Calico again to open a new window — all windows share the same vault and settings.",
          "Optionally restore your open tabs on startup.",
          "Import hosts straight from your ~/.ssh/config, skipping duplicates.",
          "New toast notifications give non-blocking feedback for your actions.",
        ],
      },
    ],
  },
  {
    version: "2.1.0",
    date: "2026-06-11",
    tagline:
      "Run AI coding agents in tabs, and detach tabs into their own windows.",
    sections: [
      {
        id: "agent-launch",
        title: "Launch AI Coding Agents",
        icon: Bot,
        accent: "bg-violet-500/15 text-violet-300 border-violet-500/30",
        items: [
          "Start CLI coding agents — Claude Code, Codex, OpenCode, Gemini CLI, Aider — right inside a terminal tab.",
          "Run an agent locally or over SSH, in any working directory.",
          "Remote folder browser to pick the agent's working directory on SSH hosts.",
          "Automatic install detection, with a link to set up agents that aren't on your PATH.",
          "Branded launch banner so you always know which agent is running.",
        ],
      },
      {
        id: "detach-tabs",
        title: "Detachable Tabs",
        icon: PictureInPicture2,
        accent: "bg-sky-500/15 text-sky-300 border-sky-500/30",
        items: [
          "Pop any tab out into its own window without dropping the session.",
          "The PTY keeps running — no reconnect, no lost scrollback.",
          "Detach straight from the tab's right-click context menu.",
          "Terminal state is serialized and restored in the detached window.",
        ],
      },
    ],
  },
  {
    version: "2.0.0",
    date: "2026-05-21",
    tagline: "AI Agent, Workspaces, deeper SSH/SFTP, and full observability.",
    sections: [
      {
        id: "agent",
        title: "AI Agent Mode",
        icon: Bot,
        accent: "bg-violet-500/15 text-violet-300 border-violet-500/30",
        items: [
          "Autonomous agent in the sidebar that runs tasks using tools.",
          "Inline approval for every action — confirm risky steps right from the chat.",
          "Tool calls and their results are rendered directly in the conversation.",
        ],
      },
      {
        id: "workspaces",
        title: "Workspaces",
        icon: FolderKanban,
        accent: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
        items: [
          "Group connections by environment with their own color and identity.",
          "Workspace switcher in the title bar with keyboard shortcuts.",
          "Production confirmation prompt to prevent connecting by mistake.",
          "Encrypted import/export of workspaces — secrets never leave your machine.",
          "Per-workspace snippets and environment variables.",
        ],
      },
      {
        id: "ssh",
        title: "SSH",
        icon: KeyRound,
        accent: "bg-amber-500/15 text-amber-300 border-amber-500/30",
        items: [
          "Built-in SSH key management: generate, import, copy, delete.",
          "Jump Host (ProxyJump) support for connecting through bastions.",
          "Automatic disconnect detection with one-click reconnect.",
          "Use aliases from your ~/.ssh/config directly.",
        ],
      },
      {
        id: "sftp",
        title: "SFTP & Remote editing",
        icon: FileCode2,
        accent: "bg-sky-500/15 text-sky-300 border-sky-500/30",
        items: [
          "Remote editor powered by Monaco (⌘S to save, up to 5 MB).",
          "Live tail -F viewer with regex filter and pause.",
          "Local↔remote diff viewer with push-to-server.",
          "Bidirectional directory sync with per-file progress.",
        ],
      },
      {
        id: "observability",
        title: "Observability & Security",
        icon: Activity,
        accent: "bg-rose-500/15 text-rose-300 border-rose-500/30",
        items: [
          "Per-tab session recording (asciinema) with built-in player.",
          "Signed audit log (ed25519) — exportable and verifiable.",
          "Host metrics pill (CPU / MEM / Load) in the status bar.",
          "Regex-based alerts on terminal output with native notifications.",
          "Guardrails panel for production-protection rules.",
          "Encrypted Env Vault for credentials and environment variables.",
        ],
      },
      {
        id: "settings",
        title: "Settings & UI",
        icon: Settings2,
        accent: "bg-slate-500/15 text-slate-200 border-slate-500/30",
        items: [
          "Settings reorganized into structured groups for easier navigation.",
          "More responsive tab styles and improved layout.",
          "Pointer cursor on buttons for clearer interaction.",
        ],
      },
    ],
  },
];
