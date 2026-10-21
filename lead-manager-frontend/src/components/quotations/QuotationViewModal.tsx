/**
 * @fileoverview Modal to View and Print Quotation in Letterhead format.
 * Uses isolated iframe printing to guarantee 100% pure PDF content in the print preview.
 * @module components/portal/shared/quotations/QuotationViewModal
 */
"use client";

import React, { useRef, useMemo } from "react";
import Link from "next/link";
import { X, Printer, FileText, Lock, Copy } from "lucide-react";
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
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Quotation_${quotation.ref_no || quotation.quotation_no || "Document"}</title>
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
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Quotation Preview: {quotation.ref_no || quotation.quotation_no}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  quotation.approval_status === "approved" || quotation.status === "approved"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                }`}>
                  {quotation.approval_status || quotation.status}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Official Letterhead format for {quotation.customer_name}
              </p>
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
                      quotation,
                      company: companyData as any,
                      portalLabel,
                      downloadedBy,
                    });
                    pdf.save(`Quotation_${quotation.ref_no || quotation.quotation_no || "document"}.pdf`);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-hover cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print
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
                quotation={quotation}
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
