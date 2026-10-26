"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  FileText,
  Lock,
  Edit3,
  User,
  Truck,
  MapPin,
  ShieldCheck,
  AlignLeft,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  X,
  Save,
  FileSpreadsheet,
  FileCheck,
  Paperclip,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import { mutationRejectedMessage } from "@/lib/mutationMessages";
import { useAppSelector } from "@/store";
import {
  useGetOrderPerformaQuery,
  useUpdateOrderPerformaMutation,
  useCreateAttachmentMutation,
  useDeleteAttachmentMutation,
} from "@/store/api";
import { fetchFileBlob, resolveFileUrl } from "@/lib/env";
import {
  FilePreviewModal,
  useFilePreview,
} from "@/components/portal/shared/ui/modals/FilePreviewModal";
import { SingleDocumentCard } from "./components/SingleDocumentCard";
import { MultiDocumentGrid } from "./components/MultiDocumentGrid";
import {
  PerformaInvoiceFields,
  type PerformaFormValues,
  type PerformaAttachmentFiles,
  INITIAL_PERFORMA_VALUES,
} from "../../performa/PerformaInvoiceFields";

interface PerformaTabProps {
  orderId: string;
  detail?: Record<string, unknown>;
  refetchOrder?: () => void;
}

function detailPartyId(detail?: Record<string, unknown>): string {
  if (!detail) return "";
  const p = detail.party || detail.customer;
  if (typeof p === "string") return p;
  if (p && typeof p === "object" && "_id" in p) {
    return String((p as { _id: unknown })._id ?? "");
  }
  return "";
}

export default function PerformaTab({
  orderId,
  detail,
  refetchOrder,
}: PerformaTabProps) {
  const token = useAppSelector((s) => s.auth.token);
  const { data: performa, isLoading, isFetching, refetch } = useGetOrderPerformaQuery(orderId, {
    skip: !orderId,
  });
  const [updateOrderPerforma, { isLoading: isUpdating }] = useUpdateOrderPerformaMutation();
  const [createAttachment, { isLoading: isUploading }] = useCreateAttachmentMutation();
  const [deleteAttachment, { isLoading: isDeleting }] = useDeleteAttachmentMutation();

  const {
    previewDoc,
    previewBlobUrl,
    previewLoading,
    openPreview,
    closePreview,
  } = useFilePreview(token);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [formValues, setFormValues] = useState<PerformaFormValues>(INITIAL_PERFORMA_VALUES);
  const [modalFiles, setModalFiles] = useState<PerformaAttachmentFiles>({
    po_file: null,
    cost_sheet_file: null,
    aadhaar_file: null,
    pan_file: null,
    gst_file: null,
    kyc_files: [],
  });

  const creatorName = useMemo(() => {
    const cb = detail?.created_by;
    if (cb && typeof cb === "object") {
      const rec = cb as Record<string, unknown>;
      return String(rec.name || rec.username || "");
    }
    if (typeof cb === "string" && cb.trim()) {
      return cb;
    }
    return String(performa?.sales_person || detail?.sales_person || "");
  }, [detail, performa]);

  // Sync initial values when performa data loads
  useEffect(() => {
    if (performa) {
      setFormValues({
        sales_person: performa.sales_person || "",
        freight_charges: performa.freight_charges || "",
        orc: performa.orc || "",
        transport: performa.transport || "",
        dispatch_date: performa.dispatch_date ? performa.dispatch_date.slice(0, 10) : "",
        ship_to_address: performa.ship_to_address || "",
        payment_terms: performa.payment_terms || "",
        customer_type: performa.customer_type || "",
        installation_required: performa.installation_required || "",
        gst_concession: performa.gst_concession || "",
        margin_sheet_attached: performa.margin_sheet_attached || "",
        kyc_status: performa.kyc_status || "",
        remarks: performa.remarks || "",
      });
    }
  }, [performa]);

  const isLocked = Boolean(performa?.is_locked);
  const lockReason =
    performa?.lock_reason ||
    "Performa invoice cannot be edited once dispatch has been created and submitted.";

  const handleFieldChange = (field: keyof PerformaFormValues, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleModalFileChange = (
    field: keyof PerformaAttachmentFiles,
    file: File | File[] | null
  ) => {
    setModalFiles((prev) => ({ ...prev, [field]: file }));
  };

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      const response = await fetchFileBlob(fileUrl, token);
      if (!response.ok) {
        toast.error(`Failed to download file (${response.status})`);
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || "download";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      toast.error("Failed to download file");
    }
  };

  const handlePreview = (att: Record<string, unknown>) => {
    void openPreview({
      name: String(att.original_name ?? att.file_name ?? "Document"),
      url: resolveFileUrl(String(att.url ?? "")),
      mime: String(att.mime_type ?? ""),
    });
  };

  const handleUploadPo = async (file: File, remarks?: string) => {
    if (isLocked) {
      toast.error("Cannot modify attachments: dispatch is submitted.");
      return;
    }
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("entity_type", "order");
      fd.append("entity_id", orderId);
      fd.append("category", "po");
      fd.append("remarks", remarks || "Customer Purchase Order (PO)");

      await createAttachment(fd).unwrap();
      await updateOrderPerforma({
        orderId,
        data: {},
      }).unwrap().catch(() => {});

      toast.success("Purchase Order attached successfully");
      refetch();
      if (refetchOrder) refetchOrder();
    } catch (rejected) {
      toast.error(mutationRejectedMessage(rejected));
    }
  };

  const handleUploadCostSheet = async (file: File, remarks?: string) => {
    if (isLocked) {
      toast.error("Cannot modify attachments: dispatch is submitted.");
      return;
    }
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("entity_type", "order");
      fd.append("entity_id", orderId);
      fd.append("category", "cost_sheet");
      fd.append("remarks", remarks || "Cost Sheet / Margin Sheet");

      await createAttachment(fd).unwrap();
      await updateOrderPerforma({
        orderId,
        data: { margin_sheet_attached: "Attached" },
      }).unwrap().catch(() => {});

      toast.success("Cost Sheet attached successfully");
      refetch();
      if (refetchOrder) refetchOrder();
    } catch (rejected) {
      toast.error(mutationRejectedMessage(rejected));
    }
  };

  const handleUploadAadhaar = async (file: File, remarks?: string) => {
    if (isLocked) {
      toast.error("Cannot modify attachments: dispatch is submitted.");
      return;
    }
    try {
      const partyId = detailPartyId(detail);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("entity_type", "order");
      fd.append("entity_id", orderId);
      fd.append("category", "kyc_aadhaar");
      fd.append("remarks", remarks || "Customer Aadhaar Card");
      await createAttachment(fd).unwrap();

      if (partyId) {
        const pfd = new FormData();
        pfd.append("file", file);
        pfd.append("entity_type", "party");
        pfd.append("entity_id", partyId);
        pfd.append("category", "kyc_aadhaar");
        pfd.append("remarks", remarks || "Customer Aadhaar Card from Order");
        await createAttachment(pfd).unwrap().catch(() => {});
      }

      await updateOrderPerforma({
        orderId,
        data: { kyc_status: "Attached" },
      }).unwrap().catch(() => {});

      toast.success("Aadhaar Card uploaded successfully");
      refetch();
      if (refetchOrder) refetchOrder();
    } catch (rejected) {
      toast.error(mutationRejectedMessage(rejected));
    }
  };

  const handleUploadPan = async (file: File, remarks?: string) => {
    if (isLocked) {
      toast.error("Cannot modify attachments: dispatch is submitted.");
      return;
    }
    try {
      const partyId = detailPartyId(detail);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("entity_type", "order");
      fd.append("entity_id", orderId);
      fd.append("category", "kyc_pan");
      fd.append("remarks", remarks || "Customer PAN Card");
      await createAttachment(fd).unwrap();

      if (partyId) {
        const pfd = new FormData();
        pfd.append("file", file);
        pfd.append("entity_type", "party");
        pfd.append("entity_id", partyId);
        pfd.append("category", "kyc_pan");
        pfd.append("remarks", remarks || "Customer PAN Card from Order");
        await createAttachment(pfd).unwrap().catch(() => {});
      }

      await updateOrderPerforma({
        orderId,
        data: { kyc_status: "Attached" },
      }).unwrap().catch(() => {});

      toast.success("PAN Card uploaded successfully");
      refetch();
      if (refetchOrder) refetchOrder();
    } catch (rejected) {
      toast.error(mutationRejectedMessage(rejected));
    }
  };

  const handleUploadGst = async (file: File, remarks?: string) => {
    if (isLocked) {
      toast.error("Cannot modify attachments: dispatch is submitted.");
      return;
    }
    try {
      const partyId = detailPartyId(detail);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("entity_type", "order");
      fd.append("entity_id", orderId);
      fd.append("category", "kyc_gst");
      fd.append("remarks", remarks || "Customer GST Certificate");
      await createAttachment(fd).unwrap();

      if (partyId) {
        const pfd = new FormData();
        pfd.append("file", file);
        pfd.append("entity_type", "party");
        pfd.append("entity_id", partyId);
        pfd.append("category", "kyc_gst");
        pfd.append("remarks", remarks || "Customer GST Certificate from Order");
        await createAttachment(pfd).unwrap().catch(() => {});
      }

      await updateOrderPerforma({
        orderId,
        data: { kyc_status: "Attached" },
      }).unwrap().catch(() => {});

      toast.success("GST Certificate uploaded successfully");
      refetch();
      if (refetchOrder) refetchOrder();
    } catch (rejected) {
      toast.error(mutationRejectedMessage(rejected));
    }
  };

  const handleUploadKyc = async (files: File[], remarks?: string) => {
    if (isLocked) {
      toast.error("Cannot modify attachments: dispatch is submitted.");
      return;
    }
    try {
      const partyId = detailPartyId(detail);
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("entity_type", "order");
        fd.append("entity_id", orderId);
        fd.append("category", "kyc");
        fd.append("remarks", remarks || "KYC Verification Document");
        await createAttachment(fd).unwrap();

        if (partyId) {
          const pfd = new FormData();
          pfd.append("file", file);
          pfd.append("entity_type", "party");
          pfd.append("entity_id", partyId);
          pfd.append("category", "kyc");
          pfd.append("remarks", remarks || "KYC Verification Document from Order");
          await createAttachment(pfd).unwrap().catch(() => {});
        }
      }

      await updateOrderPerforma({
        orderId,
        data: { kyc_status: "Attached" },
      }).unwrap().catch(() => {});

      toast.success("KYC document(s) uploaded successfully");
      refetch();
      if (refetchOrder) refetchOrder();
    } catch (rejected) {
      toast.error(mutationRejectedMessage(rejected));
    }
  };

  const handleDeleteAttachment = async (attachmentId: string, name: string) => {
    if (isLocked) {
      toast.error("Cannot delete attachments: dispatch is submitted.");
      return;
    }
    try {
      await deleteAttachment(attachmentId).unwrap();
      toast.success(`Removed ${name}`);
      refetch();
      if (refetchOrder) refetchOrder();
    } catch (rejected) {
      toast.error(mutationRejectedMessage(rejected));
    }
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      toast.error("Editing is locked because dispatch has already been created/submitted.");
      return;
    }

    try {
      // Upload staged PO file if selected in modal
      if (modalFiles.po_file) {
        const fd = new FormData();
        fd.append("file", modalFiles.po_file);
        fd.append("entity_type", "order");
        fd.append("entity_id", orderId);
        fd.append("category", "po");
        fd.append("remarks", "Purchase Order (PO)");
        await createAttachment(fd).unwrap().catch(() => {});
      }

      // Upload staged Cost Sheet file if selected in modal
      if (modalFiles.cost_sheet_file) {
        const fd = new FormData();
        fd.append("file", modalFiles.cost_sheet_file);
        fd.append("entity_type", "order");
        fd.append("entity_id", orderId);
        fd.append("category", "cost_sheet");
        fd.append("remarks", "Cost Sheet / Margin Sheet");
        await createAttachment(fd).unwrap().catch(() => {});
      }

      // Upload staged Aadhaar file if selected in modal
      if (modalFiles.aadhaar_file) {
        const partyId = detailPartyId(detail);
        const fd = new FormData();
        fd.append("file", modalFiles.aadhaar_file);
        fd.append("entity_type", "order");
        fd.append("entity_id", orderId);
        fd.append("category", "kyc_aadhaar");
        fd.append("remarks", "Customer Aadhaar Card");
        await createAttachment(fd).unwrap().catch(() => {});

        if (partyId) {
          const pfd = new FormData();
          pfd.append("file", modalFiles.aadhaar_file);
          pfd.append("entity_type", "party");
          pfd.append("entity_id", partyId);
          pfd.append("category", "kyc_aadhaar");
          pfd.append("remarks", "Customer Aadhaar Card from Order");
          await createAttachment(pfd).unwrap().catch(() => {});
        }
      }

      // Upload staged PAN file if selected in modal
      if (modalFiles.pan_file) {
        const partyId = detailPartyId(detail);
        const fd = new FormData();
        fd.append("file", modalFiles.pan_file);
        fd.append("entity_type", "order");
        fd.append("entity_id", orderId);
        fd.append("category", "kyc_pan");
        fd.append("remarks", "Customer PAN Card");
        await createAttachment(fd).unwrap().catch(() => {});

        if (partyId) {
          const pfd = new FormData();
          pfd.append("file", modalFiles.pan_file);
          pfd.append("entity_type", "party");
          pfd.append("entity_id", partyId);
          pfd.append("category", "kyc_pan");
          pfd.append("remarks", "Customer PAN Card from Order");
          await createAttachment(pfd).unwrap().catch(() => {});
        }
      }

      // Upload staged GST file if selected in modal
      if (modalFiles.gst_file) {
        const partyId = detailPartyId(detail);
        const fd = new FormData();
        fd.append("file", modalFiles.gst_file);
        fd.append("entity_type", "order");
        fd.append("entity_id", orderId);
        fd.append("category", "kyc_gst");
        fd.append("remarks", "Customer GST Certificate");
        await createAttachment(fd).unwrap().catch(() => {});

        if (partyId) {
          const pfd = new FormData();
          pfd.append("file", modalFiles.gst_file);
          pfd.append("entity_type", "party");
          pfd.append("entity_id", partyId);
          pfd.append("category", "kyc_gst");
          pfd.append("remarks", "Customer GST Certificate from Order");
          await createAttachment(pfd).unwrap().catch(() => {});
        }
      }

      // Upload staged KYC files if selected in modal
      if (modalFiles.kyc_files && modalFiles.kyc_files.length > 0) {
        const partyId = detailPartyId(detail);
        for (const file of modalFiles.kyc_files) {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("entity_type", "order");
          fd.append("entity_id", orderId);
          fd.append("category", "kyc");
          fd.append("remarks", "KYC Verification Document");
          await createAttachment(fd).unwrap().catch(() => {});

          if (partyId) {
            const pfd = new FormData();
            pfd.append("file", file);
            pfd.append("entity_type", "party");
            pfd.append("entity_id", partyId);
            pfd.append("category", "kyc");
            pfd.append("remarks", "KYC Document from Order");
            await createAttachment(pfd).unwrap().catch(() => {});
          }
        }
      }

      // Save form values with any new attachments immediately linked
      await updateOrderPerforma({
        orderId,
        data: formValues,
      }).unwrap();

      toast.success("Performa Invoice updated successfully");
      setIsEditModalOpen(false);
      setModalFiles({
        po_file: null,
        cost_sheet_file: null,
        aadhaar_file: null,
        pan_file: null,
        gst_file: null,
        kyc_files: [],
      });
      refetch();
      if (refetchOrder) refetchOrder();
    } catch (err) {
      toast.error(mutationRejectedMessage(err));
    }
  };

  const data = performa || (INITIAL_PERFORMA_VALUES as any);
  const poDoc = data.po_document || null;
  const costSheetDoc = data.cost_sheet_document || null;
  const aadhaarDoc = data.aadhaar_document || null;
  const panDoc = data.pan_document || null;
  const gstDoc = data.gst_document || null;
  const kycDocs = (data.kyc_documents as Record<string, unknown>[]) || [];

  const extraKycDocs = useMemo(() => {
    const knownIds = new Set(
      [aadhaarDoc?._id, panDoc?._id, gstDoc?._id].filter(Boolean).map(String)
    );
    return kycDocs.filter((d) => !knownIds.has(String(d._id)));
  }, [kycDocs, aadhaarDoc, panDoc, gstDoc]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading Performa Invoice...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Top Banner / Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/60">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-50">
                Performa Invoice
              </h3>
              {isLocked ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-500/30">
                  <Lock className="h-3 w-3" />
                  Locked (Dispatch Submitted)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-500/30">
                  <CheckCircle2 className="h-3 w-3" />
                  Editable
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Commercial terms, carrier details, Purchase Order, Cost Sheet, and Verification & KYC records.
            </p>
          </div>
        </div>

        <div>
          {!isLocked ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setIsEditModalOpen(true)}
              className="gap-1.5 cursor-pointer"
            >
              <Edit3 className="h-4 w-4" />
              Edit Performa Invoice
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-200/60 dark:border-white/5">
              <Lock className="h-3.5 w-3.5 text-amber-500" />
              <span>Editing locked</span>
            </div>
          )}
        </div>
      </div>

      {/* Lock Notice if locked */}
      {isLocked && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/70 p-4 text-amber-800 dark:border-amber-500/20 dark:bg-amber-950/20 dark:text-amber-300">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <span className="font-semibold">Notice:</span> {lockReason}
          </div>
        </div>
      )}

      {/* Section 1: Commercial Representation & Terms */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Sales & Entity */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-white/5 mb-4">
              <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Sales & Entity
              </h4>
            </div>
            <dl className="space-y-3 text-xs">
              <div>
                <dt className="text-slate-500 dark:text-slate-400 font-medium">Sales Person</dt>
                <dd className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {data.sales_person || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400 font-medium">Customer Type</dt>
                <dd className="mt-0.5 font-medium text-slate-800 dark:text-slate-200">
                  {data.customer_type ? (
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-800 dark:bg-slate-800 dark:text-slate-200 font-medium">
                      {data.customer_type}
                    </span>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400 font-medium">Payment Terms</dt>
                <dd className="mt-0.5 text-slate-800 dark:text-slate-200 font-semibold">
                  {data.payment_terms || "—"}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Card 2: Freight & Commercials */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-white/5 mb-4">
              <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Freight & Commercials
              </h4>
            </div>
            <dl className="space-y-3 text-xs">
              <div>
                <dt className="text-slate-500 dark:text-slate-400 font-medium">Freight Charges</dt>
                <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                  {data.freight_charges ? (
                    <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {data.freight_charges}
                    </span>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400 font-medium">ORC</dt>
                <dd className="mt-0.5 text-slate-800 dark:text-slate-200 font-medium">
                  {data.orc || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400 font-medium">GST Concession</dt>
                <dd className="mt-0.5 text-slate-800 dark:text-slate-200 font-medium">
                  {data.gst_concession || "—"}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Card 3: Logistics & Dispatch */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-white/5 mb-4">
              <Truck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Logistics & Dispatch
              </h4>
            </div>
            <dl className="space-y-3 text-xs">
              <div>
                <dt className="text-slate-500 dark:text-slate-400 font-medium">Transport / Carrier</dt>
                <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                  {data.transport || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400 font-medium">Dispatch Date</dt>
                <dd className="mt-0.5 font-medium text-slate-800 dark:text-slate-200">
                  {data.dispatch_date ? new Date(data.dispatch_date).toLocaleDateString() : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400 font-medium">Installation Required</dt>
                <dd className="mt-0.5 font-medium text-slate-800 dark:text-slate-200">
                  {data.installation_required ? (
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                        data.installation_required === "Yes"
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {data.installation_required}
                    </span>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Card 4: Address Details */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/60 md:col-span-2 lg:col-span-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-white/5 mb-3">
            <MapPin className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Ship to Address
            </h4>
          </div>
          <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
            {data.ship_to_address || "No shipping address specified."}
          </div>
        </div>
      </div>

      {/* Section 2: Order Documents (Purchase Order & Cost Sheet) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Performa Documents & Cost Sheets
            </h4>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Purchase Order (PO) & Internal Cost / Margin Sheet
          </span>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Purchase Order (PO) Card */}
          <SingleDocumentCard
            title="Purchase Order (PO)"
            subtitle="Customer purchase order document / contract copy"
            badgeText="Purchase Order"
            attachment={poDoc}
            creatorFallback={creatorName}
            onUpload={handleUploadPo}
            onReplace={handleUploadPo}
            onDelete={(id, name) => handleDeleteAttachment(id, name)}
            onPreview={handlePreview}
            onDownload={handleDownload}
            isUploading={isUploading}
            isDeleting={isDeleting}
            disabled={isLocked}
          />

          {/* Cost Sheet (Margin Sheet) Card */}
          <SingleDocumentCard
            title="Cost Sheet (Margin Sheet)"
            subtitle="Internal product cost breakdown and approved margins"
            badgeText="Cost Sheet"
            attachment={costSheetDoc}
            creatorFallback={creatorName}
            onUpload={handleUploadCostSheet}
            onReplace={handleUploadCostSheet}
            onDelete={(id, name) => handleDeleteAttachment(id, name)}
            onPreview={handlePreview}
            onDownload={handleDownload}
            isUploading={isUploading}
            isDeleting={isDeleting}
            disabled={isLocked}
          />
        </div>
      </div>

      {/* Section 3: Verification & KYC Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 dark:border-white/10">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Verification & KYC Documents
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              KYC Status:
            </span>
            <span
              className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold ${
                data.kyc_status === "Verified" || data.kyc_status === "Attached"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 ring-1 ring-emerald-600/20"
                  : data.kyc_status === "Pending"
                  ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 ring-1 ring-amber-600/20"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {data.kyc_status || "Not Applicable"}
            </span>
          </div>
        </div>

        {/* Dedicated 3-Card Grid for Aadhaar, PAN, and GST */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Aadhaar Card */}
          <SingleDocumentCard
            title="Aadhaar Card"
            subtitle="Government issued 12-digit Aadhaar identity card"
            badgeText="Aadhaar"
            attachment={aadhaarDoc}
            creatorFallback={creatorName}
            onUpload={handleUploadAadhaar}
            onReplace={handleUploadAadhaar}
            onDelete={(id, name) => handleDeleteAttachment(id, name)}
            onPreview={handlePreview}
            onDownload={handleDownload}
            isUploading={isUploading}
            isDeleting={isDeleting}
            disabled={isLocked}
          />

          {/* PAN Card */}
          <SingleDocumentCard
            title="PAN Card"
            subtitle="Income Tax Permanent Account Number card"
            badgeText="PAN"
            attachment={panDoc}
            creatorFallback={creatorName}
            onUpload={handleUploadPan}
            onReplace={handleUploadPan}
            onDelete={(id, name) => handleDeleteAttachment(id, name)}
            onPreview={handlePreview}
            onDownload={handleDownload}
            isUploading={isUploading}
            isDeleting={isDeleting}
            disabled={isLocked}
          />

          {/* GST Certificate */}
          <SingleDocumentCard
            title="GST Certificate"
            subtitle="GSTIN Registration Certificate / Tax filing copy"
            badgeText="GST Certificate"
            attachment={gstDoc}
            creatorFallback={creatorName}
            onUpload={handleUploadGst}
            onReplace={handleUploadGst}
            onDelete={(id, name) => handleDeleteAttachment(id, name)}
            onPreview={handlePreview}
            onDownload={handleDownload}
            isUploading={isUploading}
            isDeleting={isDeleting}
            disabled={isLocked}
          />
        </div>

        {/* Additional Supporting KYC Files (if any) */}
        {extraKycDocs.length > 0 && (
          <div className="pt-2">
            <MultiDocumentGrid
              title="Other Supporting KYC Files"
              subtitle="Additional identity or business verification documents"
              badgeText="Supporting KYC"
              documents={extraKycDocs}
              creatorFallback={creatorName}
              onUpload={handleUploadKyc}
              onDelete={(id, name) => handleDeleteAttachment(id, name)}
              onPreview={handlePreview}
              onDownload={handleDownload}
              isUploading={isUploading}
              isDeleting={isDeleting}
              disabled={isLocked}
            />
          </div>
        )}
      </div>

      {/* Card 6: Remarks if any */}
      {data.remarks && (
        <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/60">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-white/5 mb-3">
            <AlignLeft className="h-4 w-4 text-slate-500" />
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Remarks & Commercial Notes
            </h4>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
            {data.remarks}
          </p>
        </div>
      )}

      {/* Edit Performa Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  <FileText className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-50">
                    Update Performa Invoice & Attachments
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Update commercial terms, carrier details, Purchase Order, Cost Sheet, and KYC files.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveModal} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <PerformaInvoiceFields
                  values={formValues}
                  onChange={handleFieldChange}
                  readOnly={isLocked}
                  attachmentFiles={modalFiles}
                  onAttachmentFileChange={handleModalFileChange}
                  existingDocuments={{
                    po_document: poDoc,
                    cost_sheet_document: costSheetDoc,
                    aadhaar_document: aadhaarDoc,
                    pan_document: panDoc,
                    gst_document: gstDoc,
                    kyc_documents: kycDocs,
                  }}
                />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/50">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isUpdating}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isUpdating || isLocked}
                  className="gap-1.5 cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  {isUpdating ? "Saving..." : "Save Performa Invoice"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {previewDoc && (
        <FilePreviewModal
          doc={previewDoc}
          blobUrl={previewBlobUrl}
          loading={previewLoading}
          onClose={closePreview}
          onDownload={() => {
            if (previewDoc?.url) {
              handleDownload(previewDoc.url, previewDoc.name || "document");
            }
          }}
        />
      )}
    </div>
  );
}
