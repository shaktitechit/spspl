"use client";

import { LargeModalPortal } from "@/components/portal/shared/ui/modals/LargeModalPortal";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle, RotateCw, Truck, MapPin } from "lucide-react";

import { useAppSelector } from "@/store";
import {
  useGetOrderQuery,
  useListFlagsQuery,
  useGetOrderHistoryQuery,
  useSubmitOrderMutation,
  useCreateOrderApprovalMutation,
  useLazyGetOrderApprovalsQuery,
  useListAttachmentsQuery,
  useListUsersQuery,
  useListPartiesQuery,
  useGetPartyQuery,
  useGetOrderFulfillmentQuery,
  useListOrderApprovalsQuery,
  useListDispatchesQuery,
  useListTransportsQuery,
} from "@/store/api";
import { toast } from "@/lib/toast";
import { mutationRejectedMessage } from "@/lib/mutationMessages";
import { contactsFromParty } from "@/lib/partyContacts";

import {
  buildPartyNameById,
  buildPartySraById,
  checkOrderPartySra,
  resolveOrderCounterparty,
} from "@/components/portal/sales/partyDisplay";
import { useShellNav } from "@/components/shell/shell-nav-context";
import { OrderHeaderSummary } from "@/components/portal/shared/orders/detail/components/OrderHeaderSummary";
import { OrderDetailTabsNav } from "@/components/portal/shared/orders/components/OrderDetailTabsNav";
import { ItemFulfillmentDetailsModal } from "@/components/portal/shared/orders/modals/ItemFulfillmentDetailsModal";
import OrderDetailsModal from "@/components/portal/shared/orders/detail/modals/OrderDetailsModal";
import PartyDetailsModal from "@/components/portal/shared/orders/detail/modals/PartyDetailsModal";
import UpdatePartyAddressModal from "@/components/portal/shared/orders/detail/modals/UpdatePartyAddressModal";
import { isOrderClosed } from "@/components/portal/sales/orderUtils";
import { PortalBusyOverlay } from "@/components/portal/shared/shell/PortalBusyOverlay";
import {
  OrderFulfillmentPipelineStrip,
  buildOrderFulfillmentPipelineSteps,
  DEFAULT_ORDER_PIPELINE_ICONS,
} from "@/components/portal/shared/ui/fulfillment/FulfillmentCircleStep";
import { deriveOrderWorkflowStatus } from "@/components/portal/shared/orders/lib/orderLifecycle";
import { computeDepartmentStageBoxes } from "@/components/portal/shared/orders/lib/orderDepartmentStages";
import { type OrderStatusDimension } from "@/components/portal/shared/orders/lib/orderStatusDimensions";
import OrderTab from "./components/OrderTab";
import EditOrderModal from "./components/EditOrderModal";
import FlagsTab from "./components/FlagsTab";
import AttachmentsTab from "./components/AttachmentsTab";
import DispatchesTab from "./components/DispatchesTab";
import TransportsTab from "./components/TransportsTab";
import ApprovalTab from "./components/ApprovalTab";
import PoTab from "@/components/portal/shared/orders/detail/tabs/PoTab";
import PerformaTab from "@/components/portal/shared/orders/detail/tabs/PerformaTab";
import { useGetOrderPerformaQuery } from "@/store/api/slices/orderPerformaApi";
import CostSheetTab from "@/components/portal/shared/orders/detail/tabs/CostSheetTab";
import KycTab from "@/components/portal/shared/orders/detail/tabs/KycTab";
import SubmitOrderPreviewModal from "./components/SubmitOrderPreviewModal";
import { mobileTabIcon } from "@/components/portal/shared/orders/detail/orderDetailMobileIcons";
import { formatDateShort, detailRefId } from "@/components/portal/shared/orders/detail/orderDetailUtils";
import type { WorkflowEmailOptions } from "@/components/portal/shared/orders/modals/WorkflowEmailControls";

const btnSecondaryClass =
  "rounded-lg border border-slate-200/95 px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:text-slate-100 dark:hover:bg-white/5";

function pickList(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.items)) return o.items as Record<string, unknown>[];
    if (Array.isArray(o.data)) return o.data as Record<string, unknown>[];
    if (Array.isArray(o.attachments)) return o.attachments as Record<string, unknown>[];
    if (Array.isArray(o.rows)) return o.rows as Record<string, unknown>[];
    if (Array.isArray(o.records)) return o.records as Record<string, unknown>[];
    if (Array.isArray(o.documents)) return o.documents as Record<string, unknown>[];
  }
  return [];
}

export type SalesTabId =
  | "approvals"
  | "po"
  | "performa"
  | "cost_sheet"
  | "kyc"
  | "dispatches"
  | "transports"
  | "flags"
  | "attachments";

const TAB_TITLES: Record<SalesTabId, string> = {
  approvals: "Order Approval",
  po: "Purchase Order",
  performa: "Performa Invoice",
  cost_sheet: "Cost Sheet",
  kyc: "KYC Documents",
  dispatches: "Dispatches",
  transports: "Transports",
  flags: "Flags",
  attachments: "Attachments",
};

export default function SalesOrderDetail({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { setHeaderExtra } = useShellNav();
  const { data, isLoading, isFetching, isError, refetch } = useGetOrderQuery(orderId);
  const user = useAppSelector((s) => s.auth.user);

  const [activeTab, setActiveTab] = useState<SalesTabId>("approvals");
  const [mobileTabOpen, setMobileTabOpen] = useState(false);

  const [isSubmitPreviewOpen, setIsSubmitPreviewOpen] = useState(false);
  const [isFulfillmentModalOpen, setIsFulfillmentModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isOrderItemsModalOpen, setIsOrderItemsModalOpen] = useState(false);
  const [isOrderDetailsModalOpen, setIsOrderDetailsModalOpen] = useState(false);
  const [isPartyDetailsModalOpen, setIsPartyDetailsModalOpen] = useState(false);
  const [isUpdateAddressModalOpen, setIsUpdateAddressModalOpen] = useState(false);
  const [submitRemarks, setSubmitRemarks] = useState("");
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [submitIssue, setSubmitIssue] = useState<{
    kind: "submit" | "approval";
    message: string;
  } | null>(null);
  const [lastSubmitBody, setLastSubmitBody] = useState<Record<
    string,
    unknown
  > | null>(null);

  const usersQ = useListUsersQuery({});
  const users = useMemo(() => pickList(usersQ.data), [usersQ.data]);

  const resolveUser = useCallback(
    (userVal: unknown): { name: string; phone: string } => {
      if (!userVal) return { name: "—", phone: "" };
      if (typeof userVal === "object" && userVal !== null) {
        const u = userVal as Record<string, unknown>;
        if (u.name || u.phone) {
          return {
            name: String(u.name || u.username || "—"),
            phone: String(u.phone || ""),
          };
        }
      }
      const userId = typeof userVal === "string" ? userVal : String((userVal as any)?._id ?? (userVal as any)?.id ?? "");
      if (!userId) return { name: "—", phone: "" };
      const found = users.find((u) => String((u as any)._id ?? (u as any).id ?? "") === userId);
      if (found) {
        return {
          name: String((found as any).name || (found as any).username || "—"),
          phone: String((found as any).phone || ""),
        };
      }
      return { name: "—", phone: "" };
    },
    [users]
  );
  const partiesQ = useListPartiesQuery({});
  const partyNameById = useMemo(
    () => buildPartyNameById(partiesQ.data),
    [partiesQ.data],
  );
  const partySraById = useMemo(
    () => buildPartySraById(partiesQ.data),
    [partiesQ.data],
  );

  const attachmentsQ = useListAttachmentsQuery({
    entity_type: "order",
    entity_id: orderId,
  });
  const attachmentsList = useMemo(() => pickList(attachmentsQ.data), [attachmentsQ.data]);
  const attachmentsCount = attachmentsList.length;

  const flagsQ = useListFlagsQuery({ order: orderId });
  const openFlagsCount = useMemo(() => {
    const arr = pickList(flagsQ.data);
    return arr.filter((f) => {
      if (!f || typeof f !== "object") return false;
      return (f as Record<string, unknown>).status === "open";
    }).length;
  }, [flagsQ.data]);

  const historyQ = useGetOrderHistoryQuery(orderId);
  const fulfillmentQ = useGetOrderFulfillmentQuery(orderId);
  const approvalsQ = useListOrderApprovalsQuery(
    { order: orderId },
    { skip: !orderId },
  );
  const dispatchesQ = useListDispatchesQuery(
    { order: orderId },
    { skip: !orderId },
  );
  const transportsQ = useListTransportsQuery(
    { order: orderId },
    { skip: !orderId },
  );
  const performaQ = useGetOrderPerformaQuery(orderId, { skip: !orderId });

  const approvalsCount = useMemo(
    () => pickList(approvalsQ.data).length,
    [approvalsQ.data],
  );
  const dispatchesCount = useMemo(
    () => pickList(dispatchesQ.data).length,
    [dispatchesQ.data],
  );
  const transportsCount = useMemo(
    () => pickList(transportsQ.data).length,
    [transportsQ.data],
  );

  const [submitOrder] = useSubmitOrderMutation();
  const [createOrderApproval] = useCreateOrderApprovalMutation();
  const [fetchOrderApprovals] = useLazyGetOrderApprovalsQuery();

  const [submitEmailOptions, setSubmitEmailOptions] = useState<WorkflowEmailOptions>({
    send_email: false,
    send_to_party: false,
    recipients: [],
  });

  const detail =
    data && typeof data === "object"
      ? (data as Record<string, unknown>)
      : null;

  const performaRecord = performaQ.data;
  const orderPerformaField =
    detail?.order_performa ??
    (detail as any)?.performa ??
    (detail as any)?.proforma_details;

  const hasPerforma = useMemo(() => {
    if (performaRecord?._id && !performaRecord.is_default) {
      return true;
    }
    if (orderPerformaField) {
      if (typeof orderPerformaField === "string" && orderPerformaField.trim().length > 0) {
        return true;
      }
      if (typeof orderPerformaField === "object" && orderPerformaField !== null) {
        const perfObj = orderPerformaField as Record<string, unknown>;
        if (perfObj._id && !perfObj.is_default) {
          return true;
        }
        if (
          perfObj.sales_person ||
          perfObj.dispatch_date ||
          perfObj.transport ||
          perfObj.po_attachment ||
          perfObj.cost_sheet_attachment
        ) {
          return true;
        }
      }
    }
    if (performaRecord?._id) {
      return true;
    }
    return false;
  }, [performaRecord, orderPerformaField]);

  const performaCount = hasPerforma ? 1 : 0;

  const status = deriveOrderWorkflowStatus(detail);
  const isDraft = status === "draft";

  const fulfillmentSnapshot = useMemo(
    () =>
      fulfillmentQ.data && typeof fulfillmentQ.data === "object"
        ? (fulfillmentQ.data as Record<string, unknown>)
        : null,
    [fulfillmentQ.data],
  );

  const deptBoxes = useMemo(() => {
    if (!detail) return [];
    return computeDepartmentStageBoxes(detail, fulfillmentSnapshot);
  }, [detail, fulfillmentSnapshot]);

  const currentPartyId = detail ? detailRefId(detail.party || detail.customer) : "";
  const partyDetailQ = useGetPartyQuery(currentPartyId, {
    skip: !currentPartyId,
  });
  const partyAttachmentsQ = useListAttachmentsQuery(
    { entity_type: "party", entity_id: currentPartyId },
    { skip: !currentPartyId },
  );
  const customerAttachmentsQ = useListAttachmentsQuery(
    { entity_type: "customer", entity_id: currentPartyId },
    { skip: !currentPartyId },
  );

  // PO count
  const poCount = useMemo(() => {
    return (attachmentsList as Record<string, unknown>[]).filter((a) => {
      const c = String(a.category || "").toLowerCase();
      const r = String(a.remarks || "").toLowerCase();
      const n = String(a.original_name || a.file_name || "").toLowerCase();
      return c === "po" || r.startsWith("[po]") || n.startsWith("po_");
    }).length;
  }, [attachmentsList]);

  // Cost Sheet count
  const costSheetCount = useMemo(() => {
    return (attachmentsList as Record<string, unknown>[]).filter((a) => {
      const c = String(a.category || "").toLowerCase();
      const r = String(a.remarks || "").toLowerCase();
      const n = String(a.original_name || a.file_name || "").toLowerCase();
      return c === "cost_sheet" || r.startsWith("[cost_sheet]") || n.includes("cost_sheet") || n.includes("costsheet");
    }).length;
  }, [attachmentsList]);

  // KYC count
  const kycCount = useMemo(() => {
    const kycPartyDocs = [
      ...pickList(partyAttachmentsQ.data),
      ...pickList(customerAttachmentsQ.data),
    ];
    const seenKycDocIds = new Set<string>();
    const deduplicatedPartyDocs: Record<string, unknown>[] = [];
    for (const doc of kycPartyDocs) {
      const id = String(doc._id ?? doc.id ?? "");
      if (id && !seenKycDocIds.has(id)) {
        seenKycDocIds.add(id);
        deduplicatedPartyDocs.push(doc);
      } else if (!id) {
        deduplicatedPartyDocs.push(doc);
      }
    }

    const kycOrderDocs = (attachmentsList as Record<string, unknown>[]).filter((a) => {
      const c = String(a.category || "").toLowerCase();
      const r = String(a.remarks || "").toLowerCase();
      const n = String(a.original_name || a.file_name || "").toLowerCase();
      return (
        c.startsWith("kyc") ||
        c.includes("aadhaar") ||
        c.includes("pan") ||
        c.includes("gst") ||
        r.includes("kyc") ||
        r.includes("aadhaar") ||
        r.includes("adhaar") ||
        r.includes("pan") ||
        r.includes("gst") ||
        n.includes("kyc") ||
        n.includes("aadhaar") ||
        n.includes("adhaar") ||
        n.includes("pan") ||
        n.includes("gst")
      );
    });

    const partyObj = (
      (partyDetailQ.data && typeof partyDetailQ.data === "object" && !Array.isArray(partyDetailQ.data)
        ? (partyDetailQ.data as Record<string, unknown>)
        : null) ||
      (detail?.party && typeof detail.party === "object" && !Array.isArray(detail.party)
        ? (detail.party as Record<string, unknown>)
        : null)
    ) as Record<string, unknown> | undefined;

    let registeredFieldCount = 0;
    if (partyObj?.gst_no || (detail as any)?.gst_no) registeredFieldCount++;
    if (partyObj?.pan || partyObj?.pan_no || (detail as any)?.pan) registeredFieldCount++;
    if (partyObj?.drug_license_no || partyObj?.drug_license) registeredFieldCount++;
    if (partyObj?.aadhaar_number || partyObj?.aadhaar_no) registeredFieldCount++;

    const totalKycDocs = deduplicatedPartyDocs.length + kycOrderDocs.length;
    return totalKycDocs > 0
      ? totalKycDocs
      : registeredFieldCount > 0
        ? registeredFieldCount
        : (partyObj?.kyc_verified || (partyObj as any)?.is_kyc_verified)
          ? 1
          : 0;
  }, [partyAttachmentsQ.data, customerAttachmentsQ.data, attachmentsList, partyDetailQ.data, detail]);

  const custLabel = useMemo(
    () =>
      detail ? resolveOrderCounterparty(detail, partyNameById) : "—",
    [detail, partyNameById],
  );

  const readOnlyItems = useMemo(() => {
    if (!detail || !Array.isArray(detail.order_items)) return [];
    return detail.order_items as Record<string, unknown>[];
  }, [detail]);

  const orderKpis = useMemo(() => {
    const fulfillment =
      fulfillmentQ.data && typeof fulfillmentQ.data === "object"
        ? (fulfillmentQ.data as Record<string, unknown>)
        : null;
    const totals =
      fulfillment?.totals && typeof fulfillment.totals === "object"
        ? (fulfillment.totals as Record<string, unknown>)
        : null;

    const totalLines = readOnlyItems.length;
    const totalQty = Number(totals?.ordered ?? readOnlyItems.reduce(
      (sum, line) => sum + Number(line.ordered_quantity ?? line.quantity ?? 0),
      0,
    ));
    const financeApprovedQty = Number(totals?.approved ?? readOnlyItems.reduce(
      (sum, line) => sum + Number(line.approved_quantity || 0),
      0,
    ));
    const dispatchedQty = Number(totals?.dispatched ?? readOnlyItems.reduce(
      (sum, line) => sum + Number(line.dispatched_quantity || 0),
      0,
    ));
    const pendingQty = Number(
      totals?.pendingDispatch ??
      readOnlyItems.reduce((sum, line) => {
        const approved = Number(line.approved_quantity || 0);
        const cap = approved > 0 ? approved : Number(line.ordered_quantity ?? line.quantity ?? 0);
        return sum + Math.max(0, cap - Number(line.dispatched_quantity || 0));
      }, 0),
    );

    return {
      totalLines,
      totalQty,
      dispatchedQty,
      pendingQty,
      financeApprovedQty,
      openFlags: openFlagsCount,
    };
  }, [fulfillmentQ.data, openFlagsCount, readOnlyItems]);

  const pipelineSteps = useMemo(
    () =>
      buildOrderFulfillmentPipelineSteps(deptBoxes, DEFAULT_ORDER_PIPELINE_ICONS, {
        defaultTotal: orderKpis.totalQty,
      }),
    [deptBoxes, orderKpis.totalQty],
  );

  const orderNo = detail?.order_no ? String(detail.order_no) : "Order";

  const activeTransportInfo = useMemo(() => {
    const rawTransports = pickList(transportsQ.data);
    if (!rawTransports || rawTransports.length === 0) return null;
    const sorted = [...rawTransports].sort((a: any, b: any) => {
      const dateA = new Date(a.scheduled_date || a.createdAt || 0).getTime();
      const dateB = new Date(b.scheduled_date || b.createdAt || 0).getTime();
      return dateB - dateA;
    });
    const latest = sorted[0] as any;
    const agent = latest?.transport_agent;
    const agentName =
      typeof agent === "object" && agent !== null
        ? agent.agent_name || agent.name
        : typeof agent === "string"
          ? agent
          : undefined;
    return {
      agentName: agentName ? String(agentName) : undefined,
      scheduledDate: latest?.scheduled_date
        ? String(latest.scheduled_date)
        : undefined,
    };
  }, [transportsQ.data]);

  const createdBy = useMemo(() => {
    if (!detail) return "—";
    const u = detail.createdBy;
    if (typeof u === "object" && u !== null) {
      const rec = u as Record<string, unknown>;
      return String(rec.name || rec.username || "—");
    }
    return resolveUser(u).name;
  }, [detail, resolveUser]);

  const desktopTabs = useMemo(
    () => [
      {
        id: "approvals",
        name: "Order Approval",
        count: approvalsCount,
        hasData: approvalsCount > 0,
      },
      {
        id: "po",
        name: "PO",
        count: poCount,
        hasData: poCount > 0,
      },
      {
        id: "performa",
        name: "Performa",
        count: performaCount,
        hasData: performaCount > 0,
      },
      {
        id: "cost_sheet",
        name: "Cost Sheet",
        count: costSheetCount,
        hasData: costSheetCount > 0,
      },
      {
        id: "kyc",
        name: "KYC",
        count: kycCount,
        hasData: kycCount > 0,
      },
      {
        id: "dispatches",
        name: "Dispatches",
        count: dispatchesCount,
        hasData: dispatchesCount > 0,
      },
      {
        id: "transports",
        name: "Transports",
        count: transportsCount,
        hasData: transportsCount > 0,
      },
      {
        id: "flags",
        name: "Flags",
        count: openFlagsCount,
        hasData: openFlagsCount > 0,
        dangerBadge: true,
      },
      {
        id: "attachments",
        name: "Attachments",
        count: attachmentsCount,
        hasData: attachmentsCount > 0,
      },
    ],
    [
      approvalsCount,
      poCount,
      performaCount,
      costSheetCount,
      kycCount,
      dispatchesCount,
      transportsCount,
      openFlagsCount,
      attachmentsCount,
    ],
  );

  const mobileTabs = useMemo(
    () => [
      { id: "approvals" as const, name: "Approval", count: approvalsCount, hasData: approvalsCount > 0, dangerBadge: false },
      { id: "po" as const, name: "PO", count: poCount, hasData: poCount > 0, dangerBadge: false },
      { id: "performa" as const, name: "Performa", count: performaCount, hasData: performaCount > 0, dangerBadge: false },
      { id: "cost_sheet" as const, name: "Cost Sheet", count: costSheetCount, hasData: costSheetCount > 0, dangerBadge: false },
      { id: "kyc" as const, name: "KYC", count: kycCount, hasData: kycCount > 0, dangerBadge: false },
      { id: "dispatches" as const, name: "Dispatch", count: dispatchesCount, hasData: dispatchesCount > 0, dangerBadge: false },
      { id: "transports" as const, name: "Transport", count: transportsCount, hasData: transportsCount > 0, dangerBadge: false },
      { id: "flags" as const, name: "Flags", count: openFlagsCount, hasData: openFlagsCount > 0, dangerBadge: true },
      { id: "attachments" as const, name: "Files", count: attachmentsCount, hasData: attachmentsCount > 0, dangerBadge: false },
    ],
    [
      approvalsCount,
      poCount,
      performaCount,
      costSheetCount,
      kycCount,
      dispatchesCount,
      transportsCount,
      openFlagsCount,
      attachmentsCount,
    ],
  );

  useEffect(() => {
    if (!detail) {
      setHeaderExtra(null);
      return;
    }
    setHeaderExtra(
      <OrderHeaderSummary
        orderNo={orderNo}
        custLabel={custLabel}
        orderDate={detail.order_date}
        edd={detail.expected_delivery_date}
        isSra={Boolean(
          checkOrderPartySra(detail, partySraById) ||
            (partyDetailQ.data as any)?.sra === true,
        )}
        priority={
          typeof detail.priority === "string" ? detail.priority : "normal"
        }
        workflowCategory={null}
        showFinanceWorkflowBadge={false}
        pipelineSteps={pipelineSteps}
      />,
    );
    return () => {
      setHeaderExtra(null);
    };
  }, [
    detail,
    orderNo,
    custLabel,
    partySraById,
    partyDetailQ.data,
    pipelineSteps,
    setHeaderExtra,
  ]);

  const handleRefetch = useCallback(() => {
    void refetch();
    if (!flagsQ.isUninitialized) void flagsQ.refetch();
    if (!historyQ.isUninitialized) void historyQ.refetch();
    if (!attachmentsQ.isUninitialized) void attachmentsQ.refetch();
    if (!fulfillmentQ.isUninitialized) void fulfillmentQ.refetch();
    if (!approvalsQ.isUninitialized) void approvalsQ.refetch();
    if (!dispatchesQ.isUninitialized) void dispatchesQ.refetch();
    if (!transportsQ.isUninitialized) void transportsQ.refetch();
    if (!partyDetailQ.isUninitialized) void partyDetailQ.refetch();
    if (!partyAttachmentsQ.isUninitialized) void partyAttachmentsQ.refetch();
    if (!customerAttachmentsQ.isUninitialized) void customerAttachmentsQ.refetch();
    if (!performaQ.isUninitialized) void performaQ.refetch();
  }, [
    refetch,
    flagsQ,
    historyQ,
    attachmentsQ,
    fulfillmentQ,
    approvalsQ,
    dispatchesQ,
    transportsQ,
    partyDetailQ,
    partyAttachmentsQ,
    customerAttachmentsQ,
    performaQ,
  ]);

  const buildSubmitPayload = useCallback(() => {
    const orderItemsPayload = readOnlyItems.map((line) => {
      const item: Record<string, unknown> = {
        product: detailRefId(line.product),
        product_name: String(line.product_name ?? "—"),
        sku: typeof line.sku === "string" ? line.sku : "",
        ordered_quantity: Number(line.ordered_quantity ?? line.quantity ?? 0),
        free_quantity: Number(line.free_quantity ?? line.free_qty ?? 0),
        unit_price: Number(line.unit_price ?? 0),
        discount_percent: Number(line.discount_percent ?? 0),
        discount_amount: Number(line.discount_amount ?? 0),
        gst_percent: Number(line.gst_percent ?? 18),
        applied_rate_type:
          !line.applied_rate_type || line.applied_rate_type === "MANUAL"
            ? "SR"
            : String(line.applied_rate_type),
        remarks: typeof line.remarks === "string" ? line.remarks.trim() : "",
      };
      const id = line._id ?? line.id;
      if (id) item._id = String(id);
      return item;
    });

    const getLineTotal = (line: Record<string, unknown>) => {
      const qty = Number(line.ordered_quantity ?? line.quantity ?? 0);
      const unitPrice = Number(line.unit_price ?? 0);
      const gross = qty * unitPrice;
      let discount = Number(line.discount_amount ?? 0);
      const discPercent = Number(line.discount_percent ?? 0);
      if (discPercent > 0) discount = (gross * discPercent) / 100;
      const taxable = Math.max(0, gross - discount);
      const gst = (taxable * Number(line.gst_percent ?? 0)) / 100;
      return taxable + gst;
    };

    const approvedTotal = readOnlyItems.reduce(
      (sum, line) => sum + getLineTotal(line),
      0,
    );

    const approvalItems = readOnlyItems.map((line) => {
      const item: Record<string, unknown> = {
        product: detailRefId(line.product),
        ordered_quantity: Number(line.ordered_quantity ?? line.quantity ?? 0),
        approved_quantity: Number(line.ordered_quantity ?? line.quantity ?? 0),
        approved_unit_price: Number(line.unit_price ?? 0),
        ordered_unit_price: Number(line.unit_price ?? 0),
        free_quantity: Number(line.free_quantity ?? line.free_qty ?? 0),
        discount_percent: Number(line.discount_percent ?? 0),
        discount_amount: Number(line.discount_amount ?? 0),
        gst_percent: Number(line.gst_percent ?? 18),
        applied_rate_type:
          !line.applied_rate_type || line.applied_rate_type === "MANUAL"
            ? "SR"
            : String(line.applied_rate_type),
        approved_total_amount: getLineTotal(line),
        approval_status: "fully_approved",
        remarks: typeof line.remarks === "string" ? line.remarks.trim() : "",
      };
      const id = line._id ?? line.id;
      if (id) item.order_item_id = String(id);
      return item;
    });

    const partyContacts = contactsFromParty(partyDetailQ.data);
    const selectedContacts: string[] = [];
    const selectedContactNames: string[] = [];
    const firstWithPhone = partyContacts.find((c) => c.phone.trim());
    if (firstWithPhone) {
      selectedContacts.push(firstWithPhone.phone.trim());
      selectedContactNames.push(firstWithPhone.name.trim());
    }

    return {
      order_items: orderItemsPayload,
      remarks: submitRemarks.trim() || undefined,
      approved_total_amount: approvedTotal,
      approval_items: approvalItems,
      contact_number: selectedContacts,
      contact_name: selectedContactNames,
      email_options: submitEmailOptions,
    };
  }, [readOnlyItems, partyDetailQ.data, submitRemarks, submitEmailOptions]);

  const verifyApprovalExists = useCallback(
    async (id: string) => {
      try {
        const raw = await fetchOrderApprovals(id).unwrap();
        return pickList(raw).length > 0;
      } catch {
        return false;
      }
    },
    [fetchOrderApprovals],
  );

  const finishSubmitSuccess = useCallback(() => {
    toast.success("Order submitted successfully.");
    setSubmitIssue(null);
    setLastSubmitBody(null);
    setIsSubmitPreviewOpen(false);
    setSubmitRemarks("");
    handleRefetch();
  }, [handleRefetch]);

  const handleRetryApproval = useCallback(async () => {
    if (!orderId) return;
    const body = lastSubmitBody || buildSubmitPayload();
    setIsSubmittingOrder(true);
    setSubmitIssue(null);
    try {
      await createOrderApproval({
        order: orderId,
        approve_immediately: false,
        replace_snapshot: true,
        approval_notes:
          typeof body.remarks === "string" ? body.remarks : undefined,
        approved_total_amount: Number(body.approved_total_amount ?? 0) || 0,
        approval_items: (body.approval_items as any[]) || [],
        contact_number: (body.contact_number as string[]) || [],
        contact_name: (body.contact_name as string[]) || [],
        order_items: (body.order_items as any[]) || [],
      }).unwrap();
      const ok = await verifyApprovalExists(orderId);
      if (!ok) {
        throw new Error("Approval still missing after retry");
      }
      finishSubmitSuccess();
    } catch (rejected) {
      const message = mutationRejectedMessage(rejected);
      setSubmitIssue({
        kind: "approval",
        message:
          message ||
          "Order was submitted but approval could not be created. Retry.",
      });
      toast.error(message || "Failed to create order approval");
    } finally {
      setIsSubmittingOrder(false);
    }
  }, [
    orderId,
    lastSubmitBody,
    buildSubmitPayload,
    createOrderApproval,
    verifyApprovalExists,
    finishSubmitSuccess,
  ]);

  const handleSubmitOrder = useCallback(async () => {
    if (!orderId) return;
    if (!readOnlyItems.length) {
      toast.error("Add at least one line item before submitting.");
      return;
    }
    setIsSubmittingOrder(true);
    setSubmitIssue(null);
    const body = buildSubmitPayload();
    setLastSubmitBody(body);
    try {
      const result = (await submitOrder({
        id: orderId,
        body,
      }).unwrap()) as {
        approval_created?: boolean;
        approval_error?: string | null;
      };

      if (result?.approval_created === false) {
        setSubmitIssue({
          kind: "approval",
          message:
            result.approval_error ||
            "Order was submitted but approval was not created. Please retry.",
        });
        toast.error("Submitted, but approval creation failed — retry below.");
        return;
      }

      const exists = await verifyApprovalExists(orderId);
      if (!exists && result?.approval_created !== true) {
        let found = false;
        for (let i = 0; i < 3; i += 1) {
          await new Promise((r) => setTimeout(r, 800));
          found = await verifyApprovalExists(orderId);
          if (found) break;
        }
        if (!found) {
          setSubmitIssue({
            kind: "approval",
            message:
              "Order was submitted but approval is missing. Please retry approval creation.",
          });
          toast.error("Approval missing after submit — use Retry.");
          return;
        }
      }

      finishSubmitSuccess();
    } catch (rejected) {
      const message = mutationRejectedMessage(rejected);
      setSubmitIssue({ kind: "submit", message });
      toast.error(message);
    } finally {
      setIsSubmittingOrder(false);
    }
  }, [
    orderId,
    readOnlyItems.length,
    buildSubmitPayload,
    submitOrder,
    verifyApprovalExists,
    finishSubmitSuccess,
  ]);

  const handleSubmitRetry = useCallback(async () => {
    if (submitIssue?.kind === "approval") {
      await handleRetryApproval();
      return;
    }
    await handleSubmitOrder();
  }, [submitIssue, handleRetryApproval, handleSubmitOrder]);

  if (isError || (!isLoading && !detail)) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-4 font-sans">
        <AlertTriangle className="h-10 w-10 text-red-500 mb-2" />
        <p className="text-sm text-rose-600 dark:text-rose-400">
          Could not load order details.
        </p>
        <button
          type="button"
          onClick={() => router.back()}
          className={`${btnSecondaryClass} mt-4 cursor-pointer`}
        >
          Back
        </button>
      </div>
    );
  }

  if (!detail) {
    return <PortalBusyOverlay active message="Loading order details…" />;
  }

  return (
    <div className="h-[calc(100vh-150px)] md:h-[calc(100vh-160px)] flex flex-col min-h-0 overflow-hidden space-y-0 pb-20 md:pb-0 font-sans select-none">
      <EditOrderModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        orderId={orderId}
        detail={detail}
        user={user}
        refetchOrder={handleRefetch}
      />

      <SubmitOrderPreviewModal
        isOpen={isSubmitPreviewOpen}
        onClose={() => {
          if (isSubmittingOrder) return;
          setIsSubmitPreviewOpen(false);
          setSubmitRemarks("");
          setSubmitIssue(null);
          setLastSubmitBody(null);
        }}
        detail={detail}
        partyLabel={custLabel}
        submitRemarks={submitRemarks}
        onSubmitRemarksChange={setSubmitRemarks}
        onSubmit={() => void handleSubmitOrder()}
        onRetry={() => void handleSubmitRetry()}
        isSubmitting={isSubmittingOrder}
        submitIssue={submitIssue}
        emailOptions={submitEmailOptions}
        onEmailOptionsChange={setSubmitEmailOptions}
      />

      <ItemFulfillmentDetailsModal
        isOpen={isFulfillmentModalOpen}
        onClose={() => setIsFulfillmentModalOpen(false)}
        order={detail}
        fulfillmentSnapshot={fulfillmentSnapshot}
      />

      <OrderDetailsModal
        isOpen={isOrderDetailsModalOpen}
        onClose={() => setIsOrderDetailsModalOpen(false)}
        detail={detail}
        createdBy={createdBy}
        resolveUser={resolveUser}
        activeTransportInfo={activeTransportInfo}
        onEditAddress={() => setIsUpdateAddressModalOpen(true)}
      />

      <PartyDetailsModal
        isOpen={isPartyDetailsModalOpen}
        onClose={() => setIsPartyDetailsModalOpen(false)}
        isFetching={partyDetailQ.isFetching}
        isError={partyDetailQ.isError}
        partyData={partyDetailQ.data}
        custLabel={custLabel}
        onEditAddress={() => setIsUpdateAddressModalOpen(true)}
      />

      <UpdatePartyAddressModal
        isOpen={isUpdateAddressModalOpen}
        onClose={() => setIsUpdateAddressModalOpen(false)}
        partyId={currentPartyId}
        orderId={orderId}
        isLocked={isOrderClosed(detail)}
        partyName={custLabel}
        initialBillingAddress={
          (detail?.billing_address as Record<string, unknown>) ||
          ((partyDetailQ.data as Record<string, unknown>)?.billing_address as Record<string, unknown>) ||
          (((detail?.party || detail?.customer) as Record<string, unknown>)?.billing_address as Record<string, unknown>)
        }
        initialShippingAddress={
          (detail?.shipping_address as Record<string, unknown>) ||
          ((partyDetailQ.data as Record<string, unknown>)?.shipping_address as Record<string, unknown>) ||
          (((detail?.party || detail?.customer) as Record<string, unknown>)?.shipping_address as Record<string, unknown>)
        }
        shippingAddresses={
          ((partyDetailQ.data as any)?.shipping_addresses as any[]) || []
        }
        onSuccess={() => {
          if (!partyDetailQ.isUninitialized) void partyDetailQ.refetch();
          handleRefetch();
        }}
      />

      {isOrderItemsModalOpen && (
        <LargeModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
            <div className="w-full max-w-4xl rounded-xl border border-slate-200/90 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-slate-900 transition-all max-h-[85vh] flex flex-col font-sans">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/5">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                  Order Items
                </h3>
                <button
                  type="button"
                  onClick={() => setIsOrderItemsModalOpen(false)}
                  className="rounded-md text-slate-400 hover:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 p-1 cursor-pointer"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mt-4 overflow-y-auto flex-1 pr-1">
                <OrderTab
                  orderId={orderId}
                  detail={detail}
                  isDraft={isDraft}
                  user={user}
                  refetchOrder={handleRefetch}
                  partyLabel={custLabel}
                />
              </div>

              <div className="mt-5 flex justify-end border-t border-slate-100 pt-3 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setIsOrderItemsModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-100 dark:hover:bg-white/5 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </LargeModalPortal>
      )}

      {detail && (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* ── Unified Top Action Bar ── */}
          <div className="flex-shrink-0 mb-1.5">
            <div className="rounded-lg border border-slate-200/80 bg-white p-2 shadow-xs dark:border-white/10 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
                {/* Back button & Breadcrumbs */}
                <div className="flex items-center gap-1.5 text-2xs text-slate-500 dark:text-slate-400 shrink-0">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 font-medium text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/20 transition cursor-pointer"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    <span>Back</span>
                  </button>
                  <span className="text-slate-300 dark:text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={() => router.push("/sales/orders")}
                    className="font-medium text-blue-650 hover:underline dark:text-blue-400"
                  >
                    Orders
                  </button>
                  <span>/</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    Details
                  </span>
                  <span className="ml-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-wider text-slate-600 dark:bg-white/10 dark:text-slate-300">
                    Sales
                  </span>
                </div>

                {/* Unified Top Action Panel */}
                <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 font-sans font-medium text-2xs">
                  {/* Order Info */}
                  <button
                    type="button"
                    onClick={() => setIsOrderDetailsModalOpen(true)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-white px-2 py-1 text-2xs font-semibold text-slate-700 shadow-xs transition dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-white/5 cursor-pointer active:scale-[0.97]"
                  >
                    <span>Order Info</span>
                  </button>

                  {/* Party Info */}
                  <button
                    type="button"
                    onClick={() => setIsPartyDetailsModalOpen(true)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-white px-2 py-1 text-2xs font-semibold text-slate-700 shadow-xs transition dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-white/5 cursor-pointer active:scale-[0.97]"
                  >
                    <span>Party Info</span>
                  </button>

                  {/* Address */}
                  <button
                    type="button"
                    disabled={!currentPartyId && !orderId}
                    onClick={() => setIsUpdateAddressModalOpen(true)}
                    className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50/80 hover:bg-blue-100/90 px-2 py-1 text-2xs font-semibold text-blue-800 shadow-xs transition dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50 cursor-pointer active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
                    title={currentPartyId || orderId ? "Update billing & shipping addresses" : "No party linked to this order"}
                  >
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span>Address</span>
                  </button>

                  {/* Items List */}
                  <button
                    type="button"
                    onClick={() => setIsOrderItemsModalOpen(true)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-white px-2 py-1 text-2xs font-semibold text-slate-700 shadow-xs transition dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-white/5 cursor-pointer active:scale-[0.97]"
                  >
                    <span>Items List</span>
                  </button>

                  {/* Details (Fulfillment Details) */}
                  <button
                    type="button"
                    onClick={() => setIsFulfillmentModalOpen(true)}
                    className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 hover:bg-amber-100/80 px-2 py-1 text-2xs font-semibold text-amber-800 shadow-xs transition dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50 cursor-pointer active:scale-[0.97]"
                    title="Fulfillment details"
                  >
                    <span>Details</span>
                  </button>

                  {/* Refresh */}
                  <button
                    type="button"
                    onClick={handleRefetch}
                    className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-slate-50 hover:bg-white p-1 text-slate-600 shadow-xs transition dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-white/5 cursor-pointer active:scale-[0.97]"
                    title="Refresh order"
                  >
                    <RotateCw className="h-3 w-3" />
                  </button>

                  {/* Active Transport Info Chip (if assigned) */}
                  {(activeTransportInfo?.agentName || activeTransportInfo?.scheduledDate) && (
                    <div className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-2xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 ring-1 ring-inset ring-amber-600/25 shadow-xs">
                      <Truck className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>
                        {activeTransportInfo.agentName ? (
                          <span>Agent: <b>{activeTransportInfo.agentName}</b></span>
                        ) : null}
                        {activeTransportInfo.scheduledDate ? (
                          <span>
                            {activeTransportInfo.agentName ? " • " : ""}Dispatch: <b>{formatDateShort(activeTransportInfo.scheduledDate)}</b>
                          </span>
                        ) : null}
                      </span>
                    </div>
                  )}

                  {/* Edit Draft */}
                  {isDraft && (
                    <button
                      type="button"
                      onClick={() => setIsEditModalOpen(true)}
                      className="inline-flex items-center gap-1 rounded-md bg-blue-600 hover:bg-blue-700 px-2 py-1 text-2xs font-semibold text-white shadow-xs transition active:scale-[0.97] cursor-pointer dark:bg-blue-500 dark:hover:bg-blue-400"
                    >
                      <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>Edit Draft</span>
                    </button>
                  )}

                  {/* Submit Order */}
                  {status === "draft" && (
                    <button
                      type="button"
                      onClick={() => {
                        setSubmitRemarks("");
                        setIsSubmitPreviewOpen(true);
                      }}
                      className="rounded-md bg-emerald-600 px-2.5 py-1 text-2xs font-semibold text-white transition hover:bg-emerald-700 active:scale-[0.98] dark:bg-emerald-500 dark:hover:bg-emerald-400 cursor-pointer shadow-xs"
                    >
                      Submit Order
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── DESKTOP: Tab Content ── */}
          <div className="hidden md:block flex-1 min-h-0 overflow-y-auto pr-1">
            {activeTab === "approvals" && (
              <ApprovalTab orderId={orderId} detail={detail} partyLabel={custLabel} />
            )}
            {activeTab === "po" && (
              <PoTab
                orderId={orderId}
                attachments={attachmentsList as Record<string, unknown>[]}
                isLoading={attachmentsQ.isLoading}
                onRefetch={handleRefetch}
                onUploadSuccess={handleRefetch}
              />
            )}
            {activeTab === "performa" && (
              <PerformaTab
                orderId={orderId}
                detail={detail}
                refetchOrder={handleRefetch}
                partyName={custLabel}
              />
            )}
            {activeTab === "cost_sheet" && (
              <CostSheetTab
                orderId={orderId}
                attachments={attachmentsList as Record<string, unknown>[]}
                isLoading={attachmentsQ.isLoading}
                onRefetch={handleRefetch}
                onUploadSuccess={handleRefetch}
              />
            )}
            {activeTab === "kyc" && (
              <KycTab
                orderId={orderId}
                partyId={currentPartyId}
                partyName={custLabel}
              />
            )}
            {activeTab === "dispatches" && (
              <DispatchesTab
                orderId={orderId}
                detail={detail}
                refetchOrder={handleRefetch}
              />
            )}
            {activeTab === "transports" && (
              <TransportsTab
                orderId={orderId}
                detail={detail}
                refetchOrder={handleRefetch}
              />
            )}
            {activeTab === "flags" && (
              <FlagsTab
                orderId={orderId}
                refetchOrder={handleRefetch}
              />
            )}
            {activeTab === "attachments" && (
              <AttachmentsTab
                orderId={orderId}
                attachments={attachmentsList}
                isLoading={attachmentsQ.isLoading}
                onUploadSuccess={handleRefetch}
              />
            )}
          </div>

          {/* ── DESKTOP: Dark Footer Tab Navigation ── */}
          <div className="hidden md:block mb-0 flex-shrink-0 border-t border-slate-800 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md px-2 py-1 [&_nav]:pb-0 shadow-lg">
            <OrderDetailTabsNav
              className="!mb-0 !rounded-none !border-0 !bg-transparent !p-0"
              tabs={desktopTabs}
              activeId={activeTab}
              onChange={(id) => setActiveTab(id as SalesTabId)}
              variant="dark"
            />
          </div>

          {/* ── MOBILE: Full-screen / Popup Drawer ── */}
          {mobileTabOpen && (
            <div className="md:hidden fixed inset-0 z-[60] flex flex-col bg-white dark:bg-slate-900 animate-in slide-in-from-bottom duration-300">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 sticky top-0 z-10">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50 capitalize">
                  {TAB_TITLES[activeTab] ?? activeTab}
                </h2>
                <button
                  type="button"
                  onClick={() => setMobileTabOpen(false)}
                  className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 transition active:scale-95 cursor-pointer"
                  aria-label="Close panel"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 pb-24">
                {activeTab === "approvals" && (
                  <ApprovalTab orderId={orderId} detail={detail} partyLabel={custLabel} />
                )}
                {activeTab === "po" && (
                  <PoTab
                    orderId={orderId}
                    attachments={attachmentsList as Record<string, unknown>[]}
                    isLoading={attachmentsQ.isLoading}
                    onRefetch={handleRefetch}
                    onUploadSuccess={handleRefetch}
                  />
                )}
                {activeTab === "performa" && (
                  <PerformaTab
                    orderId={orderId}
                    detail={detail}
                    refetchOrder={handleRefetch}
                    partyName={custLabel}
                  />
                )}
                {activeTab === "cost_sheet" && (
                  <CostSheetTab
                    orderId={orderId}
                    attachments={attachmentsList as Record<string, unknown>[]}
                    isLoading={attachmentsQ.isLoading}
                    onRefetch={handleRefetch}
                    onUploadSuccess={handleRefetch}
                  />
                )}
                {activeTab === "kyc" && (
                  <KycTab
                    orderId={orderId}
                    partyId={currentPartyId}
                    partyName={custLabel}
                  />
                )}
                {activeTab === "dispatches" && (
                  <DispatchesTab
                    orderId={orderId}
                    detail={detail}
                    refetchOrder={handleRefetch}
                  />
                )}
                {activeTab === "transports" && (
                  <TransportsTab
                    orderId={orderId}
                    detail={detail}
                    refetchOrder={handleRefetch}
                  />
                )}
                {activeTab === "flags" && (
                  <FlagsTab
                    orderId={orderId}
                    refetchOrder={handleRefetch}
                  />
                )}
                {activeTab === "attachments" && (
                  <AttachmentsTab
                    orderId={orderId}
                    attachments={attachmentsList}
                    isLoading={attachmentsQ.isLoading}
                    onUploadSuccess={handleRefetch}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MOBILE: Dark Bottom Navigation Bar ── */}
      {!isFetching && !isError && detail && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md px-2 pb-safe">
          <nav className="flex items-stretch justify-around overflow-x-auto">
            {mobileTabs.map((tab) => {
              const isActive = activeTab === tab.id && mobileTabOpen;
              const count = tab.count ?? 0;
              const hasData = tab.hasData;
              const dangerBadge = tab.dangerBadge;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    if (activeTab === tab.id && mobileTabOpen) {
                      setMobileTabOpen(false);
                    } else {
                      setActiveTab(tab.id);
                      setMobileTabOpen(true);
                    }
                  }}
                  className={`relative flex flex-col items-center justify-center gap-0.5 py-2 px-2 flex-1 min-w-0 transition-colors ${
                    isActive
                      ? "text-white"
                      : hasData
                        ? "text-slate-300 hover:text-white"
                        : "text-slate-500 hover:text-slate-400"
                  }`}
                >
                  <span
                    className={`relative transition-transform ${isActive ? "scale-110" : ""}`}
                  >
                    {mobileTabIcon(tab.id as any)}
                    <span
                      className={`absolute -top-1.5 -right-2 min-w-[1rem] h-3.5 flex items-center justify-center rounded-full px-1 text-3xs font-bold ring-1 ring-slate-900 ${
                        hasData
                          ? dangerBadge
                            ? "bg-rose-500 text-white"
                            : "bg-emerald-500 text-slate-950 font-extrabold"
                          : "bg-slate-800 text-slate-500 ring-slate-700/60"
                      }`}
                    >
                      {count}
                    </span>
                  </span>
                  <span
                    className={`text-3xs font-semibold leading-none truncate max-w-full tracking-tight ${
                      isActive ? "text-white font-bold" : ""
                    }`}
                  >
                    {tab.name}
                  </span>
                  {isActive && (
                    <span className="absolute top-0 left-2 right-2 h-0.5 rounded-full bg-emerald-400" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
}
