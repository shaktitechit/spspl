/**
 * @fileoverview Component to safely render rich text HTML content for Terms & Conditions.
 * @module components/portal/shared/quotations/RichTextDisplay
 */
"use client";

import React from "react";

type RichTextDisplayProps = {
  content: string;
  className?: string;
};

export function isNonEmptyRichText(content?: string | null): boolean {
  if (!content) return false;
  return content.replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").trim().length > 0;
}

export function RichTextDisplay({ content, className = "" }: RichTextDisplayProps) {
  if (!isNonEmptyRichText(content)) return null;

  // Check if content contains HTML tags
  const isHtml = /<[a-z][\s\S]*>/i.test(content);

  if (isHtml) {
    return (
      <div
        className={`rich-text-content max-w-none text-xs leading-relaxed text-slate-800 dark:text-white break-words [&_table]:w-full [&_table]:border-collapse [&_table]:my-2 [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:dark:bg-slate-800 [&_th]:p-1.5 [&_th]:text-left [&_th]:font-bold [&_td]:border [&_td]:border-slate-300 [&_td]:p-1.5 [&_td]:text-left [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-1 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mb-1 [&_h3]:text-xs [&_h3]:font-bold [&_h3]:mb-1 [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/60 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:my-1.5 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_pre]:bg-slate-100 dark:[&_pre]:bg-slate-800 [&_pre]:p-2 [&_pre]:rounded-md [&_hr]:my-2 [&_hr]:border-slate-300 [&_a]:text-blue-600 [&_a]:underline ${className}`}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  return (
    <div className={`rich-text-content text-xs text-slate-800 dark:text-white whitespace-pre-wrap break-words leading-relaxed ${className}`}>
      {content}
    </div>
  );
}
