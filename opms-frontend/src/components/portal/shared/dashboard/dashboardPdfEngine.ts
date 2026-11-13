/**
 * @fileoverview Centralized PDF generation engine for dashboard analytics and reports on company letterhead.
 * @module components/portal/shared/dashboard/dashboardPdfEngine
 */

import { useState, useCallback, useMemo } from "react";
import {
  type PdfCompanyLetterhead,
  usePdfCompanyLetterhead,
} from "../pdf/templates/pdfCompanyLetterhead";
import {
  type JsPDF,
  type PdfChromeOpts,
  type PdfCol,
  NAVY,
  DARK,
  TEXT,
  MUTED,
  LINE,
  BAND,
  ZEBRA,
  contentWidth,
  ensureSpace,
  measureCells,
  preparePdfChrome,
  stampAllPages,
  startPdfPage,
  wrapLines,
} from "../pdf/builders/pdfVectorChrome";
import { useAppSelector } from "@/store";
import { toast } from "@/lib/toast";

export interface DashboardPdfExportOptions {
  letterhead: PdfCompanyLetterhead;
  title: string;
  subtitle?: string;
  metaLines?: string[];
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
  filename: string;
  orientation?: "portrait" | "landscape";
  portalLabel?: string;
  downloadedBy?: string;
  colAligns?: Array<"left" | "right" | "center">;
  colWidths?: number[];
  footerNotes?: string[];
}

/** Check whether a value looks numeric, currency, count, or percentage. */
function isNumericCell(val: unknown): boolean {
  if (val == null) return false;
  if (typeof val === "number") return true;
  const s = String(val).trim();
  if (!s || s === "—" || s === "-") return false;
  return /^₹?\s*-?\d+([.,]\d+)?%?$/.test(s);
}

/** Guess column alignment based on header and data sample. */
function inferColAlign(
  header: string,
  colIndex: number,
  rows: Array<Array<string | number | null | undefined>>,
): "left" | "right" | "center" {
  const h = header.toLowerCase().trim();
  if (colIndex === 0 && (h === "rank" || h === "#" || h === "s.no" || h === "sr. no" || h === "sl no")) {
    return "center";
  }
  if (h === "code" || h === "sku code" || h === "type" || h === "class" || h === "abc class" || h === "status") {
    return "center";
  }
  if (
    h.includes("qty") ||
    h.includes("quantity") ||
    h.includes("revenue") ||
    h.includes("rate") ||
    h.includes("price") ||
    h.includes("amount") ||
    h.includes("inr") ||
    h.includes("share") ||
    h.includes("%") ||
    h.includes("count") ||
    h.includes("orders") ||
    h.includes("total") ||
    h.includes("volume") ||
    h.includes("realization")
  ) {
    return "right";
  }

  // Check sample rows
  let numericHits = 0;
  let totalChecked = 0;
  for (let r = 0; r < Math.min(rows.length, 10); r += 1) {
    const val = rows[r]?.[colIndex];
    if (val != null && String(val).trim() !== "") {
      totalChecked += 1;
      if (isNumericCell(val)) numericHits += 1;
    }
  }
  if (totalChecked > 0 && numericHits / totalChecked >= 0.7) {
    return "right";
  }
  return "left";
}

/** Calculate balanced column widths fitting exact usable page width. */
function calculateColWidths(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
  availW: number,
  manualWidths?: number[],
): PdfCol[] {
  if (manualWidths && manualWidths.length === headers.length) {
    return headers.map((label, i) => ({
      label,
      w: manualWidths[i]!,
      align: inferColAlign(label, i, rows),
    }));
  }

  const weights: number[] = headers.map((h, i) => {
    // Measure length of header
    let maxLen = h.length;
    for (let r = 0; r < Math.min(rows.length, 15); r += 1) {
      const cellLen = String(rows[r]?.[i] ?? "").length;
      if (cellLen > maxLen) maxLen = cellLen;
    }
    // Give lead column slightly higher baseline if text
    if (i === 0 && maxLen > 15) {
      return Math.min(maxLen * 1.2, 45);
    }
    return Math.min(Math.max(maxLen, 6), 35);
  });

  const sumWeights = weights.reduce((a, b) => a + b, 0);
  const minColW = headers.length > 8 ? 14 : headers.length > 5 ? 18 : 22;

  let assigned = weights.map((w) => Math.max(minColW, (w / sumWeights) * availW));
  const assignedSum = assigned.reduce((a, b) => a + b, 0);

  // Normalize so total equals availW exactly
  assigned = assigned.map((w) => (w / assignedSum) * availW);

  return headers.map((label, i) => ({
    label,
    w: assigned[i]!,
    align: inferColAlign(label, i, rows),
  }));
}

/** Check if row is a Total or summary row. */
function isTotalRow(row: Array<string | number | null | undefined>): boolean {
  if (!row.length) return false;
  const first = String(row[0] ?? "").trim().toLowerCase();
  return first === "total" || first === "grand total" || first.startsWith("total ") || first.endsWith(" total");
}

/** Draw a specialized Total summary row. */
function drawSummaryRow(
  pdf: JsPDF,
  cols: PdfCol[],
  cells: string[][],
  x: number,
  y: number,
  h: number,
  fontSize: number,
  lineH: number,
) {
  const totalW = cols.reduce((s, c) => s + c.w, 0);

  // Background tint
  pdf.setFillColor(241, 245, 249);
  pdf.rect(x, y, totalW, h, "F");

  // Top thick border
  pdf.setDrawColor(...NAVY);
  pdf.setLineWidth(0.4);
  pdf.line(x, y, x + totalW, y);

  // Bottom double border
  pdf.line(x, y + h, x + totalW, y + h);
  pdf.setLineWidth(0.15);
  pdf.line(x, y + h + 0.6, x + totalW, y + h + 0.6);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(fontSize);
  pdf.setTextColor(...NAVY);

  let cx = x;
  const startOffset = fontSize <= 5.5 ? 2.5 : fontSize <= 6.0 ? 2.8 : 3.3;
  for (let i = 0; i < cols.length; i += 1) {
    const col = cols[i]!;
    const lines = cells[i] || ["—"];
    let ly = y + startOffset;
    for (const line of lines) {
      const tx =
        col.align === "right"
          ? cx + col.w - 1.2
          : col.align === "center"
            ? cx + col.w / 2
            : cx + 1.2;
      pdf.text(line, tx, ly, { align: col.align || "left" });
      ly += lineH;
    }
    cx += col.w;
  }
}

/**
 * Core export function for generating and saving a dashboard PDF report on company letterhead.
 */
export async function exportDashboardPdf(opts: DashboardPdfExportOptions): Promise<void> {
  const { jsPDF } = await import("jspdf");

  const orientation =
    opts.orientation ?? (opts.headers.length > 7 ? "landscape" : "portrait");

  const pdf = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4",
  });

  const now = new Date();
  const generatedAt = `${now.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })} ${now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;

  const chromeOpts: PdfChromeOpts = await preparePdfChrome(opts.letterhead, {
    title: opts.title,
    subtitle: opts.subtitle,
    generatedAt,
    portalLabel: opts.portalLabel,
    downloadedBy: opts.downloadedBy,
    compact: orientation === "landscape",
  });

  const m = orientation === "landscape" ? 8 : 10;
  const w = contentWidth(pdf, chromeOpts.compact);

  let y = startPdfPage(pdf, chromeOpts, true);

  // Optional Meta Lines (e.g. Period, Filter details, Record count)
  if (opts.metaLines && opts.metaLines.length > 0) {
    pdf.setFillColor(...BAND);
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.2);

    const metaBoxH = 5 + opts.metaLines.length * 3.5;
    pdf.rect(m, y, w, metaBoxH, "FD");

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.8);
    pdf.setTextColor(...MUTED);

    let my = y + 3.8;
    for (const line of opts.metaLines) {
      pdf.text(line, m + 3, my);
      my += 3.5;
    }
    y += metaBoxH + 3;
  }

  // Column definitions
  const cols = calculateColWidths(opts.headers, opts.rows, w, opts.colWidths);
  if (opts.colAligns && opts.colAligns.length === cols.length) {
    cols.forEach((col, idx) => {
      if (opts.colAligns![idx]) col.align = opts.colAligns![idx];
    });
  }

  // Dynamic font and line height according to density
  const colCount = cols.length;
  const headerFontSize = colCount > 10 ? 5.2 : colCount > 7 ? 6.0 : 6.8;
  const rowFontSize = colCount > 10 ? 5.4 : colCount > 7 ? 6.2 : 6.8;
  const lineH = colCount > 10 ? 2.6 : colCount > 7 ? 2.9 : 3.2;
  const pad = colCount > 10 ? 0.9 : 1.1;
  const headerH = colCount > 10 ? 5.5 : 6.4;

  const renderHeader = (curY: number): number => {
    return drawCustomTableHead(pdf, cols, m, curY, headerH, headerFontSize);
  };

  y = renderHeader(y);

  // Render Rows
  for (let rIdx = 0; rIdx < opts.rows.length; rIdx += 1) {
    const rawRow = opts.rows[rIdx]!;
    const isTotal = isTotalRow(rawRow);

    const stringCells = rawRow.map((cell) => {
      if (cell == null) return "—";
      const s = String(cell);
      return s.trim() === "" ? "—" : s;
    });

    const measured = measureCells(pdf, cols, stringCells, 4, lineH, pad);
    const neededH = measured.h + (isTotal ? 3 : 1);

    const nextY = ensureSpace(pdf, chromeOpts, y, neededH);
    if (nextY !== y) {
      // New page was started, redraw table head
      y = renderHeader(nextY);
    }

    if (isTotal) {
      drawSummaryRow(pdf, cols, measured.cells, m, y, measured.h, rowFontSize, lineH);
      y += measured.h + 2;
    } else {
      drawCustomTableRow(
        pdf,
        cols,
        measured.cells,
        m,
        y,
        measured.h,
        rIdx % 2 === 1,
        lineH,
        rowFontSize,
      );
      y += measured.h;
    }
  }

  // Footer notes if any
  if (opts.footerNotes && opts.footerNotes.length > 0) {
    y = ensureSpace(pdf, chromeOpts, y, 15);
    y += 4;
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(6.2);
    pdf.setTextColor(...MUTED);
    for (const note of opts.footerNotes) {
      pdf.text(note, m, y);
      y += 3;
    }
  }

  // Stamp running headers/footers on all pages
  stampAllPages(pdf, chromeOpts);

  // Download file
  const filename = opts.filename.toLowerCase().endsWith(".pdf")
    ? opts.filename
    : `${opts.filename}.pdf`;

  pdf.save(filename);
}

function drawCustomTableHead(
  pdf: JsPDF,
  cols: PdfCol[],
  x: number,
  y: number,
  h: number,
  fontSize: number,
): number {
  const totalW = cols.reduce((s, c) => s + c.w, 0);
  pdf.setFillColor(...BAND);
  pdf.rect(x, y, totalW, h, "F");
  pdf.setDrawColor(148, 163, 184);
  pdf.setLineWidth(0.3);
  pdf.line(x, y + h, x + totalW, y + h);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(fontSize);
  pdf.setTextColor(...NAVY);
  let cx = x;
  for (const col of cols) {
    const label = col.label.toUpperCase();
    const tx =
      col.align === "right"
        ? cx + col.w - 1.2
        : col.align === "center"
          ? cx + col.w / 2
          : cx + 1.2;
    const ty = fontSize <= 5.5 ? y + h - 1.5 : y + h - 1.8;
    pdf.text(label, tx, ty, { align: col.align || "left" });
    cx += col.w;
  }
  return y + h;
}

function drawCustomTableRow(
  pdf: JsPDF,
  cols: PdfCol[],
  cells: string[][],
  x: number,
  y: number,
  h: number,
  zebra: boolean,
  lineH: number,
  fontSize: number,
) {
  const totalW = cols.reduce((s, c) => s + c.w, 0);
  if (zebra) {
    pdf.setFillColor(...ZEBRA);
    pdf.rect(x, y, totalW, h, "F");
  }
  pdf.setDrawColor(...LINE);
  pdf.setLineWidth(0.15);
  pdf.line(x, y + h, x + totalW, y + h);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(fontSize);
  pdf.setTextColor(...TEXT);
  let cx = x;
  const startOffset = fontSize <= 5.5 ? 2.3 : fontSize <= 6.0 ? 2.6 : 3.0;
  for (let i = 0; i < cols.length; i += 1) {
    const col = cols[i]!;
    const lines = cells[i] || ["—"];
    let ly = y + startOffset;
    for (const line of lines) {
      const tx =
        col.align === "right"
          ? cx + col.w - 1.2
          : col.align === "center"
            ? cx + col.w / 2
            : cx + 1.2;
      pdf.text(line, tx, ly, { align: col.align || "left" });
      ly += lineH;
    }
    cx += col.w;
  }
}

/**
 * Convenient React hook for downloading dashboard reports as branded PDFs.
 */
export function useDashboardPdfExport() {
  const letterhead = usePdfCompanyLetterhead();
  const user = useAppSelector((s) => s.auth.user);
  const [isExporting, setIsExporting] = useState(false);

  const downloadedBy: string | undefined = useMemo(() => {
    if (!user) return undefined;
    const name =
      typeof user.name === "string"
        ? user.name
        : typeof user.first_name === "string"
          ? user.first_name
          : "";
    const email = typeof user.email === "string" ? user.email : "";
    return name.trim() || email.trim() || undefined;
  }, [user]);

  const exportPdf = useCallback(
    async (
      options: Omit<DashboardPdfExportOptions, "letterhead">,
    ): Promise<boolean> => {
      setIsExporting(true);
      try {
        await exportDashboardPdf({
          ...options,
          letterhead,
          downloadedBy: options.downloadedBy || downloadedBy,
        });
        toast.success("PDF report downloaded successfully.");
        return true;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to generate PDF report.";
        toast.error(msg);
        return false;
      } finally {
        setIsExporting(false);
      }
    },
    [letterhead, downloadedBy],
  );

  return {
    exportPdf,
    isExporting,
    letterhead,
  };
}

