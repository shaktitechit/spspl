/**
 * @fileoverview Client-side vector PDF report generator with company letterhead integration.
 * @module components/workPlanner/exportPdfReport
 */

import { stripHtml } from "./workPlanUtils";
import {
  companyInfoToLetterhead,
  DEFAULT_COMPANY_LETTERHEAD,
  type PdfCompanyLetterhead,
} from "./pdfCompanyLetterhead";
import { publicWorkPlannerApiOrigin } from "@/lib/env";

export function cleanPdfText(text: unknown): string {
  if (text == null) return "";
  const s = stripHtml(String(text));
  return s
    .replace(/[\u20B9₹]/g, "Rs. ")
    .replace(/Rs\.\s*Rs\./g, "Rs. ")
    .replace(/\u00A0/g, " ") // replace non-breaking spaces
    .replace(/\s+/g, " ")
    .trim();
}

export function formatAmountForPdf(val: number | string | null | undefined): string {
  if (val == null || val === "" || val === "—") return "—";
  const num = typeof val === "number" ? val : Number(String(val).replace(/[^0-9.-]+/g, ""));
  if (Number.isNaN(num)) return "—";
  if (num === 0) return "0.00";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatCurrencyForPdf(val: number | string | null | undefined): string {
  if (val == null || val === "" || val === "—") return "Rs. 0.00";
  const num = typeof val === "number" ? val : Number(String(val).replace(/[^0-9.-]+/g, ""));
  if (Number.isNaN(num)) return "Rs. 0.00";
  return `Rs. ${new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)}`;
}

export type PdfReportColumn = {
  key: string;
  label: string;
  /** Relative width weight (default 1) */
  width?: number;
  align?: "left" | "right" | "center";
};

export type PdfReportRow = Record<string, string | number | null | undefined>;

export type DownloadPdfReportOptions = {
  letterhead: PdfCompanyLetterhead;
  filename: string;
  title: string;
  subtitle?: string;
  downloadedBy?: string;
  timestamp?: string;
  filterPanel?: Array<{ label: string; value: string }>;
  metadata?: Array<{ label: string; value: string }>;
  columns: PdfReportColumn[];
  rows: PdfReportRow[];
};

async function loadLogoDataUrl(url?: string): Promise<{ dataUrl: string; format: "PNG" | "JPEG" | "WEBP" } | null> {
  if (!url) return null;

  if (url.startsWith("data:image/png")) return { dataUrl: url, format: "PNG" };
  if (url.startsWith("data:image/jpeg") || url.startsWith("data:image/jpg")) return { dataUrl: url, format: "JPEG" };
  if (url.startsWith("data:image/webp")) return { dataUrl: url, format: "WEBP" };

  // 1. Try Canvas Image loading for cross-origin & format conversion to pure PNG
  const canvasRes = await new Promise<{ dataUrl: string; format: "PNG" } | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width || 300;
        canvas.height = img.naturalHeight || img.height || 150;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        resolve({ dataUrl, format: "PNG" });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });

  if (canvasRes) return canvasRes;

  // 2. Fetch fallback
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
    if (!dataUrl) return null;
    const format = blob.type.includes("jpeg") || blob.type.includes("jpg") ? "JPEG" : blob.type.includes("webp") ? "WEBP" : "PNG";
    return { dataUrl, format };
  } catch {
    return null;
  }
}

export async function downloadPdfReport({
  letterhead,
  filename,
  title,
  subtitle,
  downloadedBy,
  timestamp,
  filterPanel = [],
  metadata = [],
  columns,
  rows,
}: DownloadPdfReportOptions): Promise<void> {
  const { jsPDF } = await import("jspdf");

  let activeLetterhead = {
    ...DEFAULT_COMPANY_LETTERHEAD,
    ...letterhead,
  };

  // If logoUrl is missing or not a data URL, fetch from company-info endpoint
  if (!activeLetterhead.logoUrl) {
    try {
      const origin = publicWorkPlannerApiOrigin().replace(/\/+$/, "");
      const res = await fetch(`${origin}/api/company-info`);
      if (res.ok) {
        const json = await res.json();
        const comp = json?.data || json;
        if (comp) {
          const fresh = companyInfoToLetterhead(comp);
          activeLetterhead = {
            ...activeLetterhead,
            ...fresh,
            logoUrl: fresh.logoUrl || activeLetterhead.logoUrl,
          };
        }
      }
    } catch {
      // ignore
    }
  }

  const logoObj = await loadLogoDataUrl(activeLetterhead.logoUrl);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
  const marginX = 10;
  const marginBottom = 14;

  const usableWidth = pageWidth - marginX * 2;
  const weightSum = columns.reduce((s, c) => s + (c.width ?? 1), 0);
  const colWidths = columns.map((c) => ((c.width ?? 1) / weightSum) * usableWidth);

  const timeStr = timestamp || new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const userStr = downloadedBy || "System User";

  let y = 9;

  const drawLetterheadHeader = (isFirstPage: boolean) => {
    if (isFirstPage) {
      // 1. Logo & Company Name Brand Block
      const headerStartY = y;
      const logoW = 34;
      const logoH = 15;

      if (logoObj?.dataUrl) {
        try {
          doc.addImage(logoObj.dataUrl, logoObj.format, marginX, headerStartY, logoW, logoH);
        } catch {
          // Fallback if image rendering fails
        }
      }

      const centerX = pageWidth / 2;
      let textCursorY = headerStartY + 3.5;

      const compName = cleanPdfText(
        activeLetterhead.companyName || "Medica Enterprises",
      );
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(30, 58, 95);
      doc.text(compName, centerX, textCursorY, { align: "center" });

      if (activeLetterhead.addressLine) {
        textCursorY += 4.5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(cleanPdfText(activeLetterhead.addressLine), centerX, textCursorY, { align: "center" });
      }

      if (activeLetterhead.contactLine) {
        textCursorY += 4;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(cleanPdfText(activeLetterhead.contactLine), centerX, textCursorY, { align: "center" });
      }

      y = Math.max(headerStartY + logoH + 2, textCursorY + 4);

      // Decorative Brand Rule (dual tone)
      doc.setDrawColor(30, 58, 95);
      doc.setLineWidth(0.7);
      doc.line(marginX, y, pageWidth - marginX, y);
      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(0.35);
      doc.line(marginX, y + 0.6, pageWidth - marginX, y + 0.6);
      y += 2.5;

      // Letterhead Metadata: Downloaded By (left) & Timestamp (right)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(30, 58, 95);
      doc.text("Downloaded By: ", marginX, y + 3);
      const dByW = doc.getTextWidth("Downloaded By: ");
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      doc.text(cleanPdfText(userStr), marginX + dByW, y + 3);

      const fullTimeLbl = `Timestamp: ${cleanPdfText(timeStr)}`;
      const timeLblW = doc.getTextWidth(fullTimeLbl);
      const timeX = pageWidth - marginX - timeLblW;

      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 58, 95);
      doc.text("Timestamp: ", timeX, y + 3);
      const tOnW = doc.getTextWidth("Timestamp: ");
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      doc.text(cleanPdfText(timeStr), timeX + tOnW, y + 3);

      y += 6.5;

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 4.5;
    } else {
      // Compact top rule for subsequent pages
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`${cleanPdfText(activeLetterhead.companyName || "Medica Enterprises")} — ${cleanPdfText(title)}`, marginX, y + 2);
      y += 4;
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 4;
    }

    // 2. Report Title & Subtitle (First page only)
    if (isFirstPage) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(cleanPdfText(title), marginX, y);
      y += 5;

      if (subtitle) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(cleanPdfText(subtitle), marginX, y);
        y += 4.5;
      }

      // 3. Filter Panel Box
      if (filterPanel && filterPanel.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(30, 58, 95);
        doc.text("APPLIED FILTERS & PARAMETERS", marginX, y + 2.5);
        y += 4;

        const colsPerRow = Math.min(4, filterPanel.length);
        const colW = usableWidth / colsPerRow;
        const rowsCount = Math.ceil(filterPanel.length / colsPerRow);
        const boxHeight = rowsCount * 5.5 + 2.5;

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(marginX, y, usableWidth, boxHeight, 1.5, 1.5, "FD");

        filterPanel.forEach((item, idx) => {
          const colIndex = idx % colsPerRow;
          const rowIndex = Math.floor(idx / colsPerRow);
          const itemX = marginX + colIndex * colW + 3;
          const itemY = y + 4.2 + rowIndex * 5.5;

          const lbl = cleanPdfText(item.label);
          const rawVal = cleanPdfText(item.value || "All");

          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          doc.setTextColor(30, 58, 95);
          doc.text(`${lbl}: `, itemX, itemY);

          const lblW = doc.getTextWidth(`${lbl}: `);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(51, 65, 85);
          const maxValW = colW - lblW - 5;
          const valText = doc.splitTextToSize(rawVal, maxValW)[0] || rawVal;
          doc.text(valText, itemX + lblW, itemY);
        });

        y += boxHeight + 4;
      }

      // 4. Summary / KPI Metrics Cards Grid
      if (metadata && metadata.length > 0) {
        const cardCount = metadata.length;
        const cardGap = 2.5;
        const cardWidth = (usableWidth - (cardCount - 1) * cardGap) / cardCount;
        const cardHeight = 13.5;

        metadata.forEach((item, idx) => {
          const cardX = marginX + idx * (cardWidth + cardGap);

          // Card container
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(203, 213, 225);
          doc.roundedRect(cardX, y, cardWidth, cardHeight, 1.5, 1.5, "FD");

          // Top accent bar
          doc.setFillColor(30, 58, 95);
          doc.rect(cardX, y, cardWidth, 1.2, "F");

          // Card Label
          doc.setFont("helvetica", "bold");
          doc.setFontSize(6.5);
          doc.setTextColor(100, 116, 139);
          const lbl = cleanPdfText(item.label).toUpperCase();
          doc.text(lbl, cardX + 2.5, y + 4.5);

          // Card Value
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(15, 23, 42);
          const val = cleanPdfText(item.value);
          const valLines = doc.splitTextToSize(val, cardWidth - 5);
          doc.text(valLines[0] || val, cardX + 2.5, y + 9.0);

          if (valLines.length > 1) {
            doc.setFontSize(6.5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100, 116, 139);
            doc.text(valLines[1], cardX + 2.5, y + 12.0);
          }
        });

        y += cardHeight + 4.5;
      }
    }
  };

  const drawTableHeaders = () => {
    doc.setFillColor(30, 58, 95);
    doc.rect(marginX, y, usableWidth, 6.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);

    let x = marginX;
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const align = col.align || "left";
      const textX =
        align === "right"
          ? x + colWidths[i] - 2
          : align === "center"
          ? x + colWidths[i] / 2
          : x + 2;
      doc.text(cleanPdfText(col.label), textX, y + 4.5, { align });
      x += colWidths[i];
    }
    y += 6.5;
  };

  // Draw Page 1 Header
  drawLetterheadHeader(true);
  drawTableHeaders();

  // Draw Table Rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);

  let isZebra = false;

  for (const row of rows) {
    const isPlanRow = String(row._rowType || "").includes("PLAN") || String(row.rowType || "").includes("PLAN");
    const isItemRow = String(row._rowType || "").includes("VISIT") || String(row._rowType || "").includes("TASK");
    const isDateHeader = row._rowType === "DATE_HEADER";
    const isUserHeader = row._rowType === "USER_HEADER";
    const isSubtotal =
      row._rowType === "USER_SUBTOTAL" ||
      row._rowType === "DATE_TOTAL" ||
      row._rowType === "SUBTOTAL" ||
      row._rowType === "TOTAL";

    // 1. Full-width Date Group Header
    if (isDateHeader) {
      const headerHeight = 6.8;
      if (y + headerHeight > pageHeight - marginBottom) {
        doc.addPage();
        y = 9;
        drawLetterheadHeader(false);
        drawTableHeaders();
      }

      doc.setFillColor(30, 58, 95);
      doc.rect(marginX, y, usableWidth, headerHeight, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(cleanPdfText(row.title || row.sectionTitle || ""), marginX + 3, y + 4.5);

      if (row.summaryRight || row.amount || row.total) {
        const rightText = cleanPdfText(row.summaryRight || row.amount || row.total);
        doc.text(rightText, pageWidth - marginX - 3, y + 4.5, { align: "right" });
      }

      y += headerHeight;
      isZebra = false;
      continue;
    }

    // 2. Full-width User Group Header
    if (isUserHeader) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);

      const rightText = (row.summaryRight || row.amount || row.total) ? cleanPdfText(row.summaryRight || row.amount || row.total) : "";
      const rightTextW = rightText ? doc.getTextWidth(rightText) + 6 : 0;
      const maxTitleW = usableWidth - rightTextW - 8;
      const titleLines = doc.splitTextToSize(cleanPdfText(row.title || row.sectionTitle || ""), maxTitleW);
      const headerHeight = Math.max(5.8, titleLines.length * 3.4 + 2.0);

      if (y + headerHeight > pageHeight - marginBottom) {
        doc.addPage();
        y = 9;
        drawLetterheadHeader(false);
        drawTableHeaders();
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
      }

      doc.setFillColor(241, 245, 249);
      doc.rect(marginX, y, usableWidth, headerHeight, "F");

      // Blue accent line on left
      doc.setFillColor(59, 130, 246);
      doc.rect(marginX, y, 2.5, headerHeight, "F");

      doc.setTextColor(30, 58, 95);
      let textLineY = y + 3.8;
      for (const line of titleLines) {
        doc.text(line, marginX + 4.5, textLineY);
        textLineY += 3.4;
      }

      if (rightText) {
        doc.text(rightText, pageWidth - marginX - 3, y + 4.0, { align: "right" });
      }

      y += headerHeight;
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.2);
      doc.line(marginX, y, pageWidth - marginX, y);

      isZebra = false;
      continue;
    }

    // 3. Subtotal / Date Total / Grand Total Row
    if (isSubtotal) {
      const isDateTotal = row._rowType === "DATE_TOTAL";
      const isGrandTotal = row._rowType === "TOTAL" || row._rowType === "GRAND_TOTAL";
      const subtotalHeight = isGrandTotal ? 6.5 : isDateTotal ? 6.0 : 5.8;
      if (y + subtotalHeight > pageHeight - marginBottom) {
        doc.addPage();
        y = 9;
        drawLetterheadHeader(false);
        drawTableHeaders();
      }

      doc.setFillColor(isGrandTotal ? 226 : 241, isGrandTotal ? 232 : 245, isGrandTotal ? 240 : 249);
      doc.rect(marginX, y, usableWidth, subtotalHeight, "F");

      // Top double-line / highlight border
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(isGrandTotal ? 0.5 : 0.35);
      doc.line(marginX, y, pageWidth - marginX, y);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);

      // If the row has a title, draw it on the left
      const titleText = cleanPdfText(row.title || row.sectionTitle || "");
      if (titleText) {
        doc.text(titleText, marginX + 3, y + 4.0);
      }

      let x = marginX;
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        const align = col.align || "left";
        const val = row[col.key];
        const text = val == null ? "" : cleanPdfText(val);
        const textX =
          align === "right"
            ? x + colWidths[i] - 2
            : align === "center"
            ? x + colWidths[i] / 2
            : x + 2;

        if (text) {
          doc.text(text, textX, y + 4.0, { align });
        }
        x += colWidths[i];
      }

      y += subtotalHeight;

      // Bottom double border
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(isGrandTotal ? 0.5 : 0.35);
      doc.line(marginX, y, pageWidth - marginX, y);

      isZebra = false;
      continue;
    }

    // Standard Row
    const cellLines = columns.map((col, i) => {
      const val = row[col.key];
      const text = val == null ? "" : cleanPdfText(val);
      return doc.splitTextToSize(text || "—", colWidths[i] - 2.5);
    });

    const maxLineCount = Math.max(1, ...cellLines.map((lines) => lines.length));
    const rowHeight = Math.max(5.0, maxLineCount * 3.4 + 1.6);

    // Page overflow check
    if (y + rowHeight > pageHeight - marginBottom) {
      doc.addPage();
      y = 9;
      drawLetterheadHeader(false);
      drawTableHeaders();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
    }

    // Row Background
    if (isPlanRow) {
      doc.setFillColor(241, 245, 249);
      doc.rect(marginX, y, usableWidth, rowHeight, "F");
    } else if (isZebra) {
      doc.setFillColor(248, 250, 252);
      doc.rect(marginX, y, usableWidth, rowHeight, "F");
    }

    let x = marginX;
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const align = col.align || "left";
      const textX =
        align === "right"
          ? x + colWidths[i] - 2
          : align === "center"
          ? x + colWidths[i] / 2
          : x + 2;

      if (isPlanRow) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 58, 95);
      } else if (isItemRow) {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(51, 65, 85);
      } else {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(15, 23, 42);
      }

      doc.text(cellLines[i], textX, y + 3.4, { align });
      x += colWidths[i];
    }

    y += rowHeight;

    // Row divider line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.15);
    doc.line(marginX, y, pageWidth - marginX, y);

    isZebra = !isZebra;
  }

  // Stamp Page Footers (Page X of Y & Letterhead Footer Note)
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.line(marginX, pageHeight - 9, pageWidth - marginX, pageHeight - 9);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);

    const footerBrand = cleanPdfText(
      activeLetterhead.companyName || "Medica Enterprises",
    );
    const footerText = `${footerBrand} — Confidential Financial Record | Generated by ${cleanPdfText(userStr)} on ${cleanPdfText(timeStr)}`;
    doc.text(footerText, marginX, pageHeight - 4.5);

    doc.text(`Page ${i} of ${pageCount}`, pageWidth - marginX, pageHeight - 4.5, {
      align: "right",
    });
  }

  const safeName = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  doc.save(safeName);
}
