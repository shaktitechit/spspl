/**
 * @fileoverview High-Precision A4 Letterhead Template for Quotations.
 * Pure CSS Flexbox & Div Box-Model architecture to eliminate html2canvas table rendering glitches.
 * @module components/portal/shared/quotations/QuotationPdfTemplate
 */
"use client";

import React, { useMemo, type CSSProperties } from "react";
import { useGetCompanyInfoQuery, type LeadQuotationRecord } from "@/store/api";
import { useAppSelector } from "@/store/hooks";
import { readSessionFromStorage } from "@/utils/authStorage";
import { formatCompanyAddress } from "@/components/portal/shared/pdfCompanyLetterhead";
import { resolvePublicAssetUrl } from "@/lib/env";
import { numberToIndianWords } from "./quotationLineMath";
import { RichTextDisplay, isNonEmptyRichText } from "./RichTextDisplay";

type Props = {
  quotation: LeadQuotationRecord;
  portalLabel?: string;
  downloadedBy?: string;
  documentType?: "quotation" | "proforma";
  watermark?: string;
};

const PAGE_WIDTH = 794;

const pageStyle: CSSProperties = {
  width: `${PAGE_WIDTH}px`,
  minHeight: "1123px",
  padding: "20px 28px 24px 28px",
  backgroundColor: "#ffffff",
  color: "#0f172a",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "9px",
  lineHeight: "14px",
  boxSizing: "border-box",
  display: "block",
  position: "relative",
  margin: "0 auto",
};

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

export default function QuotationPdfTemplate({
  quotation,
  portalLabel = "Lead Manager",
  downloadedBy,
  documentType = "quotation",
  watermark,
}: Props) {
  const { data: companyData } = useGetCompanyInfoQuery();
  const company = companyData as Record<string, unknown> | undefined;
  const reduxUser = useAppSelector((s) => s.auth.user);
  const sessionUser = useMemo(() => (typeof window !== "undefined" ? readSessionFromStorage()?.user || null : null), []);
  const authUser = (reduxUser || sessionUser) as any;

  const userLabel = useMemo(() => {
    if (downloadedBy && downloadedBy.trim()) return downloadedBy.trim();
    if (!authUser) return quotation.signatory_name || "User";
    const name = String(authUser.name || "").trim();
    if (name && name !== "Authorized Staff" && name !== "Authorized User") return name;
    const first = String(authUser.first_name || "").trim();
    const last = String(authUser.last_name || "").trim();
    const full = `${first} ${last}`.trim();
    if (full) return full;
    const uname = String(authUser.username || "").trim();
    if (uname) return uname;
    const email = String(authUser.email || "").trim();
    if (email) return email;
    return quotation.signatory_name || "User";
  }, [downloadedBy, authUser, quotation.signatory_name]);

  const companyName =
    quotation.company_name ||
    (company?.trade_name as string) ||
    (company?.legal_name as string) ||
    "";

  const resolvedPortalLabel = portalLabel || "Lead Manager";

  const logoRaw =
    (company?.logo_url as string) ||
    (quotation as any)?.company_logo ||
    (quotation as any)?.logo_url ||
    "";
  const logoUrl = logoRaw ? resolvePublicAssetUrl(logoRaw) : "";

  const companyRegdAddress = formatCompanyAddress(company as any, quotation.company_regd_address);

  const companyPhone = quotation.company_phone || (company?.phone as string) || "";
  const companyEmail = quotation.company_email || (company?.email as string) || "";
  const companyGstin = quotation.company_gstin || (company?.gstin as string) || "";

  const contactLine = [
    companyPhone ? `Phone: ${companyPhone}` : "",
    companyEmail ? `Email: ${companyEmail}` : "",
    companyGstin ? `GSTIN: ${companyGstin}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  const customerDisplay = quotation.customer_name
    ? quotation.customer_name.startsWith("M/s")
      ? quotation.customer_name
      : `M/s. ${quotation.customer_name}`
    : "";

  const custAddress = quotation.address
    ? [
      quotation.address.address_line_1,
      quotation.address.city,
      quotation.address.state,
      quotation.address.pincode,
    ]
      .filter(Boolean)
      .join(", ")
    : "";

  const signatoryContacts = [
    quotation.signatory_phone || "",
    quotation.signatory_email || "",
  ]
    .filter(Boolean)
    .join(" | ");

  const items = quotation.items || [];
  const terms = quotation.terms_and_conditions || [];

  return (
    <>
      <style>{`
        @media print {
          #quotation-pdf-root {
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
            position: static !important;
            box-sizing: border-box !important;
          }
          .quotation-card-block {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
        .quotation-terms-content p {
          margin: 0;
          display: inline;
        }
        .quotation-terms-content div {
          margin: 0;
        }
        .quotation-terms-content ul {
          list-style-type: disc;
          margin: 2px 0;
          padding-left: 14px;
        }
        .quotation-terms-content ol {
          list-style-type: decimal;
          margin: 2px 0;
          padding-left: 14px;
        }
        .quotation-terms-content li {
          margin: 1px 0;
        }
      `}</style>

      <div
        id="quotation-pdf-root"
        data-pdf-page
        style={pageStyle}
      >
        {/* WATERMARK OVERLAY */}
        {watermark && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              userSelect: "none",
              zIndex: 35,
              overflow: "hidden",
            }}
          >
            {/* Top subtle repeating watermark */}
            <div
              style={{
                position: "absolute",
                top: "16%",
                transform: "rotate(-32deg)",
                fontSize: "76px",
                fontWeight: 900,
                letterSpacing: "14px",
                color: "rgba(220, 38, 38, 0.07)",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                fontFamily: "Arial, Helvetica, sans-serif",
              }}
            >
              {watermark}
            </div>

            {/* Main Center Prominent Watermark Box */}
            <div
              style={{
                transform: "rotate(-32deg)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px 56px",
                border: "8px dashed rgba(220, 38, 38, 0.22)",
                borderRadius: "20px",
                backgroundColor: "rgba(255, 255, 255, 0.25)",
              }}
            >
              <div
                style={{
                  fontSize: "116px",
                  fontWeight: 900,
                  letterSpacing: "20px",
                  color: "rgba(220, 38, 38, 0.16)",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  lineHeight: "1",
                  fontFamily: "Arial, Helvetica, sans-serif",
                }}
              >
                {watermark}
              </div>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: 800,
                  letterSpacing: "6px",
                  marginTop: "10px",
                  color: "rgba(220, 38, 38, 0.30)",
                  textTransform: "uppercase",
                  fontFamily: "Arial, Helvetica, sans-serif",
                }}
              >
                UNOFFICIAL DRAFT • NOT FOR ISSUE
              </div>
            </div>

            {/* Bottom subtle repeating watermark */}
            <div
              style={{
                position: "absolute",
                bottom: "16%",
                transform: "rotate(-32deg)",
                fontSize: "76px",
                fontWeight: 900,
                letterSpacing: "14px",
                color: "rgba(220, 38, 38, 0.07)",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                fontFamily: "Arial, Helvetica, sans-serif",
              }}
            >
              {watermark}
            </div>
          </div>
        )}

        {/* 1. HEADER SECTION */}
        <div style={{ marginBottom: "14px", width: "100%", boxSizing: "border-box" }}>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingBottom: "10px", borderBottom: "2.5px solid #1e3a5f" }}>
            {/* Logo Left */}
            <div style={{ width: "135px", flexShrink: 0 }}>
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={companyName || "Logo"}
                  crossOrigin="anonymous"
                  style={{
                    width: "130px",
                    height: "48px",
                    objectFit: "contain",
                    objectPosition: "left center",
                    display: "block",
                  }}
                />
              ) : (
                <div style={{ width: "130px", height: "44px", border: "1px dashed #cbd5e1", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "10px", fontWeight: 700 }}>
                  {companyName.slice(0, 12)}
                </div>
              )}
            </div>

            {/* Company Info Center */}
            <div style={{ flex: 1, textAlign: "center", padding: "0 12px", minWidth: 0 }}>
              {companyName && (
                <div
                  style={{
                    fontSize: "16.5px",
                    fontWeight: 800,
                    color: "#1e3a5f",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    lineHeight: "20px",
                    marginBottom: "3px",
                    textAlign: "center",
                  }}
                >
                  {companyName}
                </div>
              )}
              {companyRegdAddress && (
                <div
                  style={{
                    fontSize: "8.5px",
                    color: "#334155",
                    lineHeight: "13px",
                    marginBottom: "3px",
                    textAlign: "center",
                  }}
                >
                  <strong style={{ color: "#1e3a5f" }}>Regd. Off:</strong> {companyRegdAddress}
                </div>
              )}
              {(companyPhone || companyEmail || companyGstin) && (
                <div
                  style={{
                    fontSize: "8px",
                    color: "#475569",
                    fontWeight: 500,
                    display: "flex",
                    justifyContent: "center",
                    flexWrap: "wrap",
                    gap: "6px",
                  }}
                >
                  {companyPhone && (
                    <span>
                      <strong style={{ color: "#1e3a5f" }}>Phone:</strong> {companyPhone}
                    </span>
                  )}
                  {companyPhone && (companyEmail || companyGstin) && <span style={{ color: "#cbd5e1" }}>•</span>}
                  {companyEmail && (
                    <span>
                      <strong style={{ color: "#1e3a5f" }}>Email:</strong> {companyEmail}
                    </span>
                  )}
                  {companyEmail && companyGstin && <span style={{ color: "#cbd5e1" }}>•</span>}
                  {companyGstin && (
                    <span>
                      <strong style={{ color: "#1e3a5f" }}>GSTIN:</strong> {companyGstin}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Right: Document Badge */}
            <div style={{ width: "135px", flexShrink: 0, textAlign: "right" }}>
              <div style={{ display: "inline-block", background: "#eff6ff", border: "1px solid #bfdbfe", padding: "4px 8px", borderRadius: "4px" }}>
                <div style={{ fontSize: "9px", fontWeight: 800, color: "#1e3a5f", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  {documentType === "proforma" ? "PROFORMA INVOICE" : "QUOTATION"}
                </div>
                <div style={{ fontSize: "8px", fontWeight: 700, color: "#2563eb", marginTop: "1px" }}>
                  {quotation.quotation_no || "DRAFT"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. TITLE & REF BAR */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            borderBottom: "1.5px solid #cbd5e1",
            paddingBottom: "5px",
            marginBottom: "12px",
            boxSizing: "border-box",
          }}
        >
          <div>
            <span
              style={{
                fontSize: "13px",
                fontWeight: 800,
                color: "#1e3a5f",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                lineHeight: "16px",
              }}
            >
              {documentType === "proforma" ? "PROFORMA INVOICE" : "QUOTATION"}
            </span>
          </div>
          <div style={{ textAlign: "right", fontSize: "8.5px", color: "#334155", lineHeight: "13px" }}>
            <div>
              <strong>{documentType === "proforma" ? "PI Ref. No. :" : "Ref. No. :"}</strong>{" "}
              <span style={{ fontWeight: 700, color: "#1e40af" }}>
                {quotation.ref_no || quotation.quotation_no || ""}
                {quotation.version && quotation.version > 1 ? ` (Rev v${quotation.version})` : ""}
              </span>
            </div>
            {quotation.quotation_date && (
              <div style={{ marginTop: "1px" }}>
                <strong>Date :</strong> {formatDate(quotation.quotation_date)}
              </div>
            )}
            <div style={{ marginTop: "1px" }}>
              <strong>Validity Date :</strong>{" "}
              <span style={{ fontWeight: 600, color: "#0f172a" }}>
                {quotation.valid_until
                  ? formatDate(String(quotation.valid_until))
                  : quotation.quotation_date
                    ? formatDate(
                      new Date(
                        new Date(quotation.quotation_date).setDate(
                          new Date(quotation.quotation_date).getDate() + (quotation.validity_days || 15)
                        )
                      ).toISOString()
                    )
                    : ""}{" "}
                ({quotation.validity_days || 15} Days)
              </span>
            </div>
          </div>
        </div>

        {/* 3. CUSTOMER & PROPOSAL DETAILS CARD */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            width: "100%",
            border: "1px solid #cbd5e1",
            borderRadius: "4px",
            marginBottom: "12px",
            boxSizing: "border-box",
            backgroundColor: "#ffffff",
          }}
        >
          {/* Customer Details */}
          <div
            style={{
              width: "55%",
              padding: "7px 10px",
              borderRight: "1px solid #cbd5e1",
              boxSizing: "border-box",
            }}
          >
            {customerDisplay && (
              <div style={{ fontSize: "10px", fontWeight: 700, color: "#0f172a", lineHeight: "14px", wordBreak: "break-word" }}>
                {customerDisplay}
              </div>
            )}
            {quotation.customer_ref && (
              <div style={{ marginTop: "2px", marginBottom: "2px", fontSize: "8px", color: "#1e3a5f", wordBreak: "break-word" }}>
                <strong>Cust. Ref. :</strong>{" "}
                <span style={{ fontWeight: 700, color: "#1e40af" }}>
                  {quotation.customer_ref}
                </span>
              </div>
            )}
            {custAddress && (
              <div style={{ marginTop: "2px", fontSize: "8px", color: "#475569", lineHeight: "11.5px", wordBreak: "break-word" }}>
                {custAddress}
              </div>
            )}
            <div style={{ marginTop: "4px", fontSize: "8px", color: "#334155", lineHeight: "12px" }}>
              {quotation.gstin && (
                <div>
                  <strong>GSTIN :</strong> {quotation.gstin}
                </div>
              )}
              {quotation.phone && (
                <div>
                  <strong>Tel. :</strong> {quotation.phone}
                </div>
              )}
              {quotation.cell && (
                <div>
                  <strong>Cell :</strong> {quotation.cell}
                </div>
              )}
              {quotation.email && (
                <div>
                  <strong>E-mail :</strong> {quotation.email}
                </div>
              )}
            </div>
          </div>

          {/* Proposal Details */}
          <div
            style={{
              width: "45%",
              padding: "7px 10px",
              fontSize: "8px",
              color: "#334155",
              lineHeight: "12.5px",
              boxSizing: "border-box",
            }}
          >
            {quotation.kind_attn && (
              <div style={{ marginBottom: "4px" }}>
                <strong>Kind Attn :</strong>{" "}
                <span style={{ fontWeight: 600, color: "#0f172a" }}>{quotation.kind_attn}</span>
              </div>
            )}
            {quotation.subject && (
              <div style={{ marginBottom: "4px" }}>
                <strong>Sub. :</strong>{" "}
                <span style={{ fontWeight: 700, color: "#1e3a5f" }}>{quotation.subject}</span>
              </div>
            )}
          </div>
        </div>

        {/* Cover / Introductory Message (if provided, rendered seamlessly without label) */}
        {isNonEmptyRichText(quotation.message || (quotation as any).quotation_message) && (
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
              content={(quotation.message || (quotation as any).quotation_message) || ""}
              className="text-[8.5px] leading-relaxed text-slate-800"
            />
          </div>
        )}

        {/* 4. ITEMS GRID */}
        <div
          style={{
            width: "100%",
            border: "1px solid #cbd5e1",
            borderBottom: "none",
            boxSizing: "border-box",
            backgroundColor: "#ffffff",
          }}
        >
          {/* Header Row */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              width: "100%",
              backgroundColor: "#f8fafc",
              borderBottom: "1px solid #cbd5e1",
              fontWeight: 700,
              fontSize: "8.5px",
              color: "#1e3a5f",
              textTransform: "uppercase",
              letterSpacing: "0.02em",
              boxSizing: "border-box",
            }}
          >
            <div style={{ width: "5%", padding: "6px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1", boxSizing: "border-box" }}>Sr.</div>
            <div style={{ width: "27%", padding: "6px 6px", textAlign: "left", borderRight: "1px solid #cbd5e1", boxSizing: "border-box" }}>Description of Goods</div>
            <div style={{ width: "9%", padding: "6px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1", boxSizing: "border-box" }}>HSN/SAC</div>
            <div style={{ width: "7%", padding: "6px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1", boxSizing: "border-box" }}>QTY</div>
            <div style={{ width: "11%", padding: "6px 4px", textAlign: "right", borderRight: "1px solid #cbd5e1", boxSizing: "border-box" }}>Rate (Rs.)</div>
            <div style={{ width: "12%", padding: "6px 4px", textAlign: "right", borderRight: "1px solid #cbd5e1", boxSizing: "border-box" }}>Sub Total (Rs.)</div>
            <div style={{ width: "7%", padding: "6px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1", boxSizing: "border-box" }}>GST %</div>
            <div style={{ width: "10%", padding: "6px 4px", textAlign: "right", borderRight: "1px solid #cbd5e1", boxSizing: "border-box" }}>GST Amt (Rs.)</div>
            <div style={{ width: "12%", padding: "6px 4px", textAlign: "right", boxSizing: "border-box" }}>Total (Rs.)</div>
          </div>

          {/* Item Rows */}
          {items.map((item, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                flexDirection: "row",
                width: "100%",
                borderBottom: "1px solid #cbd5e1",
                fontSize: "8.5px",
                lineHeight: "12.5px",
                color: "#334155",
                backgroundColor: "#ffffff",
                boxSizing: "border-box",
              }}
            >
              <div style={{ width: "5%", padding: "6px 4px", textAlign: "center", color: "#64748b", borderRight: "1px solid #cbd5e1", boxSizing: "border-box" }}>
                {index + 1}
              </div>
              <div style={{ width: "27%", padding: "6px 6px", textAlign: "left", borderRight: "1px solid #cbd5e1", boxSizing: "border-box" }}>
                <div style={{ fontWeight: 700, color: "#0f172a", lineHeight: "12px" }}>
                  {item.product_name}
                </div>
                {item.discount_percent && item.discount_percent > 0 ? (
                  <div
                    style={{
                      fontSize: "7px",
                      fontWeight: 600,
                      color: "#059669",
                      marginTop: "1.5px",
                    }}
                  >
                    Disc: {item.discount_percent}% (-₹{formatCurrency(item.discount_amount || 0)})
                  </div>
                ) : null}
                {item.description && (
                  <div
                    style={{
                      fontSize: "7.5px",
                      color: "#64748b",
                      marginTop: "2px",
                      whiteSpace: "pre-line",
                      lineHeight: "11px",
                    }}
                  >
                    {item.description}
                  </div>
                )}
              </div>
              <div style={{ width: "9%", padding: "6px 4px", textAlign: "center", color: "#475569", borderRight: "1px solid #cbd5e1", boxSizing: "border-box" }}>
                {item.hsn_code || "—"}
              </div>
              <div style={{ width: "7%", padding: "6px 4px", textAlign: "center", fontWeight: 600, borderRight: "1px solid #cbd5e1", boxSizing: "border-box" }}>
                {item.quantity} {item.unit || ""}
              </div>
              <div style={{ width: "11%", padding: "6px 4px", textAlign: "right", borderRight: "1px solid #cbd5e1", boxSizing: "border-box" }}>
                {formatCurrency(item.rate)}
              </div>
              <div style={{ width: "12%", padding: "6px 4px", textAlign: "right", fontWeight: 600, borderRight: "1px solid #cbd5e1", boxSizing: "border-box" }}>
                {formatCurrency(item.taxable_amount)}
              </div>
              <div style={{ width: "7%", padding: "6px 4px", textAlign: "center", color: "#475569", borderRight: "1px solid #cbd5e1", boxSizing: "border-box" }}>
                {quotation.gst_enabled === false || item.gst_enabled === false || !item.gst_rate ? "" : `${item.gst_rate}%`}
              </div>
              <div style={{ width: "10%", padding: "6px 4px", textAlign: "right", borderRight: "1px solid #cbd5e1", boxSizing: "border-box" }}>
                {quotation.gst_enabled === false || item.gst_enabled === false || !item.total_gst_amount ? "" : formatCurrency(item.total_gst_amount)}
              </div>
              <div style={{ width: "12%", padding: "6px 4px", textAlign: "right", fontWeight: 700, color: "#0f172a", boxSizing: "border-box" }}>
                {formatCurrency(item.line_total)}
              </div>
            </div>
          ))}
        </div>

        {/* SUMMARY & TOTALS */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            width: "100%",
            border: "1px solid #cbd5e1",
            borderTop: "none",
            marginBottom: "12px",
            boxSizing: "border-box",
            backgroundColor: "#ffffff",
          }}
        >
          {/* Left Side: Amount in Words */}
          <div
            style={{
              width: "59%",
              padding: "8px 10px",
              borderRight: "1px solid #cbd5e1",
              boxSizing: "border-box",
            }}
          >
            <div style={{ fontSize: "7.5px", textTransform: "uppercase", fontWeight: 700, color: "#64748b", lineHeight: "10px" }}>
              Amount in words:
            </div>
            <div
              style={{
                fontSize: "9px",
                fontWeight: 700,
                color: "#1e3a5f",
                marginTop: "3px",
                lineHeight: "13px",
                textTransform: "capitalize",
              }}
            >
              {(quotation.amount_in_words && quotation.amount_in_words.trim()) || numberToIndianWords(quotation.grand_total) || "Zero Rupees Only"}
            </div>
          </div>

          {/* Right Side: Calculation Totals */}
          <div style={{ width: "41%", boxSizing: "border-box" }}>
            {quotation.total_discount && quotation.total_discount > 0 ? (
              <>
                <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", padding: "4px 6px", fontSize: "8.5px", borderBottom: "1px solid #cbd5e1", boxSizing: "border-box" }}>
                  <span style={{ color: "#475569", fontWeight: 600 }}>Gross Total:</span>
                  <span style={{ fontWeight: 700 }}>Rs. {formatCurrency((quotation.subtotal || 0) + (quotation.total_discount || 0))}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", padding: "4px 6px", fontSize: "8.5px", borderBottom: "1px solid #cbd5e1", boxSizing: "border-box" }}>
                  <span style={{ color: "#059669", fontWeight: 600 }}>Total Discount:</span>
                  <span style={{ fontWeight: 700, color: "#059669" }}>-Rs. {formatCurrency(quotation.total_discount)}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", padding: "4px 6px", fontSize: "8.5px", borderBottom: "1px solid #cbd5e1", boxSizing: "border-box" }}>
                  <span style={{ color: "#475569", fontWeight: 600 }}>Taxable Sub Total:</span>
                  <span style={{ fontWeight: 700 }}>Rs. {formatCurrency(quotation.subtotal)}</span>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", padding: "4px 6px", fontSize: "8.5px", borderBottom: "1px solid #cbd5e1", boxSizing: "border-box" }}>
                <span style={{ color: "#475569", fontWeight: 600 }}>Sub Total (Taxable):</span>
                <span style={{ fontWeight: 700 }}>Rs. {formatCurrency(quotation.subtotal)}</span>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", padding: "4px 6px", fontSize: "8.5px", borderBottom: "1px solid #cbd5e1", boxSizing: "border-box" }}>
              <span style={{ color: "#475569", fontWeight: 600 }}>Total GST:</span>
              <span style={{ fontWeight: 700 }}>
                {quotation.gst_enabled === false || !quotation.total_gst ? "" : `Rs. ${formatCurrency(quotation.total_gst)}`}
              </span>
            </div>
            {quotation.round_off !== undefined && quotation.round_off !== 0 && (
              <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", padding: "4px 6px", fontSize: "8.5px", borderBottom: "1px solid #cbd5e1", boxSizing: "border-box" }}>
                <span style={{ color: "#475569" }}>Round Off:</span>
                <span>Rs. {formatCurrency(quotation.round_off)}</span>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", padding: "5px 6px", fontSize: "9.5px", fontWeight: 800, color: "#1e3a5f", backgroundColor: "#f8fafc", boxSizing: "border-box" }}>
              <span>Grand Total:</span>
              <span>Rs. {formatCurrency(quotation.grand_total)}</span>
            </div>
          </div>
        </div>

        {/* GENERAL TERMS & CONDITIONS */}
        {terms.length > 0 && (
          <div style={{ marginBottom: "12px", width: "100%", boxSizing: "border-box" }}>
            <div
              style={{
                fontSize: "9px",
                fontWeight: 800,
                color: "#1e3a5f",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                borderBottom: "1px solid #cbd5e1",
                paddingBottom: "3px",
                marginBottom: "5px",
              }}
            >
              General Terms &amp; Conditions
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              {terms.map((term, index) => (
                <div key={index} style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", fontSize: "7.5px", lineHeight: "11.5px" }}>
                  <span style={{ width: "16px", fontWeight: 700, color: "#1e3a5f", flexShrink: 0 }}>
                    {index + 1})
                  </span>
                  <div
                    className="quotation-terms-content"
                    style={{ color: "#334155", wordBreak: "break-word", flex: 1 }}
                    dangerouslySetInnerHTML={{
                      __html: term.replace(/^(\d+[\.\)]\s*)+/, ""),
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* COMPANY BANK DETAILS */}
        {((company?.bank_name as string) || quotation.bank_name || (company?.account_number as string) || quotation.account_number) && (
          <div style={{ marginBottom: "12px", width: "100%", boxSizing: "border-box" }}>
            <div
              style={{
                fontSize: "9px",
                fontWeight: 800,
                color: "#1e3a5f",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                borderBottom: "1px solid #cbd5e1",
                paddingBottom: "3px",
                marginBottom: "5px",
              }}
            >
              Company Bank Details
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                flexWrap: "wrap",
                gap: "6px 20px",
                padding: "6px 10px",
                backgroundColor: "#f8fafc",
                border: "1px solid #cbd5e1",
                borderRadius: "4px",
                fontSize: "8px",
                lineHeight: "13px",
                color: "#334155",
              }}
            >
              {(quotation.bank_name || (company?.bank_name as string)) && (
                <div>
                  <strong>Bank Name :</strong>{" "}
                  <span style={{ fontWeight: 700, color: "#0f172a" }}>
                    {quotation.bank_name || (company?.bank_name as string)}
                  </span>
                </div>
              )}
              {(quotation.account_name || (company?.account_name as string) || companyName) && (
                <div>
                  <strong>Account Name :</strong>{" "}
                  <span style={{ fontWeight: 600, color: "#0f172a" }}>
                    {quotation.account_name || (company?.account_name as string) || companyName}
                  </span>
                </div>
              )}
              {(quotation.account_number || (company?.account_number as string)) && (
                <div>
                  <strong>A/c No. :</strong>{" "}
                  <span style={{ fontWeight: 700, color: "#1e40af", fontFamily: "monospace" }}>
                    {quotation.account_number || (company?.account_number as string)}
                  </span>
                </div>
              )}
              {(quotation.ifsc_code || (company?.ifsc_code as string)) && (
                <div>
                  <strong>IFSC Code :</strong>{" "}
                  <span style={{ fontWeight: 700, color: "#1e40af", fontFamily: "monospace" }}>
                    {quotation.ifsc_code || (company?.ifsc_code as string)}
                  </span>
                </div>
              )}
              {(quotation.branch_name || (company?.branch_name as string)) && (
                <div>
                  <strong>Branch :</strong>{" "}
                  <span>{quotation.branch_name || (company?.branch_name as string)}</span>
                </div>
              )}
              {(quotation.account_type || (company?.account_type as string)) && (
                <div>
                  <strong>A/c Type :</strong>{" "}
                  <span>{quotation.account_type || (company?.account_type as string)}</span>
                </div>
              )}
              {Boolean(company?.upi_id) && (
                <div>
                  <strong>UPI ID :</strong> <span>{company?.upi_id as string}</span>
                </div>
              )}
              {Boolean(company?.swift_code) && (
                <div>
                  <strong>SWIFT Code :</strong> <span>{company?.swift_code as string}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* DUAL SIGNATURES */}
        <div style={{ marginBottom: "12px", paddingTop: "8px", borderTop: "1.5px dashed #cbd5e1", width: "100%", boxSizing: "border-box" }}>
          <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", width: "100%" }}>
            {/* Company Signatory */}
            <div style={{ width: "55%", fontSize: "8px", lineHeight: "12px", boxSizing: "border-box" }}>
              <div style={{ fontWeight: 700, color: "#1e3a5f", marginBottom: "1px" }}>
                Thanks and Regards,
              </div>
              {companyName && (
                <div style={{ fontWeight: 800, color: "#0f172a" }}>For {companyName}</div>
              )}
              <div style={{ height: "24px" }} />
              {quotation.signatory_name && (
                <div style={{ fontWeight: 700, color: "#0f172a" }}>{quotation.signatory_name}</div>
              )}
              {quotation.signatory_designation && (
                <div style={{ fontSize: "7.5px", fontWeight: 600, color: "#1e3a5f", lineHeight: "11px" }}>
                  {quotation.signatory_designation}
                </div>
              )}
              {signatoryContacts && <div style={{ color: "#475569", lineHeight: "11px" }}>{signatoryContacts}</div>}
              {companyRegdAddress && (
                <div
                  style={{
                    color: "#64748b",
                    fontSize: "7.5px",
                    marginTop: "1px",
                    maxWidth: "340px",
                    lineHeight: "10.5px",
                  }}
                >
                  {companyRegdAddress}
                </div>
              )}
              {companyPhone && (
                <div style={{ color: "#64748b", fontSize: "7.5px", lineHeight: "10.5px" }}>Off Phone: {companyPhone}</div>
              )}
            </div>

            {/* Order Acceptance */}
            <div style={{ width: "45%", textAlign: "right", fontSize: "8px", lineHeight: "12px", boxSizing: "border-box" }}>
              <div style={{ fontWeight: 700, color: "#1e3a5f", marginBottom: "1px" }}>
                Order Acceptance
              </div>
              {customerDisplay && (
                <div style={{ fontWeight: 700, color: "#0f172a" }}>{customerDisplay}</div>
              )}
              <div style={{ height: "24px" }} />
              <div
                style={{
                  borderTop: "1px solid #94a3b8",
                  paddingTop: "3px",
                  color: "#64748b",
                  fontSize: "7.5px",
                  display: "inline-block",
                  minWidth: "180px",
                  lineHeight: "11px",
                }}
              >
                ( Authorized Signatory / Company Seal )
              </div>
            </div>
          </div>
        </div>

        {/* SYSTEM GENERATED NOTICE */}
        <div
          style={{
            textAlign: "center",
            fontSize: "7.5px",
            color: "#64748b",
            fontStyle: "italic",
            marginTop: "10px",
            marginBottom: "6px",
            boxSizing: "border-box",
          }}
        >
          * This is a system-generated quotation; physical signature is not required. *
        </div>

        {/* FOOTER AUDIT LINE */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: "5px",
            borderTop: "1px solid #e2e8f0",
            fontSize: "7px",
            color: "#94a3b8",
            lineHeight: "10px",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <div>
            Ref: {quotation.quotation_no || quotation.ref_no || ""} • Generated via {resolvedPortalLabel}
          </div>
          <div
            className="print-page-number"
            style={{
              textAlign: "center",
              fontWeight: 700,
              fontSize: "7.5px",
              color: "#334155",
            }}
          />
          <div style={{ textAlign: "right" }}>
            Generated By: {userLabel} •{" "}
            {new Date().toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}{" "}
            {new Date().toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            })}
          </div>
        </div>
      </div>
    </>
  );
}
