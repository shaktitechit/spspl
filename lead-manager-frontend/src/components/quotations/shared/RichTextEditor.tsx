/**
 * @fileoverview Full-Featured Rich Text Editor Component for Quotations, Cover Letters & Terms.
 * Provides a comprehensive, production-grade WYSIWYG editor with:
 * - History: Undo / Redo
 * - Typography: Paragraph, Headings (H1, H2, H3), Blockquote, Code block
 * - Font Sizing: 10px, 12px, 14px, 16px, 18px, 24px
 * - Formatting: Bold, Italic, Underline, Strikethrough, Subscript, Superscript
 * - Alignment: Left, Center, Right, Justify
 * - Lists & Indentation: Bullet, Numbered, Indent, Outdent
 * - Colors: Curated text palette + custom hex color picker
 * - Highlights: Curated background highlight palette + custom picker + clear fill
 * - Inserts: Hyperlinks (create / unlink), Tables, Horizontal dividers, Quote blocks
 * - Utilities: Clear formatting, live Word count & Character count stats
 * @module components/quotations/RichTextEditor
 */
"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Subscript,
  Superscript,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Indent,
  Outdent,
  Link as LinkIcon,
  Unlink,
  Table as TableIcon,
  Minus,
  Quote,
  Code,
  Undo,
  Redo,
  RotateCcw,
  Palette,
  Highlighter,
  ChevronDown,
  X,
} from "lucide-react";

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
};

const TEXT_COLORS = [
  { label: "Default", color: "inherit" },
  { label: "Dark Slate", color: "#0f172a" },
  { label: "Navy Blue", color: "#1e3a5f" },
  { label: "Primary Blue", color: "#2563eb" },
  { label: "Cyan", color: "#0891b2" },
  { label: "Emerald Green", color: "#16a34a" },
  { label: "Amber / Orange", color: "#d97706" },
  { label: "Rose Red", color: "#dc2626" },
  { label: "Purple", color: "#7c3aed" },
  { label: "Muted Gray", color: "#64748b" },
];

const HIGHLIGHT_COLORS = [
  { label: "None", color: "transparent" },
  { label: "Yellow", color: "#fef08a" },
  { label: "Soft Green", color: "#bbf7d0" },
  { label: "Soft Blue", color: "#bfdbfe" },
  { label: "Soft Pink", color: "#fbcfe8" },
  { label: "Soft Orange", color: "#fed7aa" },
  { label: "Soft Purple", color: "#e9d5ff" },
  { label: "Light Gray", color: "#e2e8f0" },
];

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write your content here...",
  className = "",
  minHeight = "120px",
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isUpdatingFromPropRef = useRef(false);

  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [activeFormatBlock, setActiveFormatBlock] = useState("p");
  const [activeFontSize, setActiveFontSize] = useState("3");

  // Sync external value to contentEditable innerHTML
  useEffect(() => {
    if (editorRef.current) {
      const currentHtml = editorRef.current.innerHTML;
      if (currentHtml !== value && !isUpdatingFromPropRef.current) {
        editorRef.current.innerHTML = value || "";
      }
      isUpdatingFromPropRef.current = false;
    }
  }, [value]);

  const execCmd = (command: string, cmdValue: string | undefined = undefined) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, cmdValue);
    emitChange();
  };

  const emitChange = () => {
    if (!editorRef.current) return;
    isUpdatingFromPropRef.current = true;
    const html = editorRef.current.innerHTML;
    // Normalize empty tags
    const trimmed = html.trim();
    const cleanHtml =
      trimmed === "" ||
      trimmed === "<br>" ||
      trimmed === "<div><br></div>" ||
      trimmed === "<p><br></p>" ||
      trimmed === "<p></p>"
        ? ""
        : html;
    onChange(cleanHtml);
  };

  // Block Formatting (Paragraph, Headings, Quote, Code)
  const handleBlockFormat = (tag: string) => {
    setActiveFormatBlock(tag);
    if (!editorRef.current) return;
    editorRef.current.focus();
    try {
      document.execCommand("formatBlock", false, `<${tag}>`);
    } catch {
      document.execCommand("formatBlock", false, tag);
    }
    emitChange();
  };

  // Font Size (1 to 7)
  const handleFontSize = (sizeStr: string) => {
    setActiveFontSize(sizeStr);
    execCmd("fontSize", sizeStr);
  };

  // Text Color
  const handleApplyColor = (color: string) => {
    execCmd("foreColor", color);
    setShowTextColorPicker(false);
  };

  // Highlight / Background Fill
  const handleApplyHighlight = (color: string) => {
    if (color === "transparent") {
      execCmd("removeFormat");
    } else {
      execCmd("hiliteColor", color);
    }
    setShowHighlightPicker(false);
  };

  // Insert Link with prompt
  const handleInsertLink = () => {
    const previousUrl = "";
    const url = window.prompt("Enter Web Address / URL (e.g. https://example.com):", previousUrl || "https://");
    if (url && url.trim() && url.trim() !== "https://") {
      execCmd("createLink", url.trim());
    }
  };

  // Insert Clean Table
  const handleInsertTable = () => {
    const tableHtml =
      `<table style="width:100%;border-collapse:collapse;margin:8px 0;border:1px solid #cbd5e1;font-size:11px;">` +
      `<thead><tr style="background:#f1f5f9;font-weight:bold;">` +
      `<th style="border:1px solid #cbd5e1;padding:5px 8px;text-align:left;">Header 1</th>` +
      `<th style="border:1px solid #cbd5e1;padding:5px 8px;text-align:left;">Header 2</th>` +
      `<th style="border:1px solid #cbd5e1;padding:5px 8px;text-align:left;">Header 3</th>` +
      `</tr></thead>` +
      `<tbody>` +
      `<tr><td style="border:1px solid #cbd5e1;padding:5px 8px;">Item / Detail A</td><td style="border:1px solid #cbd5e1;padding:5px 8px;">Specification B</td><td style="border:1px solid #cbd5e1;padding:5px 8px;">Remarks C</td></tr>` +
      `<tr><td style="border:1px solid #cbd5e1;padding:5px 8px;">Item / Detail D</td><td style="border:1px solid #cbd5e1;padding:5px 8px;">Specification E</td><td style="border:1px solid #cbd5e1;padding:5px 8px;">Remarks F</td></tr>` +
      `</tbody></table><p><br></p>`;
    execCmd("insertHTML", tableHtml);
  };

  // Statistics: Word and character count
  const stats = useMemo(() => {
    if (!value) return { words: 0, chars: 0 };
    const text = value.replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").trim();
    if (!text) return { words: 0, chars: 0 };
    const words = text.split(/\s+/).filter(Boolean).length;
    return { words, chars: text.length };
  }, [value]);

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900 overflow-hidden shadow-2xs transition-all ${className}`}
    >
      {/* ============================================================ */}
      {/* FULL-FEATURED RICH TEXT TOOLBAR */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200/90 bg-slate-50/90 px-2.5 py-1.5 dark:border-white/10 dark:bg-slate-800/80 shrink-0 select-none">
        {/* 1. History (Undo / Redo) */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execCmd("undo")}
            title="Undo (Ctrl+Z)"
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white transition cursor-pointer"
          >
            <Undo className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execCmd("redo")}
            title="Redo (Ctrl+Y)"
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white transition cursor-pointer"
          >
            <Redo className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

        {/* 2. Block Hierarchy (Heading / Paragraph) */}
        <div className="relative">
          <select
            value={activeFormatBlock}
            onChange={(e) => handleBlockFormat(e.target.value)}
            className="h-7 rounded-lg border border-slate-200 bg-white px-2 pr-6 text-xs font-semibold text-slate-700 hover:border-slate-300 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 appearance-none cursor-pointer"
            title="Paragraph Format"
          >
            <option value="p">Normal (Paragraph)</option>
            <option value="h1">Heading 1 (Large)</option>
            <option value="h2">Heading 2 (Medium)</option>
            <option value="h3">Heading 3 (Small)</option>
            <option value="blockquote">Quote Block</option>
            <option value="pre">Code / Monospace</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-1.5 top-2 h-3 w-3 text-slate-400" />
        </div>

        {/* 3. Font Size */}
        <div className="relative">
          <select
            value={activeFontSize}
            onChange={(e) => handleFontSize(e.target.value)}
            className="h-7 rounded-lg border border-slate-200 bg-white px-2 pr-6 text-xs font-semibold text-slate-700 hover:border-slate-300 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 appearance-none cursor-pointer"
            title="Font Size"
          >
            <option value="1">10px (Small)</option>
            <option value="2">12px (Regular)</option>
            <option value="3">14px (Medium)</option>
            <option value="4">16px (Large)</option>
            <option value="5">18px (XL)</option>
            <option value="6">24px (Title)</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-1.5 top-2 h-3 w-3 text-slate-400" />
        </div>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

        {/* 4. Text Formats: Bold, Italic, Underline, Strikethrough, Sub, Sup */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execCmd("bold")}
            title="Bold (Ctrl+B)"
            className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white transition cursor-pointer font-bold"
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execCmd("italic")}
            title="Italic (Ctrl+I)"
            className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white transition cursor-pointer"
          >
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execCmd("underline")}
            title="Underline (Ctrl+U)"
            className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white transition cursor-pointer"
          >
            <Underline className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execCmd("strikeThrough")}
            title="Strikethrough"
            className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white transition cursor-pointer"
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execCmd("subscript")}
            title="Subscript (e.g. H₂O)"
            className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white transition cursor-pointer"
          >
            <Subscript className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execCmd("superscript")}
            title="Superscript (e.g. X²)"
            className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white transition cursor-pointer"
          >
            <Superscript className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

        {/* 5. Color Palette & Highlights */}
        <div className="flex items-center gap-1 relative">
          {/* Text Color Trigger */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setShowTextColorPicker(!showTextColorPicker);
                setShowHighlightPicker(false);
              }}
              title="Text Color"
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white transition cursor-pointer border border-slate-200 dark:border-white/10"
            >
              <Palette className="h-3.5 w-3.5 text-primary" />
              <span>Color</span>
              <ChevronDown className="h-2.5 w-2.5 opacity-60" />
            </button>

            {/* Color Popover */}
            {showTextColorPicker && (
              <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xl dark:border-white/10 dark:bg-slate-900">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Text Colors</span>
                  <button
                    type="button"
                    onClick={() => setShowTextColorPicker(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <div className="grid grid-cols-5 gap-1.5 mb-2.5">
                  {TEXT_COLORS.map((tc) => (
                    <button
                      key={tc.color}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleApplyColor(tc.color)}
                      style={{ backgroundColor: tc.color === "inherit" ? "#0f172a" : tc.color }}
                      title={tc.label}
                      className="h-6 w-6 rounded-md border border-slate-200 dark:border-white/10 hover:scale-110 transition cursor-pointer"
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-2 dark:border-white/10">
                  <span className="text-[10px] text-slate-500">Custom Hex:</span>
                  <input
                    type="color"
                    onChange={(e) => handleApplyColor(e.target.value)}
                    className="h-6 w-8 rounded cursor-pointer border-0 p-0 bg-transparent"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Highlight Color Trigger */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setShowHighlightPicker(!showHighlightPicker);
                setShowTextColorPicker(false);
              }}
              title="Highlight Text Background"
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-amber-700 bg-amber-50/60 hover:bg-amber-100 dark:text-amber-300 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 transition cursor-pointer border border-amber-200/60 dark:border-amber-700/40"
            >
              <Highlighter className="h-3.5 w-3.5" />
              <span>Highlight</span>
              <ChevronDown className="h-2.5 w-2.5 opacity-60" />
            </button>

            {/* Highlight Popover */}
            {showHighlightPicker && (
              <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xl dark:border-white/10 dark:bg-slate-900">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Highlight Fill</span>
                  <button
                    type="button"
                    onClick={() => setShowHighlightPicker(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {HIGHLIGHT_COLORS.map((hc) => (
                    <button
                      key={hc.color}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleApplyHighlight(hc.color)}
                      style={{ backgroundColor: hc.color === "transparent" ? "#ffffff" : hc.color }}
                      title={hc.label}
                      className="h-6 w-full rounded-md border border-slate-200 dark:border-white/10 text-[9px] font-bold text-slate-700 hover:scale-105 transition cursor-pointer flex items-center justify-center"
                    >
                      {hc.color === "transparent" ? "None" : ""}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-2 dark:border-white/10">
                  <span className="text-[10px] text-slate-500">Custom Fill:</span>
                  <input
                    type="color"
                    onChange={(e) => handleApplyHighlight(e.target.value)}
                    className="h-6 w-8 rounded cursor-pointer border-0 p-0 bg-transparent"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

        {/* 6. Text Alignment */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execCmd("justifyLeft")}
            title="Align Left"
            className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white transition cursor-pointer"
          >
            <AlignLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execCmd("justifyCenter")}
            title="Align Center"
            className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white transition cursor-pointer"
          >
            <AlignCenter className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execCmd("justifyRight")}
            title="Align Right"
            className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white transition cursor-pointer"
          >
            <AlignRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execCmd("justifyFull")}
            title="Justify Text"
            className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white transition cursor-pointer"
          >
            <AlignJustify className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

        {/* 7. Lists & Indentation */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execCmd("insertUnorderedList")}
            title="Bullet List"
            className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white transition cursor-pointer"
          >
            <List className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execCmd("insertOrderedList")}
            title="Numbered List"
            className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white transition cursor-pointer"
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execCmd("outdent")}
            title="Decrease Indent"
            className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white transition cursor-pointer"
          >
            <Outdent className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execCmd("indent")}
            title="Increase Indent"
            className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white transition cursor-pointer"
          >
            <Indent className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

        {/* 8. Inserts: Links, Tables, Dividers, Quote, Code */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleInsertLink}
            title="Insert Hyperlink"
            className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white transition cursor-pointer"
          >
            <LinkIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execCmd("unlink")}
            title="Remove Hyperlink"
            className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white transition cursor-pointer"
          >
            <Unlink className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleInsertTable}
            title="Insert Table Grid"
            className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white transition cursor-pointer"
          >
            <TableIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execCmd("insertHorizontalRule")}
            title="Insert Horizontal Divider Line"
            className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white transition cursor-pointer"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleBlockFormat("blockquote")}
            title="Blockquote Note"
            className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white transition cursor-pointer"
          >
            <Quote className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleBlockFormat("pre")}
            title="Monospace / Code Block"
            className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white transition cursor-pointer"
          >
            <Code className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

        {/* 9. Reset / Clear Formatting */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd("removeFormat")}
          title="Clear Formatting"
          className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40 transition cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ============================================================ */}
      {/* EDITABLE CONTENT WORKSPACE */}
      {/* ============================================================ */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={emitChange}
          onBlur={emitChange}
          style={{ minHeight }}
          className="w-full p-3.5 text-xs text-slate-900 dark:text-white focus:outline-none overflow-y-auto leading-relaxed prose dark:prose-invert max-w-none [&>h1]:text-base [&>h1]:font-bold [&>h1]:mb-1.5 [&>h1]:text-slate-900 dark:[&>h1]:text-white [&>h2]:text-sm [&>h2]:font-bold [&>h2]:mb-1 [&>h2]:text-slate-800 dark:[&>h2]:text-white [&>h3]:text-xs [&>h3]:font-bold [&>h3]:mb-1 [&>blockquote]:border-l-2 [&>blockquote]:border-primary/60 [&>blockquote]:pl-3 [&>blockquote]:italic [&>blockquote]:my-2 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>pre]:bg-slate-100 dark:[&>pre]:bg-slate-800 [&>pre]:p-2 [&>pre]:rounded-md [&>table]:w-full [&>table_td]:border [&>table_td]:border-slate-300 [&>table_td]:p-1.5 [&>table_th]:border [&>table_th]:border-slate-300 [&>table_th]:p-1.5 [&>hr]:my-2.5 [&>hr]:border-slate-300 [&>a]:text-blue-600 [&>a]:underline"
        />

        {/* Empty Placeholder overlay */}
        {(!value ||
          value === "<br>" ||
          value === "<div><br></div>" ||
          value === "<p><br></p>" ||
          value === "<p></p>") && (
          <div className="pointer-events-none absolute left-3.5 top-3.5 text-xs text-slate-400 select-none">
            {placeholder}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* FOOTER STATUS BAR: WORD & CHAR COUNTS */}
      {/* ============================================================ */}
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-3 py-1 text-[10px] text-slate-500 dark:border-white/5 dark:bg-slate-800/40 dark:text-slate-400">
        <span className="flex items-center gap-2">
          <span>Rich Text Mode</span>
          <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
          <span>Full Features Enabled</span>
        </span>
        <div className="flex items-center gap-3 font-medium">
          <span>{stats.words} {stats.words === 1 ? "word" : "words"}</span>
          <span>{stats.chars} characters</span>
        </div>
      </div>
    </div>
  );
}
