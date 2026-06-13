import React from "react";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  if (!content) return null;

  // Split content by lines to process block structures
  const lines = content.split("\n");

  const renderedElements = lines.map((line, index) => {
    const trimmed = line.trim();

    // 1. Headers: ### Title or ## Title
    if (trimmed.startsWith("###")) {
      return (
        <h3 key={index} className="text-lg font-bold text-slate-800 dark:text-white mt-4 mb-2">
          {parseInlineMarkdown(trimmed.replace(/^###\s*/, ""))}
        </h3>
      );
    }
    if (trimmed.startsWith("##")) {
      return (
        <h2 key={index} className="text-xl font-extrabold text-slate-900 dark:text-white mt-5 mb-3 border-b border-slate-100 pb-1">
          {parseInlineMarkdown(trimmed.replace(/^##\s*/, ""))}
        </h2>
      );
    }
    if (trimmed.startsWith("#")) {
      return (
        <h1 key={index} className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-6 mb-4">
          {parseInlineMarkdown(trimmed.replace(/^#\s*/, ""))}
        </h1>
      );
    }

    // 2. Unordered lists: - item or * item
    if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
      const cleanText = trimmed.replace(/^[-*]\s*/, "");
      return (
        <li key={index} className="ml-5 list-disc text-slate-600 dark:text-slate-300 mb-1">
          {parseInlineMarkdown(cleanText)}
        </li>
      );
    }

    // 3. Blockquotes: > quote
    if (trimmed.startsWith(">")) {
      const cleanText = trimmed.replace(/^>\s*/, "");
      return (
        <blockquote key={index} className="border-l-4 border-indigo-400 pl-4 py-1 my-3 bg-indigo-50/50 dark:bg-indigo-950/20 text-slate-700 dark:text-slate-300 italic rounded-r">
          {parseInlineMarkdown(cleanText)}
        </blockquote>
      );
    }

    // 4. Code Blocks (simple handling or fallback)
    if (trimmed.startsWith("```")) {
      return null; // Skip code fence borders
    }

    // 5. Empty lines
    if (!trimmed) {
      return <div key={index} className="h-2" />;
    }

    // 6. Normal paragraph
    return (
      <p key={index} className="text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
        {parseInlineMarkdown(line)}
      </p>
    );
  });

  return <div className="space-y-1">{renderedElements}</div>;
}

// Simple parsing for **bold** and `code` tags inline
function parseInlineMarkdown(text: string): React.ReactNode {
  if (!text) return "";

  // Split by regex for bold (**text**) and code (`text`) inline styles
  // matches: **bold** or `code`
  const regex = /(\*\*.*?\*\*|`.*?`)/g;
  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-slate-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded text-xs font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
