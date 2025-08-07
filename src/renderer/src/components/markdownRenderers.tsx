"use client";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { Components } from "react-markdown";

export interface MarkdownProps {
  content: string;
  className?: string;
}

export const Markdown: React.FC<MarkdownProps> = ({
  content,
  className = "",
}) => (
  <article className={`prose prose-neutral max-w-full ${className}`}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={
        {
          h1: ({ node, ...props }) => (
            <h1 className="text-4xl font-bold mt-8 mb-4" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-3xl font-semibold mt-6 mb-3" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="leading-7 mb-4 " {...props} />
          ),
          a: ({ node, ...props }) => (
            <a
              className="text-blue-600 underline hover:text-blue-800"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc list-inside mb-4" {...props} />
          ),
          li: ({ node, ...props }) => <li className="mb-1" {...props} />,
          code({ node, className: codeClass = "", children, ...props }) {
            const langMatch = /language-(\w+)/.exec(codeClass);
            const isBlock = Boolean(langMatch);

            if (!isBlock) {
              return (
                <code
                  className="bg-gray-100 rounded px-1 font-mono text-sm"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            const lang = langMatch![1];

            return (
              <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm my-4">
                <code className={`language-${lang}`} {...props}>
                  {children}
                </code>
              </pre>
            );
          },
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-4"
              {...props}
            />
          ),
          hr: ({ node, ...props }) => (
            <hr className="my-8 border-gray-300" {...props} />
          ),
        } as Components
      }
    >
      {content}
    </ReactMarkdown>
  </article>
);
export default Markdown;
