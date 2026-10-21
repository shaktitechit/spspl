/**
 * @fileoverview Complete Quotation Detail Page with status tracking, letterhead preview, 
 * signatory approval workflow, financial summary, line items, and email dispatch.
 * @module components/portal/shared/quotations/QuotationDetailPage
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Pencil,
  Send,
  Check,
  X,
  Printer,
  Mail,
  Lock,
  FileText,
  Building2,
  User,
  Calendar,
  DollarSign,
  CheckCircle2,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Download,
  ExternalLink,
  Eye,
  Share2,
  ShieldCheck,
  Tag,
  Phone,
  PauseCircle,
  Copy,
  MessageSquare,
  History,
  ShoppingCart,
  RefreshCw,
  GitCompare,
} from "lucide-react";
import {
  useGetLeadQuotationQuery,
  useSubmitLeadQuotationForApprovalMutation,
  useApproveLeadQuotationMutation,
  useRejectLeadQuotationMutation,
  useUpdateLeadQuotationMutation,
  useMarkQuotationProformaIssuedMutation,
  useGetCompanyInfoQuery,
  type LeadQuotationRecord,
  type LeadRecord,
} from "@/store/api";
import { useAppSelector } from "@/store/hooks";
import { readSessionFromStorage, isManager } from "@/utils/authStorage";
import { toast } from "@/lib/toast";
import QuotationPdfTemplate from "./QuotationPdfTemplate";
import { SendQuotationEmailModal } from "./SendQuotationEmailModal";
import { QuotationLifecycleStepper } from "./QuotationLifecycleStepper";
import { QuotationFollowUpCard } from "./QuotationFollowUpCard";
import { CustomerRejectQuotationModal } from "./CustomerRejectQuotationModal";
import { ConvertQuotationModal } from "./ConvertQuotationModal";
import { GenerateProformaModal } from "./GenerateProformaModal";
import { ExtendQuotationValidityModal } from "./ExtendQuotationValidityModal";
import { QuotationVersionDiffModal } from "./QuotationVersionDiffModal";
import { buildQuotationPdf } from "./buildQuotationPdf";
import { numberToIndianWords } from "./quotationLineMath";
import {
  formatCurrencyINR,
  isAssignedSignatory,
  isStrictSignatory,
  isQuotationCreator,
  canViewQuotationPdf,
  canEmailQuotation,
  canEditQuotation,
  canSubmitForApproval,
  isQuotationApproved,
  canConvertQuotation,
  isQuotationExpired,
  isQuotationExpiringSoon,
  getQuotationExpiryInfo,
} from "./quotationUtils";

type Props = {
  quotationId: string;
  portalHome?: string;
};

export default function QuotationDetailPage({ quotationId, portalHome = "/dashboard" }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const reduxUser = useAppSelector((state) => state.auth.user);
  const sessionUser = useMemo(() => readSessionFromStorage()?.user || null, []);
  const authUser = (reduxUser || sessionUser) as any;

  // Data Query
  const { data: quotation, isLoading, isError, refetch } = useGetLeadQuotationQuery(quotationId, {
    skip: !quotationId,
  });

  const downloadedBy = useMemo(() => {
    if (!authUser) return quotation?.signatory_name || "User";
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
    return quotation?.signatory_name || "User";
  }, [authUser, quotation?.signatory_name]);

  // Mutations
  const [submitForApproval, { isLoading: isSubmitting }] = useSubmitLeadQuotationForApprovalMutation();
  const [approveQuotation, { isLoading: isApproving }] = useApproveLeadQuotationMutation();
  const [rejectQuotation, { isLoading: isRejecting }] = useRejectLeadQuotationMutation();
  const [updateQuotation, { isLoading: isUpdating }] = useUpdateLeadQuotationMutation();
  const [markProformaIssued] = useMarkQuotationProformaIssuedMutation();
  const { data: companyData } = useGetCompanyInfoQuery();

  // Dialog & Modal States
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showOnHoldModal, setShowOnHoldModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showCustomerRejectModal, setShowCustomerRejectModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showProformaModal, setShowProformaModal] = useState(false);
  const [showExtendValidityModal, setShowExtendValidityModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [downloadingProforma, setDownloadingProforma] = useState(false);

  // Versioning & Comparison States
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareFromVersion, setCompareFromVersion] = useState<number>(1);
  const [compareToVersion, setCompareToVersion] = useState<number>(2);

  // Version Resolution & Historical Snapshot Derivation (Unconditional hooks before early returns)
  const currentVersion = quotation?.version || 1;
  const activeVersion = selectedVersion ?? currentVersion;
  const isViewingArchive = Boolean(quotation) && activeVersion !== currentVersion;

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

  const displayedQuotation = useMemo<LeadQuotationRecord | null>(() => {
    if (!quotation) return null;
    if (!isViewingArchive || !selectedRevisionSnapshot) {
      return quotation;
    }
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

  const handleDownloadProforma = async () => {
    if (!quotation) return;
    try {
      setDownloadingProforma(true);
      const pdf = await buildQuotationPdf({
        quotation,
        company: companyData as any,
        portalLabel: "Lead Manager",
        downloadedBy: authUser?.name,
        documentType: "proforma",
      });
      const fileName = `${(quotation.ref_no || quotation.quotation_no || "Quotation").replace(/\//g, "-")}_Proforma_Invoice.pdf`;
      pdf.save(fileName);
      await markProformaIssued(quotation._id).unwrap();
      toast.success("Proforma Invoice downloaded and recorded successfully");
    } catch (err: any) {
      console.error("Proforma generation failed", err);
      toast.error("Failed to generate Proforma Invoice");
    } finally {
      setDownloadingProforma(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Loading quotation details...
        </p>
      </div>
    );
  }

  if (isError || !quotation || !displayedQuotation) {
    return (
      <div className="mx-auto my-12 max-w-lg rounded-2xl border border-rose-200 bg-rose-50/50 p-8 text-center shadow-xl dark:border-rose-900/40 dark:bg-rose-950/20">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-400">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
          Quotation Not Found
        </h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          The requested quotation could not be loaded or may have been deleted.
        </p>
        <Link
          href={`${portalHome}/quotations`}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Quotations
        </Link>
      </div>
    );
  }

  const isSignatory = isAssignedSignatory(authUser, quotation);
  const canViewPdf = canViewQuotationPdf(authUser, quotation);
  const canEmail = canEmailQuotation(quotation);
  const canEdit = canEditQuotation(authUser, quotation);
  const canSubmit = canSubmitForApproval(authUser, quotation as unknown as Parameters<typeof canSubmitForApproval>[1]);
  const isPending = quotation.approval_status === "pending_approval" || quotation.status === "pending_approval";
  const isApproved = isQuotationApproved(quotation);
  const isRejected = quotation.approval_status === "rejected" || quotation.status === "rejected";

  const leadId =
    typeof quotation.lead === "object" && quotation.lead !== null
      ? quotation.lead._id
      : (quotation.lead as string);

  // Status Badge Helper
  const getStatusBadge = () => {
    switch (quotation.status) {
      case "converted":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300/40">
            <ShoppingCart className="h-3.5 w-3.5" /> Converted to Order
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300/40">
            <CheckCircle2 className="h-3.5 w-3.5" /> Approved
          </span>
        );
      case "pending_approval":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300/40">
            <Clock className="h-3.5 w-3.5" /> Pending Signatory Approval
          </span>
        );
      case "sent":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-300/40">
            <Send className="h-3.5 w-3.5" /> Sent to Customer
          </span>
        );
      case "in_negotiation":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300/40">
            <MessageSquare className="h-3.5 w-3.5" /> In Negotiation
          </span>
        );
      case "accepted":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-800 dark:bg-teal-950/80 dark:text-teal-300 border border-teal-300/40">
            <CheckCircle className="h-3.5 w-3.5" /> Accepted
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300/40">
            <XCircle className="h-3.5 w-3.5" /> Rejected
          </span>
        );
      case "expired":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300/40">
            <Clock className="h-3.5 w-3.5" /> Expired
          </span>
        );
      case "on_hold":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300/40">
            <PauseCircle className="h-3.5 w-3.5" /> On Hold
          </span>
        );
      default:
        if (isQuotationExpired(quotation)) {
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300/40">
              <Clock className="h-3.5 w-3.5" /> Expired
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <FileText className="h-3.5 w-3.5" /> Draft
          </span>
        );
    }
  };

  // Pure Isolated Iframe Printing
  const handlePrint = () => {
    if (!containerRef.current || !canViewPdf) return;

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
          if (printFrame.parentNode) {
            printFrame.parentNode.removeChild(printFrame);
          }
        }, 1000);
      }
    }, 300);
  };

  // Handlers for approval actions
  const handleConfirmSubmitForApproval = async () => {
    try {
      await submitForApproval({ quotationId: quotation._id }).unwrap();
      toast.success(`Quotation ${quotation.quotation_no} submitted for signatory approval`);
      refetch();
    } catch {
      toast.error("Failed to submit quotation for approval");
    }
  };

  const handleConfirmApprove = async () => {
    try {
      await approveQuotation({ quotationId: quotation._id }).unwrap();
      toast.success(`Quotation ${quotation.quotation_no} approved successfully`);
      setShowApproveModal(false);
      refetch();
    } catch {
      toast.error("Failed to approve quotation");
    }
  };

  const handleStartNegotiation = async () => {
    try {
      await updateQuotation({
        quotationId: quotation._id,
        leadId: leadId || "",
        body: { status: "in_negotiation" },
      }).unwrap();
      toast.success(`Quotation ${quotation.quotation_no} moved to In Negotiation`);
      refetch();
    } catch {
      toast.error("Failed to update status to negotiation");
    }
  };

  const handleConfirmAccept = async () => {
    try {
      await updateQuotation({
        quotationId: quotation._id,
        leadId: leadId || "",
        body: { status: "accepted" },
      }).unwrap();
      toast.success(`Quotation ${quotation.quotation_no} marked as Accepted`);
      setShowAcceptModal(false);
      refetch();
    } catch {
      toast.error("Failed to mark quotation as accepted");
    }
  };

  const handleConfirmOnHold = async (newStatus: "on_hold" | "sent") => {
    try {
      await updateQuotation({
        quotationId: quotation._id,
        leadId: leadId || "",
        body: { status: newStatus },
      }).unwrap();
      toast.success(
        newStatus === "on_hold"
          ? `Quotation ${quotation.quotation_no} put On Hold`
          : `Quotation ${quotation.quotation_no} resumed`
      );
      setShowOnHoldModal(false);
      refetch();
    } catch {
      toast.error("Failed to update quotation status");
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejecting this quotation");
      return;
    }
    try {
      await rejectQuotation({
        quotationId: quotation._id,
        rejection_reason: rejectionReason.trim(),
      }).unwrap();
      toast.success(`Quotation ${quotation.quotation_no} rejected`);
      setShowRejectModal(false);
      setRejectionReason("");
      refetch();
    } catch {
      toast.error("Failed to reject quotation");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Navigation & Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`${portalHome}/quotations`}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
            title="Back to Quotations"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-black text-slate-900 dark:text-white sm:text-2xl">
                {displayedQuotation.ref_no || displayedQuotation.quotation_no}
              </h1>
              <span
                className={`rounded-lg border px-2.5 py-0.5 text-xs font-black transition-all ${
                  isViewingArchive
                    ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/80 dark:text-amber-300"
                    : "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950 dark:text-indigo-300"
                }`}
              >
                v{displayedQuotation.version || 1} {isViewingArchive ? "(Archived)" : ""}
              </span>
              {getStatusBadge()}
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Customer: <span className="font-semibold text-slate-700 dark:text-slate-200">{displayedQuotation.customer_name || "N/A"}</span>
              {displayedQuotation.subject ? ` • ${displayedQuotation.subject}` : ""}
            </p>

            {/* Version Switcher Bar */}
            {availableVersions.length > 1 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
                  <History className="h-3.5 w-3.5" /> Versions:
                </span>
                {availableVersions.map((v) => {
                  const isCurrent = v === currentVersion;
                  const isSelected = activeVersion === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setSelectedVersion(isCurrent ? null : v)}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? "bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900"
                          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      }`}
                    >
                      v{v}
                      {isCurrent ? (
                        <span className="ml-0.5 rounded px-1 py-0.2 text-[9px] font-extrabold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          Current
                        </span>
                      ) : null}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setCompareFromVersion(activeVersion > 1 ? activeVersion - 1 : 1);
                    setCompareToVersion(activeVersion === currentVersion && currentVersion > 1 ? currentVersion : currentVersion);
                    setShowCompareModal(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50/70 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/60 dark:text-indigo-300 cursor-pointer ml-1 transition"
                  title="Compare versions side-by-side"
                >
                  <GitCompare className="h-3.5 w-3.5" />
                  Compare
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Action Toolbar Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Historical Mode: Locked Actions & Return to Current */}
          {isViewingArchive ? (
            <>
              <button
                type="button"
                onClick={() => setSelectedVersion(null)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700 cursor-pointer transition-all"
              >
                <ArrowLeft className="h-4 w-4" /> View Current (v{currentVersion})
              </button>
              <button
                type="button"
                onClick={() => {
                  setCompareFromVersion(activeVersion);
                  setCompareToVersion(currentVersion);
                  setShowCompareModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 shadow-xs hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950 dark:text-indigo-300 cursor-pointer transition-colors"
              >
                <GitCompare className="h-4 w-4" /> Compare with Current
              </button>
            </>
          ) : (
            <>
              {/* Submit for approval button */}
              {canSubmit && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmSubmitForApproval}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white shadow-md hover:bg-primary-hover disabled:opacity-50 cursor-pointer transition-all"
                >
                  <Send className="h-4 w-4" /> Send for Approval
                </button>
              )}

              {/* Strict Signatory Approve / Reject Buttons */}
              {isPending && isSignatory && (
                <>
                  <button
                    type="button"
                    disabled={isApproving || isRejecting}
                    onClick={() => setShowApproveModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 cursor-pointer transition-all"
                  >
                    <Check className="h-4 w-4" /> Approve
                  </button>
                  <button
                    type="button"
                    disabled={isApproving || isRejecting}
                    onClick={() => {
                      setRejectionReason("");
                      setShowRejectModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-rose-100 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-200 dark:bg-rose-950 dark:text-rose-300 disabled:opacity-50 cursor-pointer transition-all"
                  >
                    <X className="h-4 w-4" /> Reject
                  </button>
                </>
              )}

              {/* Sent Status: Start Negotiation button */}
              {quotation.status === "sent" && (
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={handleStartNegotiation}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 cursor-pointer transition-all"
                >
                  <MessageSquare className="h-4 w-4" /> Start Negotiation
                </button>
              )}

              {/* Approved / Sent / In Negotiation / On Hold Status Action Buttons */}
              {(quotation.status === "approved" || quotation.status === "sent" || quotation.status === "in_negotiation" || quotation.status === "on_hold") && (
                <>
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => setShowAcceptModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-bold text-white shadow-md hover:bg-teal-700 disabled:opacity-50 cursor-pointer transition-all"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Mark Accepted
                  </button>

                  {quotation.status === "on_hold" ? (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => setShowOnHoldModal(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-md hover:bg-amber-700 disabled:opacity-50 cursor-pointer transition-all"
                    >
                      <Send className="h-4 w-4" /> Resume Quotation
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => setShowOnHoldModal(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 px-3.5 py-2 text-xs font-bold text-amber-800 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300 disabled:opacity-50 cursor-pointer transition-all"
                    >
                      <PauseCircle className="h-4 w-4" /> Put On Hold
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isUpdating || isRejecting}
                    onClick={() => setShowCustomerRejectModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-rose-100 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-200 dark:bg-rose-950 dark:text-rose-300 disabled:opacity-50 cursor-pointer transition-all"
                  >
                    <XCircle className="h-4 w-4" /> Customer Rejected
                  </button>
                </>
              )}

              {/* Convert to Order & Proforma Actions */}
              {quotation.status === "accepted" && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowProformaModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-teal-300 bg-teal-50 px-3.5 py-2 text-xs font-bold text-teal-800 shadow-xs hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-200 cursor-pointer transition-all"
                  >
                    <FileText className="h-4 w-4 text-teal-600" />
                    {quotation.proforma_issued_at ? "Proforma Invoice" : "Generate Proforma"}
                  </button>

                  {canConvertQuotation(authUser) && (
                    <button
                      type="button"
                      onClick={() => setShowConvertModal(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:opacity-95 cursor-pointer transition-all"
                    >
                      <ShoppingCart className="h-4 w-4" /> Convert to Order
                    </button>
                  )}
                </>
              )}

              {/* Extend Validity Button */}
              {quotation.status !== "converted" && (
                <button
                  type="button"
                  onClick={() => setShowExtendValidityModal(true)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold shadow-xs transition-colors cursor-pointer ${
                    isQuotationExpired(quotation)
                      ? "bg-rose-600 text-white hover:bg-rose-700 shadow-rose-600/30 shadow-md"
                      : "border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/60 dark:text-indigo-300"
                  }`}
                >
                  <Calendar className="h-4 w-4" />
                  {isQuotationExpired(quotation) ? "Extend Validity" : "Extend Validity"}
                </button>
              )}

              {/* Edit / Revise Button */}
              {canEdit && (
                <Link
                  href={`${portalHome}/quotations/${quotation._id}/edit`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 shadow-xs hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/60 dark:text-indigo-300 transition-colors"
                >
                  <Pencil className="h-4 w-4" />
                  {quotation.status === "draft" ? "Edit Quotation" : `Revise & Edit (v${(quotation.version || 1) + 1})`}
                </Link>
              )}

              {/* Email Button */}
              {canEmail && (
                <button
                  type="button"
                  onClick={() => setEmailModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700 shadow-xs hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/60 dark:text-blue-300 cursor-pointer transition-colors"
                >
                  <Mail className="h-4 w-4" /> Send Email
                </button>
              )}
            </>
          )}

          {/* Copy Quotation Button (always available) */}
          <Link
            href={`${portalHome}/quotations/new?copy_from=${quotation._id}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
            title="Copy this quotation to create a new quotation"
          >
            <Copy className="h-4 w-4 text-indigo-500" />
            Copy Quotation
          </Link>

          {/* Print / PDF Button (renders displayed version) */}
          <button
            type="button"
            disabled={!canViewPdf}
            onClick={handlePrint}
            title={canViewPdf ? `Print / Download PDF Letterhead (v${displayedQuotation.version || 1})` : "PDF preview is locked for non-signatories prior to approval"}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold shadow-xs transition-colors cursor-pointer ${
              canViewPdf
                ? "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                : "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 opacity-80 cursor-not-allowed"
            }`}
          >
            {canViewPdf ? <Printer className="h-4 w-4" /> : <Lock className="h-4 w-4 text-amber-600" />}
            {canViewPdf ? `Print PDF (v${displayedQuotation.version || 1})` : "PDF Restricted"}
          </button>
        </div>
      </div>

      {/* Historical Version Notice Banner */}
      {isViewingArchive && selectedRevisionSnapshot && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 shadow-xs dark:border-amber-900/60 dark:bg-amber-950/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-600 text-white shadow-xs">
                <History className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-950 dark:text-amber-100 flex items-center gap-2">
                  Viewing Historical Version v{activeVersion} (Archived Snapshot)
                  <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                    Read-Only
                  </span>
                </h3>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Snapshot saved on {selectedRevisionSnapshot.saved_at ? new Date(selectedRevisionSnapshot.saved_at).toLocaleString("en-IN") : "N/A"}
                  {selectedRevisionSnapshot.saved_by ? ` by ${typeof selectedRevisionSnapshot.saved_by === "object" ? selectedRevisionSnapshot.saved_by.name : "Staff"}` : ""}.
                  Total: <strong>{formatCurrencyINR(selectedRevisionSnapshot.grand_total || 0)}</strong> with {selectedRevisionSnapshot.items?.length || 0} item(s).
                  Workflow status actions are locked in historical view.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCompareFromVersion(activeVersion);
                  setCompareToVersion(currentVersion);
                  setShowCompareModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-900 shadow-xs hover:bg-amber-100 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-200 cursor-pointer transition"
              >
                <GitCompare className="h-3.5 w-3.5 text-amber-600" /> Compare with Current
              </button>
              <button
                type="button"
                onClick={() => setSelectedVersion(null)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-amber-700 cursor-pointer transition"
              >
                Return to Current (v{currentVersion})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expired Status Banner */}
      {isQuotationExpired(quotation) && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50/90 p-4 shadow-xs dark:border-rose-900/60 dark:bg-rose-950/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-xs">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-950 dark:text-rose-100">
                  Quotation Expired on {quotation.valid_until ? new Date(quotation.valid_until).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "N/A"}
                </h3>
                <p className="text-xs text-rose-700 dark:text-rose-300">
                  This proposal has passed its validity window. Direct Order conversion and client communication are paused until validity is extended.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowExtendValidityModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-rose-600/30 hover:bg-rose-700 transition cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Extend Validity Now
            </button>
          </div>
        </div>
      )}

      {/* Expiring Soon Banner */}
      {!isQuotationExpired(quotation) && isQuotationExpiringSoon(quotation) && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/80 p-3.5 shadow-xs dark:border-amber-900/50 dark:bg-amber-950/30 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 animate-pulse" />
            <span>
              <strong>Attention:</strong> This quotation expires on {quotation.valid_until ? new Date(quotation.valid_until).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "N/A"} ({getQuotationExpiryInfo(quotation).label}).
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowExtendValidityModal(true)}
            className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 hover:underline dark:text-amber-300 cursor-pointer"
          >
            <Calendar className="h-3.5 w-3.5" /> Extend Validity
          </button>
        </div>
      )}

      {/* Visual Lifecycle Stepper */}
      <QuotationLifecycleStepper quotation={quotation} />

      {/* Accepted Status: Proforma & Order Conversion Card */}
      {quotation.status === "accepted" && (
        <div className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 via-emerald-50 to-teal-50/80 p-5 text-teal-950 dark:border-teal-900/50 dark:bg-gradient-to-r dark:from-teal-950/40 dark:via-emerald-950/40 dark:to-teal-950/30 dark:text-teal-100 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-md shadow-teal-600/20">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-sm font-black flex items-center gap-2">
                  Client Accepted Quotation (Deal Won)
                  <span className="rounded-full bg-teal-200 px-2.5 py-0.5 text-[11px] font-bold text-teal-900 dark:bg-teal-900 dark:text-teal-200">
                    Ready for Fulfillment
                  </span>
                </h4>
                <p className="mt-0.5 text-xs text-teal-800 dark:text-teal-300">
                  {quotation.proforma_issued_at
                    ? `Proforma Invoice #${quotation.proforma_details?.proforma_no || "Issued"} on ${new Date(quotation.proforma_issued_at).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })} • View, edit commercial dispatch parameters, or proceed to Convert to Order.`
                    : "Client has accepted this commercial proposal. You can generate a dedicated Proforma Invoice with Order Details for advance payment/PO release, or proceed to Convert to Order."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowProformaModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-teal-300 bg-white px-3.5 py-2 text-xs font-bold text-teal-800 shadow-xs hover:bg-teal-50 dark:border-teal-800 dark:bg-slate-900 dark:text-teal-200 cursor-pointer transition-all"
              >
                <FileText className="h-4 w-4 text-teal-600" />
                {quotation.proforma_issued_at ? "View / Edit Proforma" : "Generate Proforma Invoice"}
              </button>

              {canConvertQuotation(authUser) && (
                <button
                  type="button"
                  onClick={() => setShowConvertModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:opacity-95 cursor-pointer transition-all"
                >
                  <ShoppingCart className="h-4 w-4" /> Convert to Order
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Converted to Order Success Banner */}
      {quotation.status === "converted" && quotation.conversion && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4.5 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-black flex items-center gap-2">
                  Quotation Successfully Converted to Order
                  <span className="rounded-full bg-emerald-200/80 px-2.5 py-0.5 text-[11px] font-bold text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200">
                    Active Order
                  </span>
                </h4>
                <p className="mt-0.5 text-xs text-emerald-800 dark:text-emerald-300">
                  {quotation.conversion.converted_at
                    ? `Converted on ${new Date(quotation.conversion.converted_at).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`
                    : "Order has been submitted and sent to the order workflow."}
                  {typeof quotation.conversion.order_id === "object" && (quotation.conversion.order_id as any)?.order_no
                    ? ` • Order #${(quotation.conversion.order_id as any).order_no}`
                    : ""}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Notice Banner */}
      {isRejected && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-extrabold">Quotation Rejected</h4>
              <p className="mt-1 text-xs leading-relaxed">
                {quotation.rejection_reason || "No specific reason was provided by the signatory."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Letterhead A4 Sheet on Left, Metadata Cards on Right */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Letterhead PDF Container (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col items-center">
          {!canViewPdf ? (
            <div className="my-8 w-full max-w-md rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-xl dark:border-amber-900/40 dark:bg-slate-900">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                <Lock className="h-7 w-7" />
              </div>
              <h4 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
                PDF Preview Restricted
              </h4>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                This quotation is currently <strong>Pending Signatory Approval</strong>.
              </p>
              <p className="mt-3 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 p-3 rounded-xl dark:bg-amber-950/40 font-semibold leading-relaxed">
                Only the assigned signatory (<strong>{quotation.signatory_name || "Authorized Signatory"}</strong>) can preview or download the PDF prior to approval. Creators can preview and download the PDF after approval.
              </p>
            </div>
          ) : (
            <div
              ref={containerRef}
              className="w-full max-w-[794px] bg-white shadow-xl rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 flex justify-center"
            >
              <QuotationPdfTemplate
                quotation={displayedQuotation}
                portalLabel="Lead Manager"
                downloadedBy={downloadedBy}
              />
            </div>
          )}
        </div>

        {/* Right Column: Metadata Cards (4 Cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Quotation Summary Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900 space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Quotation Summary
            </h3>
            
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-white/5">
                <span className="text-slate-500">Quotation No:</span>
                <span className="font-bold text-slate-900 dark:text-white">{displayedQuotation.quotation_no}</span>
              </div>
              {displayedQuotation.ref_no && (
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-white/5">
                  <span className="text-slate-500">Ref No:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{displayedQuotation.ref_no}</span>
                </div>
              )}
              {displayedQuotation.customer_ref && (
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-white/5">
                  <span className="text-slate-500">Customer Ref:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{displayedQuotation.customer_ref}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-white/5">
                <span className="text-slate-500">Quotation Date:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {displayedQuotation.quotation_date ? new Date(displayedQuotation.quotation_date).toLocaleDateString("en-IN") : "N/A"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-white/5">
                <span className="text-slate-500">Valid Until:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {displayedQuotation.valid_until ? new Date(displayedQuotation.valid_until).toLocaleDateString("en-IN") : "N/A"}
                  {displayedQuotation.validity_days ? ` (${displayedQuotation.validity_days} days)` : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Customer / Party Info Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900 space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Customer Details
            </h3>

            <div className="space-y-2 text-xs">
              <div className="font-bold text-sm text-slate-900 dark:text-white">
                {displayedQuotation.customer_name || "N/A"}
              </div>
              {displayedQuotation.kind_attn && (
                <div className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-400" /> Kind Attn: {displayedQuotation.kind_attn}
                </div>
              )}
              {displayedQuotation.phone && (
                <div className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-slate-400" /> {displayedQuotation.phone}
                </div>
              )}
              {displayedQuotation.email && (
                <div className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-slate-400" /> {displayedQuotation.email}
                </div>
              )}
              {displayedQuotation.gstin && (
                <div className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-slate-400" /> GSTIN: {displayedQuotation.gstin}
                </div>
              )}
              {displayedQuotation.address?.address_line_1 && (
                <div className="mt-2 rounded-xl bg-slate-50 p-2.5 text-[11px] text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                  {displayedQuotation.address.address_line_1}
                  {displayedQuotation.address.city ? `, ${displayedQuotation.address.city}` : ""}
                  {displayedQuotation.address.state ? `, ${displayedQuotation.address.state}` : ""}
                  {displayedQuotation.address.pincode ? ` - ${displayedQuotation.address.pincode}` : ""}
                </div>
              )}
            </div>
          </div>

          {/* Financial Breakdown Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900 space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-600" /> Financial Summary
            </h3>

            <div className="space-y-2 text-xs">
              {Boolean(displayedQuotation.total_discount && displayedQuotation.total_discount > 0) ? (
                <>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Gross Total:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {formatCurrencyINR((displayedQuotation.subtotal || 0) + (displayedQuotation.total_discount || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                    <span>Total Discount:</span>
                    <span className="font-semibold">-{formatCurrencyINR(displayedQuotation.total_discount || 0)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Taxable Subtotal:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{formatCurrencyINR(displayedQuotation.subtotal || 0)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Subtotal ({displayedQuotation.items?.length || 0} items):</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{formatCurrencyINR(displayedQuotation.subtotal || 0)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  Total GST:
                  {displayedQuotation.gst_enabled === false && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                      Exempt
                    </span>
                  )}
                </span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {displayedQuotation.gst_enabled === false ? "₹0.00" : formatCurrencyINR(displayedQuotation.total_gst || 0)}
                </span>
              </div>
              {Boolean(displayedQuotation.round_off) && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Round Off:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{formatCurrencyINR(displayedQuotation.round_off || 0)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-white/10 text-sm font-black text-slate-900 dark:text-white">
                <span>Grand Total:</span>
                <span className="text-emerald-600 dark:text-emerald-400">{formatCurrencyINR(displayedQuotation.grand_total || 0)}</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 italic">
                &ldquo;{(displayedQuotation.amount_in_words && displayedQuotation.amount_in_words.trim()) || numberToIndianWords(displayedQuotation.grand_total) || "Zero Rupees Only"}&rdquo;
              </div>
            </div>
          </div>

          {/* Signatory & Creator Info Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900 space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Signatory & Creator
            </h3>

            <div className="space-y-3 text-xs">
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Authorized Signatory</div>
                <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                  {displayedQuotation.signatory_name || "Authorized Signatory"}
                </div>
                <div className="text-[11px] text-slate-500">
                  {displayedQuotation.signatory_designation || "Signatory"}
                </div>
                {displayedQuotation.signatory_email && (
                  <div className="text-[11px] text-slate-400 truncate">{displayedQuotation.signatory_email}</div>
                )}
              </div>

              {(displayedQuotation.sales_person_name || displayedQuotation.sales_person_user) && (
                <div className="rounded-xl bg-emerald-50/60 p-3 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Sales Representative (Internal)
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                    {displayedQuotation.sales_person_name ||
                      (typeof displayedQuotation.sales_person_user === "object" ? displayedQuotation.sales_person_user?.name : "") ||
                      "Sales Executive"}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {displayedQuotation.sales_person_designation || "Sales Department"}
                  </div>
                  {(displayedQuotation.sales_person_phone || displayedQuotation.sales_person_email) && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {[displayedQuotation.sales_person_phone, displayedQuotation.sales_person_email].filter(Boolean).join(" • ")}
                    </div>
                  )}
                </div>
              )}

              {quotation.created_by && (
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quotation Creator</div>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                    {quotation.created_by.name || quotation.created_by.email || "System"}
                  </div>
                  {quotation.createdAt && (
                    <div className="text-[11px] text-slate-400">
                      Created: {new Date(quotation.createdAt).toLocaleDateString("en-IN")}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Revision History Archive Card */}
          {availableVersions.length > 1 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <History className="h-4 w-4 text-indigo-500" /> Revision History
                </h3>
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  {availableVersions.length} Total Versions
                </span>
              </div>

              <div className="space-y-2.5">
                {/* Current Active Version Entry */}
                <div
                  className={`rounded-xl border p-3 text-xs space-y-1.5 transition-all ${
                    activeVersion === currentVersion
                      ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30"
                      : "border-slate-100 bg-slate-50/70 dark:border-white/5 dark:bg-slate-800/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-emerald-700 dark:text-emerald-400">
                        Version {currentVersion}
                      </span>
                      <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[9px] font-black uppercase text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Current
                      </span>
                      {activeVersion === currentVersion && (
                        <span className="rounded bg-slate-900 px-1.5 py-0.2 text-[9px] font-bold text-white dark:bg-white dark:text-slate-900">
                          Active View
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-medium text-slate-400">
                      {quotation.updatedAt
                        ? new Date(quotation.updatedAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <span>
                      Total: <strong className="text-slate-900 dark:text-white">{formatCurrencyINR(quotation.grand_total || 0)}</strong>
                    </span>
                    <span>{quotation.items?.length || 0} items</span>
                  </div>
                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    {activeVersion !== currentVersion ? (
                      <button
                        type="button"
                        onClick={() => setSelectedVersion(null)}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 transition cursor-pointer"
                      >
                        <Eye className="h-3 w-3" /> View Current
                      </button>
                    ) : (
                      <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        Currently viewing
                      </span>
                    )}
                  </div>
                </div>

                {/* Historical Revisions */}
                {quotation.revision_history &&
                  quotation.revision_history
                    .slice()
                    .reverse()
                    .map((rev, idx) => {
                      const isSelected = activeVersion === rev.version;
                      return (
                        <div
                          key={rev._id || idx}
                          className={`rounded-xl border p-3 text-xs space-y-1.5 transition-all ${
                            isSelected
                              ? "border-indigo-400 bg-indigo-50/70 shadow-xs dark:border-indigo-700 dark:bg-indigo-950/40"
                              : "border-slate-100 bg-slate-50/70 dark:border-white/5 dark:bg-slate-800/40"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-indigo-700 dark:text-indigo-400">
                                Version {rev.version}
                              </span>
                              {isSelected && (
                                <span className="rounded bg-indigo-600 px-1.5 py-0.2 text-[9px] font-bold text-white">
                                  Viewing
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-medium text-slate-400">
                              {rev.saved_at
                                ? new Date(rev.saved_at).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })
                                : ""}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                            <span>
                              Total: <strong className="text-slate-900 dark:text-white">{formatCurrencyINR(rev.grand_total || 0)}</strong>
                            </span>
                            <span>{rev.items?.length || 0} items</span>
                          </div>
                          {rev.saved_by && (
                            <div className="text-[10px] text-slate-400 truncate">
                              Revised by {typeof rev.saved_by === "object" ? rev.saved_by.name : "Staff"}
                            </div>
                          )}
                          <div className="flex items-center justify-end gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setCompareFromVersion(rev.version);
                                setCompareToVersion(currentVersion);
                                setShowCompareModal(true);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 transition cursor-pointer"
                              title={`Compare v${rev.version} with Current (v${currentVersion})`}
                            >
                              <GitCompare className="h-3 w-3 text-indigo-500" /> Compare
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedVersion(rev.version)}
                              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                                isSelected
                                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                                  : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
                              }`}
                            >
                              <Eye className="h-3 w-3" /> {isSelected ? "Viewing" : `View v${rev.version}`}
                            </button>
                          </div>
                        </div>
                      );
                    })}
              </div>
            </div>
          )}

          {/* Quotation Follow-Up Timeline Card */}
          <QuotationFollowUpCard quotation={quotation} />
        </div>
      </div>

      {/* Approve Confirmation Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 space-y-4 border border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Approve Quotation
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to approve quotation <strong>{quotation.quotation_no}</strong>? This will unlock the PDF preview and letterhead download for the creator.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isApproving}
                onClick={handleConfirmApprove}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
              >
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accept Confirmation Modal */}
      {showAcceptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 space-y-4 border border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-3 text-teal-600 dark:text-teal-400">
              <CheckCircle2 className="h-6 w-6" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Mark Quotation as Accepted
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to mark quotation <strong>{quotation.quotation_no}</strong> as <strong>Accepted</strong> by customer?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAcceptModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUpdating}
                onClick={handleConfirmAccept}
                className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-teal-700 cursor-pointer disabled:opacity-50"
              >
                Confirm Accepted
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 space-y-4 border border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <XCircle className="h-6 w-6" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Reject Quotation
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Please specify the reason for rejecting quotation <strong>{quotation.quotation_no}</strong>:
            </p>
            <textarea
              rows={3}
              placeholder="Enter rejection reason..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-900 focus:border-rose-500 focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRejecting}
                onClick={handleConfirmReject}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-rose-700 cursor-pointer disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* On Hold / Resume Confirmation Modal */}
      {showOnHoldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 space-y-4 border border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <PauseCircle className="h-6 w-6" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {quotation.status === "on_hold" ? "Resume Quotation?" : "Put Quotation On Hold?"}
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {quotation.status === "on_hold"
                ? `Are you sure you want to resume Quotation #${quotation.quotation_no}? Status will return to active.`
                : `Are you sure you want to put Quotation #${quotation.quotation_no} on hold?`}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowOnHoldModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleConfirmOnHold(quotation.status === "on_hold" ? "sent" : "on_hold")}
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-amber-700 cursor-pointer disabled:opacity-50"
              >
                {quotation.status === "on_hold" ? "Resume Quotation" : "Put On Hold"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Email Modal */}
      {emailModalOpen && (
        <SendQuotationEmailModal
          quotation={quotation}
          lead={
            quotation.lead && typeof quotation.lead === "object"
              ? (quotation.lead as LeadRecord)
              : null
          }
          open={emailModalOpen}
          onClose={() => setEmailModalOpen(false)}
        />
      )}

      {/* Customer Rejection / Lost Deal Modal */}
      <CustomerRejectQuotationModal
        quotation={quotation}
        open={showCustomerRejectModal}
        onClose={() => {
          setShowCustomerRejectModal(false);
          refetch();
        }}
      />

      {/* Generate / Preview Dedicated Proforma Invoice Modal */}
      <GenerateProformaModal
        quotation={quotation}
        open={showProformaModal}
        onClose={() => setShowProformaModal(false)}
        onSuccess={() => refetch()}
      />

      {/* Convert Quotation to Confirmed Order Modal */}
      <ConvertQuotationModal
        quotation={quotation}
        open={showConvertModal}
        onClose={() => setShowConvertModal(false)}
        onSuccess={() => refetch()}
      />

      {/* Extend Quotation Validity Modal */}
      <ExtendQuotationValidityModal
        quotation={quotation}
        open={showExtendValidityModal}
        onClose={() => setShowExtendValidityModal(false)}
        onSuccess={() => refetch()}
      />

      {/* Quotation Version Diff & Comparison Modal */}
      {showCompareModal && (
        <QuotationVersionDiffModal
          quotation={quotation}
          open={showCompareModal}
          onClose={() => setShowCompareModal(false)}
          initialFromVersion={compareFromVersion}
          initialToVersion={compareToVersion}
        />
      )}
    </div>
  );
}
