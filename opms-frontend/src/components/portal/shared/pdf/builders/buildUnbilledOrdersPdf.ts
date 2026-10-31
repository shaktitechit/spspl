/**
 * @fileoverview Native vector jsPDF builder for Unbilled / Process Pending / On Hold reports.
 * @module components/portal/shared/pdf/builders/buildUnbilledOrdersPdf
 */

import type { PdfCompanyLetterhead } from "../templates/pdfCompanyLetterhead";
import type {
  UnbilledOrdersPdfListLine,
  UnbilledOrdersPdfUnbilledLine,
} from "../templates/UnbilledOrdersPdfTemplate";
import {
  DARK,
  MUTED,
  NAVY,
  contentBottom,
  contentWidth,
  drawTableHead,
  drawTableRow,
  ensureSpace,
  preparePdfChrome,
  stampAllPages,
  startPdfPage,
  wrapLinesPreservingBreaks,
  type JsPDF,
  type PdfChromeOpts,
  type PdfCol,
} from "./pdfVectorChrome";

export type BuildUnbilledOrdersPdfInput = {
  letterhead: PdfCompanyLetterhead;
  portalLabel: string;
  downloadedBy: string;
  generatedAt: string;
  groupBySalesPerson?: boolean;
  selectedSalesPerson?: string;
  unbilledLines: UnbilledOrdersPdfUnbilledLine[];
  processPendingLines: UnbilledOrdersPdfListLine[];
  onHoldLines: UnbilledOrdersPdfListLine[];
};

function formatCurrency(amount?: number | null): string {
  if (amount == null || Number.isNaN(amount) || amount <= 0) return "—";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

const UNBILLED_COLS: PdfCol[] = [
  { label: "Order", w: 16 },
  { label: "Date", w: 13 },
  { label: "Party", w: 24 },
  { label: "Sales Person", w: 20 },
  { label: "Status", w: 16 },
  { label: "Product", w: 28 },
  { label: "Appr", w: 7, align: "right" },
  { label: "Disp", w: 7, align: "right" },
  { label: "Unbilled", w: 8, align: "right" },
  { label: "Amount", w: 15, align: "right" },
  { label: "Remarks", w: 36 },
];

const UNBILLED_GROUPED_COLS: PdfCol[] = [
  { label: "Order", w: 18 },
  { label: "Date", w: 14 },
  { label: "Party", w: 28 },
  { label: "Status", w: 18 },
  { label: "Product", w: 32 },
  { label: "Appr", w: 8, align: "right" },
  { label: "Disp", w: 8, align: "right" },
  { label: "Unbilled", w: 8, align: "right" },
  { label: "Amount", w: 16, align: "right" },
  { label: "Remarks", w: 40 },
];

const LIST_COLS: PdfCol[] = [
  { label: "Order", w: 16 },
  { label: "Date", w: 13 },
  { label: "Party", w: 24 },
  { label: "Sales Person", w: 20 },
  { label: "Status", w: 16 },
  { label: "Product", w: 28 },
  { label: "Ordered", w: 8, align: "right" },
  { label: "Pending", w: 8, align: "right" },
  { label: "Amount", w: 15, align: "right" },
  { label: "Remarks", w: 42 },
];

const LIST_GROUPED_COLS: PdfCol[] = [
  { label: "Order", w: 18 },
  { label: "Date", w: 14 },
  { label: "Party", w: 28 },
  { label: "Status", w: 18 },
  { label: "Product", w: 32 },
  { label: "Ordered", w: 9, align: "right" },
  { label: "Pending", w: 9, align: "right" },
  { label: "Amount", w: 16, align: "right" },
  { label: "Remarks", w: 46 },
];

const SALES_SUMMARY_COLS: PdfCol[] = [
  { label: "Sales Person", w: 50 },
  { label: "Unbilled Qty", w: 26, align: "right" },
  { label: "Process Qty", w: 26, align: "right" },
  { label: "On Hold Qty", w: 26, align: "right" },
  { label: "Total Qty", w: 26, align: "right" },
  { label: "Total Amount", w: 36, align: "right" },
];

type SalesPersonSummaryRow = {
  salesPerson: string;
  unbilledQty: number;
  processQty: number;
  holdQty: number;
  totalQty: number;
  totalAmount: number;
};

function groupLinesBySalesPerson<T extends { salesPerson?: string }>(
  lines: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const line of lines) {
    const key =
      line.salesPerson && line.salesPerson !== "—"
        ? line.salesPerson
        : "Unassigned";
    const group = map.get(key) ?? [];
    group.push(line);
    map.set(key, group);
  }
  return new Map(
    Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "Unassigned") return 1;
      if (b === "Unassigned") return -1;
      return a.localeCompare(b);
    }),
  );
}

function buildSalesPersonSummaryRows(
  unbilledLines: UnbilledOrdersPdfUnbilledLine[],
  processPendingLines: UnbilledOrdersPdfListLine[],
  onHoldLines: UnbilledOrdersPdfListLine[],
): SalesPersonSummaryRow[] {
  const map = new Map<string, SalesPersonSummaryRow>();

  const getOrCreate = (name: string): SalesPersonSummaryRow => {
    const key = name && name !== "—" ? name : "Unassigned";
    let existing = map.get(key);
    if (!existing) {
      existing = {
        salesPerson: key,
        unbilledQty: 0,
        processQty: 0,
        holdQty: 0,
        totalQty: 0,
        totalAmount: 0,
      };
      map.set(key, existing);
    }
    return existing;
  };

  for (const l of unbilledLines) {
    const row = getOrCreate(l.salesPerson || "");
    const qty = Number(l.remaining || 0);
    const amt = Number(l.amount || 0);
    row.unbilledQty += qty;
    row.totalQty += qty;
    row.totalAmount += amt;
  }

  for (const l of processPendingLines) {
    const row = getOrCreate(l.salesPerson || "");
    const qty = Number(l.pending || 0);
    const amt = Number(l.amount || 0);
    row.processQty += qty;
    row.totalQty += qty;
    row.totalAmount += amt;
  }

  for (const l of onHoldLines) {
    const row = getOrCreate(l.salesPerson || "");
    const qty = Number(l.pending || 0);
    const amt = Number(l.amount || 0);
    row.holdQty += qty;
    row.totalQty += qty;
    row.totalAmount += amt;
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.salesPerson === "Unassigned") return 1;
    if (b.salesPerson === "Unassigned") return -1;
    return a.salesPerson.localeCompare(b.salesPerson);
  });
}

function productLabel(name: string, sku?: string): string {
  return sku ? `${name}  ·  SKU ${sku}` : name;
}

function drawSectionTitle(
  pdf: JsPDF,
  chrome: PdfChromeOpts,
  x: number,
  y: number,
  title: string,
  count: number,
): number {
  y = ensureSpace(pdf, chrome, y, 10);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.setTextColor(...NAVY);
  pdf.text(title.toUpperCase(), x, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(...MUTED);
  pdf.text(`${count} line${count === 1 ? "" : "s"}`, x, y + 3.4);
  return y + 6.5;
}

function drawSalesPersonBanner(
  pdf: JsPDF,
  chrome: PdfChromeOpts,
  x: number,
  y: number,
  w: number,
  salesPerson: string,
  count: number,
  qty: number,
  amount: number,
): number {
  y = ensureSpace(pdf, chrome, y, 9);
  pdf.setFillColor(241, 245, 249);
  pdf.setDrawColor(203, 213, 225);
  pdf.rect(x, y, w, 6.6, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.8);
  pdf.setTextColor(...NAVY);
  pdf.text(`SALES PERSON: ${salesPerson.toUpperCase()}`, x + 2.5, y + 4.5);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(...MUTED);
  const countText = `(${count} line${count === 1 ? "" : "s"}  ·  ${qty} unit${qty === 1 ? "" : "s"})`;
  pdf.text(countText, x + 70, y + 4.5);
  if (amount > 0) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...DARK);
    pdf.text(`Rs. ${formatCurrency(amount)}`, x + w - 2.5, y + 4.5, { align: "right" });
  }
  return y + 8;
}

function drawEmptyNote(
  pdf: JsPDF,
  chrome: PdfChromeOpts,
  x: number,
  y: number,
  w: number,
  label: string,
): number {
  y = ensureSpace(pdf, chrome, y, 9.5);
  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(226, 232, 240);
  pdf.rect(x, y, w, 7.5, "FD");
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...MUTED);
  pdf.text(`No ${label} at the time of download.`, x + 3, y + 4.8);
  return y + 10;
}

function measureUnbilledRowCells(
  pdf: JsPDF,
  cols: PdfCol[],
  values: string[],
  fontSize = 5.8,
  lineH = 2.7,
  pad = 1.0,
): { cells: string[][]; h: number } {
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(fontSize);

  const cells = cols.map((col, i) => {
    const val = values[i] ?? "—";
    const isRemarksCol = col.label.toLowerCase() === "remarks";
    const isProductCol = col.label.toLowerCase() === "product";
    // Allow remarks up to 30 lines so timestamped remark entries are never hidden!
    const maxLines = isRemarksCol ? 30 : isProductCol ? 4 : 3;
    return wrapLinesPreservingBreaks(pdf, val, col.w - 1.8, maxLines);
  });

  const n = Math.max(1, ...cells.map((c) => c.length));
  const h = Math.max(5.0, pad * 2 + n * lineH);
  return { cells, h };
}

function drawRows<T>(
  pdf: JsPDF,
  chrome: PdfChromeOpts,
  x: number,
  y: number,
  cols: PdfCol[],
  rows: T[],
  toValues: (row: T) => string[],
): number {
  const headH = 5.6;
  const headFontSize = 6.0;
  const cellFontSize = 5.8;
  const cellLineH = 2.7;
  const cellPad = 1.0;

  y = ensureSpace(pdf, chrome, y, 8);
  y = drawTableHead(pdf, cols, x, y, headH, headFontSize);
  rows.forEach((row, idx) => {
    const measured = measureUnbilledRowCells(
      pdf,
      cols,
      toValues(row),
      cellFontSize,
      cellLineH,
      cellPad,
    );
    const next = ensureSpace(pdf, chrome, y, measured.h + 0.5);
    if (next !== y) {
      y = drawTableHead(pdf, cols, x, next, headH, headFontSize);
    } else {
      y = next;
    }
    drawTableRow(
      pdf,
      cols,
      measured.cells,
      x,
      y,
      measured.h,
      idx % 2 === 1,
      cellLineH,
      cellFontSize,
    );
    y += measured.h;
  });
  return y + 2.5;
}

export async function buildUnbilledOrdersPdf(input: BuildUnbilledOrdersPdfInput): Promise<JsPDF> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const isSalesWise = Boolean(input.groupBySalesPerson || input.selectedSalesPerson);
  const subtitle = input.selectedSalesPerson
    ? `Sales Person: ${input.selectedSalesPerson} · Combined report generated from the orders modal`
    : isSalesWise
      ? "Sales Person-wise combined report generated from the orders modal"
      : "Combined report generated from the orders modal";

  const chrome = await preparePdfChrome(input.letterhead, {
    title: "Unbilled / Process Pending / On Hold Orders",
    subtitle,
    generatedAt: input.generatedAt,
    portalLabel: input.portalLabel,
    downloadedBy: input.downloadedBy,
  });

  const m = 10;
  const w = contentWidth(pdf);
  let y = startPdfPage(pdf, chrome, true);

  // Section 1: Un Billed Orders
  y = drawSectionTitle(pdf, chrome, m, y, "1. Un Billed Orders", input.unbilledLines.length);
  if (input.unbilledLines.length === 0) {
    y = drawEmptyNote(pdf, chrome, m, y, w, "un billed orders");
  } else if (isSalesWise) {
    const unbilledGroups = groupLinesBySalesPerson(input.unbilledLines);
    for (const [salesPerson, groupLines] of unbilledGroups.entries()) {
      const groupQty = groupLines.reduce((s, l) => s + Number(l.remaining || 0), 0);
      const groupAmt = groupLines.reduce((s, l) => s + Number(l.amount || 0), 0);
      y = drawSalesPersonBanner(pdf, chrome, m, y, w, salesPerson, groupLines.length, groupQty, groupAmt);
      y = drawRows(pdf, chrome, m, y, UNBILLED_GROUPED_COLS, groupLines, (line) => [
        line.orderNo,
        line.refOrderDate,
        line.party,
        line.statusLabel,
        productLabel(line.productName, line.sku),
        String(line.approved),
        String(line.submittedDispatch),
        String(line.remaining),
        formatCurrency(line.amount),
        line.remarks || "—",
      ]);
      y += 2;
    }
  } else {
    y = drawRows(pdf, chrome, m, y, UNBILLED_COLS, input.unbilledLines, (line) => [
      line.orderNo,
      line.refOrderDate,
      line.party,
      line.salesPerson || "—",
      line.statusLabel,
      productLabel(line.productName, line.sku),
      String(line.approved),
      String(line.submittedDispatch),
      String(line.remaining),
      formatCurrency(line.amount),
      line.remarks || "—",
    ]);
  }

  // Section 2: Process Pending Orders
  y = drawSectionTitle(pdf, chrome, m, y, "2. Process Pending Orders", input.processPendingLines.length);
  if (input.processPendingLines.length === 0) {
    y = drawEmptyNote(pdf, chrome, m, y, w, "process pending orders");
  } else if (isSalesWise) {
    const processGroups = groupLinesBySalesPerson(input.processPendingLines);
    for (const [salesPerson, groupLines] of processGroups.entries()) {
      const groupQty = groupLines.reduce((s, l) => s + Number(l.pending || 0), 0);
      const groupAmt = groupLines.reduce((s, l) => s + Number(l.amount || 0), 0);
      y = drawSalesPersonBanner(pdf, chrome, m, y, w, salesPerson, groupLines.length, groupQty, groupAmt);
      y = drawRows(pdf, chrome, m, y, LIST_GROUPED_COLS, groupLines, (line) => [
        line.orderNo,
        line.refOrderDate,
        line.party,
        line.statusLabel,
        productLabel(line.productName, line.sku),
        String(line.ordered),
        String(line.pending),
        formatCurrency(line.amount),
        line.remarks || "—",
      ]);
      y += 2;
    }
  } else {
    y = drawRows(pdf, chrome, m, y, LIST_COLS, input.processPendingLines, (line) => [
      line.orderNo,
      line.refOrderDate,
      line.party,
      line.salesPerson || "—",
      line.statusLabel,
      productLabel(line.productName, line.sku),
      String(line.ordered),
      String(line.pending),
      formatCurrency(line.amount),
      line.remarks || "—",
    ]);
  }

  // Section 3: On Hold Orders
  y = drawSectionTitle(pdf, chrome, m, y, "3. On Hold Orders", input.onHoldLines.length);
  if (input.onHoldLines.length === 0) {
    y = drawEmptyNote(pdf, chrome, m, y, w, "on hold orders");
  } else if (isSalesWise) {
    const holdGroups = groupLinesBySalesPerson(input.onHoldLines);
    for (const [salesPerson, groupLines] of holdGroups.entries()) {
      const groupQty = groupLines.reduce((s, l) => s + Number(l.pending || 0), 0);
      const groupAmt = groupLines.reduce((s, l) => s + Number(l.amount || 0), 0);
      y = drawSalesPersonBanner(pdf, chrome, m, y, w, salesPerson, groupLines.length, groupQty, groupAmt);
      y = drawRows(pdf, chrome, m, y, LIST_GROUPED_COLS, groupLines, (line) => [
        line.orderNo,
        line.refOrderDate,
        line.party,
        line.statusLabel,
        productLabel(line.productName, line.sku),
        String(line.ordered),
        String(line.pending),
        formatCurrency(line.amount),
        line.remarks || "—",
      ]);
      y += 2;
    }
  } else {
    y = drawRows(pdf, chrome, m, y, LIST_COLS, input.onHoldLines, (line) => [
      line.orderNo,
      line.refOrderDate,
      line.party,
      line.salesPerson || "—",
      line.statusLabel,
      productLabel(line.productName, line.sku),
      String(line.ordered),
      String(line.pending),
      formatCurrency(line.amount),
      line.remarks || "—",
    ]);
  }

  // Section 4: Sales Person Wise Breakdown (when sales-wise)
  if (isSalesWise) {
    const salesRows = buildSalesPersonSummaryRows(
      input.unbilledLines,
      input.processPendingLines,
      input.onHoldLines,
    );
    if (salesRows.length > 0) {
      y = drawSectionTitle(pdf, chrome, m, y, "4. Sales Person Wise Breakdown", salesRows.length);
      y = drawRows(pdf, chrome, m, y, SALES_SUMMARY_COLS, salesRows, (r) => [
        r.salesPerson,
        String(r.unbilledQty),
        String(r.processQty),
        String(r.holdQty),
        String(r.totalQty),
        `Rs. ${formatCurrency(r.totalAmount)}`,
      ]);
      y += 2;
    }
  }

  const unbilledQty = input.unbilledLines.reduce((s, l) => s + Number(l.remaining || 0), 0);
  const processQty = input.processPendingLines.reduce((s, l) => s + Number(l.pending || 0), 0);
  const holdQty = input.onHoldLines.reduce((s, l) => s + Number(l.pending || 0), 0);
  const totalQty = unbilledQty + processQty + holdQty;

  const unbilledAmount = input.unbilledLines.reduce((s, l) => s + Number(l.amount || 0), 0);
  const processAmount = input.processPendingLines.reduce((s, l) => s + Number(l.amount || 0), 0);
  const holdAmount = input.onHoldLines.reduce((s, l) => s + Number(l.amount || 0), 0);
  const totalAmount = unbilledAmount + processAmount + holdAmount;

  y = ensureSpace(pdf, chrome, y, 30);
  if (y + 30 > contentBottom(pdf)) y = startPdfPage(pdf, chrome, false);
  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(203, 213, 225);
  pdf.rect(m, y, w, 28, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.8);
  pdf.setTextColor(...NAVY);
  pdf.text("QUANTITY & AMOUNT SUMMARY", m + 3, y + 4.8);
  const summary = [
    { label: "Un Billed", qty: unbilledQty, amount: unbilledAmount },
    { label: "Process Pending", qty: processQty, amount: processAmount },
    { label: "On Hold pending", qty: holdQty, amount: holdAmount },
    { label: "Total pending (incl. unbilled)", qty: totalQty, amount: totalAmount },
  ];
  let sy = y + 9.2;
  for (const row of summary) {
    const last = row === summary[summary.length - 1];
    pdf.setFont("helvetica", last ? "bold" : "normal");
    pdf.setFontSize(last ? 7.8 : 7.0);
    pdf.setTextColor(...(last ? DARK : MUTED));
    pdf.text(row.label, m + 3, sy);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...DARK);
    pdf.text(`${row.qty} unit${row.qty === 1 ? "" : "s"}`, m + w - 46, sy, { align: "right" });
    pdf.text(
      `Rs. ${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(row.amount)}`,
      m + w - 3,
      sy,
      { align: "right" },
    );
    sy += last ? 4.6 : 4.0;
  }

  stampAllPages(pdf, chrome);
  return pdf;
}
