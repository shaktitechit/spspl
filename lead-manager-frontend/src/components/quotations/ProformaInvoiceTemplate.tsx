/**
 * @fileoverview High-Precision A4 Letterhead Template for Dedicated Proforma Invoices.
 * Clean, modern layout matching industrial medical commercial formats.
 * @module components/quotations/ProformaInvoiceTemplate
 */
"use client";

import React, { useMemo, type CSSProperties } from "react";
import { useGetCompanyInfoQuery, type LeadQuotationRecord, type LeadQuotationProformaDetails } from "@/store/api";
import { formatCompanyAddress } from "@/components/portal/shared/pdfCompanyLetterhead";
import { resolvePublicAssetUrl } from "@/lib/env";
import { numberToIndianWords } from "./quotationLineMath";
import { RichTextDisplay, isNonEmptyRichText } from "./RichTextDisplay";

type Props = {
  quotation: LeadQuotationRecord;
  proformaDetails?: LeadQuotationProformaDetails;
  portalLabel?: string;
};

const PAGE_WIDTH = 794;

const pageStyle: CSSProperties = {
  width: `${PAGE_WIDTH}px`,
  minHeight: "1123px",
  padding: "28px 32px",
  backgroundColor: "#ffffff",
  color: "#0f172a",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "9px",
  lineHeight: "14px",
  boxSizing: "border-box",
  display: "block",
  position: "relative",
  margin: "0 auto",
  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
  borderRadius: "4px",
};

function formatCurrency(amount?: number): string {
  if (amount == null || Number.isNaN(amount)) return "0.00";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr?: string | Date | null): string {
  if (!dateStr) return "";
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

export default function ProformaInvoiceTemplate({ quotation, proformaDetails }: Props) {
  const { data: companyData } = useGetCompanyInfoQuery();
  const company = companyData as Record<string, unknown> | undefined;

  const pDetails = proformaDetails || quotation.proforma_details || {};

  const companyName =
    quotation.company_name ||
    (company?.trade_name as string) ||
    (company?.legal_name as string) ||
    "Shakti Technology IT";
  const companyRegdAddress = formatCompanyAddress(company as any, quotation.company_regd_address);
  const companyPhone = quotation.company_phone || (company?.phone as string) || "";
  const companyEmail = quotation.company_email || (company?.email as string) || "";
  const companyGstin = quotation.company_gstin || (company?.gstin as string) || "";

  const bankName = quotation.bank_name || (company?.bank_name as string) || "";
  const accountName = quotation.account_name || (company?.account_name as string) || companyName;
  const accountNumber = quotation.account_number || (company?.account_number as string) || "";
  const ifscCode = quotation.ifsc_code || (company?.ifsc_code as string) || "";
  const branchName = quotation.branch_name || (company?.branch_name as string) || "";

  const logoRaw =
    (company?.logo_url as string) ||
    (quotation as any)?.company_logo ||
    (quotation as any)?.logo_url ||
    "";
  const logoUrl = useMemo(() => (logoRaw ? resolvePublicAssetUrl(logoRaw) : ""), [logoRaw]);

  const customerName = quotation.customer_name
    ? quotation.customer_name.startsWith("M/s")
      ? quotation.customer_name
      : `M/s. ${quotation.customer_name}`
    : "M/s. Customer";

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

  const rawNo = quotation.quotation_no ? quotation.quotation_no.replace(/^QUOT-?/i, "") : String(Date.now()).slice(-4);
  const proformaNo = pDetails.proforma_no || `PINV-${rawNo}`;
  const invoiceDateStr = formatDate(pDetails.invoice_date || quotation.proforma_issued_at || new Date());
  const poNumber = pDetails.customer_po_number || quotation.customer_po_number || "Verbal";
  const poDateStr = formatDate(pDetails.customer_po_date || quotation.customer_po_date || quotation.quotation_date);

  const approvedBy =
    typeof quotation.approved_by === "object" && quotation.approved_by !== null
      ? (quotation.approved_by as any).name
      : quotation.signatory_name || "Authorized Authority";
  const approvedDateStr = formatDate(quotation.approved_at || quotation.updatedAt);

  const items = quotation.items || [];

  const salesPersonName =
    pDetails.sales_person ||
    quotation.sales_person_name ||
    (typeof quotation.sales_person_user === "object" && quotation.sales_person_user !== null
      ? quotation.sales_person_user.name
      : "") ||
    "Sales Representative";

  const effectiveMessage =
    pDetails.message || (quotation as any).message || (quotation as any).quotation_message || "";

  return (
    <div id="proforma-pdf-root" style={pageStyle}>
      <style>{`
        .rich-text-content {
          font-size: 8.5px;
          line-height: 14px;
          color: #334155;
          word-break: break-word;
          overflow-wrap: break-word;
        }
        .rich-text-content p {
          margin: 0 0 4px 0;
          line-height: 14px;
        }
        .rich-text-content p:last-child {
          margin-bottom: 0;
        }
        .rich-text-content table {
          width: 100% !important;
          max-width: 100% !important;
          border-collapse: collapse !important;
          margin: 6px 0 !important;
          box-sizing: border-box !important;
          table-layout: auto !important;
        }
        .rich-text-content th,
        .rich-text-content td {
          border: 1px solid #cbd5e1 !important;
          padding: 4px 6px !important;
          font-size: 8px !important;
          line-height: 12px !important;
          text-align: left;
          vertical-align: top;
          box-sizing: border-box !important;
          word-break: break-word;
        }
        .rich-text-content th {
          background-color: #f1f5f9 !important;
          color: #1e3a5f !important;
          font-weight: 700 !important;
        }
        .rich-text-content td {
          background-color: #ffffff !important;
          color: #334155 !important;
        }
        .rich-text-content h1 {
          font-size: 11px;
          font-weight: 700;
          color: #1e3a5f;
          margin: 6px 0 2px 0;
        }
        .rich-text-content h2 {
          font-size: 10px;
          font-weight: 700;
          color: #1e3a5f;
          margin: 5px 0 2px 0;
        }
        .rich-text-content h3 {
          font-size: 9px;
          font-weight: 700;
          color: #1e3a5f;
          margin: 4px 0 1px 0;
        }
        .rich-text-content ul {
          list-style-type: disc !important;
          margin: 3px 0 4px 0 !important;
          padding-left: 16px !important;
        }
        .rich-text-content ol {
          list-style-type: decimal !important;
          margin: 3px 0 4px 0 !important;
          padding-left: 16px !important;
        }
        .rich-text-content li {
          margin-bottom: 2px !important;
          line-height: 13px !important;
        }
        .rich-text-content blockquote {
          border-left: 2px solid #94a3b8 !important;
          padding-left: 8px !important;
          margin: 4px 0 !important;
          font-style: italic;
          color: #475569;
        }
        .rich-text-content hr {
          border: none;
          border-top: 1px solid #e2e8f0;
          margin: 6px 0;
        }
      `}</style>

      {/* 1. Company Letterhead Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", paddingBottom: "10px", borderBottom: "2.5px solid #1e3a5f" }}>
        {/* Left: Logo - Flex-protected slot with increased size & preserved aspect ratio */}
        <div style={{ flex: "0 0 175px", width: "175px", minWidth: "175px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "flex-start" }}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={companyName || "Logo"}
              crossOrigin="anonymous"
              style={{
                maxWidth: "175px",
                maxHeight: "68px",
                width: "auto",
                height: "auto",
                objectFit: "contain",
                objectPosition: "left center",
                display: "block",
              }}
            />
          ) : (
            <div style={{ width: "160px", height: "54px", border: "1px dashed #cbd5e1", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "11px", fontWeight: 700 }}>
              {companyName.slice(0, 16)}
            </div>
          )}
        </div>

        {/* Center: Company Name & Credentials - Multi-line word wrap that cannot encroach on logo */}
        <div style={{ flex: 1, textAlign: "center", padding: "0 10px", minWidth: 0, overflow: "hidden" }}>
          <div
            style={{
              fontSize: "15.5px",
              fontWeight: 800,
              color: "#1e3a5f",
              letterSpacing: "0.03em",
              textTransform: "uppercase",
              marginBottom: "3px",
              lineHeight: "20px",
              whiteSpace: "normal",
              wordBreak: "break-word",
              overflowWrap: "break-word",
              maxWidth: "100%",
            }}
          >
            {companyName}
          </div>
          {companyRegdAddress && (
            <div
              style={{
                fontSize: "8.5px",
                color: "#334155",
                marginBottom: "3px",
                lineHeight: "13px",
                whiteSpace: "normal",
                wordBreak: "break-word",
                overflowWrap: "break-word",
                maxWidth: "100%",
              }}
            >
              <strong style={{ color: "#1e3a5f" }}>Regd. Off:</strong> {companyRegdAddress}
            </div>
          )}
          {(companyPhone || companyEmail || companyGstin) && (
            <div style={{ fontSize: "8px", color: "#475569", fontWeight: 500, display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "6px" }}>
              {companyPhone && <span><strong style={{ color: "#1e3a5f" }}>Phone:</strong> {companyPhone}</span>}
              {companyPhone && (companyEmail || companyGstin) && <span style={{ color: "#cbd5e1" }}>•</span>}
              {companyEmail && <span><strong style={{ color: "#1e3a5f" }}>Email:</strong> {companyEmail}</span>}
              {companyEmail && companyGstin && <span style={{ color: "#cbd5e1" }}>•</span>}
              {companyGstin && <span><strong style={{ color: "#1e3a5f" }}>GSTIN:</strong> {companyGstin}</span>}
            </div>
          )}
        </div>

        {/* Right: Document Badge */}
        <div style={{ flex: "0 0 145px", width: "145px", minWidth: "145px", flexShrink: 0, textAlign: "right" }}>
          <div style={{ display: "inline-block", background: "#eff6ff", border: "1px solid #bfdbfe", padding: "5px 10px", borderRadius: "5px" }}>
            <div style={{ fontSize: "9px", fontWeight: 800, color: "#1e3a5f", textTransform: "uppercase", letterSpacing: "0.03em" }}>
              PROFORMA INVOICE
            </div>
            <div style={{ fontSize: "8.5px", fontWeight: 700, color: "#2563eb", marginTop: "1px" }}>
              {proformaNo}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Proforma Meta Box */}
      <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", border: "1px solid #cbd5e1", borderRadius: "4px", marginBottom: "12px", background: "#ffffff", overflow: "hidden" }}>
        {/* Left Customer Column */}
        <div style={{ padding: "8px 12px", borderRight: "1px solid #cbd5e1", fontSize: "8.5px", lineHeight: "14px" }}>
          <div style={{ display: "inline-block", fontSize: "11px", fontWeight: 800, color: "#1e3a5f", textTransform: "uppercase", letterSpacing: "0.02em", marginBottom: "4px" }}>
            PROFORMA INVOICE
          </div>
          <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "10px", marginBottom: "3px" }}>
            {customerName}
          </div>
          {customerAddress && <div style={{ color: "#334155", marginBottom: "3px" }}>{customerAddress}</div>}
          {quotation.gstin && (
            <div>
              <strong style={{ color: "#1e3a5f" }}>GSTIN : </strong>
              <span style={{ fontWeight: 600, color: "#0f172a" }}>{quotation.gstin}</span>
            </div>
          )}
          {quotation.kind_attn && (
            <div>
              <strong style={{ color: "#1e3a5f" }}>Contact Person: </strong>
              <span>{quotation.kind_attn}</span>
            </div>
          )}
          {(quotation.phone || quotation.cell) && (
            <div>
              {quotation.phone && <span><strong>Tel. : </strong>{quotation.phone} </span>}
              {quotation.cell && <span><strong>Cell : </strong>{quotation.cell}</span>}
            </div>
          )}
          {quotation.email && (
            <div>
              <strong>E-mail : </strong>{quotation.email}
            </div>
          )}
        </div>

        {/* Right Reference Column */}
        <div style={{ padding: "8px 12px", fontSize: "8.5px", lineHeight: "15px", background: "#f8fafc" }}>
          <div style={{ marginBottom: "2px" }}>
            <strong style={{ color: "#1e3a5f" }}>Pro. Invoice No. : </strong>
            <span style={{ fontWeight: 800, color: "#2563eb", fontSize: "9.5px" }}>{proformaNo}</span>
          </div>
          <div style={{ marginBottom: "2px" }}>
            <strong>Invoice Date : </strong>
            <span style={{ fontWeight: 600 }}>{invoiceDateStr}</span>
          </div>
          <div style={{ marginBottom: "2px" }}>
            <strong>Customer PO No. : </strong>
            <span>{poNumber}</span>
          </div>
          <div style={{ marginBottom: "2px" }}>
            <strong>Customer PO Date : </strong>
            <span>{poDateStr}</span>
          </div>
          <div style={{ marginBottom: "2px" }}>
            <strong>Approved By : </strong>
            <span>{approvedBy}</span>
          </div>
          <div>
            <strong>Approved Date : </strong>
            <span>{approvedDateStr}</span>
          </div>
        </div>
      </div>

      {/* Cover / Introductory Message (if provided, rendered seamlessly without label) */}
      {isNonEmptyRichText(effectiveMessage) && (
        <div
          style={{
            width: "100%",
            marginBottom: "8px",
            padding: "4px 2px",
            fontSize: "8.5px",
            color: "#334155",
            lineHeight: "14px",
            boxSizing: "border-box",
          }}
        >
          <RichTextDisplay
            content={effectiveMessage}
            className="text-[8.5px] leading-relaxed text-slate-800"
          />
        </div>
      )}

      {/* 3. Goods & Pricing Table */}
      <div style={{ marginBottom: "10px", border: "1px solid #cbd5e1", borderRadius: "4px", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8px" }}>
          <thead>
            <tr style={{ background: "#1e3a5f", color: "#ffffff", textAlign: "left" }}>
              <th style={{ padding: "6px 4px", width: "24px", textAlign: "center", borderRight: "1px solid #334155" }}>Sr.</th>
              <th style={{ padding: "6px 8px", borderRight: "1px solid #334155" }}>Description of Goods</th>
              <th style={{ padding: "6px 4px", width: "60px", textAlign: "center", borderRight: "1px solid #334155" }}>HSN/SAC</th>
              <th style={{ padding: "6px 4px", width: "35px", textAlign: "center", borderRight: "1px solid #334155" }}>QTY</th>
              <th style={{ padding: "6px 6px", width: "70px", textAlign: "right", borderRight: "1px solid #334155" }}>Rate (₹)</th>
              <th style={{ padding: "6px 6px", width: "75px", textAlign: "right", borderRight: "1px solid #334155" }}>Taxable Amt (₹)</th>
              <th style={{ padding: "6px 4px", width: "45px", textAlign: "center", borderRight: "1px solid #334155" }}>Tax %</th>
              <th style={{ padding: "6px 6px", width: "65px", textAlign: "right", borderRight: "1px solid #334155" }}>Tax Amt (₹)</th>
              <th style={{ padding: "6px 8px", width: "85px", textAlign: "right" }}>Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => {
              const qty = Number(it.quantity || 1);
              const rate = Number(it.rate || 0);
              const subtotal = Number(it.taxable_amount || qty * rate);
              const isItemGstOff = quotation.gst_enabled === false || it.gst_enabled === false || !it.gst_rate;
              const gstRate = isItemGstOff ? 0 : Number(it.gst_rate || 0);
              const gstAmt = isItemGstOff ? 0 : Number(it.total_gst_amount || 0);
              const total = Number(it.line_total || subtotal + gstAmt);

              return (
                <tr key={idx} style={{ background: idx % 2 === 0 ? "#ffffff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "5px 4px", textAlign: "center", borderRight: "1px solid #e2e8f0" }}>{idx + 1}</td>
                  <td style={{ padding: "5px 8px", borderRight: "1px solid #e2e8f0" }}>
                    <div style={{ fontWeight: 700, color: "#0f172a" }}>{it.product_name}</div>
                    {it.description && <div style={{ fontSize: "7.5px", color: "#64748b", marginTop: "1px" }}>{it.description}</div>}
                  </td>
                  <td style={{ padding: "5px 4px", textAlign: "center", borderRight: "1px solid #e2e8f0" }}>{it.hsn_code || "—"}</td>
                  <td style={{ padding: "5px 4px", textAlign: "center", borderRight: "1px solid #e2e8f0", fontWeight: 600 }}>{qty}</td>
                  <td style={{ padding: "5px 6px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{formatCurrency(rate)}</td>
                  <td style={{ padding: "5px 6px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{formatCurrency(subtotal)}</td>
                  <td style={{ padding: "5px 4px", textAlign: "center", borderRight: "1px solid #e2e8f0" }}>
                    {isItemGstOff || !gstRate ? "" : `${gstRate}%`}
                  </td>
                  <td style={{ padding: "5px 6px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>
                    {isItemGstOff || !gstAmt ? "" : formatCurrency(gstAmt)}
                  </td>
                  <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700, color: "#0f172a" }}>{formatCurrency(total)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: "#eff6ff", fontWeight: 700, borderTop: "2px solid #cbd5e1" }}>
              <td colSpan={5} style={{ padding: "6px 8px", textAlign: "right", color: "#1e3a5f" }}>Total</td>
              <td style={{ padding: "6px 6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>{formatCurrency(quotation.subtotal)}</td>
              <td style={{ padding: "6px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>—</td>
              <td style={{ padding: "6px 6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                {quotation.gst_enabled === false || !quotation.total_gst ? "" : formatCurrency(quotation.total_gst)}
              </td>
              <td style={{ padding: "6px 8px", textAlign: "right", color: "#2563eb", fontWeight: 800 }}>{formatCurrency(quotation.grand_total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Totals & Words Strip */}
      <div style={{ border: "1px solid #cbd5e1", borderRadius: "4px", padding: "6px 12px", background: "#f8fafc", marginBottom: "12px", fontSize: "8.5px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
          <div>
            <strong style={{ color: "#1e3a5f" }}>Total GST : </strong>
            <span style={{ fontWeight: 600 }}>
              {quotation.gst_enabled === false || !quotation.total_gst ? "" : `₹ ${formatCurrency(quotation.total_gst)}`}
            </span>
          </div>
          <div>
            <strong style={{ color: "#1e3a5f", fontSize: "9.5px" }}>Grand Total : </strong>
            <span style={{ fontWeight: 800, color: "#2563eb", fontSize: "11px" }}>₹ {formatCurrency(quotation.grand_total)}</span>
          </div>
        </div>
        <div style={{ marginTop: "4px", paddingTop: "4px", borderTop: "1px dashed #cbd5e1", fontSize: "8.5px" }}>
          <strong style={{ color: "#475569" }}>Amount in words : </strong>
          <span style={{ fontStyle: "italic", color: "#1e3a5f", fontWeight: 700 }}>
            {(quotation.amount_in_words && quotation.amount_in_words.trim()) || numberToIndianWords(quotation.grand_total) || "Zero Rupees Only"}
          </span>
        </div>
      </div>

      {/* 4. Order Details 2-Column Box */}
      <div style={{ border: "1px solid #cbd5e1", borderRadius: "4px", overflow: "hidden", marginBottom: "12px" }}>
        <div style={{ background: "#eff6ff", padding: "5px 12px", borderBottom: "1px solid #cbd5e1", fontWeight: 800, color: "#1e3a5f", fontSize: "8.5px", textTransform: "uppercase", letterSpacing: "0.02em" }}>
          Order Details:
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "8px 12px", fontSize: "8px", lineHeight: "15px", background: "#ffffff" }}>
          {/* Left Column */}
          <div style={{ paddingRight: "12px", borderRight: "1px solid #f1f5f9" }}>
            <div>
              <strong style={{ color: "#334155" }}>Sales Person:</strong>{" "}
              <span style={{ color: "#0f172a", fontWeight: 600 }}>{salesPersonName}</span>
            </div>
            <div><strong style={{ color: "#334155" }}>ORC:</strong> <span style={{ color: "#0f172a" }}>{pDetails.orc || "na"}</span></div>
            <div><strong style={{ color: "#334155" }}>Dispatch Date:</strong> <span style={{ color: "#0f172a" }}>{formatDate(pDetails.dispatch_date || quotation.valid_until || new Date())}</span></div>
            <div><strong style={{ color: "#334155" }}>Payment Terms:</strong> <span style={{ color: "#0f172a" }}>{pDetails.payment_terms || quotation.payment_terms || "On Delivery"}</span></div>
            <div><strong style={{ color: "#334155" }}>Installation Required:</strong> <span style={{ color: "#0f172a" }}>{pDetails.installation_required || "No"}</span></div>
            <div><strong style={{ color: "#334155" }}>Margin Sheet Attached:</strong> <span style={{ color: "#0f172a" }}>{pDetails.margin_sheet_attached || "na"}</span></div>
          </div>

          {/* Right Column */}
          <div style={{ paddingLeft: "12px" }}>
            <div><strong style={{ color: "#334155" }}>Freight Charges:</strong> <span style={{ color: "#0f172a" }}>{pDetails.freight_charges || "Extra at actual"}</span></div>
            <div><strong style={{ color: "#334155" }}>Transport:</strong> <span style={{ color: "#0f172a" }}>{pDetails.transport || "To be arranged / SafeXpress"}</span></div>
            <div><strong style={{ color: "#334155" }}>Ship to Address:</strong> <span style={{ color: "#0f172a" }}>{pDetails.ship_to_address || "Same as billing"}</span></div>
            <div><strong style={{ color: "#334155" }}>Customer Type:</strong> <span style={{ color: "#0f172a" }}>{pDetails.customer_type || "Dealer"}</span></div>
            <div><strong style={{ color: "#334155" }}>GST Concession:</strong> <span style={{ color: "#0f172a" }}>{pDetails.gst_concession || "na"}</span></div>
            <div><strong style={{ color: "#334155" }}>KYC:</strong> <span style={{ color: "#0f172a" }}>{pDetails.kyc_status || "na"}</span></div>
          </div>
        </div>
      </div>

      {/* 5. Bottom Sign-Off: Bank Coordinates & Order Acceptance */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", border: "1px solid #cbd5e1", borderRadius: "4px", background: "#ffffff", overflow: "hidden" }}>
        {/* Left: Banking Details */}
        <div style={{ padding: "8px 12px", borderRight: "1px solid #cbd5e1", fontSize: "8px", lineHeight: "14px" }}>
          <div style={{ fontWeight: 800, color: "#1e3a5f", marginBottom: "4px" }}>
            Company Banking Coordinates (for Wire / NEFT / RTGS Transfer):
          </div>
          {bankName && <div><strong style={{ color: "#334155" }}>Bank Name : </strong><span>{bankName}</span></div>}
          {accountName && <div><strong style={{ color: "#334155" }}>A/C Name : </strong><span>{accountName}</span></div>}
          {accountNumber && (
            <div>
              <strong style={{ color: "#334155" }}>A/C No. : </strong>
              <span style={{ fontWeight: 800, color: "#2563eb" }}>{accountNumber}</span>
            </div>
          )}
          {ifscCode && <div><strong style={{ color: "#334155" }}>IFSC Code : </strong><span>{ifscCode}</span></div>}
          {branchName && <div><strong style={{ color: "#334155" }}>Branch : </strong><span>{branchName}</span></div>}
        </div>

        {/* Right: Order Acceptance */}
        <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f8fafc" }}>
          <div>
            <div style={{ fontWeight: 800, color: "#1e3a5f", fontSize: "8.5px" }}>Order Acceptance,</div>
            <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "8.5px", marginTop: "2px" }}>{customerName}</div>
          </div>

          <div style={{ marginTop: "28px", borderTop: "1px solid #94a3b8", paddingTop: "3px", textAlign: "center" }}>
            <span style={{ fontSize: "7.5px", color: "#64748b", fontWeight: 700 }}>
              Authorised Signatory ( Name / Company Seal )
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
