"use client";

import { useMemo, useState } from "react";
import {
  CreditCard,
  FileBadge,
  Building2,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import {
  FilePreviewModal,
  useFilePreview,
  type PreviewFile,
} from "@/components/portal/shared/ui/modals/FilePreviewModal";
import { useAppSelector } from "@/store";
import {
  useCreateAttachmentMutation,
  useDeleteAttachmentMutation,
  useListAttachmentsQuery,
} from "@/store/api";
import { toast } from "@/lib/toast";
import { fetchFileBlob, resolveFileUrl } from "@/lib/env";
import { mutationRejectedMessage } from "@/lib/mutationMessages";
import { MultiDocumentGrid } from "./components/MultiDocumentGrid";

export type KycTabProps = {
  orderId: string;
  partyId?: string;
  partyName?: string;
  disabled?: boolean;
};

type KycSubTabId = "aadhaar" | "pan" | "gst";

function pickList(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data as Record<string, unknown>[];
    if (Array.isArray(o.items)) return o.items as Record<string, unknown>[];
    if (Array.isArray(o.attachments)) return o.attachments as Record<string, unknown>[];
  }
  return [];
}

export default function KycTab({
  orderId,
  partyId = "",
  partyName = "Customer",
  disabled = false,
}: KycTabProps) {
  const token = useAppSelector((s) => s.auth.token);
  const [activeSubTab, setActiveSubTab] = useState<KycSubTabId>("aadhaar");

  // Query KYC attachments stored under the Party entity
  const partyAttachmentsQ = useListAttachmentsQuery(
    { entity_type: "party", entity_id: partyId },
    { skip: !partyId }
  );

  // Fallback query for legacy customer entity_type
  const customerAttachmentsQ = useListAttachmentsQuery(
    { entity_type: "customer", entity_id: partyId },
    { skip: !partyId }
  );

  const [createAttachment, { isLoading: isUploading }] = useCreateAttachmentMutation();
  const [deleteAttachment, { isLoading: isDeleting }] = useDeleteAttachmentMutation();

  const {
    previewDoc,
    previewBlobUrl,
    previewLoading,
    openPreview,
    closePreview,
  } = useFilePreview(token);

  // Combine party + legacy customer KYC attachments without duplicates (strictly party-scoped)
  const allKycAttachments = useMemo(() => {
    const list1 = pickList(partyAttachmentsQ.data);
    const list2 = pickList(customerAttachmentsQ.data);

    const seen = new Set<string>();
    const merged: Record<string, unknown>[] = [];

    for (const item of [...list1, ...list2]) {
      const id = String(item._id || item.id || "");
      if (id && !seen.has(id)) {
        seen.add(id);
        merged.push(item);
      }
    }

    return merged;
  }, [partyAttachmentsQ.data, customerAttachmentsQ.data]);

  // Sub-categorize attachments
  const aadhaarDocs = useMemo(() => {
    return allKycAttachments.filter((att) => {
      const cat = String(att.category || "").toLowerCase();
      if (cat === "kyc_aadhaar") return true;
      const remarks = String(att.remarks || "").toLowerCase();
      const name = String(att.original_name || att.file_name || "").toLowerCase();
      return (
        remarks.includes("aadhaar") ||
        remarks.includes("adhaar") ||
        name.includes("aadhaar") ||
        name.includes("adhaar")
      );
    });
  }, [allKycAttachments]);

  const panDocs = useMemo(() => {
    return allKycAttachments.filter((att) => {
      const cat = String(att.category || "").toLowerCase();
      if (cat === "kyc_pan") return true;
      const remarks = String(att.remarks || "").toLowerCase();
      const name = String(att.original_name || att.file_name || "").toLowerCase();
      return remarks.includes("pan") || name.includes("pan");
    });
  }, [allKycAttachments]);

  const gstDocs = useMemo(() => {
    return allKycAttachments.filter((att) => {
      const cat = String(att.category || "").toLowerCase();
      if (cat === "kyc_gst") return true;
      const remarks = String(att.remarks || "").toLowerCase();
      const name = String(att.original_name || att.file_name || "").toLowerCase();
      return remarks.includes("gst") || name.includes("gst");
    });
  }, [allKycAttachments]);

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      const response = await fetchFileBlob(fileUrl, token);
      if (!response.ok) {
        toast.error(`Failed to download file (${response.status})`);
        return;
      }
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error("Failed to download file");
    }
  };

  const handlePreview = (att: Record<string, unknown>) => {
    void openPreview({
      name: String(att.original_name ?? att.file_name ?? "KYC Document"),
      url: resolveFileUrl(String(att.url ?? "")),
      mime: String(att.mime_type ?? ""),
    });
  };

  const handleUpload = async (files: File[], remarks?: string) => {
    if (!partyId) {
      toast.error("Unable to upload KYC: this order is not linked to a customer/party.");
      return;
    }

    const categoryMap: Record<KycSubTabId, string> = {
      aadhaar: "kyc_aadhaar",
      pan: "kyc_pan",
      gst: "kyc_gst",
    };

    const targetCategory = categoryMap[activeSubTab];

    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("entity_type", "party");
        fd.append("entity_id", partyId);
        fd.append("category", targetCategory);
        fd.append(
          "remarks",
          remarks || `KYC ${activeSubTab.toUpperCase()} Document`
        );
        await createAttachment(fd).unwrap();
      }

      toast.success(
        `${files.length} ${activeSubTab.toUpperCase()} document(s) saved to party record successfully`
      );

      void partyAttachmentsQ.refetch();
      void customerAttachmentsQ.refetch();
    } catch (rejected) {
      toast.error(mutationRejectedMessage(rejected));
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      await deleteAttachment(id).unwrap();
      toast.success("Document deleted successfully");
      void partyAttachmentsQ.refetch();
      void customerAttachmentsQ.refetch();
    } catch (rejected) {
      toast.error(mutationRejectedMessage(rejected));
    }
  };

  const isLoading =
    customerAttachmentsQ.isLoading ||
    partyAttachmentsQ.isLoading;

  return (
    <div className="space-y-6">
      <FilePreviewModal
        doc={previewDoc}
        blobUrl={previewBlobUrl}
        loading={previewLoading}
        onClose={closePreview}
        onDownload={(doc: PreviewFile) => void handleDownload(doc.url, doc.name)}
        subtitle="KYC Document Preview"
      />

      {/* KYC Party Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/30 p-4 dark:border-blue-900/30 dark:bg-blue-950/20">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/20">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-50 font-sans">
              Customer KYC Verification
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Verified documents for <span className="font-semibold text-blue-700 dark:text-blue-300">{partyName}</span>. Documents are saved to the party record and shared across all orders.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400">
            Party-Shared Records
          </span>
        </div>
      </div>

      {!partyId && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Notice: No party/customer is linked to this order yet. KYC documents are strictly party-specific and require a linked customer account.</span>
        </div>
      )}

      {/* Sub-tab Navigation */}
      <div className="flex border-b border-slate-200 dark:border-white/10 gap-2">
        <button
          type="button"
          onClick={() => setActiveSubTab("aadhaar")}
          className={`relative flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
            activeSubTab === "aadhaar"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <CreditCard className="h-4 w-4" />
          <span>Aadhaar</span>
          <span
            className={`rounded-full px-2 py-0.5 text-2xs font-bold ${
              activeSubTab === "aadhaar"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400"
            }`}
          >
            {aadhaarDocs.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("pan")}
          className={`relative flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
            activeSubTab === "pan"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <FileBadge className="h-4 w-4" />
          <span>PAN</span>
          <span
            className={`rounded-full px-2 py-0.5 text-2xs font-bold ${
              activeSubTab === "pan"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400"
            }`}
          >
            {panDocs.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("gst")}
          className={`relative flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
            activeSubTab === "gst"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>GST</span>
          <span
            className={`rounded-full px-2 py-0.5 text-2xs font-bold ${
              activeSubTab === "gst"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400"
            }`}
          >
            {gstDocs.length}
          </span>
        </button>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-slate-500">
          Loading KYC documents...
        </div>
      ) : (
        <>
          {activeSubTab === "aadhaar" && (
            <MultiDocumentGrid
              title="Aadhaar Documents"
              subtitle="Upload scanned front & back copies or official e-Aadhaar verification documents."
              badgeText="Aadhaar Verification"
              documents={aadhaarDocs}
              onUpload={handleUpload}
              onDelete={handleDelete}
              onPreview={handlePreview}
              onDownload={handleDownload}
              isUploading={isUploading}
              isDeleting={isDeleting}
              disabled={disabled || !partyId}
            />
          )}

          {activeSubTab === "pan" && (
            <MultiDocumentGrid
              title="PAN Card Documents"
              subtitle="Upload business or proprietor PAN card copies and verification forms."
              badgeText="PAN Verification"
              documents={panDocs}
              onUpload={handleUpload}
              onDelete={handleDelete}
              onPreview={handlePreview}
              onDownload={handleDownload}
              isUploading={isUploading}
              isDeleting={isDeleting}
              disabled={disabled || !partyId}
            />
          )}

          {activeSubTab === "gst" && (
            <MultiDocumentGrid
              title="GST Registration Documents"
              subtitle="Upload official GST registration certificates (Form GST REG-06) and annexures."
              badgeText="GSTIN Verification"
              documents={gstDocs}
              onUpload={handleUpload}
              onDelete={handleDelete}
              onPreview={handlePreview}
              onDownload={handleDownload}
              isUploading={isUploading}
              isDeleting={isDeleting}
              disabled={disabled || !partyId}
            />
          )}
        </>
      )}
    </div>
  );
}
