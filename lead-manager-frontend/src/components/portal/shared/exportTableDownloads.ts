/** Minimal client-side table export helpers (PDF via jsPDF, XLSX via OOXML zip). */

export type ExportTableColumn = {
  key: string;
  label: string;
  /** Approximate width share for PDF layout (default 1). */
  width?: number;
};

export type ExportTableRow = Record<string, string | number | null | undefined>;

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function cellText(value: string | number | null | undefined): string {
  if (value == null) return "";
  return String(value);
}

/* ---------- CRC32 + ZIP (store) for XLSX ---------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u16(n: number): Uint8Array {
  const b = new Uint8Array(2);
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  return b;
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  b[2] = (n >>> 16) & 0xff;
  b[3] = (n >>> 24) & 0xff;
  return b;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function zipStore(files: Array<{ name: string; data: Uint8Array }>): Blob {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const encoder = new TextEncoder();

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const crc = crc32(file.data);
    const localHeader = concatBytes([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(file.data.length),
      u32(file.data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
    ]);
    localParts.push(localHeader, file.data);

    centralParts.push(
      concatBytes([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(file.data.length),
        u32(file.data.length),
        u16(nameBytes.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        nameBytes,
      ]),
    );
    offset += localHeader.length + file.data.length;
  }

  const central = concatBytes(centralParts);
  const end = concatBytes([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(central.length),
    u32(offset),
    u16(0),
  ]);

  const zipBytes = concatBytes([...localParts, central, end]);
  // Copy into a fresh ArrayBuffer so BlobPart typing accepts it under strict DOM libs.
  const ab = new ArrayBuffer(zipBytes.byteLength);
  new Uint8Array(ab).set(zipBytes);
  return new Blob([ab], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function colLetter(index: number): string {
  let n = index;
  let s = "";
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

/** Download a simple .xlsx workbook for the given columns/rows. */
export function downloadTableXlsx(options: {
  filename: string;
  sheetName?: string;
  title?: string;
  columns: ExportTableColumn[];
  rows: ExportTableRow[];
}): void {
  const { filename, sheetName = "Sheet1", title, columns, rows } = options;
  downloadMultiSheetXlsx({
    filename,
    sheets: [
      {
        sheetName,
        title,
        columns,
        rows,
      },
    ],
  });
}

export type MultiSheetXlsxTab = {
  sheetName: string;
  title?: string;
  columns: ExportTableColumn[];
  rows: ExportTableRow[];
};

/** Download a multi-sheet .xlsx workbook. */
export function downloadMultiSheetXlsx(options: {
  filename: string;
  sheets: MultiSheetXlsxTab[];
}): void {
  const { filename, sheets } = options;
  if (!sheets || sheets.length === 0) return;

  const encoder = new TextEncoder();
  const fileEntries: Array<{ name: string; data: Uint8Array }> = [];

  const contentTypeOverrides: string[] = [];
  const sheetElements: string[] = [];
  const relElements: string[] = [];

  sheets.forEach((tab, tabIdx) => {
    const sheetId = tabIdx + 1;
    const relId = `rId${sheetId}`;
    const safeSheet = tab.sheetName.replace(/[\\/*?:\[\]]/g, "_").slice(0, 31) || `Sheet${sheetId}`;

    contentTypeOverrides.push(
      `<Override PartName="/xl/worksheets/sheet${sheetId}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    );
    sheetElements.push(
      `<sheet name="${xmlEscape(safeSheet)}" sheetId="${sheetId}" r:id="${relId}"/>`
    );
    relElements.push(
      `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${sheetId}.xml"/>`
    );

    const sheetRows: string[] = [];
    let rowIdx = 1;

    if (tab.title) {
      sheetRows.push(
        `<row r="${rowIdx}"><c r="A${rowIdx}" t="inlineStr"><is><t>${xmlEscape(tab.title)}</t></is></c></row>`
      );
      rowIdx += 1;
      sheetRows.push(`<row r="${rowIdx}"/>`);
      rowIdx += 1;
    }

    const headerCells = tab.columns
      .map(
        (col, i) =>
          `<c r="${colLetter(i)}${rowIdx}" t="inlineStr"><is><t>${xmlEscape(col.label)}</t></is></c>`
      )
      .join("");
    sheetRows.push(`<row r="${rowIdx}">${headerCells}</row>`);
    rowIdx += 1;

    for (const row of tab.rows) {
      const cells = tab.columns
        .map((col, i) => {
          const text = xmlEscape(cellText(row[col.key]));
          return `<c r="${colLetter(i)}${rowIdx}" t="inlineStr"><is><t>${text}</t></is></c>`;
        })
        .join("");
      sheetRows.push(`<row r="${rowIdx}">${cells}</row>`);
      rowIdx += 1;
    }

    const lastCol = colLetter(Math.max(0, tab.columns.length - 1));
    const lastRow = Math.max(1, rowIdx - 1);
    const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastCol}${lastRow}"/>
  <sheetData>
    ${sheetRows.join("\n    ")}
  </sheetData>
</worksheet>`;

    fileEntries.push({
      name: `xl/worksheets/sheet${sheetId}.xml`,
      data: encoder.encode(sheetXml),
    });
  });

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${contentTypeOverrides.join("\n  ")}
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheetElements.join("\n    ")}
  </sheets>
</workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${relElements.join("\n  ")}
</Relationships>`;

  const blob = zipStore([
    { name: "[Content_Types].xml", data: encoder.encode(contentTypes) },
    { name: "_rels/.rels", data: encoder.encode(rels) },
    { name: "xl/workbook.xml", data: encoder.encode(workbook) },
    { name: "xl/_rels/workbook.xml.rels", data: encoder.encode(workbookRels) },
    ...fileEntries,
  ]);

  const safeName = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  triggerDownload(blob, safeName);
}

import type { PdfCompanyLetterhead } from "./pdfCompanyLetterhead";

async function loadLogoData(url?: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:image/")) return url;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || "") || null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Download a landscape A4 PDF table for the given columns/rows. */
export async function downloadTablePdf(options: {
  filename: string;
  title: string;
  subtitle?: string;
  columns: ExportTableColumn[];
  rows: ExportTableRow[];
  letterhead?: PdfCompanyLetterhead;
  portalLabel?: string;
  downloadedBy?: string;
}): Promise<void> {
  const { filename, title, subtitle, columns, rows, letterhead, portalLabel = letterhead?.portalName || "Lead Manager", downloadedBy } = options;
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 10;
  const marginTop = 12;
  const marginBottom = 12;
  const usableWidth = pageWidth - marginX * 2;
  const weightSum = columns.reduce((s, c) => s + (c.width ?? 1), 0);
  const colWidths = columns.map((c) => ((c.width ?? 1) / weightSum) * usableWidth);

  const logoData = await loadLogoData(letterhead?.logoUrl);

  let y = marginTop;

  const drawHeaderBlock = () => {
    if (logoData) {
      try {
        doc.addImage(logoData, "PNG", marginX, y, 28, 12, undefined, "FAST");
      } catch {
        // Fallback gracefully
      }
    }

    if (letterhead && (letterhead.companyName || letterhead.addressLine || letterhead.contactLine)) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(30, 58, 95);
      doc.text(letterhead.companyName || "", pageWidth / 2, y + 4, { align: "center" });
      y += 7;

      const headerDetailParts = [
        letterhead.addressLine ? `Regd. Off: ${letterhead.addressLine}` : "",
        letterhead.phone ? `Tel: ${letterhead.phone}` : "",
        letterhead.email ? `Email: ${letterhead.email}` : "",
        letterhead.gstin ? `GSTIN: ${letterhead.gstin}` : "",
      ].filter(Boolean);

      if (headerDetailParts.length > 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.2);
        doc.setTextColor(71, 85, 105);
        const detailStr = headerDetailParts.join("  •  ");
        doc.text(detailStr, pageWidth / 2, y, { align: "center" });
        y += 4;
      }

      doc.setDrawColor(30, 58, 95);
      doc.setLineWidth(0.5);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 6;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 58, 95);
    doc.text(title, marginX, y);
    y += 5;
    if (subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(subtitle, marginX, y);
      y += 4.5;
    }
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 4.5;
  };

  const drawColumnHeaders = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(30, 58, 95);
    let x = marginX;
    for (let i = 0; i < columns.length; i++) {
      const label = columns[i].label;
      const lines = doc.splitTextToSize(label, colWidths[i] - 1.5);
      doc.text(lines, x + 0.8, y);
      x += colWidths[i];
    }
    y += 5;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 3.5;
  };

  drawHeaderBlock();
  drawColumnHeaders();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);

  for (const row of rows) {
    const cellLines = columns.map((col, i) =>
      doc.splitTextToSize(cellText(row[col.key]) || "—", colWidths[i] - 1.5),
    );
    const rowHeight = Math.max(4.5, ...cellLines.map((lines) => lines.length * 3.4));

    if (y + rowHeight > pageHeight - marginBottom) {
      doc.addPage();
      y = marginTop;
      drawHeaderBlock();
      drawColumnHeaders();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
    }

    let x = marginX;
    for (let i = 0; i < columns.length; i++) {
      doc.text(cellLines[i], x + 0.8, y);
      x += colWidths[i];
    }
    y += rowHeight;
    doc.setDrawColor(241, 245, 249);
    doc.line(marginX, y - 1, pageWidth - marginX, y - 1);
  }

  const pageCount = doc.getNumberOfPages();
  const now = new Date();
  const timestampStr = `${now.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })} ${now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })}`;
  const userLabel = downloadedBy && downloadedBy.trim() ? downloadedBy.trim() : "User";
  const auditRight = `Generated By: ${userLabel} • ${timestampStr}`;
  const portalStr = `Generated via ${portalLabel}`;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageHeight - 7, pageWidth - marginX, pageHeight - 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);

    doc.text(portalStr, marginX, pageHeight - 3);
    if (pageCount > 1) {
      doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 3, { align: "center" });
    }
    doc.text(auditRight, pageWidth - marginX, pageHeight - 3, { align: "right" });
  }

  const safeName = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  doc.save(safeName);
}
