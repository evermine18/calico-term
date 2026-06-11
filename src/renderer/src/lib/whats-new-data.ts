import {
  Bot,
  FolderKanban,
  KeyRound,
  FileCode2,
  Activity,
  Settings2,
  PictureInPicture2,
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
export const APP_VERSION = "2.1.0";

export const WHATS_NEW_STORAGE_KEY = "calico-term:whats-new-seen-version";

export const WHATS_NEW: WhatsNewVersion[] = [
  {
    version: "2.1.0",
    date: "2026-06-11",
    tagline: "Run AI coding agents in tabs, and detach tabs into their own windows.",
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
