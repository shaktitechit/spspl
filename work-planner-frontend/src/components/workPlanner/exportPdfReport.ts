/**
 * @fileoverview Client-side vector PDF report generator with company letterhead integration.
 * @module components/workPlanner/exportPdfReport
 */

import { stripHtml } from "./workPlanUtils";

import type { PdfCompanyLetterhead } from "./pdfCompanyLetterhead";

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

  const logoObj = await loadLogoDataUrl(letterhead.logoUrl);

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

  let y = 10;

  const drawLetterheadHeader = (isFirstPage: boolean) => {
    if (isFirstPage) {
      // 1. Logo & Company Name Brand Block
      let headerTextX = marginX;
      if (logoObj?.dataUrl) {
        try {
          doc.addImage(logoObj.dataUrl, logoObj.format, marginX, y, 32, 14);
          headerTextX = marginX + 35;
        } catch {
          headerTextX = marginX;
        }
      }

      const availableHeaderWidth = pageWidth - marginX - headerTextX;
      const centerX = headerTextX + availableHeaderWidth / 2;

      if (letterhead.companyName) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(30, 58, 95);
        doc.text(letterhead.companyName, centerX, y + 4, { align: "center" });
      }

      if (letterhead.addressLine) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(letterhead.addressLine, centerX, y + 9, { align: "center" });
      }

      if (letterhead.contactLine) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(letterhead.contactLine, centerX, y + 13, { align: "center" });
      }

      y += 16;

      // Decorative Brand Rule
      doc.setDrawColor(30, 58, 95);
      doc.setLineWidth(0.6);
      doc.line(marginX, y, pageWidth - marginX, y);
      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(0.3);
      doc.line(marginX, y + 0.5, pageWidth - marginX, y + 0.5);
      y += 2.5;

      // Bottom of Letterhead Metadata: Downloaded By & Timestamp
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(30, 58, 95);
      doc.text("Downloaded By: ", marginX, y + 3);
      const dByW = doc.getTextWidth("Downloaded By: ");
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      doc.text(userStr, marginX + dByW, y + 3);

      const fullTimeLbl = `Timestamp: ${timeStr}`;
      const timeLblW = doc.getTextWidth(fullTimeLbl);
      const timeX = pageWidth - marginX - timeLblW;

      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 58, 95);
      doc.text("Timestamp: ", timeX, y + 3);
      const tOnW = doc.getTextWidth("Timestamp: ");
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      doc.text(timeStr, timeX + tOnW, y + 3);

      y += 6.5;

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 5;
    } else {
      // Compact top rule for subsequent pages
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`${letterhead.companyName || "Work Planner"} — ${title}`, marginX, y + 2);
      y += 4;
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 4;
    }

    // 2. Report Title & Subtitle
    if (isFirstPage) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(title, marginX, y);
      y += 5;

      if (subtitle) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(subtitle, marginX, y);
        y += 4.5;
      }

      // 3. Filter Panel Box
      if (filterPanel && filterPanel.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(30, 58, 95);
        doc.text("APPLIED FILTER PANEL & PARAMETERS", marginX, y + 3);
        y += 4.5;

        const colsPerRow = 4;
        const colW = usableWidth / colsPerRow;
        const rowsCount = Math.ceil(filterPanel.length / colsPerRow);
        const boxHeight = rowsCount * 5.2 + 3.5;

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(marginX, y, usableWidth, boxHeight, 1.5, 1.5, "FD");

        filterPanel.forEach((item, idx) => {
          const colIndex = idx % colsPerRow;
          const rowIndex = Math.floor(idx / colsPerRow);
          const itemX = marginX + colIndex * colW + 3;
          const itemY = y + 4.2 + rowIndex * 5.2;

          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          doc.setTextColor(30, 58, 95);
          doc.text(`${item.label}: `, itemX, itemY);

          const lblW = doc.getTextWidth(`${item.label}: `);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(51, 65, 85);
          const maxValW = colW - lblW - 4;
          const valText = doc.splitTextToSize(item.value || "All", maxValW)[0] || item.value;
          doc.text(valText, itemX + lblW, itemY);
        });

        y += boxHeight + 4.5;
      }

      // Summary Metrics box (if provided)
      if (metadata.length > 0) {
        doc.setFillColor(241, 245, 249);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(marginX, y, usableWidth, 7, 1, 1, "FD");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(51, 65, 85);

        let metaX = marginX + 3;
        metadata.forEach((item) => {
          doc.setFont("helvetica", "bold");
          doc.text(`${item.label}: `, metaX, y + 4.5);
          const labelWidth = doc.getTextWidth(`${item.label}: `);
          doc.setFont("helvetica", "normal");
          doc.text(item.value, metaX + labelWidth, y + 4.5);
          metaX += labelWidth + doc.getTextWidth(item.value) + 10;
        });

        y += 10;
      }
    }
  };

  const drawTableHeaders = () => {
    doc.setFillColor(30, 58, 95);
    doc.rect(marginX, y, usableWidth, 6, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);

    let x = marginX;
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const align = col.align || "left";
      const textX = align === "right" ? x + colWidths[i] - 1.5 : align === "center" ? x + colWidths[i] / 2 : x + 1.5;
      doc.text(col.label, textX, y + 4.2, { align });
      x += colWidths[i];
    }
    y += 6;
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

    const cellLines = columns.map((col, i) => {
      const val = row[col.key];
      const text = val == null ? "" : stripHtml(String(val));
      return doc.splitTextToSize(text || "—", colWidths[i] - 2);
    });

    const maxLineCount = Math.max(1, ...cellLines.map((lines) => lines.length));
    const rowHeight = Math.max(4.8, maxLineCount * 3.5);

    // Page overflow check
    if (y + rowHeight > pageHeight - marginBottom) {
      doc.addPage();
      y = 10;
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
      const textX = align === "right" ? x + colWidths[i] - 1.5 : align === "center" ? x + colWidths[i] / 2 : x + 1.5;

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

      doc.text(cellLines[i], textX, y + 3.2, { align });
      x += colWidths[i];
    }

    y += rowHeight;

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
    doc.setLineWidth(0.3);
    doc.line(marginX, pageHeight - 10, pageWidth - marginX, pageHeight - 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);

    const footerText = `${letterhead.companyName || process.env.NEXT_PUBLIC_COMPANY_NAME || "Work Planner"} | Downloaded by ${userStr} on ${timeStr}`;
    doc.text(footerText, marginX, pageHeight - 5);

    doc.text(`Page ${i} of ${pageCount}`, pageWidth - marginX, pageHeight - 5, {
      align: "right",
    });
  }

  const safeName = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  doc.save(safeName);
}
