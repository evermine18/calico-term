import { Bot, CircleX, Copy, RefreshCw, Play } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { useState } from "react";
import type { Components } from "react-markdown";

const EXECUTABLE_LANGS = new Set(["bash", "sh", "zsh", "shell"]);

interface AssistantMessageProps {
  message: string;
  timestamp: string;
  isTyping?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onExecute?: (cmd: string) => void;
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
    <div className="my-3 rounded-md overflow-hidden border border-slate-700/50">
      <div className="flex items-center justify-between bg-slate-950 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-500">{lang}</span>
          {isLong && (
            <span className="text-[10px] text-slate-600">
              {lineCount} lines
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {isLong && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="text-[10px] px-2 py-0.5 rounded transition-colors text-slate-500 hover:text-slate-300"
              title={collapsed ? "Expand" : "Collapse"}
            >
              {collapsed ? "Show" : "Hide"}
            </button>
          )}
          <button
            onClick={handleCopyCode}
            className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded transition-colors ${
              copied
                ? "bg-green-500/20 text-green-400"
                : "text-slate-500 hover:text-slate-300"
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
                  ? "bg-green-500/20 text-green-400"
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
      <pre className={`bg-slate-950 text-gray-100 px-3 py-3 overflow-x-auto text-xs font-mono leading-5 m-0 ${
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
}: AssistantMessageProps) {
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
        <code className="bg-slate-900 rounded px-1 py-0.5 font-mono text-xs text-accent-300">
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
        <blockquote className="border-l-2 border-accent-500/50 pl-3 italic text-slate-400 my-2 text-sm">
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

        <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/40 text-gray-100 rounded-2xl rounded-bl-sm px-3 py-2.5 w-full min-w-0 max-w-full overflow-hidden">
          {isTyping ? (
            <div className="flex items-center space-x-2 py-1">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-accent-400 rounded-full" style={{ animation: 'bounce-delayed 1.4s infinite ease-in-out 0ms' }} />
                <div className="w-2 h-2 bg-accent-400 rounded-full" style={{ animation: 'bounce-delayed 1.4s infinite ease-in-out 150ms' }} />
                <div className="w-2 h-2 bg-accent-400 rounded-full" style={{ animation: 'bounce-delayed 1.4s infinite ease-in-out 300ms' }} />
              </div>
              <span className="text-sm text-gray-400">Thinking...</span>
            </div>
          ) : (
            <>
              {error ? (
                <div className="text-red-400 mb-2">
                  <div className="flex items-center justify-between">
                    <span>
                      <CircleX className="inline mr-1" size={18} />
                      <span className="font-medium">Error</span>
                    </span>
                    {onRetry && (
                      <button
                        onClick={onRetry}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-accent-300 transition-colors ml-2"
                        title="Retry"
                      >
                        <RefreshCw size={13} />
                        Retry
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-red-300/80 mt-1 font-mono">{message}</p>
                </div>
              ) : null}

              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={components}
              >
                {message}
              </ReactMarkdown>

              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-500">{timestamp}</span>
                {message && !error && (
                  <button
                    onClick={handleCopy}
                    className="text-gray-600 hover:text-accent-400 transition-colors"
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
