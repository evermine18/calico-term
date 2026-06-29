import { Bot, CircleX, Copy, RefreshCw, Play } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import githubDark from "highlight.js/styles/github-dark.css?url";
import githubLight from "highlight.js/styles/github.css?url";
import { useEffect, useState } from "react";
import type { Components } from "react-markdown";
import type { ToolCall } from "./conversation-types";
import ToolCallCard from "./tool-call-card";

const EXECUTABLE_LANGS = new Set(["bash", "sh", "zsh", "shell"]);

const HLJS_LINK_ID = "hljs-theme";

/**
 * Keeps a single <link id="hljs-theme"> in <head> pointing at the github-dark or
 * github (light) highlight.js stylesheet, following the app's resolved UI mode
 * (the `dark` class on <html>). Shared across all rendered messages — the link
 * is created once (guarded by id) and never removed on a single message unmount.
 */
function useHighlightTheme(): void {
  useEffect(() => {
    const apply = (): void => {
      const isDark = document.documentElement.classList.contains("dark");
      let link = document.getElementById(
        HLJS_LINK_ID,
      ) as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.id = HLJS_LINK_ID;
        link.rel = "stylesheet";
        document.head.appendChild(link);
      }
      const href = isDark ? githubDark : githubLight;
      if (link.getAttribute("href") !== href) link.setAttribute("href", href);
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);
}

interface AssistantMessageProps {
  message: string;
  timestamp: string;
  isTyping?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onExecute?: (cmd: string) => void;
  toolCalls?: ToolCall[];
  onApproveTool?: (callId: string, name: string, always: boolean) => void;
  onDenyTool?: (callId: string, name: string) => void;
}

function CodeBlock({
  lang,
  code,
  onExecute,
}: {
  lang: string;
  code: string;
  onExecute?: (cmd: string) => void;
}) {
  const [ran, setRan] = useState(false);
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(code.split("\n").length > 20);
  const isExecutable = EXECUTABLE_LANGS.has(lang) && onExecute;
  const lineCount = code.split("\n").length;
  const isLong = lineCount > 20;

  const handleRun = () => {
    onExecute!(code.trimEnd());
    setRan(true);
    setTimeout(() => setRan(false), 2000);
  };

  const handleCopyCode = () => {
    window.api.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-md overflow-hidden border border-hairline/50">
      <div className="flex items-center justify-between bg-surface px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-ink-subtle">{lang}</span>
          {isLong && (
            <span className="text-[10px] text-ink-subtle">
              {lineCount} lines
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {isLong && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="text-[10px] px-2 py-0.5 rounded transition-colors text-ink-subtle hover:text-ink-muted"
              title={collapsed ? "Expand" : "Collapse"}
            >
              {collapsed ? "Show" : "Hide"}
            </button>
          )}
          <button
            onClick={handleCopyCode}
            className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded transition-colors ${
              copied
                ? "bg-success/20 text-success"
                : "text-ink-subtle hover:text-ink-muted"
            }`}
            title="Copy code"
          >
            <Copy size={9} />
            {copied ? "Copied!" : "Copy"}
          </button>
          {isExecutable && (
            <button
              onClick={handleRun}
              className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded transition-colors ${
                ran
                  ? "bg-success/20 text-success"
                  : "bg-accent-500/15 text-accent-400 hover:bg-accent-500/30"
              }`}
              title="Run in terminal"
            >
              <Play size={9} />
              {ran ? "Sent!" : "Run"}
            </button>
          )}
        </div>
      </div>
      <pre className={`bg-field text-ink px-3 py-3 overflow-x-auto text-xs font-mono leading-5 m-0 ${
        collapsed ? "max-h-[300px]" : ""
      }`}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function AssistantMessage({
  message,
  timestamp,
  isTyping = false,
  error = false,
  onRetry,
  onExecute,
  toolCalls,
  onApproveTool,
  onDenyTool,
}: AssistantMessageProps) {
  useHighlightTheme();

  const handleCopy = () => {
    window.api.clipboard.writeText(message);
  };

  const components: Components = {
    code({ className, children, node }) {
      const langMatch = /language-(\w+)/.exec(className ?? "");
      const lang = langMatch?.[1] ?? "";
      if (lang) {
        // Extract raw text from hast AST — children may be React elements
        // after rehype-highlight transforms them into <span> nodes.
        const extractText = (n: any): string => {
          if (!n) return "";
          if (typeof n.value === "string") return n.value;
          if (Array.isArray(n.children))
            return n.children.map(extractText).join("");
          return "";
        };
        const code = extractText(node).replace(/\n$/, "");
        return <CodeBlock lang={lang} code={code} onExecute={onExecute} />;
      }
      return (
        <code className="bg-panel rounded px-1 py-0.5 font-mono text-xs text-accent-300">
          {children}
        </code>
      );
    },
    pre({ children }) {
      return <>{children}</>;
    },
    p({ children }) {
      return <p className="text-sm leading-6 mb-2 last:mb-0">{children}</p>;
    },
    ul({ children }) {
      return (
        <ul className="list-disc list-inside mb-2 text-sm space-y-0.5">
          {children}
        </ul>
      );
    },
    ol({ children }) {
      return (
        <ol className="list-decimal list-inside mb-2 text-sm space-y-0.5">
          {children}
        </ol>
      );
    },
    li({ children }) {
      return <li className="text-sm">{children}</li>;
    },
    h1({ children }) {
      return <h1 className="text-base font-bold mt-3 mb-1">{children}</h1>;
    },
    h2({ children }) {
      return <h2 className="text-sm font-semibold mt-3 mb-1">{children}</h2>;
    },
    h3({ children }) {
      return <h3 className="text-sm font-medium mt-2 mb-1">{children}</h3>;
    },
    blockquote({ children }) {
      return (
        <blockquote className="border-l-2 border-accent-500/50 pl-3 italic text-ink-muted my-2 text-sm">
          {children}
        </blockquote>
      );
    },
    a({ href, children }) {
      return (
        <a
          href={href}
          className="text-accent-400 underline hover:text-accent-300"
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      );
    },
  };

  return (
    <div className="flex justify-start animate-fade-in selectable-section">
      <div className="flex items-start space-x-2 max-w-[90%] min-w-0">
        <div className="flex-shrink-0 w-8 h-8 bg-accent-500/20 border border-accent-500/30 rounded-lg flex items-center justify-center">
          <Bot size={16} className="text-accent-400" />
        </div>

        <div className="bg-elevated/60 backdrop-blur-sm border border-hairline/40 text-ink rounded-2xl rounded-bl-sm px-3 py-2.5 w-full min-w-0 max-w-full overflow-hidden">
          {isTyping ? (
            <div className="flex items-center space-x-2 py-1">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-accent-400 rounded-full" style={{ animation: 'bounce-delayed 1.4s infinite ease-in-out 0ms' }} />
                <div className="w-2 h-2 bg-accent-400 rounded-full" style={{ animation: 'bounce-delayed 1.4s infinite ease-in-out 150ms' }} />
                <div className="w-2 h-2 bg-accent-400 rounded-full" style={{ animation: 'bounce-delayed 1.4s infinite ease-in-out 300ms' }} />
              </div>
              <span className="text-sm text-ink-muted">Thinking...</span>
            </div>
          ) : (
            <>
              {error ? (
                <div className="text-danger mb-2">
                  <div className="flex items-center justify-between">
                    <span>
                      <CircleX className="inline mr-1" size={18} />
                      <span className="font-medium">Error</span>
                    </span>
                    {onRetry && (
                      <button
                        onClick={onRetry}
                        className="flex items-center gap-1 text-xs text-ink-muted hover:text-accent-300 transition-colors ml-2"
                        title="Retry"
                      >
                        <RefreshCw size={13} />
                        Retry
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-danger/80 mt-1 font-mono">{message}</p>
                </div>
              ) : null}

              {message && (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={components}
                >
                  {message}
                </ReactMarkdown>
              )}

              {toolCalls && toolCalls.length > 0 && (
                <div className="mt-1">
                  {toolCalls.map((tc) => (
                    <ToolCallCard
                      key={tc.id}
                      call={tc}
                      onApprove={onApproveTool}
                      onDeny={onDenyTool}
                    />
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-ink-subtle">{timestamp}</span>
                {message && !error && (
                  <button
                    onClick={handleCopy}
                    className="text-ink-subtle hover:text-accent-400 transition-colors"
                    title="Copy full response"
                  >
                    <Copy size={12} />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
