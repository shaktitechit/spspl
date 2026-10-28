"use client";

import { useCallback, useMemo } from "react";
import { DashboardCard } from "@/components/widgets";
import { toast } from "@/lib/toast";
import { useAppSelector } from "@/store/hooks";
import { fetchFileBlob, resolveFileUrl } from "@/lib/env";
import {
  FilePreviewModal,
  useFilePreview,
  type PreviewFile,
} from "@/components/portal/shared/ui/modals/FilePreviewModal";
import {
  useListDispatchesQuery,
  useListTransportsQuery,
  useListUsersQuery,
  useListTransportAgentsQuery,
} from "@/store/api";
import { pickList, formatDate } from "../orderDetailUtils";
import { DispatchBatchCard } from "./DispatchBatchCard";

type ReadonlyDispatchesTabProps = {
  orderId: string;
  detail: Record<string, any> | null;
  refetchOrder?: () => void;
};

export function ReadonlyDispatchesTab({
  orderId,
  detail,
}: ReadonlyDispatchesTabProps) {
  const token = useAppSelector((state) => state.auth.token);
  const {
    previewDoc,
    previewBlobUrl,
    previewLoading,
    openPreview,
    closePreview,
  } = useFilePreview(token);

  const handleDownloadBillDocument = useCallback(
    async (fileUrl: string, fileName: string) => {
      try {
        const response = await fetchFileBlob(fileUrl, token);
        if (!response.ok) {
          if (response.status === 404) {
            toast.error("Document file is not found on storage server.");
          } else {
            toast.error(`Failed to download bill document (${response.status})`);
          }
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
        toast.error("Failed to download bill document");
      }
    },
    [token],
  );

  const handleViewBillDocument = useCallback(
    (billDoc: { name: string; url: string; mime: string }) => {
      void openPreview({
        name: billDoc.name,
        url: resolveFileUrl(billDoc.url),
        mime: billDoc.mime,
      });
    },
    [openPreview],
  );

  const handlePreviewBillDownload = useCallback(
    (doc: PreviewFile) => {
      void handleDownloadBillDocument(doc.url, doc.name);
    },
    [handleDownloadBillDocument],
  );

  const dispatchesQ = useListDispatchesQuery({ order: orderId });
  const transportsQ = useListTransportsQuery({ order: orderId });
  const usersQ = useListUsersQuery({});
  const transportAgentsQ = useListTransportAgentsQuery({});

  const dispatches = useMemo(
    () => pickList(dispatchesQ.data),
    [dispatchesQ.data],
  );
  const transports = useMemo(
    () => pickList(transportsQ.data),
    [transportsQ.data],
  );
  const transportAgents = useMemo(
    () => pickList(transportAgentsQ.data),
    [transportAgentsQ.data],
  );

  const userNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of pickList(usersQ.data)) {
      const id = String(u._id ?? u.id ?? "");
      if (id) map[id] = String(u.username || u.name || id);
    }
    return map;
  }, [usersQ.data]);

  const orderItems = useMemo(() => {
    if (!detail || !Array.isArray(detail.order_items)) return [];
    return detail.order_items;
  }, [detail]);

  return (
    <div className="space-y-6">
      <FilePreviewModal
        doc={previewDoc}
        blobUrl={previewBlobUrl}
        loading={previewLoading}
        onClose={closePreview}
        onDownload={handlePreviewBillDownload}
        subtitle="Bill document preview"
      />

      <DashboardCard
        title="Recorded Dispatch Batches"
        description="View dispatch details, dispatched items list, and associated logistics assignments."
      >
        {dispatchesQ.isLoading ? (
          <p className="text-sm text-slate-500 font-sans">Loading dispatches...</p>
        ) : dispatches.length === 0 ? (
          <p className="text-sm text-slate-500 font-sans">
            No dispatch batches recorded yet.
          </p>
        ) : (
          <div className="space-y-6 font-sans">
            {dispatches.map((disp) => (
              <DispatchBatchCard
                key={String(disp._id ?? disp.id ?? "")}
                dispatch={disp}
                orderItems={orderItems}
                transports={transports}
                transportAgents={transportAgents}
                userNameById={userNameById}
                formatDate={formatDate}
                onViewBillDocument={handleViewBillDocument}
                onDownloadBillDocument={handleDownloadBillDocument}
              />
            ))}
          </div>
        )}
      </DashboardCard>
    </div>
  );
}

export default ReadonlyDispatchesTab;
