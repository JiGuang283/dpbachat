"use client";

import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "./button";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({
  content,
  className = "",
}: MarkdownRendererProps) {
  const [copiedCode, setCopiedCode] = useState<string>("");

  const copyToClipboard = async (text: string, codeId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(codeId);
      setTimeout(() => setCopiedCode(""), 2000);
    } catch (err) {
      console.error("复制失败:", err);
    }
  };

  return (
    <div
      className={`prose prose-slate dark:prose-invert max-w-none overflow-hidden markdown-container ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // 代码块渲染
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          code(props: any) {
            const { inline, className, children, ...rest } = props;
            const match = /language-(\w+)/.exec(className || "");
            const language = match ? match[1] : "";
            const codeContent = String(children).replace(/\n$/, "");
            const codeId = `code-${Math.random().toString(36).substr(2, 9)}`;

            if (!inline && match) {
              return (
                <div className="relative group">
                  <div className="flex justify-between items-center bg-gray-800 text-gray-200 px-4 py-2 text-sm rounded-t-md">
                    <span>{language}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => copyToClipboard(codeContent, codeId)}
                    >
                      {copiedCode === codeId ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  <SyntaxHighlighter
                    style={oneDark as { [key: string]: React.CSSProperties }}
                    language={language}
                    PreTag="div"
                    className="!mt-0 !rounded-t-none"
                    {...rest}
                  >
                    {codeContent}
                  </SyntaxHighlighter>
                </div>
              );
            }

            return (
              <code
                className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono"
                {...rest}
              >
                {children}
              </code>
            );
          },
          // 链接渲染
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          a(props: any) {
            const { href, children, ...rest } = props;
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
                {...rest}
              >
                {children}
              </a>
            );
          },
          // 表格渲染
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          table(props: any) {
            const { children, ...rest } = props;
            return (
              <div className="overflow-x-auto">
                <table
                  className="min-w-full border-collapse border border-gray-300 dark:border-gray-600"
                  {...rest}
                >
                  {children}
                </table>
              </div>
            );
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          th(props: any) {
            const { children, ...rest } = props;
            return (
              <th
                className="border border-gray-300 dark:border-gray-600 px-4 py-2 bg-gray-50 dark:bg-gray-800 font-semibold text-left"
                {...rest}
              >
                {children}
              </th>
            );
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          td(props: any) {
            const { children, ...rest } = props;
            return (
              <td
                className="border border-gray-300 dark:border-gray-600 px-4 py-2"
                {...rest}
              >
                {children}
              </td>
            );
          },
          // 引用块渲染
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          blockquote(props: any) {
            const { children, ...rest } = props;
            return (
              <blockquote
                className="border-l-4 border-blue-500 pl-4 italic bg-blue-50 dark:bg-blue-900/20 py-2 my-4"
                {...rest}
              >
                {children}
              </blockquote>
            );
          },
          // 列表渲染
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ul(props: any) {
            const { children, ...rest } = props;
            return (
              <ul className="list-disc pl-6 my-4 space-y-1" {...rest}>
                {children}
              </ul>
            );
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ol(props: any) {
            const { children, ...rest } = props;
            return (
              <ol className="list-decimal pl-6 my-4 space-y-1" {...rest}>
                {children}
              </ol>
            );
          },
          // 标题渲染
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          h1(props: any) {
            const { children, ...rest } = props;
            return (
              <h1
                className="text-2xl font-bold mt-6 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2"
                {...rest}
              >
                {children}
              </h1>
            );
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          h2(props: any) {
            const { children, ...rest } = props;
            return (
              <h2 className="text-xl font-bold mt-5 mb-3" {...rest}>
                {children}
              </h2>
            );
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          h3(props: any) {
            const { children, ...rest } = props;
            return (
              <h3 className="text-lg font-bold mt-4 mb-2" {...rest}>
                {children}
              </h3>
            );
          },
          // 段落渲染
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          p(props: any) {
            const { children, ...rest } = props;
            return (
              <p className="mb-4 leading-relaxed" {...rest}>
                {children}
              </p>
            );
          },
          // 数学公式渲染 - 行内公式
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          span(props: any) {
            const { className, children, ...rest } = props;
            if (className === "math math-inline") {
              return (
                <span className="katex-inline mx-1" {...rest}>
                  {children}
                </span>
              );
            }
            return (
              <span className={className} {...rest}>
                {children}
              </span>
            );
          },
          // 数学公式渲染 - 块级公式
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          div(props: any) {
            const { className, children, ...rest } = props;
            if (className === "math math-display") {
              return (
                <div
                  className="katex-display my-4 text-center overflow-x-auto"
                  {...rest}
                >
                  {children}
                </div>
              );
            }
            return (
              <div className={className} {...rest}>
                {children}
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
