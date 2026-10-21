/**
 * @fileoverview Modal dialog to configure, preview, download, and print dedicated Proforma Invoices.
 * @module components/quotations/GenerateProformaModal
 */
"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  Download,
  Printer,
  X,
  CheckCircle2,
  Calendar,
  Truck,
  Building2,
  DollarSign,
  User,
  Shield,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { LargeModalPortal } from "@/components/portal/shared/LargeModalPortal";
import { ModalOverlay } from "@/components/portal/shared/ModalOverlay";
import {
  useSaveQuotationProformaMutation,
  useGetCompanyInfoQuery,
  useListUsersQuery,
  type LeadQuotationRecord,
  type LeadQuotationProformaDetails,
} from "@/store/api";
import { useAppSelector } from "@/store/hooks";
import { toast } from "@/lib/toast";
import { RichTextEditor } from "./RichTextEditor";
import ProformaInvoiceTemplate from "./ProformaInvoiceTemplate";
import { buildProformaInvoicePdf } from "./buildProformaInvoicePdf";
import { isSalesDepartmentUser } from "./quotationUtils";

type Props = {
  quotation: LeadQuotationRecord;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export function GenerateProformaModal({ quotation, open, onClose, onSuccess }: Props) {
  const authUser = useAppSelector((s) => s.auth.user);
  const { data: companyData } = useGetCompanyInfoQuery();
  const { data: usersData } = useListUsersQuery(undefined, { skip: !open });
  const [saveProforma, { isLoading: isSaving }] = useSaveQuotationProformaMutation();

  const usersList = React.useMemo(() => {
    return (
      Array.isArray(usersData)
        ? usersData
        : (usersData as { items?: unknown[] })?.items || (usersData as { data?: unknown[] })?.data || []
    ) as Array<{ _id: string; name?: string; email?: string; phone?: string; department?: string; is_active?: boolean }>;
  }, [usersData]);

  const salesUsers = React.useMemo(() => {
    return usersList.filter((u: any) => isSalesDepartmentUser(u));
  }, [usersList]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"configure" | "preview">("configure");
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Proforma State Fields
  const rawNo = quotation.quotation_no ? quotation.quotation_no.replace(/^QUOT-?/i, "") : String(Date.now()).slice(-4);
  const existingProforma = quotation.proforma_details || {};

  const [proformaNo, setProformaNo] = useState(existingProforma.proforma_no || `PINV-${rawNo}`);
  const [invoiceDate, setInvoiceDate] = useState(
    existingProforma.invoice_date
      ? new Date(existingProforma.invoice_date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0]
  );
  const [poNumber, setPoNumber] = useState(
    existingProforma.customer_po_number || quotation.customer_po_number || "Verbal"
  );
  const [poDate, setPoDate] = useState(
    existingProforma.customer_po_date
      ? new Date(existingProforma.customer_po_date).toISOString().split("T")[0]
      : quotation.customer_po_date
        ? new Date(quotation.customer_po_date).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0]
  );
  const defaultSalesPerson =
    existingProforma.sales_person ||
    quotation.sales_person_name ||
    (typeof quotation.sales_person_user === "object" && quotation.sales_person_user !== null
      ? quotation.sales_person_user.name || ""
      : "") ||
    (typeof quotation.created_by === "object" && quotation.created_by !== null
      ? quotation.created_by.name || ""
      : "") ||
    (typeof authUser?.name === "string" ? authUser.name : "") ||
    "Sales Executive";

  const [salesPerson, setSalesPerson] = useState<string>(defaultSalesPerson);
  const [orc, setOrc] = useState(existingProforma.orc || "na");
  const [dispatchDate, setDispatchDate] = useState(
    existingProforma.dispatch_date
      ? new Date(existingProforma.dispatch_date).toISOString().split("T")[0]
      : quotation.valid_until
        ? new Date(quotation.valid_until).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0]
  );
  const [freightCharges, setFreightCharges] = useState(
    existingProforma.freight_charges || "Extra at actual"
  );
  const [paymentTerms, setPaymentTerms] = useState(
    existingProforma.payment_terms || quotation.payment_terms || "On Delivery"
  );
  const [transport, setTransport] = useState(
    existingProforma.transport || "To be arranged / SafeXpress"
  );
  const [shipToAddress, setShipToAddress] = useState(
    existingProforma.ship_to_address || "same as billing"
  );
  const [customerType, setCustomerType] = useState(
    existingProforma.customer_type || "Dealer"
  );
  const [installationRequired, setInstallationRequired] = useState(
    existingProforma.installation_required || "No"
  );
  const [gstConcession, setGstConcession] = useState(
    existingProforma.gst_concession || "na"
  );
  const [marginSheetAttached, setMarginSheetAttached] = useState(
    existingProforma.margin_sheet_attached || "na"
  );
  const [kycStatus, setKycStatus] = useState(
    existingProforma.kyc_status || "na"
  );
  const [remarks, setRemarks] = useState(existingProforma.remarks || "");
  const [message, setMessage] = useState(
    existingProforma.message || (quotation as any).message || (quotation as any).quotation_message || ""
  );

  // Reset/sync when opened
  useEffect(() => {
    if (!open) return;
    const p = quotation.proforma_details || {};
    setProformaNo(p.proforma_no || `PINV-${rawNo}`);
    setInvoiceDate(
      p.invoice_date
        ? new Date(p.invoice_date).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0]
    );
    setPoNumber(p.customer_po_number || quotation.customer_po_number || "Verbal");
    setPoDate(
      p.customer_po_date
        ? new Date(p.customer_po_date).toISOString().split("T")[0]
        : quotation.customer_po_date
          ? new Date(quotation.customer_po_date).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0]
    );
    // Find sales person from quotation
    let matchedName = p.sales_person || quotation.sales_person_name || "";
    if (!matchedName && typeof quotation.sales_person_user === "object" && quotation.sales_person_user !== null) {
      matchedName = quotation.sales_person_user.name || "";
    }
    if (!matchedName && typeof quotation.sales_person_user === "string" && usersList.length > 0) {
      const u = usersList.find((x) => x._id === quotation.sales_person_user);
      if (u) matchedName = u.name || u.email || "";
    }
    if (!matchedName && typeof quotation.created_by === "object" && quotation.created_by !== null) {
      matchedName = quotation.created_by.name || "";
    }
    if (!matchedName && typeof authUser?.name === "string") {
      matchedName = authUser.name;
    }
    setSalesPerson(matchedName || "Sales Executive");
    setOrc(p.orc || "na");
    setDispatchDate(
      p.dispatch_date
        ? new Date(p.dispatch_date).toISOString().split("T")[0]
        : quotation.valid_until
          ? new Date(quotation.valid_until).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0]
    );
    setFreightCharges(p.freight_charges || "Extra at actual");
    setPaymentTerms(p.payment_terms || quotation.payment_terms || "On Delivery");
    setTransport(p.transport || "To be arranged / SafeXpress");
    setShipToAddress(p.ship_to_address || "same as billing");
    setCustomerType(p.customer_type || "Dealer");
    setInstallationRequired(p.installation_required || "No");
    setGstConcession(p.gst_concession || "na");
    setMarginSheetAttached(p.margin_sheet_attached || "na");
    setKycStatus(p.kyc_status || "na");
    setRemarks(p.remarks || "");
    setMessage(p.message || (quotation as any).message || (quotation as any).quotation_message || "");
  }, [open, quotation, rawNo, authUser?.name, usersList]);

  const currentProformaDetails: LeadQuotationProformaDetails = {
    proforma_no: proformaNo.trim(),
    invoice_date: invoiceDate,
    customer_po_number: poNumber.trim() || "Verbal",
    customer_po_date: poDate,
    sales_person: salesPerson.trim(),
    orc: orc.trim() || "na",
    dispatch_date: dispatchDate,
    freight_charges: freightCharges.trim() || "Extra at actual",
    payment_terms: paymentTerms.trim() || "On Delivery",
    transport: transport.trim(),
    ship_to_address: shipToAddress.trim() || "same as billing",
    customer_type: customerType,
    installation_required: installationRequired,
    gst_concession: gstConcession.trim() || "na",
    margin_sheet_attached: marginSheetAttached.trim() || "na",
    kyc_status: kycStatus.trim() || "na",
    remarks: remarks.trim(),
    message: message.trim() || undefined,
  };

  const handleSaveOnly = async () => {
    try {
      await saveProforma({
        quotationId: quotation._id,
        body: currentProformaDetails,
      }).unwrap();
      toast.success(`Proforma Invoice #${proformaNo} saved successfully!`);
      onSuccess?.();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save Proforma Invoice");
    }
  };

  const handleDownloadVectorPdf = async () => {
    try {
      setDownloadingPdf(true);
      // First save details to server
      await saveProforma({
        quotationId: quotation._id,
        body: currentProformaDetails,
      }).unwrap();

      const pdf = await buildProformaInvoicePdf({
        quotation,
        proformaDetails: currentProformaDetails,
        company: companyData as any,
        portalLabel: "Lead Manager",
        downloadedBy: typeof authUser?.name === "string" ? authUser.name : undefined,
      });

      const fileName = `${proformaNo.replace(/\//g, "-")}_Proforma_Invoice.pdf`;
      pdf.save(fileName);
      toast.success(`Proforma Invoice ${proformaNo} downloaded successfully!`);
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate Proforma PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handlePrint = () => {
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

    const previewNode = document.getElementById("proforma-pdf-root");
    if (!previewNode) {
      toast.error("Unable to load print document");
      return;
    }

    // Detect if content exceeds single A4 printable page height (~1060px)
    const isMultiPage = (previewNode.scrollHeight || 0) > 1060;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${proformaNo}_Proforma_Invoice</title>
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
            #proforma-pdf-root {
              width: 100% !important;
              max-width: 794px !important;
              margin: 0 auto !important;
              padding: 0 !important;
              box-shadow: none !important;
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
          ${previewNode.outerHTML}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(printFrame);
      }, 2000);
    }, 300);
  };

  if (!open) return null;

  const labelClass = "block text-xs font-bold text-slate-700 dark:text-slate-200";
  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white";

  return (
    <LargeModalPortal>
      <ModalOverlay onClick={onClose}>
        <div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 flex flex-col w-full max-w-5xl max-h-[92vh] rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-white/10 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-white/5 dark:bg-slate-800/60">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-md shadow-teal-600/20">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  Generate Proforma Invoice
                  <span className="rounded-md bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                    {proformaNo}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Quotation #{quotation.quotation_no} • {quotation.customer_name || "Customer"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Tab Selector */}
              <div className="flex rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab("configure")}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                    activeTab === "configure"
                      ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  Configure Details
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("preview")}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                    activeTab === "preview"
                      ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  Live Preview & Print
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "configure" ? (
              <div className="space-y-6">
                {/* 1. Document References Card */}
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4.5 dark:border-white/5 dark:bg-slate-800/40 space-y-4">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    Proforma Document Reference & PO Details
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
                    <div>
                      <label className={labelClass}>Pro. Invoice No. *</label>
                      <input
                        type="text"
                        value={proformaNo}
                        onChange={(e) => setProformaNo(e.target.value)}
                        placeholder="PINV-3475"
                        className={`mt-1 font-bold ${inputClass}`}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Invoice Date *</label>
                      <input
                        type="date"
                        value={invoiceDate}
                        onChange={(e) => setInvoiceDate(e.target.value)}
                        className={`mt-1 ${inputClass}`}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Customer PO No.</label>
                      <input
                        type="text"
                        value={poNumber}
                        onChange={(e) => setPoNumber(e.target.value)}
                        placeholder="e.g. Verbal or PO-987"
                        className={`mt-1 ${inputClass}`}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Customer PO Date</label>
                      <input
                        type="date"
                        value={poDate}
                        onChange={(e) => setPoDate(e.target.value)}
                        className={`mt-1 ${inputClass}`}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Commercial Order Details Card */}
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4.5 dark:border-indigo-900/30 dark:bg-indigo-950/20 space-y-4">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5 text-indigo-600" />
                    Order & Commercial Dispatch Parameters
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    <div>
                      <label className={labelClass}>Sales Person (from Quotation)</label>
                      {salesUsers.length > 0 ? (
                        <select
                          value={salesPerson}
                          onChange={(e) => setSalesPerson(e.target.value)}
                          className={`mt-1 font-medium ${inputClass}`}
                        >
                          <option value="">-- Select Sales Person --</option>
                          {salesUsers.map((u) => {
                            const val = u.name || u.email || "";
                            return (
                              <option key={u._id} value={val}>
                                {val} {u.department ? `[${u.department.toUpperCase()}]` : ""}
                              </option>
                            );
                          })}
                          {salesPerson &&
                            !salesUsers.some((u) => (u.name || u.email) === salesPerson) && (
                              <option value={salesPerson}>{salesPerson} (Quotation Default)</option>
                            )}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={salesPerson}
                          onChange={(e) => setSalesPerson(e.target.value)}
                          placeholder="e.g. Pankaj Kumar"
                          className={`mt-1 ${inputClass}`}
                        />
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>ORC (Order Referral Commission)</label>
                      <input
                        type="text"
                        value={orc}
                        onChange={(e) => setOrc(e.target.value)}
                        placeholder="e.g. na"
                        className={`mt-1 ${inputClass}`}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Dispatch Date</label>
                      <input
                        type="date"
                        value={dispatchDate}
                        onChange={(e) => setDispatchDate(e.target.value)}
                        className={`mt-1 ${inputClass}`}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Freight Charges</label>
                      <input
                        type="text"
                        value={freightCharges}
                        onChange={(e) => setFreightCharges(e.target.value)}
                        placeholder="e.g. Extra to pay to bhalla ji - 300"
                        className={`mt-1 ${inputClass}`}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Payment Terms</label>
                      <input
                        type="text"
                        value={paymentTerms}
                        onChange={(e) => setPaymentTerms(e.target.value)}
                        placeholder="e.g. On Delivery / 100% Advance"
                        className={`mt-1 ${inputClass}`}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Transport Details</label>
                      <input
                        type="text"
                        value={transport}
                        onChange={(e) => setTransport(e.target.value)}
                        placeholder="e.g. SafeXpress / By Hand"
                        className={`mt-1 ${inputClass}`}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Ship To Address</label>
                      <input
                        type="text"
                        value={shipToAddress}
                        onChange={(e) => setShipToAddress(e.target.value)}
                        placeholder="e.g. same as billing"
                        className={`mt-1 ${inputClass}`}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Customer Type</label>
                      <select
                        value={customerType}
                        onChange={(e) => setCustomerType(e.target.value)}
                        className={`mt-1 ${inputClass}`}
                      >
                        <option value="Dealer">Dealer</option>
                        <option value="Hospital / Clinic">Hospital / Clinic</option>
                        <option value="End User">End User</option>
                        <option value="Distributor">Distributor</option>
                        <option value="OEM">OEM</option>
                        <option value="Government">Government Institution</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Installation Required</label>
                      <select
                        value={installationRequired}
                        onChange={(e) => setInstallationRequired(e.target.value)}
                        className={`mt-1 ${inputClass}`}
                      >
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                        <option value="Optional / On Charge">Optional / On Charge</option>
                      </select>
                    </div>

                    <div>
                      <label className={labelClass}>GST Concession</label>
                      <input
                        type="text"
                        value={gstConcession}
                        onChange={(e) => setGstConcession(e.target.value)}
                        placeholder="e.g. na or 5% Concession Certificate"
                        className={`mt-1 ${inputClass}`}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Margin Sheet Attached</label>
                      <input
                        type="text"
                        value={marginSheetAttached}
                        onChange={(e) => setMarginSheetAttached(e.target.value)}
                        placeholder="e.g. na or Yes"
                        className={`mt-1 ${inputClass}`}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>KYC Status</label>
                      <input
                        type="text"
                        value={kycStatus}
                        onChange={(e) => setKycStatus(e.target.value)}
                        placeholder="e.g. na or Verified"
                        className={`mt-1 ${inputClass}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Cover / Introductory Message (Above Items & Pricing) */}
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4.5 dark:border-white/5 dark:bg-slate-800/40 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      Introductory Message / Cover Note (Above Requirements)
                    </span>
                    {message && (
                      <button
                        type="button"
                        onClick={() => setMessage("")}
                        className="text-xs font-medium text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:underline"
                      >
                        Clear Message
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Optional introductory / cover message printed directly above goods &amp; pricing on the Proforma Invoice. Left blank, nothing is printed.
                  </p>
                  <RichTextEditor
                    value={message}
                    onChange={(val) => setMessage(val)}
                    placeholder="Enter introductory message or note for Proforma invoice..."
                    minHeight="95px"
                  />
                </div>

                {/* 3. Items & Financial Summary Overview */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4.5 dark:border-white/10 dark:bg-slate-800/30">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Line Items Included in Proforma ({quotation.items?.length || 0})
                    </span>
                    <span className="text-xs font-bold text-primary">
                      Grand Total: ₹ {quotation.grand_total ? quotation.grand_total.toLocaleString("en-IN") : "0"}
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-white/5">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <tr>
                          <th className="py-2 px-3">#</th>
                          <th className="py-2 px-3">Description</th>
                          <th className="py-2 px-3 text-center">HSN</th>
                          <th className="py-2 px-3 text-center">Qty</th>
                          <th className="py-2 px-3 text-right">Rate (₹)</th>
                          <th className="py-2 px-3 text-right">Tax (₹)</th>
                          <th className="py-2 px-3 text-right">Total (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {quotation.items?.map((it, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                            <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                              {it.product_name}
                            </td>
                            <td className="py-2 px-3 text-center text-slate-500">{it.hsn_code || "—"}</td>
                            <td className="py-2 px-3 text-center font-bold">{it.quantity}</td>
                            <td className="py-2 px-3 text-right">{it.rate?.toLocaleString("en-IN")}</td>
                            <td className="py-2 px-3 text-right text-slate-500">{it.total_gst_amount?.toLocaleString("en-IN")}</td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white">
                              {it.line_total?.toLocaleString("en-IN")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              /* Live Preview Tab */
              <div className="flex flex-col items-center bg-slate-100 p-4 rounded-2xl dark:bg-slate-950/60 overflow-x-auto">
                <ProformaInvoiceTemplate
                  quotation={quotation}
                  proformaDetails={currentProformaDetails}
                />
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 dark:border-white/5 dark:bg-slate-800/50">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 transition-colors"
            >
              Close
            </button>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveOnly}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 transition-colors cursor-pointer"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                Save Details
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 transition-colors cursor-pointer"
              >
                <Printer className="h-4 w-4 text-slate-600" />
                Print Proforma
              </button>

              <button
                type="button"
                disabled={downloadingPdf || isSaving}
                onClick={handleDownloadVectorPdf}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-4.5 py-2 text-xs font-bold text-white shadow-md shadow-teal-600/20 hover:opacity-95 transition-all cursor-pointer"
              >
                {downloadingPdf ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {downloadingPdf ? "Generating..." : "Generate & Download PDF"}
              </button>
            </div>
          </div>
        </div>
      </ModalOverlay>
    </LargeModalPortal>
  );
}
