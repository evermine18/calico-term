import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@renderer/components/ui/dialog";
import { Button } from "@renderer/components/ui/button";
import { FileText, Loader2, Save } from "lucide-react";
import Editor, { loader, type OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import type { editor } from "monaco-editor";

self.MonacoEnvironment = {
  getWorker(_workerId, label) {
    switch (label) {
      case "json":
        return new jsonWorker();
      case "css":
      case "scss":
      case "less":
        return new cssWorker();
      case "html":
      case "handlebars":
      case "razor":
        return new htmlWorker();
      case "typescript":
      case "javascript":
        return new tsWorker();
      default:
        return new editorWorker();
    }
  },
};

loader.config({ monaco });

type Props = {
  open: boolean;
  sessionId: string;
  remotePath: string;
  onClose: () => void;
};

const EXT_TO_LANG: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  json: "json",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  swift: "swift",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  fish: "shell",
  yml: "yaml",
  yaml: "yaml",
  toml: "ini",
  ini: "ini",
  conf: "ini",
  cfg: "ini",
  env: "ini",
  xml: "xml",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  less: "less",
  md: "markdown",
  markdown: "markdown",
  sql: "sql",
  dockerfile: "dockerfile",
  lua: "lua",
  pl: "perl",
  r: "r",
  scala: "scala",
  vue: "html",
  svelte: "html",
  graphql: "graphql",
  gql: "graphql",
};

function detectLanguage(path: string): string {
  const base = path.split("/").pop() ?? "";
  if (/^dockerfile$/i.test(base)) return "dockerfile";
  if (/^makefile$/i.test(base)) return "makefile";
  const dot = base.lastIndexOf(".");
  if (dot < 0) return "plaintext";
  const ext = base.slice(dot + 1).toLowerCase();
  return EXT_TO_LANG[ext] ?? "plaintext";
}

export default function RemoteEditorDialog({
  open,
  sessionId,
  remotePath,
  onClose,
}: Props) {
  const [content, setContent] = useState("");
  const [original, setOriginal] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const saveRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    window.api.sftp
      .readText(sessionId, remotePath)
      .then((text) => {
        if (cancelled) return;
        setContent(text);
        setOriginal(text);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e?.message ?? String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sessionId, remotePath]);

  const dirty = content !== original;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await window.api.sftp.writeText(sessionId, remotePath, content);
      setOriginal(content);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  saveRef.current = () => {
    if (dirty && !saving && !loading) save();
  };

  const handleMount: OnMount = (ed, monaco) => {
    editorRef.current = ed;

    const root = getComputedStyle(document.documentElement);
    const rgb = root.getPropertyValue("--accent-rgb").trim() || "6, 182, 212";
    const [r, g, b] = rgb.split(",").map((s) => parseInt(s.trim(), 10));
    const toHex = (n: number) => n.toString(16).padStart(2, "0");
    const accent = `#${toHex(r)}${toHex(g)}${toHex(b)}`;

    monaco.editor.defineTheme("calico-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "64748b", fontStyle: "italic" },
        { token: "keyword", foreground: accent.slice(1) },
        { token: "string", foreground: "a7f3d0" },
        { token: "number", foreground: "fbbf24" },
        { token: "type", foreground: "93c5fd" },
        { token: "function", foreground: "c4b5fd" },
        { token: "variable", foreground: "e2e8f0" },
        { token: "delimiter", foreground: "94a3b8" },
      ],
      colors: {
        "editor.background": "#0f172a",
        "editor.foreground": "#e2e8f0",
        "editorLineNumber.foreground": "#475569",
        "editorLineNumber.activeForeground": "#94a3b8",
        "editor.lineHighlightBackground": "#1e293b",
        "editor.lineHighlightBorder": "#1e293b",
        "editorCursor.foreground": accent,
        "editor.selectionBackground": `${accent}55`,
        "editor.inactiveSelectionBackground": `${accent}33`,
        "editor.selectionHighlightBackground": `${accent}22`,
        "editor.findMatchBackground": `${accent}66`,
        "editor.findMatchHighlightBackground": `${accent}33`,
        "editorIndentGuide.background1": "#1e293b",
        "editorIndentGuide.activeBackground1": "#334155",
        "editorWhitespace.foreground": "#334155",
        "editorBracketMatch.background": `${accent}33`,
        "editorBracketMatch.border": accent,
        "scrollbar.shadow": "#00000000",
        "scrollbarSlider.background": "#33415588",
        "scrollbarSlider.hoverBackground": "#475569aa",
        "scrollbarSlider.activeBackground": "#64748bcc",
        "editorWidget.background": "#0f172a",
        "editorWidget.border": "#33415566",
        "editorSuggestWidget.background": "#0f172a",
        "editorSuggestWidget.border": "#33415566",
        "editorSuggestWidget.selectedBackground": `${accent}33`,
        "editorGutter.background": "#0f172a",
        "editorOverviewRuler.border": "#0f172a",
      },
    });
    monaco.editor.setTheme("calico-dark");

    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveRef.current();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[920px] max-h-[85vh] bg-panel border-hairline/40 shadow-xl flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-ink flex items-center gap-2 text-sm">
            <FileText size={14} className="text-accent-400" />
            <span className="font-mono truncate">{remotePath}</span>
            {dirty && <span className="text-warning text-xs">●</span>}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-ink-subtle text-sm gap-2">
            <Loader2 className="animate-spin" size={14} /> Loading…
          </div>
        ) : (
          <div className="flex-1 min-h-[460px] border border-hairline/50 rounded-md overflow-hidden bg-[#0f172a]">
            <Editor
              height="60vh"
              language={detectLanguage(remotePath)}
              value={content}
              onChange={(v) => setContent(v ?? "")}
              onMount={handleMount}
              theme="calico-dark"
              options={{
                fontSize: 12,
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, "Cascadia Mono", Consolas, monospace',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                renderWhitespace: "selection",
                smoothScrolling: true,
                wordWrap: "off",
              }}
            />
          </div>
        )}

        {error && (
          <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <DialogFooter className="gap-2">
          <span className="text-xs text-ink-subtle mr-auto">
            ⌘S / Ctrl+S to save
          </span>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="border-hairline text-ink-muted hover:bg-elevated"
          >
            Close
          </Button>
          <Button
            onClick={save}
            disabled={!dirty || saving || loading}
            className="bg-accent-600 hover:bg-accent-500 text-on-accent gap-1.5"
          >
            <Save size={14} />
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
