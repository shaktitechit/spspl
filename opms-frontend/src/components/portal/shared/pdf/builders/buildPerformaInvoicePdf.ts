/**
 * @fileoverview Pure Vector jsPDF Builder for Performa Invoices with Company Letterhead.
 * Matches the official OPMS Proforma Invoice body format with:
 * 1. Company Letterhead (Logo, Regd. Office, Contacts, GSTIN)
 * 2. Header & Document Meta Box (Buyer details & Proforma Invoice meta)
 * 3. Itemized Goods Table (Sr, Description of Goods, HSN/SAC, QTY, Rate, Sub Total, Tax %, Tax Amt, Total)
 * 4. Summary Strip (Total GST, Grand Total, and Amount in words)
 * 5. Order Details 2-Column Grid (Sales Person, Freight, Dispatch Date, Transport, Terms, etc.)
 * 6. Bottom Sign-Off (Company Banking Details & Customer Order Acceptance)
 * @module components/portal/shared/pdf/builders/buildPerformaInvoicePdf
 */

import type { CompanyInfoRecord } from "@/store/api";
import type { PdfCompanyLetterhead } from "../templates/pdfCompanyLetterhead";
import {
  DARK,
  LINE,
  MUTED,
  NAVY,
  TEXT,
  loadPdfLogo,
  type JsPDF,
} from "./pdfVectorChrome";

export type PerformaPdfItem = {
  productName: string;
  sku?: string;
  hsnCode?: string;
  brand?: string;
  description?: string;
  quantity: number;
  freeQty?: number;
  unit?: string;
  unitPrice: number;
  discountPercent?: number;
  discountAmount?: number;
  taxableAmount: number;
  gstPercent: number;
  gstAmount: number;
  lineTotal: number;
};

export type BuildPerformaInvoicePdfInput = {
  copyType?: "customer" | "office";
  letterhead: PdfCompanyLetterhead;
  company?: CompanyInfoRecord | null;
  orderNo: string;
  orderDate: string;
  proformaNo?: string;
  poNumber?: string;
  poDate?: string;
  approvedBy?: string;
  approvedDate?: string;
  partyName: string;
  partyCode?: string;
  partyGstin?: string;
  partyPhone?: string;
  partyMobile?: string;
  partyEmail?: string;
  contactPerson?: string;
  billingAddress: string;
  shippingAddress?: string;
  salesPerson?: string;
  salesPersonDesignation?: string;
  salesPersonPhone?: string;
  salesPersonEmail?: string;
  companyWebsite?: string;
  termsAndConditions?: string[];
  orc?: string;
  dispatchDate?: string;
  paymentTerms?: string;
  installationRequired?: string;
  marginSheetAttached?: string;
  freightCharges?: string;
  transport?: string;
  customerType?: string;
  gstConcession?: string;
  kycStatus?: string;
  remarks?: string;
  items: PerformaPdfItem[];
  subtotal: number;
  discountTotal?: number;
  taxableAmount: number;
  gstAmount: number;
  grandTotal: number;
  generatedAt?: string;
  portalLabel?: string;
  downloadedBy?: string;
};

// Exact Brand Colors (RGB)
const BLUE: [number, number, number] = [37, 99, 235];
const ACCENT_BG: [number, number, number] = [239, 246, 255]; // Light blue #eff6ff
const BORDER_COLOR: [number, number, number] = [203, 213, 225]; // Slate-300 #cbd5e1

const PAGE_W = 210;
const PAGE_H = 297;
const M = 10;
const CONTENT_W = PAGE_W - M * 2; // 190 mm

function formatCurrency(amount?: number | null): string {
  if (amount == null || Number.isNaN(amount)) return "0.00";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr?: string | Date | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return String(dateStr);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  } catch {
    return String(dateStr);
  }
}

/**
 * Converts a number to Indian currency words format (e.g. Four Lakh Seventeen Thousand Twelve Rupees Only).
 */
export function numberToIndianWords(num: number | null | undefined): string {
  if (num == null || Number.isNaN(num)) return "Zero Rupees Only";
  const n = Math.floor(Math.abs(num));
  if (n === 0) return "Zero Rupees Only";

  const units = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function convertTwoDigits(val: number): string {
    if (val < 20) return units[val];
    const rem = val % 10;
    return tens[Math.floor(val / 10)] + (rem ? " " + units[rem] : "");
  }

  function convertThreeDigits(val: number): string {
    let str = "";
    if (Math.floor(val / 100) > 0) {
      str += units[Math.floor(val / 100)] + " Hundred ";
      val %= 100;
    }
    if (val > 0) {
      str += convertTwoDigits(val);
    }
    return str.trim();
  }

  const crore = Math.floor(n / 10000000);
  let rem = n % 10000000;
  const lakh = Math.floor(rem / 100000);
  rem = rem % 100000;
  const thousand = Math.floor(rem / 1000);
  rem = rem % 1000;
  const hundred = rem;

  let result = "";
  if (crore > 0) {
    result += (crore < 100 ? convertTwoDigits(crore) : convertThreeDigits(crore)) + " Crore ";
  }
  if (lakh > 0) {
    result += convertTwoDigits(lakh) + " Lakh ";
  }
  if (thousand > 0) {
    result += convertTwoDigits(thousand) + " Thousand ";
  }
  if (hundred > 0) {
    result += convertThreeDigits(hundred) + " ";
  }

  const rupeeStr = result.trim() ? `${result.trim()} Rupees` : "Zero Rupees";

  const decimal = Math.round((Math.abs(num) - n) * 100);
  if (decimal > 0) {
    return `${rupeeStr} and ${convertTwoDigits(decimal)} Paise Only`;
  }

  return `${rupeeStr} Only`;
}

export async function buildPerformaInvoicePdf(
  input: BuildPerformaInvoicePdfInput,
): Promise<JsPDF> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const { letterhead, company } = input;
  const logoDataUrl = await loadPdfLogo(letterhead.logoUrl || company?.logo_url);

  const companyName =
    company?.trade_name ||
    company?.legal_name ||
    letterhead.companyName ||
    "";
  const companyAddress = letterhead.addressLine || company?.address || "";
  const companyPhone = letterhead.phone || company?.phone || "";
  const companyEmail = letterhead.email || company?.email || "";
  const companyGstin = letterhead.gstin || company?.gstin || "";

  const bankName = company?.bank_name || "";
  const accountName =
    company?.account_name ||
    company?.trade_name ||
    company?.legal_name ||
    "";
  const accountNumber = company?.account_number || "";
  const ifscCode = company?.ifsc_code || "";
  const branchName = company?.branch_name || "";

  const pName = input.partyName ? input.partyName.trim() : "";
  const customerName =
    pName && pName !== "—"
      ? pName.startsWith("M/s")
        ? pName
        : `M/s. ${pName}`
      : pName || "—";
  const proformaNo =
    input.proformaNo ||
    (input.orderNo.startsWith("PINV")
      ? input.orderNo
      : `PINV-QT-${input.orderNo.replace(/^ORD-?/i, "")}`);
  const invoiceDateStr = formatDate(input.orderDate || new Date());
  const poNumber = input.poNumber || "Verbal";
  const poDateStr = formatDate(input.poDate || input.orderDate || new Date());
  const approvedBy = input.approvedBy || "N?A";
  const approvedDateStr = formatDate(input.approvedDate || input.orderDate || new Date());

  let currentY = M;

  // -------------------------------------------------------------
  // 1. Company Letterhead Header (Top of Page)
  // -------------------------------------------------------------
  const drawHeader = () => {
    const headerTop = currentY;

    // Optional Logo on Top Left with Aspect-Ratio preservation to prevent collapse/distortion
    const logoMaxW = 38;
    const logoMaxH = 16;
    let logoW = 0;
    let logoH = 0;

    if (logoDataUrl) {
      try {
        const props = pdf.getImageProperties(logoDataUrl);
        const pw = Number(props?.width) || 0;
        const ph = Number(props?.height) || 0;
        if (pw > 0 && ph > 0) {
          const aspect = pw / ph;
          logoW = logoMaxW;
          logoH = logoW / aspect;
          if (logoH > logoMaxH) {
            logoH = logoMaxH;
            logoW = logoH * aspect;
          }
        } else {
          logoW = logoMaxW;
          logoH = logoMaxH;
        }
      } catch {
        logoW = logoMaxW;
        logoH = logoMaxH;
      }

      const format = /image\/jpe?g/i.test(logoDataUrl)
        ? "JPEG"
        : /image\/webp/i.test(logoDataUrl)
          ? "WEBP"
          : "PNG";

      const logoY = headerTop + Math.max(0, (logoMaxH - logoH) / 2);
      try {
        pdf.addImage(logoDataUrl, format, M, logoY, logoW, logoH, undefined, "FAST");
      } catch {
        try {
          pdf.addImage(logoDataUrl, "PNG", M, logoY, logoW, logoH, undefined, "FAST");
        } catch {
          /* ignore */
        }
      }
    }

    // Right Badge: PROFORMA INVOICE
    const badgeW = 38;
    const badgeH = 11;
    const badgeX = PAGE_W - M - badgeW;
    pdf.setFillColor(...ACCENT_BG);
    pdf.setDrawColor(191, 219, 254);
    pdf.setLineWidth(0.3);
    pdf.rect(badgeX, headerTop, badgeW, badgeH, "FD");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...NAVY);
    pdf.text("PROFORMA INVOICE", badgeX + badgeW / 2, headerTop + 4.5, { align: "center" });

    pdf.setFontSize(7);
    pdf.setTextColor(...BLUE);
    pdf.text(proformaNo, badgeX + badgeW / 2, headerTop + 8.5, { align: "center" });

    // Safe boundaries: ensure centered text never collides with left logo or right badge
    const leftLimit = logoW > 0 ? M + logoW + 3 : M + 3;
    const rightLimit = badgeX - 3;
    const halfAvailable = Math.min(PAGE_W / 2 - leftLimit, rightLimit - PAGE_W / 2);
    const maxCenterTextW = Math.max(65, Math.min(104, Math.floor(halfAvailable * 2)));

    // Company Name (Wrapped & dynamically sized to avoid overlap)
    const compNameUpper = companyName.toUpperCase();
    const nameFontSize = compNameUpper.length > 55 ? 9.5 : compNameUpper.length > 35 ? 10.5 : 12;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(nameFontSize);
    pdf.setTextColor(...NAVY);

    const companyLines = pdf.splitTextToSize(compNameUpper, maxCenterTextW) as string[];
    let infoY = headerTop + (nameFontSize >= 12 ? 4 : 3.5);
    companyLines.forEach((line: string) => {
      pdf.text(line, PAGE_W / 2, infoY, { align: "center" });
      infoY += nameFontSize >= 12 ? 4.2 : 3.7;
    });

    // Company Address (Wrapped strictly within maxCenterTextW)
    if (companyAddress) {
      pdf.setFontSize(6.8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...TEXT);
      const addrPrefix = companyAddress.toLowerCase().startsWith("regd") ? "" : "Regd. Off: ";
      const splitAddr = pdf.splitTextToSize(`${addrPrefix}${companyAddress}`, maxCenterTextW) as string[];
      splitAddr.forEach((line: string) => {
        pdf.text(line, PAGE_W / 2, infoY, { align: "center" });
        infoY += 3.1;
      });
      infoY += 0.5;
    }

    // Company Contact Details (Wrapped strictly within maxCenterTextW)
    const contactParts: string[] = [];
    if (companyPhone) contactParts.push(`Phone: ${companyPhone}`);
    if (companyEmail) contactParts.push(`Email: ${companyEmail}`);
    if (companyGstin) contactParts.push(`GSTIN: ${companyGstin}`);
    const companyWebsite = letterhead.website || company?.website || "";
    if (companyWebsite) contactParts.push(companyWebsite);

    if (contactParts.length > 0) {
      pdf.setFontSize(6.5);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...MUTED);
      const contactText = contactParts.join("  |  ");
      const contactLines = pdf.splitTextToSize(contactText, maxCenterTextW) as string[];
      contactLines.forEach((line: string) => {
        pdf.text(line, PAGE_W / 2, infoY, { align: "center" });
        infoY += 3.1;
      });
    }

    const headerMinBottom = headerTop + Math.max(logoH || 16, badgeH, 16);
    currentY = Math.max(headerMinBottom, infoY) + 2.5;
    pdf.setDrawColor(...NAVY);
    pdf.setLineWidth(0.6);
    pdf.line(M, currentY, PAGE_W - M, currentY);
    currentY += 3.5;
  };

  // -------------------------------------------------------------
  // 2. Title & Document Meta Box
  // Matches exact layout: Left = Buyer & PROFORMA INVOICE; Right = Pro Invoice No & Dates
  // -------------------------------------------------------------
  const drawMetaBox = () => {
    const boxX = M;
    const boxW = CONTENT_W; // 190 mm
    const col1W = 105;
    const col2W = boxW - col1W; // 85 mm

    // Left Column items
    const leftLines: Array<{ label?: string; val: string; bold?: boolean; isTitle?: boolean }> = [
      { val: "PROFORMA INVOICE", bold: true, isTitle: true },
      { val: customerName, bold: true },
    ];
    if (input.billingAddress) leftLines.push({ val: input.billingAddress });
    if (input.partyGstin) leftLines.push({ label: "GSTIN : ", val: input.partyGstin });
    if (input.contactPerson) leftLines.push({ label: "Contact Person : ", val: input.contactPerson, bold: true });
    if (input.partyPhone) leftLines.push({ label: "Tel. : ", val: input.partyPhone });
    if (input.partyMobile && input.partyMobile !== input.partyPhone) {
      leftLines.push({ label: "Cell : ", val: input.partyMobile });
    } else if (input.partyMobile && !input.partyPhone) {
      leftLines.push({ label: "Cell : ", val: input.partyMobile });
    }
    if (input.partyEmail) leftLines.push({ label: "E-mail : ", val: input.partyEmail });

    // Right Column items
    const rightLines: Array<{ label: string; val: string; boldVal?: boolean; colorVal?: [number, number, number] }> = [
      { label: "Pro. Invoice No. : ", val: proformaNo, boldVal: true, colorVal: BLUE },
      { label: "Invoice Date. : ", val: invoiceDateStr, boldVal: true },
      { label: "PO No. : ", val: poNumber },
      { label: "PO Date. : ", val: poDateStr },
      { label: "Approved By : ", val: approvedBy },
      { label: "Approved Date. : ", val: approvedDateStr },
    ];

    // Measure Height
    let leftH = 0;
    leftLines.forEach((l) => {
      pdf.setFontSize(l.isTitle ? 11 : 7.5);
      const text = l.label ? `${l.label}${l.val}` : l.val;
      const split = pdf.splitTextToSize(text, col1W - 8);
      leftH += split.length * 3.6 + 0.6;
    });

    const rightH = rightLines.length * 4.4;
    const boxH = Math.max(leftH, rightH) + 6;

    // Draw box background and borders
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(...BORDER_COLOR);
    pdf.setLineWidth(0.3);
    pdf.rect(boxX, currentY, boxW, boxH, "FD");

    // Divider Line between columns
    pdf.line(boxX + col1W, currentY, boxX + col1W, currentY + boxH);

    // Render Left Column
    let ly = currentY + 4.5;
    leftLines.forEach((l) => {
      if (l.isTitle) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(...NAVY);
        pdf.text(l.val, boxX + 3.5, ly);
        ly += 4.5;
      } else if (l.label) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        pdf.setTextColor(...DARK);
        pdf.text(l.label, boxX + 3.5, ly);
        const lw = pdf.getTextWidth(l.label);

        pdf.setFont("helvetica", l.bold ? "bold" : "normal");
        pdf.setTextColor(...DARK);
        const valSplit = pdf.splitTextToSize(l.val, col1W - 7 - lw);
        pdf.text(valSplit, boxX + 3.5 + lw, ly);
        ly += valSplit.length * 3.6 + 0.5;
      } else {
        pdf.setFont("helvetica", l.bold ? "bold" : "normal");
        pdf.setFontSize(7.5);
        pdf.setTextColor(...DARK);
        const split = pdf.splitTextToSize(l.val, col1W - 7);
        pdf.text(split, boxX + 3.5, ly);
        ly += split.length * 3.6 + 0.5;
      }
    });

    // Render Right Column
    let ry = currentY + 4.5;
    rightLines.forEach((r) => {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...DARK);
      pdf.text(r.label, boxX + col1W + 4, ry);

      const labelW = pdf.getTextWidth(r.label);
      pdf.setFont("helvetica", r.boldVal ? "bold" : "normal");
      pdf.setTextColor(...(r.colorVal || DARK));
      pdf.text(r.val, boxX + col1W + 4 + labelW, ry);
      ry += 4.4;
    });

    currentY += boxH + 3.5;
  };

  // -------------------------------------------------------------
  // 3. Goods & Commercial Pricing Table
  // Columns: Sr.(8) | Description of Goods(58) | HSN/SAC(17) | QTY(11) | Rate(21) | Sub Total(22) | Tax %(11) | Tax Amt(18) | Total(24) = 190 mm
  // -------------------------------------------------------------
  const drawItemsTable = () => {
    const tableX = M;
    const tableW = CONTENT_W;

    const cols = [
      { header: "Sr.", w: 8, align: "center" as const },
      { header: "Description of Goods", w: 58, align: "left" as const },
      { header: "HSN/SAC", w: 17, align: "center" as const },
      { header: "QTY", w: 11, align: "center" as const },
      { header: "Rate", w: 21, align: "right" as const },
      { header: "Sub Total", w: 22, align: "right" as const },
      { header: "Tax %", w: 11, align: "center" as const },
      { header: "Tax Amt", w: 18, align: "right" as const },
      { header: "Total", w: 24, align: "right" as const },
    ];

    // Header row
    const headerH = 6.4;
    pdf.setFillColor(...NAVY);
    pdf.rect(tableX, currentY, tableW, headerH, "F");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.2);
    pdf.setTextColor(255, 255, 255);

    let curX = tableX;
    cols.forEach((col) => {
      let tx = curX + 1.5;
      if (col.align === "center") tx = curX + col.w / 2;
      if (col.align === "right") tx = curX + col.w - 1.5;
      pdf.text(col.header, tx, currentY + 4.2, { align: col.align });
      curX += col.w;
    });

    currentY += headerH;

    // Body rows
    input.items.forEach((it, idx) => {
      const qty = Number(it.quantity || 1);
      const rate = Number(it.unitPrice || 0);
      const subtotal = Number(it.taxableAmount || qty * rate);
      const gstRate = Number(it.gstPercent || 0);
      const gstAmt = Number(it.gstAmount || (subtotal * gstRate) / 100);
      const total = Number(it.lineTotal || subtotal + gstAmt);

      const descLines = pdf.splitTextToSize(
        it.description ? `${it.productName}\n${it.description}` : it.productName,
        cols[1].w - 3,
      );
      const rowH = Math.max(6.5, descLines.length * 3.4 + 3);

      // Page break check
      if (currentY + rowH > PAGE_H - 75) {
        pdf.addPage();
        currentY = M;
        drawHeader();
      }

      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(...BORDER_COLOR);
      pdf.setLineWidth(0.2);
      pdf.rect(tableX, currentY, tableW, rowH, "FD");

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(...DARK);

      let cx = tableX;

      // Col 0: Sr.
      pdf.text(String(idx + 1), cx + cols[0].w / 2, currentY + 4.2, { align: "center" });
      cx += cols[0].w;

      // Col 1: Description of Goods
      pdf.setFont("helvetica", "bold");
      pdf.text(descLines[0] || "", cx + 1.5, currentY + 4);
      if (descLines.length > 1) {
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...MUTED);
        for (let l = 1; l < descLines.length; l++) {
          pdf.text(descLines[l], cx + 1.5, currentY + 4 + l * 3.3);
        }
      }
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...DARK);
      cx += cols[1].w;

      // Col 2: HSN/SAC
      pdf.text(it.hsnCode || "85044040", cx + cols[2].w / 2, currentY + 4.2, { align: "center" });
      cx += cols[2].w;

      // Col 3: QTY
      pdf.text(String(qty), cx + cols[3].w / 2, currentY + 4.2, { align: "center" });
      cx += cols[3].w;

      // Col 4: Rate
      pdf.text(formatCurrency(rate), cx + cols[4].w - 1.5, currentY + 4.2, { align: "right" });
      cx += cols[4].w;

      // Col 5: Sub Total
      pdf.text(formatCurrency(subtotal), cx + cols[5].w - 1.5, currentY + 4.2, { align: "right" });
      cx += cols[5].w;

      // Col 6: Tax %
      pdf.text(`${gstRate}%`, cx + cols[6].w / 2, currentY + 4.2, { align: "center" });
      cx += cols[6].w;

      // Col 7: Tax Amt
      pdf.text(formatCurrency(gstAmt), cx + cols[7].w - 1.5, currentY + 4.2, { align: "right" });
      cx += cols[7].w;

      // Col 8: Total
      pdf.setFont("helvetica", "bold");
      pdf.text(formatCurrency(total), cx + cols[8].w - 1.5, currentY + 4.2, { align: "right" });

      currentY += rowH;
    });

    // Totals Line (under table)
    const sumH = 6.4;
    pdf.setFillColor(...ACCENT_BG);
    pdf.setDrawColor(...BORDER_COLOR);
    pdf.rect(tableX, currentY, tableW, sumH, "FD");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...NAVY);

    const labelEnd = tableX + cols[0].w + cols[1].w + cols[2].w + cols[3].w + cols[4].w;
    pdf.text("Total", labelEnd - 2, currentY + 4.3, { align: "right" });

    // Subtotal (Col 5)
    let cx = labelEnd;
    pdf.text(formatCurrency(input.taxableAmount || input.subtotal), cx + cols[5].w - 1.5, currentY + 4.3, {
      align: "right",
    });

    // Tax Amt Total (Col 7)
    cx += cols[5].w + cols[6].w;
    pdf.text(formatCurrency(input.gstAmount), cx + cols[7].w - 1.5, currentY + 4.3, { align: "right" });

    // Total (Col 8)
    cx += cols[7].w;
    pdf.setTextColor(...BLUE);
    pdf.text(formatCurrency(input.grandTotal), cx + cols[8].w - 1.5, currentY + 4.3, { align: "right" });

    currentY += sumH + 2.5;

    // -------------------------------------------------------------
    // 4. Total GST, Grand Total & Amount in words (Strip Box)
    // -------------------------------------------------------------
    const words = numberToIndianWords(input.grandTotal);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.2);
    const wrappedWords = pdf.splitTextToSize(words, tableW - 35);
    const barH = Math.max(12, 6 + wrappedWords.length * 3.4);

    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(...BORDER_COLOR);
    pdf.rect(tableX, currentY, tableW, barH, "FD");

    // Line 1: Total GST & Grand Total
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...NAVY);
    pdf.text("Total GST : ", tableX + 3.5, currentY + 4.2);
    const tgstW = pdf.getTextWidth("Total GST : ");
    pdf.setTextColor(...DARK);
    pdf.text(`Rs. ${formatCurrency(input.gstAmount)}`, tableX + 3.5 + tgstW, currentY + 4.2);

    pdf.setTextColor(...NAVY);
    pdf.text("Grand Total : ", tableX + 65, currentY + 4.2);
    const gtW = pdf.getTextWidth("Grand Total : ");
    pdf.setTextColor(...BLUE);
    pdf.text(`Rs. ${formatCurrency(input.grandTotal)}`, tableX + 65 + gtW, currentY + 4.2);

    // Line 2: Amount in words
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.2);
    pdf.setTextColor(...DARK);
    pdf.text("Amount in words : ", tableX + 3.5, currentY + 8.5);
    const aiwW = pdf.getTextWidth("Amount in words : ");

    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...NAVY);
    pdf.text(wrappedWords, tableX + 3.5 + aiwW, currentY + 8.5);

    currentY += barH + 3.5;
  };

  // -------------------------------------------------------------
  // 5. Order Details (2-Column Grid)
  // -------------------------------------------------------------
  const drawOrderDetails = () => {
    const boxX = M;
    const boxW = CONTENT_W;
    const colW = boxW / 2;

    const leftRows = [
      { label: "Sales Person", val: input.salesPerson || "N/A" },
      { label: "ORC", val: input.orc || "na" },
      { label: "Dispatch Date", val: formatDate(input.dispatchDate || input.orderDate) },
      { label: "Payment Terms", val: input.paymentTerms || "30 days" },
      { label: "Installation Required", val: input.installationRequired || "Yes" },
      { label: "Margin Sheet Attached", val: input.marginSheetAttached || "Attached" },
    ];

    const rightRows = [
      { label: "Freight Charges", val: input.freightCharges || "Included" },
      { label: "Transport", val: input.transport || "To be arranged / SafeXpress" },
      { label: "Ship to Address", val: input.shippingAddress || "same as billing" },
      { label: "Customer Type", val: input.customerType || "Dealer" },
      { label: "GST Concession", val: input.gstConcession || "na" },
      { label: "KYC", val: input.kycStatus || "na" },
    ];

    const rowCount = Math.max(leftRows.length, rightRows.length);
    const boxH = rowCount * 4.2 + 7.5;

    // Header bar
    pdf.setFillColor(...ACCENT_BG);
    pdf.setDrawColor(...BORDER_COLOR);
    pdf.rect(boxX, currentY, boxW, 5.2, "FD");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.2);
    pdf.setTextColor(...NAVY);
    pdf.text("Order Details:", boxX + 3.5, currentY + 3.7);

    // Body container
    pdf.setFillColor(255, 255, 255);
    pdf.rect(boxX, currentY + 5.2, boxW, boxH - 5.2, "FD");
    pdf.line(boxX + colW, currentY + 5.2, boxX + colW, currentY + boxH);

    let ry = currentY + 9;
    for (let i = 0; i < rowCount; i++) {
      // Left
      const lr = leftRows[i];
      if (lr) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(6.8);
        pdf.setTextColor(...DARK);
        pdf.text(lr.label, boxX + 3.5, ry);

        pdf.setFont("helvetica", "normal");
        const maxValW = colW - 36;
        const valText = pdf.splitTextToSize(lr.val, maxValW)[0] || "";
        pdf.text(`: ${valText}`, boxX + 33, ry);
      }

      // Right
      const rr = rightRows[i];
      if (rr) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(6.8);
        pdf.setTextColor(...DARK);
        pdf.text(rr.label, boxX + colW + 3.5, ry);

        pdf.setFont("helvetica", "normal");
        const maxValW = colW - 36;
        const valText = pdf.splitTextToSize(rr.val, maxValW)[0] || "";
        pdf.text(`: ${valText}`, boxX + colW + 33, ry);
      }

      ry += 4.2;
    }

    currentY += boxH + 3.5;
  };

  // -------------------------------------------------------------
  // 6. Bottom Sign-Off: Company Banking Details & Order Acceptance
  // -------------------------------------------------------------
  const drawSignOff = () => {
    const boxX = M;
    const boxW = CONTENT_W;
    const colW = boxW / 2;
    const boxH = 26;

    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(...BORDER_COLOR);
    pdf.rect(boxX, currentY, boxW, boxH, "FD");
    pdf.line(boxX + colW, currentY, boxX + colW, currentY + boxH);

    // Left: Company Banking Coordinates
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.2);
    pdf.setTextColor(...NAVY);
    pdf.text("Company Banking Details (for Advance Transfer):", boxX + 3.5, currentY + 4.2);

    let by = currentY + 8;
    const bankPairs = [
      { label: "Bank Name : ", val: bankName },
      { label: "A/C Name : ", val: accountName },
      { label: "A/C No. : ", val: accountNumber, isBlue: true },
      { label: "IFSC Code : ", val: ifscCode },
      { label: "Branch : ", val: branchName },
    ];

    pdf.setFontSize(6.6);
    bankPairs.forEach((bp) => {
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...DARK);
      pdf.text(bp.label, boxX + 3.5, by);

      const lw = pdf.getTextWidth(bp.label);
      pdf.setFont("helvetica", bp.isBlue ? "bold" : "normal");
      pdf.setTextColor(...(bp.isBlue ? BLUE : DARK));
      pdf.text(bp.val, boxX + 3.5 + lw, by);
      by += 3.6;
    });

    // Right: Order Acceptance & Signatory
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.2);
    pdf.setTextColor(...NAVY);
    pdf.text("Order Acceptance,", boxX + colW + 3.5, currentY + 4.2);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.2);
    pdf.setTextColor(...DARK);
    pdf.text(customerName, boxX + colW + 3.5, currentY + 8.5);

    // Signature line
    pdf.setDrawColor(...BORDER_COLOR);
    pdf.line(boxX + colW + 3.5, currentY + 20, boxX + boxW - 3.5, currentY + 20);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.5);
    pdf.setTextColor(...MUTED);
    pdf.text("Authorised Signatory ( Name / Company Seal )", boxX + colW + 3.5, currentY + 23.5);

    currentY += boxH + 4;
  };

  // -------------------------------------------------------------
  // 5b. Customer Copy: Terms and Conditions, Bank Details & Signatories
  // Replaces internal Order Details grid in Customer Copy.
  // -------------------------------------------------------------
  const drawCustomerTermsAndSignOff = () => {
    // Check if remaining space is sufficient on page
    if (currentY + 75 > PAGE_H - 10) {
      pdf.addPage();
      currentY = M;
      drawHeader();
    }

    const boxX = M;
    const boxW = CONTENT_W;
    const colW = boxW / 2;

    // 1. Terms and Condition:
    const termsList =
      input.termsAndConditions && input.termsAndConditions.length > 0
        ? input.termsAndConditions
        : [
          `Payment ${input.paymentTerms || "Advance against Supplies"}`,
          "Delivery Terms as per Customer PO",
          "Warranty Terms as agreed on Purchase",
        ];

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...DARK);
    pdf.text("Terms and Condition:", boxX, currentY);
    const tcWidth = pdf.getTextWidth("Terms and Condition:");
    pdf.setDrawColor(...DARK);
    pdf.setLineWidth(0.2);
    pdf.line(boxX, currentY + 0.8, boxX + tcWidth, currentY + 0.8);
    currentY += 4.5;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...DARK);

    termsList.forEach((term, idx) => {
      const termLine = `${idx + 1}. ${term}`;
      const splitLines = pdf.splitTextToSize(termLine, boxW - 8) as string[];
      splitLines.forEach((line) => {
        pdf.text(line, boxX + 4, currentY);
        currentY += 3.6;
      });
    });

    currentY += 3.5;

    // 2. BANK DETAILS
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...DARK);
    pdf.text("BANK DETAILS", boxX, currentY);
    currentY += 4.2;

    const fullBankBranch = [bankName, branchName, company?.city]
      .filter(Boolean)
      .join(", ");

    const bankDetailsList = [
      { label: "Beneficiary Name - ", val: accountName },
      { label: "Beneficiary Account No. - ", val: accountNumber },
      { label: "Beneficiary Bank Name - ", val: fullBankBranch || bankName },
      { label: "IFSC Code: ", val: ifscCode },
    ];

    pdf.setFontSize(6.8);
    bankDetailsList.forEach((b) => {
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...DARK);
      pdf.text(b.label, boxX, currentY);

      const lw = pdf.getTextWidth(b.label);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...DARK);
      pdf.text(b.val, boxX + lw, currentY);
      currentY += 3.6;
    });

    currentY += 5;

    // 3. Two-Column Signatories
    // Left: For {Company Name}, sales person name as signatory & contact details, company contacts
    // Right: Order Acceptance, {Customer Name}, Authorised Signatory
    const signTopY = currentY;

    // Left Column
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.8);
    pdf.setTextColor(...DARK);
    pdf.text(`For ${companyName.toUpperCase()}`, boxX, currentY);
    currentY += 5.5;

    // Sales Person Name (uppercase bold)
    const spName = (input.salesPerson || "").toUpperCase();
    if (spName) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(...DARK);
      pdf.text(spName, boxX, currentY);
      currentY += 4.5;
    }

    // Sales Person Designation
    if (input.salesPersonDesignation) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(...DARK);
      pdf.text(input.salesPersonDesignation, boxX, currentY);
      currentY += 3.6;
    }

    // Sales Person Phone
    if (input.salesPersonPhone) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(...DARK);
      pdf.text(input.salesPersonPhone, boxX, currentY);
      currentY += 3.6;
    }

    // Sales Person Email
    if (input.salesPersonEmail) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(...DARK);
      pdf.text(input.salesPersonEmail, boxX, currentY);
      currentY += 3.6;
    }

    // Company Contacts (website / email / phone) below
    const compWeb = input.companyWebsite || company?.website || letterhead.website;
    if (compWeb) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(...BLUE);
      pdf.text(compWeb, boxX, currentY);
      currentY += 3.6;
    }

    const leftFinalY = currentY;

    // Right Column: Order Acceptance
    let rightY = signTopY;
    const rightX = boxX + colW + 20;
    const rightMaxW = boxW - (colW + 20);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...DARK);
    pdf.text("Order Acceptance,", rightX, rightY);
    rightY += 4.5;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...DARK);
    const splitCust = pdf.splitTextToSize(customerName, rightMaxW) as string[];
    splitCust.forEach((l) => {
      pdf.text(l, rightX, rightY);
      rightY += 4;
    });

    rightY += 9; // Space for physical stamp / signature

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...DARK);
    pdf.text("Authorised Signatory", rightX, rightY);
    rightY += 4;

    currentY = Math.max(leftFinalY, rightY) + 4;
  };

  // Render complete document
  drawHeader();
  drawMetaBox();
  drawItemsTable();

  const isCustomerCopy = input.copyType === "customer" || !input.copyType;

  if (isCustomerCopy) {
    drawCustomerTermsAndSignOff();
  } else {
    // Office Copy
    if (currentY + 65 > PAGE_H - 10) {
      pdf.addPage();
      currentY = M;
      drawHeader();
    }
    drawOrderDetails();
    drawSignOff();
  }

  return pdf;
}
