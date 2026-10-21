/**
 * @fileoverview Modal to View and Print Quotation in Letterhead format.
 * Uses isolated iframe printing to guarantee 100% pure PDF content in the print preview.
 * @module components/portal/shared/quotations/QuotationViewModal
 */
"use client";

import React, { useRef, useMemo, useState } from "react";
import Link from "next/link";
import { X, Printer, FileText, Lock, Copy, History } from "lucide-react";
import { useGetCompanyInfoQuery, type LeadQuotationRecord } from "@/store/api";
import { useAppSelector } from "@/store/hooks";
import { readSessionFromStorage } from "@/utils/authStorage";
import QuotationPdfTemplate from "./QuotationPdfTemplate";
import { canViewQuotationPdf } from "./quotationUtils";

type Props = {
  quotation: LeadQuotationRecord | null;
  open: boolean;
  onClose: () => void;
  portalLabel?: string;
};

export function QuotationViewModal({
  quotation,
  open,
  onClose,
  portalLabel = "Lead Manager",
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { data: companyData } = useGetCompanyInfoQuery();
  const reduxUser = useAppSelector((s) => s.auth.user);
  const sessionUser = useMemo(() => (typeof window !== "undefined" ? readSessionFromStorage()?.user || null : null), []);
  const authUser = (reduxUser || sessionUser) as any;

  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

  const downloadedBy = useMemo(() => {
    if (!authUser) return quotation?.signatory_name || "User";
    const name = String(authUser.name || "").trim();
    if (name && name !== "Authorized Staff" && name !== "Authorized User") return name;
    const first = String(authUser.first_name || "").trim();
    const last = String(authUser.last_name || "").trim();
    const full = `${first} ${last}`.trim();
    if (full) return full;
    const uname = String((authUser as any).username || "").trim();
    if (uname) return uname;
    const email = String(authUser.email || "").trim();
    if (email) return email;
    return quotation?.signatory_name || "User";
  }, [authUser, quotation?.signatory_name]);

  const currentVersion = quotation?.version || 1;
  const activeVersion = selectedVersion ?? currentVersion;
  const isViewingArchive = activeVersion !== currentVersion;

  const availableVersions = useMemo(() => {
    if (!quotation) return [];
    const set = new Set<number>();
    set.add(currentVersion);
    if (Array.isArray(quotation.revision_history)) {
      quotation.revision_history.forEach((rev) => {
        if (rev && typeof rev.version === "number") set.add(rev.version);
      });
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [currentVersion, quotation]);

  const selectedRevisionSnapshot = useMemo(() => {
    if (!quotation || !isViewingArchive || !Array.isArray(quotation.revision_history)) return null;
    return quotation.revision_history.find((r) => r.version === activeVersion) || null;
  }, [quotation, isViewingArchive, activeVersion]);

  const displayedQuotation = useMemo<LeadQuotationRecord>(() => {
    if (!quotation) return quotation as unknown as LeadQuotationRecord;
    if (!isViewingArchive || !selectedRevisionSnapshot) return quotation;
    const snap = selectedRevisionSnapshot;
    return {
      ...quotation,
      version: snap.version,
      subtotal: snap.subtotal ?? quotation.subtotal,
      total_discount: snap.total_discount ?? quotation.total_discount,
      total_gst: snap.total_gst ?? quotation.total_gst,
      round_off: snap.round_off ?? quotation.round_off,
      grand_total: snap.grand_total ?? quotation.grand_total,
      amount_in_words: snap.amount_in_words ?? quotation.amount_in_words,
      items: (snap.items as any) || quotation.items,
      terms_and_conditions: snap.terms_and_conditions ?? quotation.terms_and_conditions,
      message: snap.message ?? quotation.message,
      quotation_message: snap.quotation_message ?? quotation.quotation_message,
      customer_name: snap.customer_name ?? quotation.customer_name,
      kind_attn: snap.kind_attn ?? quotation.kind_attn,
      phone: snap.phone ?? quotation.phone,
      cell: snap.cell ?? quotation.cell,
      email: snap.email ?? quotation.email,
      gstin: snap.gstin ?? quotation.gstin,
      customer_ref: snap.customer_ref ?? quotation.customer_ref,
      subject: snap.subject ?? quotation.subject,
      address: snap.address ?? quotation.address,
      valid_until: snap.valid_until ?? quotation.valid_until,
      validity_days: snap.validity_days ?? quotation.validity_days,
      signatory_name: snap.signatory_name ?? quotation.signatory_name,
      signatory_designation: snap.signatory_designation ?? quotation.signatory_designation,
      signatory_email: snap.signatory_email ?? quotation.signatory_email,
      signatory_phone: snap.signatory_phone ?? quotation.signatory_phone,
      signatory_user: (snap.signatory_user as any) ?? quotation.signatory_user,
      sales_person_name: snap.sales_person_name ?? quotation.sales_person_name,
      sales_person_designation: snap.sales_person_designation ?? quotation.sales_person_designation,
      sales_person_phone: snap.sales_person_phone ?? quotation.sales_person_phone,
      sales_person_email: snap.sales_person_email ?? quotation.sales_person_email,
      sales_person_user: (snap.sales_person_user as any) ?? quotation.sales_person_user,
      bank_name: snap.bank_name ?? quotation.bank_name,
      account_name: snap.account_name ?? quotation.account_name,
      account_number: snap.account_number ?? quotation.account_number,
      ifsc_code: snap.ifsc_code ?? quotation.ifsc_code,
      branch_name: snap.branch_name ?? quotation.branch_name,
      account_type: snap.account_type ?? quotation.account_type,
      gst_enabled: snap.gst_enabled ?? quotation.gst_enabled,
      is_historical_snapshot: true,
    };
  }, [quotation, isViewingArchive, selectedRevisionSnapshot]);

  if (!open || !quotation) return null;

  const isPdfAllowed = canViewQuotationPdf(authUser, quotation);

  /**
   * Pure Isolated Iframe Printing:
   * Writes only the quotation letterhead into an isolated iframe document
   * so the browser print preview contains ZERO surrounding UI or modal chrome.
   */
  const handlePrint = () => {
    if (!containerRef.current || !isPdfAllowed) return;

    // Detect if content exceeds single A4 printable page height (~1060px)
    const isMultiPage = (containerRef.current.scrollHeight || 0) > 1060;

    const printFrame = document.createElement("iframe");
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow?.document;
    if (!doc) return;

    doc.open();
    const docTitle = `Quotation_${displayedQuotation.ref_no || displayedQuotation.quotation_no || "Document"}${isViewingArchive ? `_v${displayedQuotation.version}` : ""}`;
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${docTitle}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm 10mm;
              ${
                isMultiPage
                  ? `@bottom-center {
                content: "Page " counter(page) " of " counter(pages);
                font-size: 7.5pt;
                font-weight: 700;
                color: #334155;
              }`
                  : `@bottom-center {
                content: none;
              }`
              }
            }
            * {
              box-sizing: border-box;
            }
            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #0f172a;
              font-family: Arial, Helvetica, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            #quotation-pdf-root {
              width: 100% !important;
              max-width: 794px !important;
              margin: 0 auto !important;
              padding: 0 !important;
              box-shadow: none !important;
              background: #ffffff !important;
            }
            .rich-text-content {
              font-size: 8.5px !important;
              line-height: 1.4 !important;
              color: #1e293b !important;
            }
            .rich-text-content table {
              width: 100% !important;
              border-collapse: collapse !important;
              margin: 4px 0 6px 0 !important;
              page-break-inside: avoid !important;
            }
            .rich-text-content th,
            .rich-text-content td {
              border: 1px solid #cbd5e1 !important;
              padding: 4px 6px !important;
              font-size: 8px !important;
              line-height: 1.3 !important;
              text-align: left !important;
              vertical-align: top !important;
            }
            .rich-text-content th {
              background-color: #f1f5f9 !important;
              font-weight: 700 !important;
              color: #0f172a !important;
            }
            .rich-text-content h1 {
              font-size: 11px !important;
              font-weight: 700 !important;
              margin: 4px 0 2px 0 !important;
              color: #0f172a !important;
            }
            .rich-text-content h2 {
              font-size: 10px !important;
              font-weight: 700 !important;
              margin: 3px 0 2px 0 !important;
              color: #0f172a !important;
            }
            .rich-text-content h3 {
              font-size: 9px !important;
              font-weight: 700 !important;
              margin: 2px 0 1px 0 !important;
              color: #0f172a !important;
            }
            .rich-text-content p {
              margin: 0 0 3px 0 !important;
            }
            .rich-text-content ul,
            .rich-text-content ol {
              margin: 2px 0 4px 0 !important;
              padding-left: 16px !important;
            }
            .rich-text-content li {
              margin-bottom: 2px !important;
            }
            .rich-text-content blockquote {
              border-left: 2px solid #94a3b8 !important;
              padding-left: 8px !important;
              margin: 3px 0 !important;
              font-style: italic !important;
            }
            .rich-text-content hr {
              border: none !important;
              border-top: 1px solid #cbd5e1 !important;
              margin: 4px 0 !important;
            }
            ${
              isMultiPage
                ? `.print-page-number::after {
              content: "Page " counter(page) " of " counter(pages);
            }`
                : `.print-page-number {
              display: none !important;
            }`
            }
          </style>
        </head>
        <body class="${isMultiPage ? "multi-page" : "single-page"}">
          ${containerRef.current.innerHTML}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      } catch (err) {
        console.error("Print error:", err);
      } finally {
        setTimeout(() => {
          if (document.body.contains(printFrame)) {
            document.body.removeChild(printFrame);
          }
        }, 1000);
      }
    }, 250);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-900/60 p-3 sm:p-6 backdrop-blur-xs">
      <div className="relative flex max-h-[96vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900 overflow-hidden">
        {/* Top Action Bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-3.5 dark:border-white/10">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Quotation Preview: {displayedQuotation.ref_no || displayedQuotation.quotation_no}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      displayedQuotation.approval_status === "approved" || displayedQuotation.status === "approved"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    }`}
                  >
                    {displayedQuotation.approval_status || displayedQuotation.status}
                  </span>
                  <span
                    className={`rounded-md px-1.5 py-0.2 text-[10px] font-extrabold ${
                      isViewingArchive
                        ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-300"
                    }`}
                  >
                    v{displayedQuotation.version || 1} {isViewingArchive ? "(Archived)" : ""}
                  </span>
                </h3>
              </div>
              <p className="text-[11px] text-slate-500">
                Official Letterhead format for {displayedQuotation.customer_name}
              </p>

              {/* Version switcher pills */}
              {availableVersions.length > 1 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
                    <History className="h-3 w-3" /> Version:
                  </span>
                  {availableVersions.map((v) => {
                    const isCurrent = v === currentVersion;
                    const isSelected = activeVersion === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setSelectedVersion(isCurrent ? null : v)}
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold transition-all cursor-pointer ${
                          isSelected
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                            : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        v{v}
                        {isCurrent && (
                          <span className="text-[9px] font-extrabold uppercase opacity-80">(Cur)</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/quotations/new?copy_from=${quotation._id}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
              title="Copy this quotation as a new quotation"
            >
              <Copy className="h-3.5 w-3.5 text-indigo-500" />
              Copy
            </Link>
            {isPdfAllowed && (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    const { buildQuotationPdf } = await import("./buildQuotationPdf");
                    const pdf = await buildQuotationPdf({
                      quotation: displayedQuotation,
                      company: companyData as any,
                      portalLabel,
                      downloadedBy,
                    });
                    const fileName = `Quotation_${displayedQuotation.ref_no || displayedQuotation.quotation_no || "document"}${isViewingArchive ? `_v${displayedQuotation.version}` : ""}.pdf`;
                    pdf.save(fileName);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  Download PDF (v{displayedQuotation.version || 1})
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-hover cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print (v{displayedQuotation.version || 1})
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Letterhead Area - Centered A4 Sheet */}
        <div className="flex-1 overflow-y-auto bg-slate-100/70 p-4 sm:p-8 dark:bg-slate-950/60 flex justify-center items-start">
          {!isPdfAllowed ? (
            <div className="my-12 w-full max-w-md rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-xl dark:border-amber-900/40 dark:bg-slate-900">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                <Lock className="h-7 w-7" />
              </div>
              <h4 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
                PDF Preview Restricted
              </h4>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                This quotation is currently <strong>Pending Signatory Approval</strong>.
              </p>
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 p-3 rounded-xl dark:bg-amber-950/40 font-semibold">
                Only the assigned signatory (<strong>{quotation.signatory_name || "Authorized Signatory"}</strong>) can preview or download the PDF prior to approval. Creators and managers can preview & download after approval.
              </p>
            </div>
          ) : (
            <div
              ref={containerRef}
              className="w-full max-w-[794px] bg-white shadow-xl rounded-md overflow-hidden flex justify-center"
            >
              <QuotationPdfTemplate
                quotation={displayedQuotation}
                portalLabel={portalLabel}
                downloadedBy={downloadedBy}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
