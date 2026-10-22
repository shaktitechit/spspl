/**
 * @fileoverview Pure Vector jsPDF Builder for Quotations.
 * Generates 100% crisp vector PDFs without html2canvas DOM capture or layout shifting.
 * @module components/portal/shared/quotations/buildQuotationPdf
 */

import type { LeadQuotationRecord } from "@/store/api";
import { formatCompanyAddress } from "@/components/portal/shared/pdfCompanyLetterhead";
import { resolvePublicAssetUrl } from "@/lib/env";
import { numberToIndianWords } from "./quotationLineMath";
import { isNonEmptyRichText } from "./RichTextDisplay";

type JsPDF = InstanceType<(typeof import("jspdf"))["jsPDF"]>;

export type QuotationCompanyInfo = {
  trade_name?: string;
  legal_name?: string;
  logo_url?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  ifsc_code?: string;
  branch_name?: string;
  account_type?: string;
  upi_id?: string;
  swift_code?: string;
};

export type BuildQuotationPdfInput = {
  quotation: LeadQuotationRecord;
  company?: QuotationCompanyInfo;
  portalLabel?: string;
  downloadedBy?: string;
  documentType?: "quotation" | "proforma";
};

// Brand Color Palette (RGB)
const NAVY: [number, number, number] = [30, 58, 95];
const BLUE: [number, number, number] = [37, 99, 235];
const DARK: [number, number, number] = [15, 23, 42];
const TEXT: [number, number, number] = [51, 65, 85];
const MUTED: [number, number, number] = [100, 116, 139];
const LINE: [number, number, number] = [203, 213, 225];
const LIGHT_BG: [number, number, number] = [248, 250, 252];
const ACCENT_BG: [number, number, number] = [239, 246, 255];

const PAGE_W = 210;
const PAGE_H = 297;
const M = 10; // 10mm margins
const CONTENT_W = PAGE_W - M * 2; // 190mm

function formatCurrency(amount?: number): string {
  if (amount == null || Number.isNaN(amount)) return "0.00";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  } catch {
    return dateStr;
  }
}

export type LoadedLogo = {
  dataUrl: string;
  width: number;
  height: number;
  format: string;
};

async function loadLogo(url?: string): Promise<LoadedLogo | null> {
  if (!url) return null;
  if (typeof window === "undefined") return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        resolve({
          dataUrl,
          width: img.naturalWidth || 100,
          height: img.naturalHeight || 50,
          format: "PNG",
        });
      } catch {
        // Fallback to fetch/blob if canvas tainted
        fetch(url, { mode: "cors" })
          .then((r) => r.blob())
          .then((blob) => {
            const reader = new FileReader();
            reader.onload = () => {
              const res = String(reader.result || "");
              resolve({
                dataUrl: res,
                width: img.naturalWidth || 100,
                height: img.naturalHeight || 50,
                format: "PNG",
              });
            };
            reader.readAsDataURL(blob);
          })
          .catch(() => resolve(null));
      }
    };
    img.onerror = () => {
      fetch(url, { mode: "cors" })
        .then((r) => r.blob())
        .then((blob) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              dataUrl: String(reader.result || ""),
              width: 120,
              height: 48,
              format: "PNG",
            });
          };
          reader.readAsDataURL(blob);
        })
        .catch(() => resolve(null));
    };
    img.src = url;
  });
}

export type StyleState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough?: boolean;
  color: [number, number, number] | null;
};

export type TextRun = StyleState & {
  text: string;
};

export type TableCell = {
  isHeader?: boolean;
  align?: "left" | "center" | "right";
  text: string;
  runs: TextRun[];
};

export type TableRow = {
  cells: TableCell[];
};

export type BlockNode = {
  type: "paragraph" | "list-item" | "divider" | "table";
  bullet?: string;
  headingLevel?: 1 | 2 | 3;
  runs: TextRun[];
  rows?: TableRow[];
};

export function parseColorToRgb(colorStr: string): [number, number, number] | null {
  if (!colorStr) return null;
  const str = colorStr.trim().toLowerCase();
  if (str.startsWith("rgb")) {
    const match = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (match) {
      return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
    }
  }
  if (str.startsWith("#")) {
    let hex = str.slice(1);
    if (hex.length === 3) {
      hex = hex.split("").map((c) => c + c).join("");
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        return [r, g, b];
      }
    }
  }
  return null;
}

export function extractElementColor(elem: HTMLElement): [number, number, number] | null {
  const colorAttr = elem.getAttribute("color");
  if (colorAttr) {
    const parsed = parseColorToRgb(colorAttr);
    if (parsed) return parsed;
  }
  const styleColor = elem.style.color;
  if (styleColor) {
    const parsed = parseColorToRgb(styleColor);
    if (parsed) return parsed;
  }
  return null;
}

export function parseHtmlToBlocks(htmlString: string): BlockNode[] {
  const cleanHtml = htmlString.replace(/^(\d+[\.\)]\s*)+/, "").trim();
  if (!cleanHtml) return [];

  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    const stripped = cleanHtml.replace(/<[^>]*>/g, "").trim();
    return [{ type: "paragraph", runs: [{ text: stripped, bold: false, italic: false, underline: false, color: null }] }];
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${cleanHtml}</div>`, "text/html");
  const container = doc.body.firstElementChild || doc.body;

  const blocks: BlockNode[] = [];
  let currentParagraph: BlockNode = { type: "paragraph", runs: [] };

  const flushParagraph = () => {
    if (currentParagraph.runs.length > 0) {
      const hasContent = currentParagraph.runs.some((r) => r.text.trim().length > 0);
      if (hasContent) {
        blocks.push(currentParagraph);
      }
      currentParagraph = { type: "paragraph", runs: [] };
    }
  };

  function processInlineChildren(parent: Node, currentStyle: StyleState, targetBlock: BlockNode) {
    for (const child of Array.from(parent.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        let rawText = child.textContent || "";
        if (!rawText) continue;
        rawText = rawText.replace(/\u00A0/g, " ");
        const text = rawText.replace(/[\r\n\t]+/g, " ").replace(/ +/g, " ");
        if (!text) continue;
        if (targetBlock.runs.length === 0 && text === " ") continue;

        targetBlock.runs.push({
          text,
          bold: currentStyle.bold,
          italic: currentStyle.italic,
          underline: currentStyle.underline,
          strikethrough: currentStyle.strikethrough,
          color: currentStyle.color,
        });
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const elem = child as HTMLElement;
        const tag = elem.tagName.toUpperCase();

        const newStyle: StyleState = {
          bold: currentStyle.bold || tag === "B" || tag === "STRONG" || tag === "TH",
          italic: currentStyle.italic || tag === "I" || tag === "EM",
          underline: currentStyle.underline || tag === "U" || tag === "A",
          strikethrough: currentStyle.strikethrough || tag === "STRIKE" || tag === "S" || tag === "DEL",
          color: extractElementColor(elem) || currentStyle.color,
        };

        if (tag === "BR") {
          targetBlock.runs.push({ text: "\n", ...newStyle });
        } else {
          processInlineChildren(elem, newStyle, targetBlock);
        }
      }
    }
  }

  function traverseNode(node: Node, currentStyle: StyleState) {
    if (node.nodeType === Node.TEXT_NODE) {
      let rawText = node.textContent || "";
      if (!rawText) return;
      rawText = rawText.replace(/\u00A0/g, " ");
      const text = rawText.replace(/[\r\n\t]+/g, " ").replace(/ +/g, " ");
      if (!text) return;
      if (currentParagraph.runs.length === 0 && text === " ") return;

      currentParagraph.runs.push({
        text,
        bold: currentStyle.bold,
        italic: currentStyle.italic,
        underline: currentStyle.underline,
        strikethrough: currentStyle.strikethrough,
        color: currentStyle.color,
      });
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const elem = node as HTMLElement;
      const tag = elem.tagName.toUpperCase();

      const newStyle: StyleState = {
        bold: currentStyle.bold || tag === "B" || tag === "STRONG" || tag === "H1" || tag === "H2" || tag === "H3" || tag === "TH",
        italic: currentStyle.italic || tag === "I" || tag === "EM" || tag === "BLOCKQUOTE",
        underline: currentStyle.underline || tag === "U" || tag === "A",
        strikethrough: currentStyle.strikethrough || tag === "STRIKE" || tag === "S" || tag === "DEL",
        color: extractElementColor(elem) || currentStyle.color,
      };

      if (tag === "BR") {
        currentParagraph.runs.push({ text: "\n", ...newStyle });
        return;
      }

      if (tag === "HR") {
        flushParagraph();
        blocks.push({ type: "divider", runs: [] });
        return;
      }

      if (tag === "TABLE") {
        flushParagraph();
        const trElements = Array.from(elem.querySelectorAll("tr"));
        if (trElements.length > 0) {
          const rows: TableRow[] = [];
          for (const tr of trElements) {
            const cellElements = Array.from(tr.querySelectorAll("th, td"));
            if (cellElements.length === 0) continue;
            const cells: TableCell[] = [];
            for (const cell of cellElements) {
              const htmlCell = cell as HTMLElement;
              const isHeader = cell.tagName.toUpperCase() === "TH";
              const alignAttr = (htmlCell.getAttribute("align") || htmlCell.style?.textAlign || "").toLowerCase();
              const align: "left" | "center" | "right" =
                alignAttr === "center" ? "center" : alignAttr === "right" ? "right" : "left";

              const cellBlock: BlockNode = { type: "paragraph", runs: [] };
              processInlineChildren(
                cell,
                {
                  bold: isHeader || currentStyle.bold,
                  italic: currentStyle.italic,
                  underline: currentStyle.underline,
                  color: currentStyle.color,
                },
                cellBlock
              );

              const cellText = (cell.textContent || "").replace(/\u00A0/g, " ").replace(/[\r\n\t]+/g, " ").replace(/ +/g, " ").trim();
              cells.push({
                isHeader,
                align,
                text: cellText,
                runs: cellBlock.runs,
              });
            }
            if (cells.length > 0) {
              rows.push({ cells });
            }
          }
          if (rows.length > 0) {
            blocks.push({
              type: "table",
              runs: [],
              rows,
            });
          }
        }
        return;
      }

      if (
        tag === "P" ||
        tag === "DIV" ||
        tag === "H1" ||
        tag === "H2" ||
        tag === "H3" ||
        tag === "BLOCKQUOTE" ||
        tag === "PRE"
      ) {
        flushParagraph();
        const headingLevel = tag === "H1" ? 1 : tag === "H2" ? 2 : tag === "H3" ? 3 : undefined;
        const block: BlockNode = { type: "paragraph", headingLevel, runs: [] };
        processInlineChildren(elem, newStyle, block);
        if (block.runs.some((r) => r.text.trim().length > 0)) {
          blocks.push(block);
        }
        return;
      }

      if (tag === "UL" || tag === "OL") {
        flushParagraph();
        const isOrdered = tag === "OL";
        let itemIdx = 1;
        for (const child of Array.from(elem.childNodes)) {
          if (child.nodeType === Node.ELEMENT_NODE && (child as HTMLElement).tagName.toUpperCase() === "LI") {
            const liBlock: BlockNode = {
              type: "list-item",
              bullet: isOrdered ? `${itemIdx}. ` : "• ",
              runs: [],
            };
            itemIdx++;
            processInlineChildren(child, newStyle, liBlock);
            if (liBlock.runs.some((r) => r.text.trim().length > 0)) {
              blocks.push(liBlock);
            }
          }
        }
        return;
      }

      for (const child of Array.from(elem.childNodes)) {
        traverseNode(child, newStyle);
      }
    }
  }

  for (const child of Array.from(container.childNodes)) {
    traverseNode(child, { bold: false, italic: false, underline: false, color: null });
  }
  flushParagraph();

  return blocks;
}

/**
 * Builds a vector-based jsPDF document for Quotation.
 */
export async function buildQuotationPdf(input: BuildQuotationPdfInput): Promise<JsPDF> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const { quotation, company, portalLabel = "Lead Manager", downloadedBy } = input;

  const companyName =
    quotation.company_name ||
    company?.trade_name ||
    company?.legal_name ||
    "";

  const resolvedPortalLabel = portalLabel || "Lead Manager";

  const companyAddress = formatCompanyAddress(company as any, quotation.company_regd_address);

  const companyPhone = quotation.company_phone || company?.phone || "";
  const companyEmail = quotation.company_email || company?.email || "";
  const companyGstin = quotation.company_gstin || company?.gstin || "";

  const contactLine = [
    companyPhone ? `Phone: ${companyPhone}` : "",
    companyEmail ? `Email: ${companyEmail}` : "",
    companyGstin ? `GSTIN: ${companyGstin}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  const customerName = quotation.customer_name
    ? quotation.customer_name.startsWith("M/s")
      ? quotation.customer_name
      : `M/s. ${quotation.customer_name}`
    : "";

  const customerAddress = quotation.address
    ? [
      quotation.address.address_line_1,
      quotation.address.city,
      quotation.address.state,
      quotation.address.pincode,
    ]
      .filter(Boolean)
      .join(", ")
    : "";

  const refNumber = quotation.ref_no || quotation.quotation_no || "";
  const quotationDate = formatDate(quotation.quotation_date);

  const logoRaw = company?.logo_url || (quotation as any)?.company_logo || (quotation as any)?.logo_url || "";
  const logoUrl = logoRaw ? resolvePublicAssetUrl(logoRaw) : "";
  const logoData = await loadLogo(logoUrl);

  let currentY = M;

  // Helper: Draw Header & Brand
  const drawHeader = () => {
    const logoY = currentY;
    const maxLogoW = 44; // increased from 28mm (significantly larger logo)
    const maxLogoH = 18; // increased from 12mm (significantly larger logo)
    let logoW = maxLogoW;
    let logoH = maxLogoH;

    if (logoData && logoData.width && logoData.height) {
      const aspect = logoData.width / logoData.height;
      logoW = maxLogoW;
      logoH = logoW / aspect;
      if (logoH > maxLogoH) {
        logoH = maxLogoH;
        logoW = logoH * aspect;
      }
    }

    if (logoData) {
      try {
        pdf.addImage(logoData.dataUrl, logoData.format, M, logoY, logoW, logoH, undefined, "FAST");
      } catch {
        try {
          pdf.addImage(logoData.dataUrl, M, logoY, logoW, logoH);
        } catch {
          // Fallback gracefully
        }
      }
    }

    let hY = currentY + 3.5;

    // Center content safe area: Page is 210mm wide, M=10.
    // Safe text width prevents long company name from overlapping logo or right edge.
    const maxCenterTextW = 108;

    if (companyName) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12.5);
      pdf.setTextColor(...NAVY);
      const companyLines = pdf.splitTextToSize(companyName.toUpperCase(), maxCenterTextW);
      companyLines.forEach((line: string) => {
        pdf.text(line, PAGE_W / 2, hY, { align: "center" });
        hY += 4.5;
      });
    }

    if (companyAddress) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.8);
      pdf.setTextColor(...TEXT);
      const fullAddressStr = `Regd. Off: ${companyAddress}`;
      const splitAddr = pdf.splitTextToSize(fullAddressStr, maxCenterTextW + 10);
      splitAddr.forEach((line: string) => {
        pdf.text(line, PAGE_W / 2, hY, { align: "center" });
        hY += 3.4;
      });
    }

    const contactParts = [
      companyPhone ? `Tel: ${companyPhone}` : "",
      companyEmail ? `Email: ${companyEmail}` : "",
      companyGstin ? `GSTIN: ${companyGstin}` : "",
    ].filter(Boolean);

    if (contactParts.length > 0) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.8);
      pdf.setTextColor(...MUTED);
      const contactStr = contactParts.join("  •  ");
      const splitContact = pdf.splitTextToSize(contactStr, maxCenterTextW + 10);
      splitContact.forEach((line: string) => {
        pdf.text(line, PAGE_W / 2, hY, { align: "center" });
        hY += 3.4;
      });
    }

    currentY = Math.max(hY + 2, logoY + logoH + 2, currentY + 16);
    pdf.setDrawColor(...NAVY);
    pdf.setLineWidth(0.5);
    pdf.line(M, currentY, PAGE_W - M, currentY);

    currentY += 4;
  };

  // Helper: Draw Quotation / Proforma Title & Ref Bar
  const drawTitleBar = () => {
    const isProforma = input.documentType === "proforma";
    const docTitle = isProforma ? "PROFORMA INVOICE" : "QUOTATION";
    const refLabel = isProforma ? "PI Ref. No. :" : "Ref. No. :";

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(...NAVY);
    pdf.text(docTitle, M, currentY + 3);

    pdf.setFontSize(7.5);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...TEXT);
    pdf.text(refLabel, PAGE_W - M - 30, currentY + 1, { align: "right" });
    pdf.setTextColor(...BLUE);
    pdf.text(refNumber, PAGE_W - M, currentY + 1, { align: "right" });

    if (quotationDate) {
      pdf.setTextColor(...TEXT);
      pdf.text("Date :", PAGE_W - M - 30, currentY + 4.5, { align: "right" });
      pdf.setFont("helvetica", "normal");
      pdf.text(quotationDate, PAGE_W - M, currentY + 4.5, { align: "right" });
    }

    currentY += 7;
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.3);
    pdf.line(M, currentY, PAGE_W - M, currentY);
    currentY += 3;
  };

  // Helper: Draw Customer & Proposal Box
  const drawCustomerBox = () => {
    const boxX = M;
    const boxW = CONTENT_W;
    const col1W = 105;
    const col2W = boxW - col1W;

    const leftLines: Array<{ label?: string; val: string; bold?: boolean; color?: [number, number, number] }> = [];
    if (customerName) {
      leftLines.push({ val: customerName, bold: true, color: DARK });
    }
    if (customerAddress) {
      leftLines.push({ val: customerAddress, bold: false, color: TEXT });
    }
    if (quotation.gstin) {
      leftLines.push({ label: "GSTIN: ", val: quotation.gstin });
    }
    if (quotation.phone) {
      leftLines.push({ label: "Tel: ", val: quotation.phone });
    }
    if (quotation.cell) {
      leftLines.push({ label: "Cell: ", val: quotation.cell });
    }
    if (quotation.email) {
      leftLines.push({ label: "E-mail: ", val: quotation.email });
    }

    const rightLines: Array<{ label: string; val: string; bold?: boolean; color?: [number, number, number] }> = [];
    if (quotation.kind_attn) {
      rightLines.push({ label: "Kind Attn : ", val: quotation.kind_attn, bold: true });
    }
    if (quotation.subject) {
      rightLines.push({ label: "Sub. : ", val: quotation.subject, bold: true, color: NAVY });
    }

    let leftCalcH = 4;
    for (const line of leftLines) {
      pdf.setFont("helvetica", line.bold ? "bold" : "normal");
      pdf.setFontSize(line.bold ? 8 : 6.8);
      const fullText = line.label ? `${line.label}${line.val}` : line.val;
      const wrapped = pdf.splitTextToSize(fullText, col1W - 6);
      leftCalcH += wrapped.length * 3.2;
    }

    let rightCalcH = 4;
    for (const line of rightLines) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      const labelW = pdf.getTextWidth(line.label);
      pdf.setFont("helvetica", line.bold ? "bold" : "normal");
      const wrapped = pdf.splitTextToSize(line.val, col2W - labelW - 6);
      rightCalcH += wrapped.length * 3.6 + 1;
    }

    const boxH = Math.max(leftCalcH + 2, rightCalcH + 2, 18);

    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.3);
    pdf.rect(boxX, currentY, boxW, boxH, "FD");

    pdf.line(boxX + col1W, currentY, boxX + col1W, currentY + boxH);

    let y = currentY + 4;
    for (const line of leftLines) {
      pdf.setFont("helvetica", line.bold ? "bold" : "normal");
      pdf.setFontSize(line.bold ? 8 : 6.8);
      pdf.setTextColor(...(line.color || TEXT));
      const fullText = line.label ? `${line.label}${line.val}` : line.val;
      const wrapped = pdf.splitTextToSize(fullText, col1W - 6);
      pdf.text(wrapped, boxX + 3, y);
      y += wrapped.length * 3.2;
    }

    y = currentY + 4;
    for (const line of rightLines) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.setTextColor(...TEXT);
      pdf.text(line.label, boxX + col1W + 3, y);
      const labelW = pdf.getTextWidth(line.label);

      pdf.setFont("helvetica", line.bold ? "bold" : "normal");
      pdf.setTextColor(...(line.color || DARK));
      const wrapped = pdf.splitTextToSize(line.val, col2W - labelW - 6);
      pdf.text(wrapped, boxX + col1W + 3 + labelW, y);
      y += wrapped.length * 3.6 + 1;
    }

    currentY += boxH + 4;
  };

  drawHeader();
  drawTitleBar();
  drawCustomerBox();

  const cols = [
    { key: "sr", label: "Sr.", w: 8, align: "center" as const },
    { key: "desc", label: "Description of Goods", w: 54, align: "left" as const },
    { key: "hsn", label: "HSN/SAC", w: 16, align: "center" as const },
    { key: "qty", label: "QTY", w: 14, align: "center" as const },
    { key: "rate", label: "Rate (Rs.)", w: 20, align: "right" as const },
    { key: "sub", label: "Sub Total", w: 22, align: "right" as const },
    { key: "gstRate", label: "GST %", w: 14, align: "center" as const },
    { key: "gstAmt", label: "GST Amt", w: 18, align: "right" as const },
    { key: "total", label: "Total (Rs.)", w: 24, align: "right" as const },
  ];

  const checkPageBreak = (neededH: number, isTable = false) => {
    if (currentY + neededH > PAGE_H - M - 12) {
      pdf.addPage();
      currentY = M;
      drawHeader();
      if (isTable) {
        drawTableHeaders();
      }
    }
  };

  const drawTableHeaders = () => {
    pdf.setFillColor(...NAVY);
    pdf.rect(M, currentY, CONTENT_W, 6, "F");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.8);
    pdf.setTextColor(255, 255, 255);

    let x = M;
    for (const c of cols) {
      const textX = c.align === "center" ? x + c.w / 2 : c.align === "right" ? x + c.w - 1.5 : x + 1.5;
      pdf.text(c.label, textX, currentY + 4.2, { align: c.align });
      x += c.w;
    }
    currentY += 6;
  };

  const drawRichTextMessage = (html: string) => {
    const blocks = parseHtmlToBlocks(html);
    if (blocks.length === 0) return;

    for (let bIdx = 0; bIdx < blocks.length; bIdx += 1) {
      const block = blocks[bIdx];

      if (block.type === "divider") {
        checkPageBreak(3, false);
        pdf.setDrawColor(203, 213, 225);
        pdf.setLineWidth(0.2);
        pdf.line(M + 1, currentY, M + CONTENT_W - 2, currentY);
        currentY += 3.5;
        continue;
      }

      if (block.type === "table" && block.rows && block.rows.length > 0) {
        const rows = block.rows;
        let maxCols = 1;
        for (const r of rows) {
          if (r.cells.length > maxCols) maxCols = r.cells.length;
        }
        if (maxCols === 0) continue;

        const tableX = M + 1;
        const tableW = CONTENT_W - 2;
        const colW = tableW / maxCols;

        for (const row of rows) {
          const cellData = row.cells.map((cell) => {
            const isHeader = cell.isHeader;
            const fontSize = isHeader ? 7.0 : 6.5;
            const isBold = isHeader || cell.runs.some((r) => r.bold);
            pdf.setFont("helvetica", isBold ? "bold" : "normal");
            pdf.setFontSize(fontSize);

            const splitLines: string[] = pdf.splitTextToSize(cell.text || "", Math.max(colW - 3, 10));
            return {
              cell,
              isHeader,
              isBold,
              fontSize,
              splitLines: splitLines.length > 0 ? splitLines : [""],
            };
          });

          let maxLines = 1;
          for (const cd of cellData) {
            if (cd.splitLines.length > maxLines) {
              maxLines = cd.splitLines.length;
            }
          }
          const lineStep = 3.2;
          const rowH = Math.max(5.5, maxLines * lineStep + 2.0);

          checkPageBreak(rowH + 1, false);

          for (let cIdx = 0; cIdx < maxCols; cIdx++) {
            const cellX = tableX + cIdx * colW;
            const cd = cellData[cIdx];
            const isHeader = cd ? cd.isHeader : false;

            pdf.setDrawColor(203, 213, 225);
            pdf.setLineWidth(0.18);
            if (isHeader) {
              pdf.setFillColor(241, 245, 249);
              pdf.rect(cellX, currentY, colW, rowH, "FD");
            } else {
              pdf.setFillColor(255, 255, 255);
              pdf.rect(cellX, currentY, colW, rowH, "FD");
            }

            if (!cd) continue;

            pdf.setFont("helvetica", cd.isBold ? "bold" : "normal");
            pdf.setFontSize(cd.fontSize);
            pdf.setTextColor(...(isHeader ? NAVY : TEXT));

            for (let l = 0; l < cd.splitLines.length; l++) {
              const lineText = cd.splitLines[l];
              if (!lineText) continue;
              const lineY = currentY + 3.2 + l * lineStep;

              if (cd.cell.align === "center") {
                pdf.text(lineText, cellX + colW / 2, lineY, { align: "center" });
              } else if (cd.cell.align === "right") {
                pdf.text(lineText, cellX + colW - 1.5, lineY, { align: "right" });
              } else {
                pdf.text(lineText, cellX + 1.5, lineY);
              }
            }
          }

          currentY += rowH;
        }

        currentY += 2;
        continue;
      }

      const isH1 = block.headingLevel === 1;
      const isH2 = block.headingLevel === 2;
      const isH3 = block.headingLevel === 3;
      const baseFontSize = isH1 ? 9.5 : isH2 ? 8.5 : isH3 ? 7.8 : 7.0;
      const stepLineHeight = isH1 ? 5.0 : isH2 ? 4.5 : isH3 ? 4.0 : 3.6;

      const tokens: TextRun[] = [];
      for (const run of block.runs) {
        if (run.text.includes("\n")) {
          const parts = run.text.split("\n");
          for (let p = 0; p < parts.length; p++) {
            if (p > 0) tokens.push({ ...run, text: "\n" });
            if (parts[p]) {
              const words = parts[p].match(/\S+|\s+/g) || [parts[p]];
              for (const w of words) tokens.push({ ...run, text: w });
            }
          }
        } else {
          const words = run.text.match(/\S+|\s+/g) || [run.text];
          for (const w of words) tokens.push({ ...run, text: w });
        }
      }

      if (tokens.length === 0) continue;

      let bulletWidth = 0;
      if (block.type === "list-item" && block.bullet) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(baseFontSize);
        bulletWidth = pdf.getTextWidth(block.bullet);
      }

      const indentLeft = block.type === "list-item" ? bulletWidth + 2 : 0;
      const maxLineWidth = CONTENT_W - 2 - indentLeft;

      const linesOfTokens: TextRun[][] = [];
      let currentLine: TextRun[] = [];
      let currentLineWidth = 0;

      for (const token of tokens) {
        if (token.text === "\n") {
          if (currentLine.length > 0) linesOfTokens.push(currentLine);
          currentLine = [];
          currentLineWidth = 0;
          continue;
        }

        // Avoid leading whitespace indent on line start
        if (currentLine.length === 0 && !token.text.trim()) {
          continue;
        }

        const isBold = isH1 || isH2 || isH3 || token.bold;
        pdf.setFont("helvetica", isBold && token.italic ? "bolditalic" : isBold ? "bold" : token.italic ? "italic" : "normal");
        pdf.setFontSize(baseFontSize);
        const tw = pdf.getTextWidth(token.text);

        if (currentLineWidth + tw > maxLineWidth && currentLine.length > 0) {
          linesOfTokens.push(currentLine);
          currentLine = token.text.trim() ? [token] : [];
          currentLineWidth = token.text.trim() ? tw : 0;
        } else {
          currentLine.push(token);
          currentLineWidth += tw;
        }
      }
      if (currentLine.length > 0) {
        linesOfTokens.push(currentLine);
      }

      for (let lIdx = 0; lIdx < linesOfTokens.length; lIdx += 1) {
        checkPageBreak(stepLineHeight + 1, false);

        const line = linesOfTokens[lIdx];
        let x = M + 1;

        if (block.type === "list-item" && block.bullet) {
          if (lIdx === 0) {
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(baseFontSize);
            pdf.setTextColor(...NAVY);
            pdf.text(block.bullet, x, currentY);
          }
          x += bulletWidth + 2;
        }

        for (const token of line) {
          const isBold = isH1 || isH2 || isH3 || token.bold;
          pdf.setFont("helvetica", isBold && token.italic ? "bolditalic" : isBold ? "bold" : token.italic ? "italic" : "normal");
          pdf.setFontSize(baseFontSize);
          pdf.setTextColor(...(token.color || (isH1 || isH2 ? NAVY : TEXT)));
          pdf.text(token.text, x, currentY);

          const tw = pdf.getTextWidth(token.text);
          if (token.underline) {
            pdf.setDrawColor(...(token.color || TEXT));
            pdf.setLineWidth(0.15);
            pdf.line(x, currentY + 0.3, x + tw, currentY + 0.3);
          }

          if (token.strikethrough) {
            pdf.setDrawColor(...(token.color || TEXT));
            pdf.setLineWidth(0.15);
            pdf.line(x, currentY - 0.8, x + tw, currentY - 0.8);
          }

          x += tw;
        }

        currentY += stepLineHeight;
      }

      currentY += isH1 ? 2.2 : isH2 ? 1.8 : 1.2;
    }
    currentY += 1.5;
  };

  const rawMsg = quotation.message || (quotation as any).quotation_message;
  if (isNonEmptyRichText(rawMsg)) {
    drawRichTextMessage(rawMsg!);
  }

  drawTableHeaders();

  const items = quotation.items || [];
  let rowIndex = 0;

  for (const it of items) {
    rowIndex += 1;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    const titleLines = pdf.splitTextToSize(it.product_name || "Item", 51);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.5);
    const descLines = it.description ? pdf.splitTextToSize(it.description, 51) : [];
    if (it.discount_percent && it.discount_percent > 0) {
      descLines.unshift(`Disc: ${it.discount_percent}% (-Rs. ${formatCurrency(it.discount_amount || 0)})`);
    }

    const totalTextLines = titleLines.length + descLines.length;
    const rHeight = Math.max(totalTextLines * 3.2 + 3, 7);

    checkPageBreak(rHeight, true);

    if (rowIndex % 2 === 0) {
      pdf.setFillColor(...LIGHT_BG);
      pdf.rect(M, currentY, CONTENT_W, rHeight, "F");
    }

    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.2);
    pdf.rect(M, currentY, CONTENT_W, rHeight, "S");

    let x = M;
    for (const c of cols) {
      pdf.line(x + c.w, currentY, x + c.w, currentY + rHeight);
      x += c.w;
    }

    x = M;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...MUTED);
    pdf.text(String(rowIndex), x + cols[0].w / 2, currentY + 4.2, { align: "center" });
    x += cols[0].w;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...DARK);
    let descY = currentY + 3.8;
    for (const tl of titleLines) {
      pdf.text(tl, x + 1.5, descY);
      descY += 3.2;
    }
    if (descLines.length > 0) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.5);
      pdf.setTextColor(...MUTED);
      for (const dl of descLines) {
        pdf.text(dl, x + 1.5, descY);
        descY += 2.8;
      }
    }
    x += cols[1].w;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...TEXT);
    pdf.text(it.hsn_code || "—", x + cols[2].w / 2, currentY + 4.2, { align: "center" });
    x += cols[2].w;

    pdf.setFont("helvetica", "bold");
    pdf.text(`${it.quantity} ${it.unit || ""}`.trim(), x + cols[3].w / 2, currentY + 4.2, { align: "center" });
    x += cols[3].w;

    pdf.setFont("helvetica", "normal");
    pdf.text(formatCurrency(it.rate), x + cols[4].w - 1.5, currentY + 4.2, { align: "right" });
    x += cols[4].w;

    pdf.text(formatCurrency(it.taxable_amount), x + cols[5].w - 1.5, currentY + 4.2, { align: "right" });
    x += cols[5].w;

    const isItemGstOff = quotation.gst_enabled === false || it.gst_enabled === false || !it.gst_rate;
    const gstRateText = isItemGstOff ? "" : `${it.gst_rate}%`;
    pdf.text(gstRateText, x + cols[6].w / 2, currentY + 4.2, { align: "center" });
    x += cols[6].w;

    const gstAmtVal = isItemGstOff ? 0 : Number(it.total_gst_amount || 0);
    const gstAmtText = isItemGstOff || !gstAmtVal ? "" : formatCurrency(gstAmtVal);
    pdf.text(gstAmtText, x + cols[7].w - 1.5, currentY + 4.2, { align: "right" });
    x += cols[7].w;

    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...DARK);
    pdf.text(formatCurrency(it.line_total), x + cols[8].w - 1.5, currentY + 4.2, { align: "right" });

    currentY += rHeight;
  }

  const hasDiscount = Boolean(quotation.total_discount && quotation.total_discount > 0);
  const hasRoundOff = quotation.round_off !== undefined && quotation.round_off !== 0;
  const standardRowCount = (hasDiscount ? 3 : 1) + 1 + (hasRoundOff ? 1 : 0);
  const summaryH = standardRowCount * 5 + 6.5;
  checkPageBreak(summaryH + 4, false);

  const leftW = 112;
  const rightW = CONTENT_W - leftW;

  pdf.setDrawColor(...LINE);
  pdf.setLineWidth(0.3);
  pdf.rect(M, currentY, CONTENT_W, summaryH, "S");
  pdf.line(M + leftW, currentY, M + leftW, currentY + summaryH);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6.8);
  pdf.setTextColor(...MUTED);
  pdf.text("AMOUNT CHARGEABLE (IN WORDS):", M + 3, currentY + 4.5);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(...NAVY);
  const words = (quotation.amount_in_words && quotation.amount_in_words.trim()) || numberToIndianWords(quotation.grand_total) || "Zero Rupees Only";
  const wrappedWords = pdf.splitTextToSize(words, leftW - 6);
  pdf.text(wrappedWords, M + 3, currentY + 8.5);

  let rightY = currentY;
  const renderSummaryRow = (label: string, val: string, isGrand = false) => {
    if (isGrand) {
      pdf.setFillColor(...ACCENT_BG);
      pdf.rect(M + leftW, rightY, rightW, 6.5, "F");
      pdf.setDrawColor(...LINE);
      pdf.line(M + leftW, rightY, M + CONTENT_W, rightY);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(...NAVY);
      pdf.text(label, M + leftW + 3, rightY + 4.5);
      pdf.text(val, PAGE_W - M - 2, rightY + 4.5, { align: "right" });
      rightY += 6.5;
    } else {
      pdf.setDrawColor(...LINE);
      pdf.line(M + leftW, rightY + 5, M + CONTENT_W, rightY + 5);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...TEXT);
      pdf.text(label, M + leftW + 3, rightY + 3.8);
      pdf.setFont("helvetica", "bold");
      pdf.text(val, PAGE_W - M - 2, rightY + 3.8, { align: "right" });
      rightY += 5;
    }
  };

  if (hasDiscount) {
    renderSummaryRow("Gross Total:", `Rs. ${formatCurrency((quotation.subtotal || 0) + (quotation.total_discount || 0))}`);
    renderSummaryRow("Total Discount:", `-Rs. ${formatCurrency(quotation.total_discount)}`);
    renderSummaryRow("Sub Total (Taxable):", `Rs. ${formatCurrency(quotation.subtotal)}`);
  } else {
    renderSummaryRow("Sub Total (Taxable):", `Rs. ${formatCurrency(quotation.subtotal)}`);
  }
  renderSummaryRow(
    "Total GST:",
    quotation.gst_enabled === false || !quotation.total_gst ? "" : `Rs. ${formatCurrency(quotation.total_gst)}`
  );
  if (hasRoundOff) {
    renderSummaryRow("Round Off:", `Rs. ${formatCurrency(quotation.round_off)}`);
  }
  renderSummaryRow("Grand Total (INR):", `Rs. ${formatCurrency(quotation.grand_total)}`, true);

  currentY += summaryH + 4;

  const terms = quotation.terms_and_conditions || [];
  if (terms.length > 0) {
    checkPageBreak(12, false);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...NAVY);
    pdf.text("GENERAL TERMS & CONDITIONS", M, currentY + 3);

    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.3);
    pdf.line(M, currentY + 4.5, PAGE_W - M, currentY + 4.5);
    currentY += 6.5;

    for (let i = 0; i < terms.length; i += 1) {
      const rawTerm = terms[i];
      if (!rawTerm || !rawTerm.trim()) continue;

      const blocks = parseHtmlToBlocks(rawTerm);
      if (blocks.length === 0) continue;

      const termNumStr = `${i + 1}) `;

      for (let bIdx = 0; bIdx < blocks.length; bIdx += 1) {
        const block = blocks[bIdx];
        const isFirstBlockInTerm = bIdx === 0;

        const tokens: TextRun[] = [];
        for (const run of block.runs) {
          if (run.text.includes("\n")) {
            const parts = run.text.split("\n");
            for (let p = 0; p < parts.length; p++) {
              if (p > 0) tokens.push({ ...run, text: "\n" });
              if (parts[p]) {
                const words = parts[p].match(/\S+|\s+/g) || [parts[p]];
                for (const w of words) tokens.push({ ...run, text: w });
              }
            }
          } else {
            const words = run.text.match(/\S+|\s+/g) || [run.text];
            for (const w of words) tokens.push({ ...run, text: w });
          }
        }

        if (tokens.length === 0) continue;

        let prefixWidth = 0;
        if (isFirstBlockInTerm) {
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(6.5);
          prefixWidth = pdf.getTextWidth(termNumStr);
        }

        let bulletWidth = 0;
        if (block.type === "list-item" && block.bullet) {
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(6.5);
          bulletWidth = pdf.getTextWidth(block.bullet);
        }

        const indentLeft = (isFirstBlockInTerm ? prefixWidth : 0) + (block.type === "list-item" ? bulletWidth + 2 : 0);
        const maxLineWidth = CONTENT_W - 2 - indentLeft;

        const linesOfTokens: TextRun[][] = [];
        let currentLine: TextRun[] = [];
        let currentLineWidth = 0;

        for (const token of tokens) {
          if (token.text === "\n") {
            if (currentLine.length > 0) linesOfTokens.push(currentLine);
            currentLine = [];
            currentLineWidth = 0;
            continue;
          }

          if (currentLine.length === 0 && !token.text.trim()) {
            continue;
          }

          pdf.setFont("helvetica", token.bold && token.italic ? "bolditalic" : token.bold ? "bold" : token.italic ? "italic" : "normal");
          pdf.setFontSize(6.5);
          const tw = pdf.getTextWidth(token.text);

          if (currentLineWidth + tw > maxLineWidth && currentLine.length > 0) {
            linesOfTokens.push(currentLine);
            currentLine = token.text.trim() ? [token] : [];
            currentLineWidth = token.text.trim() ? tw : 0;
          } else {
            currentLine.push(token);
            currentLineWidth += tw;
          }
        }
        if (currentLine.length > 0) {
          linesOfTokens.push(currentLine);
        }

        for (let lIdx = 0; lIdx < linesOfTokens.length; lIdx += 1) {
          checkPageBreak(3.5, false);

          const line = linesOfTokens[lIdx];
          let x = M + 1;

          if (isFirstBlockInTerm && lIdx === 0) {
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(6.5);
            pdf.setTextColor(...NAVY);
            pdf.text(termNumStr, x, currentY);
            x += prefixWidth;
          } else if (isFirstBlockInTerm) {
            x += prefixWidth;
          }

          if (block.type === "list-item" && block.bullet) {
            if (lIdx === 0) {
              pdf.setFont("helvetica", "bold");
              pdf.setFontSize(6.5);
              pdf.setTextColor(...NAVY);
              pdf.text(block.bullet, x, currentY);
            }
            x += bulletWidth + 2;
          }

          for (const token of line) {
            pdf.setFont("helvetica", token.bold && token.italic ? "bolditalic" : token.bold ? "bold" : token.italic ? "italic" : "normal");
            pdf.setFontSize(6.5);
            pdf.setTextColor(...(token.color || TEXT));
            pdf.text(token.text, x, currentY);

            const tw = pdf.getTextWidth(token.text);
            if (token.underline) {
              pdf.setDrawColor(...(token.color || TEXT));
              pdf.setLineWidth(0.15);
              pdf.line(x, currentY + 0.3, x + tw, currentY + 0.3);
            }

            x += tw;
          }

          currentY += 3.2;
        }
      }
      currentY += 1.5;
    }
    currentY += 3;
    currentY += 3;
  }

  // COMPANY BANK DETAILS
  const bankName = quotation.bank_name || (company?.bank_name as string) || "";
  const accountNumber = quotation.account_number || (company?.account_number as string) || "";
  const ifscCode = quotation.ifsc_code || (company?.ifsc_code as string) || "";
  const accountName = quotation.account_name || (company?.account_name as string) || companyName || "";
  const branchName = quotation.branch_name || (company?.branch_name as string) || "";
  const accountType = quotation.account_type || (company?.account_type as string) || "";

  if (bankName || accountNumber || ifscCode) {
    checkPageBreak(18, false);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...NAVY);
    pdf.text("COMPANY BANK DETAILS", M, currentY + 3);

    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.3);
    pdf.line(M, currentY + 4.5, PAGE_W - M, currentY + 4.5);
    currentY += 6.5;

    pdf.setFillColor(...LIGHT_BG);
    pdf.rect(M, currentY, CONTENT_W, 10, "F");
    pdf.setDrawColor(...LINE);
    pdf.rect(M, currentY, CONTENT_W, 10, "S");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(...TEXT);

    const bankItems = [
      bankName ? `Bank Name: ${bankName}` : "",
      accountName ? `A/c Name: ${accountName}` : "",
      accountNumber ? `A/c No: ${accountNumber}` : "",
      ifscCode ? `IFSC: ${ifscCode}` : "",
      branchName ? `Branch: ${branchName}` : "",
      accountType ? `Type: ${accountType}` : "",
    ].filter(Boolean);

    const bankStr = bankItems.join("  |  ");
    const wrappedBank = pdf.splitTextToSize(bankStr, CONTENT_W - 4);
    pdf.text(wrappedBank, M + 2, currentY + 4);

    currentY += 14;
  }

  checkPageBreak(24, false);
  pdf.setDrawColor(...LINE);
  pdf.setLineWidth(0.4);
  pdf.setLineDashPattern([2, 2], 0);
  pdf.line(M, currentY, PAGE_W - M, currentY);
  pdf.setLineDashPattern([], 0);

  currentY += 4;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...NAVY);
  pdf.text("Thanks and Regards,", M, currentY + 2);
  pdf.setTextColor(...DARK);
  pdf.text(`For ${companyName}`, M, currentY + 5.5);

  const sigName = quotation.signatory_name || "Authorized Signatory";
  const sigDesig = quotation.signatory_designation || "";
  const sigContacts = [quotation.signatory_phone || companyPhone, quotation.signatory_email || companyEmail]
    .filter(Boolean)
    .join(" | ");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.text(sigName, M, currentY + 16);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.5);
  pdf.setTextColor(...MUTED);
  if (sigDesig) {
    pdf.text(sigDesig, M, currentY + 19);
  }
  if (sigContacts) {
    pdf.text(sigContacts, M, currentY + 22);
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...NAVY);
  pdf.text("Order Acceptance", PAGE_W - M, currentY + 2, { align: "right" });

  if (customerName) {
    pdf.setTextColor(...DARK);
    pdf.text(customerName, PAGE_W - M, currentY + 5.5, { align: "right" });
  }

  pdf.setDrawColor(...MUTED);
  pdf.setLineWidth(0.3);
  pdf.line(PAGE_W - M - 55, currentY + 16, PAGE_W - M, currentY + 16);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.5);
  pdf.setTextColor(...MUTED);
  pdf.text("( Authorized Signatory / Company Seal )", PAGE_W - M, currentY + 19.5, { align: "right" });

  const totalPages = pdf.getNumberOfPages();
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

  for (let p = 1; p <= totalPages; p += 1) {
    pdf.setPage(p);

    // Top continuation indicator on later pages (only if multi-page)
    if (totalPages > 1 && p > 1) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(6.8);
      pdf.setTextColor(...NAVY);
      pdf.text(`Ref: ${refNumber}  (Page ${p} of ${totalPages})`, PAGE_W - M, M - 1.5, { align: "right" });
    }

    // System-generated notice above footer line
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(5.5);
    pdf.setTextColor(...MUTED);
    pdf.text("* This is a system-generated quotation; physical signature is not required. *", PAGE_W / 2, PAGE_H - M - 4.5, { align: "center" });

    // Footer border line
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.2);
    pdf.line(M, PAGE_H - M - 3, PAGE_W - M, PAGE_H - M - 3);

    // Left: Ref & Portal
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6);
    pdf.setTextColor(...MUTED);
    pdf.text(`Ref: ${refNumber} • Generated via ${resolvedPortalLabel}`, M, PAGE_H - M);

    // Center: Page count (Only printed if totalPages > 1)
    if (totalPages > 1) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...DARK);
      pdf.text(`Page ${p} of ${totalPages}`, PAGE_W / 2, PAGE_H - M, { align: "center" });
    }

    // Right: Generated By with Timestamp
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6);
    pdf.setTextColor(...MUTED);
    pdf.text(auditRight, PAGE_W - M, PAGE_H - M, { align: "right" });
  }

  return pdf;
}
