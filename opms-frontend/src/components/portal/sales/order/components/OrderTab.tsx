"use client";

import { useMemo } from "react";
import { OrderTab as AdminOrderTab } from "@/components/portal/admin/order/components/OrderTab";
import { usePortalSettings } from "@/hooks/usePortalSettings";

type OrderTabProps = {
  orderId?: string;
  detail: Record<string, unknown> | null;
  isDraft?: boolean;
  user?: { _id?: unknown; id?: unknown } | null | undefined;
  refetchOrder?: () => void;
  status?: string;
  partyLabel?: string;
};

export default function OrderTab({
  detail,
  refetchOrder,
  status: statusProp,
  partyLabel = "—",
}: OrderTabProps) {
  const { canSalesMapVolume, canSalesMapPrice } = usePortalSettings();

  const readOnlyItems = useMemo(() => {
    if (!detail || !Array.isArray(detail.order_items)) return [];
    return detail.order_items as Record<string, unknown>[];
  }, [detail]);

  const status =
    statusProp ??
    (typeof detail?.status === "string" ? detail.status : "draft");

  return (
    <AdminOrderTab
      detail={detail}
      status={status}
      formatMoney={(v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n.toFixed(2) : "0.00";
      }}
      readOnlyItems={readOnlyItems}
      refetchOrder={refetchOrder}
      partyLabel={partyLabel}
      showPdfDownload={true}
      showApprovalBadges={true}
      showPricing={canSalesMapVolume}
      allowMapPrice={canSalesMapPrice}
    />
  );
}
