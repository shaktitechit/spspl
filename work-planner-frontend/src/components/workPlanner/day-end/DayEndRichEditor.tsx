"use client";

import React, { useRef, useEffect, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Palette,
  Highlighter,
  RemoveFormatting,
  Undo,
  Redo,
  Minus,
} from "lucide-react";

interface DayEndRichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

const TEXT_COLORS = [
  { label: "Default", color: "inherit" },
  { label: "Blue", color: "#2563eb" },
  { label: "Emerald", color: "#059669" },
  { label: "Amber", color: "#d97706" },
  { label: "Rose", color: "#e11d48" },
  { label: "Purple", color: "#7c3aed" },
];

const HIGHLIGHT_COLORS = [
  { label: "None", color: "transparent" },
  { label: "Yellow", color: "#fef08a" },
  { label: "Green", color: "#bbf7d0" },
  { label: "Blue", color: "#bfdbfe" },
  { label: "Pink", color: "#fbcfe8" },
];

export function DayEndRichEditor({
  value,
  onChange,
  placeholder = "Write your day end summary, key wins, and observations here...",
  className = "",
  minHeight = "320px",
}: DayEndRichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChangeRef = useRef(false);

  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [highlightPickerOpen, setHighlightPickerOpen] = useState(false);

  // Sync external value when not modified internally
  useEffect(() => {
    if (editorRef.current) {
      if (isInternalChangeRef.current) {
        isInternalChangeRef.current = false;
        return;
      }
      if (editorRef.current.innerHTML !== (value || "")) {
        editorRef.current.innerHTML = value || "";
      }
    }
  }, [value]);

  const exec = (command: string, value: string | undefined = undefined) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    emitChange();
  };

  const emitChange = () => {
    if (!editorRef.current) return;
    isInternalChangeRef.current = true;
    const html = editorRef.current.innerHTML;
    // Normalize empty content
    const cleanHtml = html === "<br>" || html === "<div><br></div>" || html === "<p><br></p>" ? "" : html;
    onChange(cleanHtml);
  };

  const handleInsertLink = () => {
    const url = prompt("Enter link URL (e.g. https://example.com):");
    if (url && url.trim()) {
      exec("createLink", url.trim());
    }
  };

  return (
    <div
      className={`flex flex-col rounded-xl border border-border bg-card shadow-xs overflow-hidden ${className}`}
    >
      {/* Sticky Rich Toolbar */}
      <div className="flex items-center gap-1 border-b border-border bg-surface-muted/50 p-1.5 sm:p-2 text-muted select-none overflow-x-auto scrollbar-none flex-nowrap sm:flex-wrap shrink-0">
        {/* Undo / Redo */}
        <button
          type="button"
          onClick={() => exec("undo")}
          title="Undo"
          className="rounded-lg p-1.5 hover:bg-surface hover:text-foreground active:scale-90 transition cursor-pointer shrink-0"
        >
          <Undo className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec("redo")}
          title="Redo"
          className="rounded-lg p-1.5 hover:bg-surface hover:text-foreground active:scale-90 transition cursor-pointer shrink-0"
        >
          <Redo className="h-4 w-4" />
        </button>

        <div className="h-4 w-px bg-border mx-1 shrink-0" />

        {/* Headings */}
        <button
          type="button"
          onClick={() => exec("formatBlock", "<h1>")}
          title="Heading 1"
          className="rounded-lg p-1.5 hover:bg-surface hover:text-foreground active:scale-90 transition cursor-pointer shrink-0"
        >
          <Heading1 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec("formatBlock", "<h2>")}
          title="Heading 2"
          className="rounded-lg p-1.5 hover:bg-surface hover:text-foreground active:scale-90 transition cursor-pointer shrink-0"
        >
          <Heading2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec("formatBlock", "<h3>")}
          title="Heading 3"
          className="rounded-lg p-1.5 hover:bg-surface hover:text-foreground active:scale-90 transition cursor-pointer shrink-0"
        >
          <Heading3 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec("formatBlock", "<p>")}
          title="Normal Text Paragraph"
          className="rounded-lg px-2 py-1 text-xs font-semibold hover:bg-surface hover:text-foreground active:scale-90 transition cursor-pointer shrink-0"
        >
          Paragraph
        </button>

        <div className="h-4 w-px bg-border mx-1 shrink-0" />

        {/* Styling */}
        <button
          type="button"
          onClick={() => exec("bold")}
          title="Bold (Ctrl+B)"
          className="rounded-lg p-1.5 hover:bg-surface hover:text-foreground active:scale-90 transition cursor-pointer shrink-0"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec("italic")}
          title="Italic (Ctrl+I)"
          className="rounded-lg p-1.5 hover:bg-surface hover:text-foreground active:scale-90 transition cursor-pointer shrink-0"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec("underline")}
          title="Underline (Ctrl+U)"
          className="rounded-lg p-1.5 hover:bg-surface hover:text-foreground active:scale-90 transition cursor-pointer shrink-0"
        >
          <Underline className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec("strikeThrough")}
          title="Strikethrough"
          className="rounded-lg p-1.5 hover:bg-surface hover:text-foreground active:scale-90 transition cursor-pointer shrink-0"
        >
          <Strikethrough className="h-4 w-4" />
        </button>

        <div className="h-4 w-px bg-border mx-1 shrink-0" />

        {/* Lists */}
        <button
          type="button"
          onClick={() => exec("insertUnorderedList")}
          title="Bullet List"
          className="rounded-lg p-1.5 hover:bg-surface hover:text-foreground active:scale-90 transition cursor-pointer shrink-0"
        >
          <List className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec("insertOrderedList")}
          title="Numbered List"
          className="rounded-lg p-1.5 hover:bg-surface hover:text-foreground active:scale-90 transition cursor-pointer shrink-0"
        >
          <ListOrdered className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec("formatBlock", "<blockquote>")}
          title="Quote"
          className="rounded-lg p-1.5 hover:bg-surface hover:text-foreground active:scale-90 transition cursor-pointer shrink-0"
        >
          <Quote className="h-4 w-4" />
        </button>

        <div className="h-4 w-px bg-border mx-1 shrink-0" />

        {/* Color Dropdown */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => {
              setColorPickerOpen(!colorPickerOpen);
              setHighlightPickerOpen(false);
            }}
            title="Text Color"
            className="rounded-lg p-1.5 hover:bg-surface hover:text-foreground active:scale-90 transition cursor-pointer flex items-center gap-1"
          >
            <Palette className="h-4 w-4" />
          </button>
          {colorPickerOpen && (
            <div className="absolute left-0 top-full z-20 mt-1 flex items-center gap-1.5 rounded-xl border border-border bg-card p-2 shadow-lg">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => {
                    if (c.color === "inherit") {
                      exec("removeFormat");
                    } else {
                      exec("foreColor", c.color);
                    }
                    setColorPickerOpen(false);
                  }}
                  title={c.label}
                  className="h-6 w-6 rounded-full border border-border transition hover:scale-110 active:scale-95 flex items-center justify-center text-[9px] font-bold cursor-pointer"
                  style={{ backgroundColor: c.color === "inherit" ? "var(--foreground)" : c.color }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Highlight Dropdown */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => {
              setHighlightPickerOpen(!highlightPickerOpen);
              setColorPickerOpen(false);
            }}
            title="Highlight Color"
            className="rounded-lg p-1.5 hover:bg-surface hover:text-foreground active:scale-90 transition cursor-pointer flex items-center gap-1"
          >
            <Highlighter className="h-4 w-4" />
          </button>
          {highlightPickerOpen && (
            <div className="absolute left-0 top-full z-20 mt-1 flex items-center gap-1.5 rounded-xl border border-border bg-card p-2 shadow-lg">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => {
                    exec("hiliteColor", c.color);
                    setHighlightPickerOpen(false);
                  }}
                  title={c.label}
                  className="h-6 w-6 rounded-full border border-black/20 transition hover:scale-110 active:scale-95 flex items-center justify-center text-[9px] font-bold text-slate-700 cursor-pointer"
                  style={{ backgroundColor: c.color }}
                >
                  {c.color === "transparent" ? "✕" : ""}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleInsertLink}
          title="Insert Link"
          className="rounded-lg p-1.5 hover:bg-surface hover:text-foreground active:scale-90 transition cursor-pointer shrink-0"
        >
          <LinkIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec("insertHorizontalRule")}
          title="Insert Divider"
          className="rounded-lg p-1.5 hover:bg-surface hover:text-foreground active:scale-90 transition cursor-pointer shrink-0"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec("removeFormat")}
          title="Clear Formatting"
          className="rounded-lg p-1.5 hover:bg-surface hover:text-foreground active:scale-90 transition cursor-pointer shrink-0"
        >
          <RemoveFormatting className="h-4 w-4" />
        </button>
      </div>

      {/* Editor Surface */}
      <div
        ref={editorRef}
        contentEditable
        onInput={emitChange}
        onBlur={emitChange}
        style={{ minHeight }}
        data-placeholder={placeholder}
        className="day-end-rich-content flex-1 overflow-y-auto p-3.5 sm:p-5 text-xs sm:text-sm text-foreground focus:outline-hidden prose prose-sm max-w-none dark:prose-invert"
      />
    </div>
  );
}

export default DayEndRichEditor;
