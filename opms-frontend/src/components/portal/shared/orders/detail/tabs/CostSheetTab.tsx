"use client";

import { useMemo } from "react";
import {
  FilePreviewModal,
  useFilePreview,
  type PreviewFile,
} from "@/components/portal/shared/ui/modals/FilePreviewModal";
import { useAppSelector } from "@/store";
import { useCreateAttachmentMutation, useDeleteAttachmentMutation } from "@/store/api";
import { toast } from "@/lib/toast";
import { fetchFileBlob, resolveFileUrl } from "@/lib/env";
import { mutationRejectedMessage } from "@/lib/mutationMessages";
import { SingleDocumentCard } from "./components/SingleDocumentCard";

export type CostSheetTabProps = {
  orderId: string;
  attachments: Record<string, unknown>[];
  isLoading: boolean;
  onRefetch?: () => void;
  onUploadSuccess?: () => void;
  disabled?: boolean;
};

export default function CostSheetTab({
  orderId,
  attachments,
  isLoading,
  onRefetch,
  onUploadSuccess,
  disabled = false,
}: CostSheetTabProps) {
  const triggerRefetch = onRefetch || onUploadSuccess;
  const token = useAppSelector((s) => s.auth.token);
  const [createAttachment, { isLoading: isUploading }] = useCreateAttachmentMutation();
  const [deleteAttachment, { isLoading: isDeleting }] = useDeleteAttachmentMutation();

  const {
    previewDoc,
    previewBlobUrl,
    previewLoading,
    openPreview,
    closePreview,
  } = useFilePreview(token);

  // Find active Cost Sheet document
  const costSheetDocument = useMemo(() => {
    return (
      attachments.find((att) => {
        const cat = String(att.category || "").toLowerCase();
        if (cat === "cost_sheet") return true;
        const remarks = String(att.remarks || "").toLowerCase();
        const name = String(att.original_name || att.file_name || "").toLowerCase();
        return remarks.startsWith("[cost_sheet]") || name.includes("cost_sheet") || name.includes("costsheet");
      }) || null
    );
  }, [attachments]);

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
      name: String(att.original_name ?? att.file_name ?? "Cost Sheet"),
      url: resolveFileUrl(String(att.url ?? "")),
      mime: String(att.mime_type ?? ""),
    });
  };

  const handleUpload = async (file: File, remarks?: string) => {
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("entity_type", "order");
      fd.append("entity_id", orderId);
      fd.append("category", "cost_sheet");
      fd.append("remarks", remarks || "Order Cost Sheet");

      await createAttachment(fd).unwrap();
      toast.success("Cost Sheet uploaded successfully");
      if (triggerRefetch) triggerRefetch();
    } catch (rejected) {
      toast.error(mutationRejectedMessage(rejected));
    }
  };

  const handleReplace = async (file: File) => {
    try {
      const oldId = String(costSheetDocument?._id || costSheetDocument?.id || "");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("entity_type", "order");
      fd.append("entity_id", orderId);
      fd.append("category", "cost_sheet");
      fd.append("remarks", "Replaced Cost Sheet");

      await createAttachment(fd).unwrap();
      if (oldId) {
        await deleteAttachment(oldId).unwrap();
      }
      toast.success("Cost Sheet replaced successfully");
      if (triggerRefetch) triggerRefetch();
    } catch (rejected) {
      toast.error(mutationRejectedMessage(rejected));
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove "${name}"?`)) return;
    try {
      await deleteAttachment(id).unwrap();
      toast.success("Cost Sheet removed successfully");
      if (triggerRefetch) triggerRefetch();
    } catch (rejected) {
      toast.error(mutationRejectedMessage(rejected));
    }
  };

  if (isLoading) {
    return (
      <div className="py-8 text-center text-sm text-slate-500">
        Loading Cost Sheet...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FilePreviewModal
        doc={previewDoc}
        blobUrl={previewBlobUrl}
        loading={previewLoading}
        onClose={closePreview}
        onDownload={(doc: PreviewFile) => void handleDownload(doc.url, doc.name)}
        subtitle="Cost Sheet Preview"
      />

      <SingleDocumentCard
        title="Cost Sheet"
        subtitle="Internal approved cost sheet and commercial margin calculation document."
        badgeText="Order Document"
        attachment={costSheetDocument}
        onUpload={handleUpload}
        onReplace={handleReplace}
        onDelete={handleDelete}
        onPreview={handlePreview}
        onDownload={handleDownload}
        isUploading={isUploading}
        isDeleting={isDeleting}
        disabled={disabled}
      />
    </div>
  );
}
