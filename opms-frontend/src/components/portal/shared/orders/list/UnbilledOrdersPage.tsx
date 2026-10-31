"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Download,
  ExternalLink,
  MessageSquarePlus,
  PauseCircle,
  Pencil,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UserCheck,
  Users,
  X,
} from "lucide-react";

import {
  UnbilledCreateOrderModal,
  type CreateOrderTarget,
} from "@/components/portal/shared/orders/list/UnbilledCreateOrderModal";
import { ModalOverlay } from "@/components/portal/shared/ui/modals/ModalOverlay";
import {
  lineApprovalQuantities,
  num,
  resolveAccountApprovalStatus,
} from "@/components/portal/shared/orders/lib/orderLineQuantities";
import {
  computeOrderLineAmount,
  isUnbilledModalRecord,
  listUnbilledLinesFromRecord,
  unbilledRecordOrderId,
  unbilledRecordOrderNo,
  unbilledRecordPartyId,
  unbilledRecordPartyLabel,
  unbilledRecordSalesUserId,
  unbilledRecordStatusLabel,
  type UnbilledOrderLine,
} from "@/components/portal/shared/orders/list/unbilledOrders";
import {
  getOrderWorkflowTabCategory,
  ORDER_WORKFLOW_TAB_LABELS,
  type OrderWorkflowCategoryOptions,
  type OrderWorkflowTabCategory,
} from "@/components/portal/shared/orders/list/orderWorkflowTabs";
import {
  type UnbilledOrdersPdfListLine,
  type UnbilledOrdersPdfUnbilledLine,
} from "@/components/portal/shared/pdf/templates/UnbilledOrdersPdfTemplate";
import { buildUnbilledOrdersPdf } from "@/components/portal/shared/pdf/builders/buildUnbilledOrdersPdf";
import { usePdfCompanyLetterhead } from "@/components/portal/shared/pdf/templates/pdfCompanyLetterhead";
import { toast } from "@/lib/toast";
import { mutationRejectedMessage } from "@/lib/mutationMessages";
import { useAppSelector } from "@/store/hooks";
import { AddUnbilledOrderModal } from "@/components/portal/shared/orders/list/AddUnbilledOrderModal";
import { AddOrderRemarkModal } from "@/components/portal/shared/orders/modals/AddOrderRemarkModal";
import { pickOrders } from "@/components/portal/shared/lib/pickOrders";
import { useOrderWorkflowCategoryOptions } from "@/components/portal/shared/orders/list/useOrderWorkflowCategoryOptions";
import {
  buildUserNameById,
  resolveUserDisplay,
} from "@/components/portal/shared/lib/userDisplay";
import { buildPartyNameById } from "@/components/portal/sales/partyDisplay";
import { formatMoney } from "@/components/portal/shared/orders/list/orderListDisplay";
import {
  useListOrdersQuery,
  useListPartiesQuery,
  useListUnbilledOrdersQuery,
  useListUsersQuery,
  usePatchOrderMutation,
  usePatchUnbilledOrderMutation,
  type UnbilledOrderRecord,
} from "@/store/api";
import {
  lineShowInUnbilledList,
  type UnbilledVisibilityCatalog,
} from "@/components/portal/shared/products/productUnbilledVisibility";
import { useUnbilledVisibilityCatalog } from "@/components/portal/shared/products/useUnbilledVisibilityCatalog";

type ModalMainTab = "unbilled" | "process_pending" | "on_hold";

/** List-tab buckets shown under Process Pending (from orders list, not UnbilledOrder). */
const PROCESS_PENDING_CATEGORIES = new Set<OrderWorkflowTabCategory>([
  "pending_admin_approval",
  "due_sheet_pending",
  "pending_finance_approval",
  "pending_account_approval",
  "open_dispatched",
]);

type ListOrderLine = {
  orderItemId: string;
  productName: string;
  sku: string;
  ordered: number;
  pending: number;
  amount: number;
  unitPrice: number;
  remarks?: string;
};

type ListOrderView = {
  orderId: string;
  orderNo: string;
  party: string;
  salesUserId: string;
  salesPerson: string;
  refOrderDate: string;
  statusLabel: string;
  remarks: string;
  href: string;
  ordered: number;
  pending: number;
  amount: number;
  orderGrandTotal: number;
  lines: ListOrderLine[];
};

function listOrderProductLabel(line: Record<string, unknown>): {
  name: string;
  sku: string;
} {
  const product = line.product;
  if (product && typeof product === "object") {
    const p = product as Record<string, unknown>;
    return {
      name: String(p.product_name ?? p.name ?? line.product_name ?? "Item"),
      sku: String(p.sku ?? line.sku ?? ""),
    };
  }
  return {
    name: String(line.product_name ?? line.name ?? "Item"),
    sku: String(line.sku ?? ""),
  };
}

/** Stage-aware pending qty for Process Pending / On Hold nested lines. */
function pendingQtyForCategory(
  cat: OrderWorkflowTabCategory,
  q: ReturnType<typeof lineApprovalQuantities>,
): number {
  switch (cat) {
    case "on_hold":
      return q.ordered;
    case "pending_admin_approval":
      return q.pendingAdmin > 0 ? q.pendingAdmin : q.ordered;
    case "due_sheet_pending":
      return q.salesApproved > 0 ? q.salesApproved : q.ordered;
    case "pending_finance_approval":
      return q.pendingFinance > 0
        ? q.pendingFinance
        : q.salesApproved > 0
          ? q.salesApproved
          : q.ordered;
    case "pending_account_approval":
      return q.pendingAccount > 0
        ? q.pendingAccount
        : q.financeApproved > 0
          ? q.financeApproved
          : q.salesApproved > 0
            ? q.salesApproved
            : q.ordered;
    case "open_dispatched":
      return q.pendingDispatch > 0
        ? q.pendingDispatch
        : q.accountCleared > 0
          ? q.accountCleared
          : q.financeApproved > 0
            ? q.financeApproved
            : q.ordered;
    default:
      return Math.max(0, q.ordered - q.dispatched);
  }
}

function listOrderLinesFromRow(
  row: Record<string, unknown>,
  cat: OrderWorkflowTabCategory,
  catalog?: UnbilledVisibilityCatalog | null,
): ListOrderLine[] {
  const items = Array.isArray(row.order_items)
    ? row.order_items
    : Array.isArray(row.items)
      ? row.items
      : [];
  const accountStatus = resolveAccountApprovalStatus(row);
  const lines: ListOrderLine[] = [];

  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const line = raw as Record<string, unknown>;
    const orderItemId = orderRefId(line._id ?? line.id);
    const q = lineApprovalQuantities(line, {
      accountApprovalStatus: accountStatus,
    });
    const ordered =
      q.ordered > 0
        ? q.ordered
        : num(
          line.ordered_quantity ??
          line.quantity ??
          line.approved_quantity ??
          line.dispatched_quantity,
        );
    if (ordered <= 0 && q.pendingAdmin <= 0 && q.pendingDispatch <= 0) {
      continue;
    }
    if (
      !lineShowInUnbilledList(
        {
          product: line.product,
          product_name: line.product_name as string | undefined,
          sku: line.sku as string | undefined,
        },
        line,
        catalog,
      )
    ) {
      continue;
    }
    const { name, sku } = listOrderProductLabel(line);
    const pending = pendingQtyForCategory(cat, q);
    const pendingFinal = pending > 0 ? pending : ordered;
    const { amount, unitPrice } = computeOrderLineAmount(pendingFinal, line);
    const lineRemarks =
      String(line.remarks ?? line.item_remarks ?? line.notes ?? "").trim() ||
      undefined;
    lines.push({
      orderItemId: orderItemId || `${name}-${lines.length}`,
      productName: name,
      sku,
      ordered,
      pending: pendingFinal,
      amount,
      unitPrice,
      remarks: lineRemarks,
    });
  }
  return lines;
}

export type UnbilledOrdersPageProps = {
  isOpen?: boolean;
  onClose?: () => void;
  partyNameById?: Map<string, string>;
  /** Optional sales user name lookup map by user id */
  salesUserNameById?: Record<string, string>;
  /** Portal prefix for order detail links, e.g. "/account" */
  portalBasePath?: string;
  portalHome?: string;
  portalLabel?: string;
  /**
   * Live list orders (enriched). Used so status labels match ListOrdersPage tabs.
   */
  orders?: unknown[];
  /** Same transport/dispatch category options as ListOrdersPage. */
  categoryOptions?: OrderWorkflowCategoryOptions;
  /** @deprecated Totals are no longer shown. */
  hidePricing?: boolean;
};

export type UnbilledOrdersModalProps = UnbilledOrdersPageProps;

function orderRefId(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    return String(o._id ?? o.id ?? "");
  }
  return String(value);
}

type UnbilledOrderView = {
  unbilledId: string;
  orderId: string;
  orderNo: string;
  partyId: string;
  party: string;
  salesUserId: string;
  salesPerson: string;
  approved: number;
  submittedDispatch: number;
  remaining: number;
  amount: number;
  orderGrandTotal: number;
  refOrderDate: string;
  remarks: string;
  href: string;
  lines: UnbilledOrderLine[];
  statusLabel: string;
  canCreateOrder: boolean;
  rawRecord: UnbilledOrderRecord;
};

type ResolveTarget = {
  unbilledId: string;
  orderNo: string;
  remaining: number;
};

type CreateOrderEligibleFilter = "all" | "yes" | "no";

const SELECT_CLASS =
  "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-cyan-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100";

const INPUT_CLASS =
  "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-cyan-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100";

function portalLabelFromPath(portalBasePath: string): string {
  const key = portalBasePath.replace(/^\//, "").toLowerCase();
  switch (key) {
    case "admin":
      return "Admin Portal";
    case "account":
      return "Account Portal";
    case "finance":
      return "Finance Portal";
    case "dispatch":
      return "Dispatch Portal";
    case "sales":
      return "Sales Portal";
    case "super_admin":
      return "Super Admin Portal";
    default:
      return key
        ? `${key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} Portal`
        : "Portal";
  }
}

function formatDateTime(v: unknown = new Date()): string {
  if (v == null || v === "") return "—";
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDateShort(v: unknown): string {
  if (v == null || v === "") return "—";
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Unbilled Orders Page — standalone page & view for unbilled orders pipeline.
 */
export function UnbilledOrdersPage({
  isOpen: isOpenProp,
  onClose,
  partyNameById: partyNameByIdProp,
  salesUserNameById: salesUserNameByIdProp,
  portalBasePath: portalBasePathProp,
  portalHome: portalHomeProp,
  portalLabel: portalLabelProp,
  orders: ordersProp,
  categoryOptions: categoryOptionsProp,
}: UnbilledOrdersPageProps) {
  const params = useParams();
  const portalParam =
    typeof params?.portal === "string"
      ? params.portal
      : Array.isArray(params?.portal)
        ? params.portal[0]
        : "admin";
  const portalBasePath =
    portalBasePathProp || portalHomeProp || `/${portalParam}`;
  const isOpen = isOpenProp ?? true;

  const partiesQ = useListPartiesQuery({}, { skip: !isOpen });
  const fetchedPartyNameById = useMemo(
    () => buildPartyNameById(partiesQ.data),
    [partiesQ.data],
  );
  const partyNameById = partyNameByIdProp ?? fetchedPartyNameById;

  const [mainTab, setMainTab] = useState<ModalMainTab>("unbilled");
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterParty, setFilterParty] = useState("all");
  const [filterSalesPerson, setFilterSalesPerson] = useState("all");
  const [isGroupBySalesPerson, setIsGroupBySalesPerson] = useState(false);
  const [filterCreateOrder, setFilterCreateOrder] =
    useState<CreateOrderEligibleFilter>("all");
  const [filterMinRemaining, setFilterMinRemaining] = useState("");
  const [filterMaxRemaining, setFilterMaxRemaining] = useState("");
  const [createTarget, setCreateTarget] = useState<CreateOrderTarget | null>(
    null,
  );
  const [resolveTarget, setResolveTarget] = useState<ResolveTarget | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const letterhead = usePdfCompanyLetterhead();

  const authUser = useAppSelector((s) => s.auth.user);
  const downloadedBy = useMemo(() => {
    if (!authUser || typeof authUser !== "object") return "—";
    const u = authUser as Record<string, unknown>;
    return (
      String(u.name ?? u.full_name ?? u.username ?? u.email ?? "").trim() || "—"
    );
  }, [authUser]);
  const portalLabel = portalLabelProp || portalLabelFromPath(portalBasePath);

  const { catalog: visibilityCatalog, isLoading: catalogLoading } =
    useUnbilledVisibilityCatalog(isOpen);

  const usersQ = useListUsersQuery({}, { skip: !isOpen });
  const fetchedSalesUserNameById = useMemo(
    () => buildUserNameById(usersQ.data),
    [usersQ.data],
  );
  const salesUserNameById = useMemo(
    () => ({
      ...fetchedSalesUserNameById,
      ...(salesUserNameByIdProp ?? {}),
    }),
    [fetchedSalesUserNameById, salesUserNameByIdProp],
  );

  const unbilledQ = useListUnbilledOrdersQuery(
    { status: "open" },
    { skip: !isOpen, refetchOnMountOrArgChange: true },
  );

  const allOrdersQ = useListOrdersQuery(
    {
      view: "list",
      paginate: "true",
      all: "true",
      page: "1",
      tab: "all",
      exclude_status: "draft",
    },
    { skip: !isOpen },
  );

  const fallbackCategoryOptions = useOrderWorkflowCategoryOptions();
  const categoryOptions = categoryOptionsProp ?? fallbackCategoryOptions;

  const liveOrders = useMemo(() => {
    if (allOrdersQ.data) {
      const picked = pickOrders(allOrdersQ.data);
      if (picked.length > 0) return picked;
    }
    return Array.isArray(ordersProp) ? ordersProp : [];
  }, [allOrdersQ.data, ordersProp]);

  const [patchUnbilledOrder] = usePatchUnbilledOrderMutation();
  const [patchOrder] = usePatchOrderMutation();
  const [remarkTarget, setRemarkTarget] = useState<{
    type: "order" | "unbilled";
    id: string;
    linkedOrderId?: string;
    orderNo: string;
    party: string;
    statusLabel: string;
    existingRemarks: string;
  } | null>(null);

  const handleSaveRemark = useCallback(
    async (updatedRemarks: string) => {
      if (!remarkTarget) return;
      try {
        if (remarkTarget.type === "unbilled") {
          await patchUnbilledOrder({
            id: remarkTarget.id,
            patch: { remarks: updatedRemarks },
          }).unwrap();
          if (remarkTarget.linkedOrderId) {
            try {
              await patchOrder({
                id: remarkTarget.linkedOrderId,
                patch: { remarks: updatedRemarks },
              }).unwrap();
            } catch {
              // Linked order update optional
            }
          }
          toast.success("Order remark saved.");
          void unbilledQ.refetch();
          void allOrdersQ.refetch();
        } else {
          await patchOrder({
            id: remarkTarget.id,
            patch: { remarks: updatedRemarks },
          }).unwrap();
          toast.success("Order remark saved.");
          void allOrdersQ.refetch();
        }
      } catch (err) {
        toast.error(mutationRejectedMessage(err) || "Could not save remark.");
        throw err;
      }
    },
    [remarkTarget, patchUnbilledOrder, patchOrder, unbilledQ, allOrdersQ],
  );
  const isUnbilledTab = mainTab === "unbilled";
  const isProcessPendingTab = mainTab === "process_pending";
  const isOnHoldTab = mainTab === "on_hold";
  const isListOrdersTab = isProcessPendingTab || isOnHoldTab;

  const handleClearFilters = useCallback(() => {
    setFilterStatus("all");
    setFilterParty("all");
    setFilterSalesPerson("all");
    setFilterCreateOrder("all");
    setFilterMinRemaining("");
    setFilterMaxRemaining("");
  }, []);

  const [isAddUnbilledOpen, setIsAddUnbilledOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<UnbilledOrderRecord | null>(null);

  const openEditModal = useCallback((record: UnbilledOrderRecord) => {
    setEditRecord(record);
  }, []);

  const closeEditModal = useCallback(() => {
    setEditRecord(null);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setMainTab("unbilled");
      setCreateTarget(null);
      setResolveTarget(null);
      setIsResolving(false);
      setIsDownloadingPdf(false);
      setIsFilterPanelOpen(false);
      setIsGroupBySalesPerson(false);
      setSearchQuery("");
      setIsAddUnbilledOpen(false);
      setEditRecord(null);
      handleClearFilters();
    }
  }, [isOpen, handleClearFilters]);

  useEffect(() => {
    // Keep filters scoped per tab.
    setFilterStatus("all");
    setFilterParty("all");
    setFilterSalesPerson("all");
    setFilterCreateOrder("all");
    setFilterMinRemaining("");
    setFilterMaxRemaining("");
    setSearchQuery("");
    setIsFilterPanelOpen(false);
  }, [mainTab]);

  const records = useMemo(
    () => (Array.isArray(unbilledQ.data) ? unbilledQ.data : []),
    [unbilledQ.data],
  );

  const existingUnbilledOrderIds = useMemo(() => {
    return new Set(
      records.map((r) => unbilledRecordOrderId(r)).filter(Boolean),
    );
  }, [records]);

  /** Live list orders by id — same enrichment ListOrdersPage tabs use. */
  const listOrderById = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    for (const raw of Array.isArray(liveOrders) ? liveOrders : []) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const id = orderRefId(row._id ?? row.id);
      if (id) map.set(id, row);
    }
    return map;
  }, [liveOrders]);

  const orderViews = useMemo((): UnbilledOrderView[] => {
    const views: UnbilledOrderView[] = [];
    for (const record of records) {
      const orderId = unbilledRecordOrderId(record);
      const liveOrder = orderId ? listOrderById.get(orderId) : undefined;
      // Drop in transit / closed-delivered (and other non-pipeline) even if API
      // still has an open tracking row until the next sync resolves it.
      if (
        !isUnbilledModalRecord(record, {
          order: liveOrder ?? null,
          categoryOptions,
          visibilityCatalog,
        })
      ) {
        continue;
      }

      const orderNo = unbilledRecordOrderNo(record);
      const lines = listUnbilledLinesFromRecord(
        record,
        visibilityCatalog,
        liveOrder ?? null,
      );
      const approved = lines.reduce((sum, line) => sum + line.approved, 0);
      const submittedDispatch = lines.reduce(
        (sum, line) => sum + line.submittedDispatch,
        0,
      );
      const remaining = lines.reduce((sum, line) => sum + line.remaining, 0);
      if (remaining <= 0) continue;
      const statusLabel = unbilledRecordStatusLabel(record, {
        order: liveOrder ?? null,
        categoryOptions,
      });
      const stage = String(record.pipeline_stage || "").toLowerCase();
      const canCreateOrder =
        stage === "unbilled" ||
        stage === "partially_billed" ||
        statusLabel === "Unbilled" ||
        statusLabel === "Partially Billed";

      const orderRef =
        liveOrder ||
        (record.order && typeof record.order === "object"
          ? (record.order as Record<string, unknown>)
          : null);
      const refOrderDate = formatDateShort(
        orderRef?.order_date ?? orderRef?.created_at ?? orderRef?.createdAt,
      );

      const rawSalesUser =
        liveOrder?.assigned_sales_user ??
        (record.order && typeof record.order === "object"
          ? (record.order as Record<string, unknown>).assigned_sales_user
          : null) ??
        unbilledRecordSalesUserId(record);
      const salesUserId =
        orderRefId(rawSalesUser) || unbilledRecordSalesUserId(record);
      const salesPerson = resolveUserDisplay(rawSalesUser, salesUserNameById);

      const lineAmountsSum = lines.reduce(
        (sum, line) => sum + (line.amount || 0),
        0,
      );
      const headerTotal = num(
        orderRef?.grand_total ?? orderRef?.total ?? orderRef?.total_amount ?? 0,
      );
      const amount = lineAmountsSum > 0 ? lineAmountsSum : headerTotal;
      const orderRemarks =
        String(
          record.remarks ??
          orderRef?.remarks ??
          orderRef?.order_remarks ??
          orderRef?.notes ??
          orderRef?.internal_notes ??
          "",
        ).trim() || "—";

      views.push({
        unbilledId: String(record._id ?? record.id ?? ""),
        orderId,
        orderNo,
        partyId: unbilledRecordPartyId(record),
        party: unbilledRecordPartyLabel(record, partyNameById),
        salesUserId,
        salesPerson,
        approved,
        submittedDispatch,
        remaining,
        amount,
        orderGrandTotal: headerTotal,
        refOrderDate,
        remarks: orderRemarks,
        href: orderId ? `${portalBasePath}/order/${orderId}` : portalBasePath,
        lines,
        statusLabel,
        canCreateOrder,
        rawRecord: record,
      });
    }
    return views;
  }, [
    records,
    listOrderById,
    categoryOptions,
    partyNameById,
    portalBasePath,
    visibilityCatalog,
    salesUserNameById,
  ]);

  const buildListOrderView = useCallback(
    (
      row: Record<string, unknown>,
      cat: OrderWorkflowTabCategory,
    ): ListOrderView | null => {
      const orderId = orderRefId(row._id ?? row.id);
      const orderNo =
        String(row.order_no ?? row.order_number ?? "").trim() ||
        orderId ||
        "—";
      const partyId = orderRefId(row.party) || orderRefId(row.customer);
      const partyFromObj =
        row.party && typeof row.party === "object"
          ? String(
            (row.party as Record<string, unknown>).party_name ??
            (row.party as Record<string, unknown>).name ??
            "",
          ).trim()
          : "";
      const party =
        partyFromObj ||
        (partyId && partyNameById.has(partyId)
          ? partyNameById.get(partyId) || "—"
          : "—");
      const rawSalesUser = row.assigned_sales_user;
      const salesUserId = orderRefId(rawSalesUser);
      const salesPerson = resolveUserDisplay(rawSalesUser, salesUserNameById);

      const lines = listOrderLinesFromRow(row, cat, visibilityCatalog);
      if (lines.length === 0) return null;
      const ordered = lines.reduce((sum, line) => sum + line.ordered, 0);
      const pending = lines.reduce((sum, line) => sum + line.pending, 0);

      const lineAmountsSum = lines.reduce((sum, line) => sum + line.amount, 0);
      const headerTotal = num(
        row.grand_total ?? row.total ?? row.total_amount ?? 0,
      );
      const amount = lineAmountsSum > 0 ? lineAmountsSum : headerTotal;
      const itemRemarks = lines
        .map((l) => l.remarks)
        .filter(Boolean)
        .join("; ");
      const orderRemarks =
        String(
          row.remarks ??
          row.order_remarks ??
          row.notes ??
          row.internal_notes ??
          row.closure_remarks ??
          row.hold_reason ??
          row.on_hold_reason ??
          row.rejection_reason ??
          row.approval_remarks ??
          row.approval_notes ??
          itemRemarks ??
          "",
        ).trim() || "—";

      return {
        orderId,
        orderNo,
        party,
        salesUserId,
        salesPerson,
        refOrderDate: formatDateShort(
          row.order_date ?? row.created_at ?? row.createdAt,
        ),
        statusLabel: ORDER_WORKFLOW_TAB_LABELS[cat] ?? cat,
        remarks: orderRemarks,
        href: orderId ? `${portalBasePath}/order/${orderId}` : portalBasePath,
        ordered,
        pending,
        amount,
        orderGrandTotal: headerTotal,
        lines,
      };
    },
    [partyNameById, portalBasePath, visibilityCatalog, salesUserNameById],
  );

  /** Process Pending — from live list orders only (does not touch UnbilledOrder). */
  const processPendingViews = useMemo((): ListOrderView[] => {
    const views: ListOrderView[] = [];
    for (const raw of Array.isArray(liveOrders) ? liveOrders : []) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const cat = getOrderWorkflowTabCategory(row, categoryOptions);
      if (!cat || !PROCESS_PENDING_CATEGORIES.has(cat)) continue;
      const view = buildListOrderView(row, cat);
      if (view) views.push(view);
    }
    views.sort((a, b) => a.orderNo.localeCompare(b.orderNo));
    return views;
  }, [liveOrders, categoryOptions, buildListOrderView]);

  /** On Hold — from live list orders only (does not touch UnbilledOrder). */
  const onHoldViews = useMemo((): ListOrderView[] => {
    const views: ListOrderView[] = [];
    for (const raw of Array.isArray(liveOrders) ? liveOrders : []) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const cat = getOrderWorkflowTabCategory(row, categoryOptions);
      if (cat !== "on_hold") continue;
      const view = buildListOrderView(row, cat);
      if (view) views.push(view);
    }
    views.sort((a, b) => a.orderNo.localeCompare(b.orderNo));
    return views;
  }, [liveOrders, categoryOptions, buildListOrderView]);

  const listTabViews = isOnHoldTab ? onHoldViews : processPendingViews;

  const uniqueStatuses = useMemo(() => {
    const labels = new Set<string>();
    const source = isUnbilledTab ? orderViews : listTabViews;
    for (const view of source) {
      if (view.statusLabel) labels.add(view.statusLabel);
    }
    return Array.from(labels).sort((a, b) => a.localeCompare(b));
  }, [isUnbilledTab, orderViews, listTabViews]);

  const uniqueParties = useMemo(() => {
    const parties = new Set<string>();
    const source = isUnbilledTab ? orderViews : listTabViews;
    for (const view of source) {
      const name = view.party.trim();
      if (name && name !== "—") parties.add(name);
    }
    return Array.from(parties).sort((a, b) => a.localeCompare(b));
  }, [isUnbilledTab, orderViews, listTabViews]);

  const uniqueSalesPersons = useMemo(() => {
    const people = new Set<string>();
    const source = isUnbilledTab ? orderViews : listTabViews;
    for (const view of source) {
      const name = view.salesPerson?.trim();
      if (name && name !== "—") people.add(name);
    }
    return Array.from(people).sort((a, b) => a.localeCompare(b));
  }, [isUnbilledTab, orderViews, listTabViews]);

  const hasUnassignedSalesPerson = useMemo(() => {
    const source = isUnbilledTab ? orderViews : listTabViews;
    return source.some((v) => !v.salesPerson || v.salesPerson === "—");
  }, [isUnbilledTab, orderViews, listTabViews]);

  const hasActiveFilters =
    filterStatus !== "all" ||
    filterParty !== "all" ||
    filterSalesPerson !== "all" ||
    (isUnbilledTab &&
      (filterCreateOrder !== "all" ||
        filterMinRemaining.trim() !== "" ||
        filterMaxRemaining.trim() !== ""));

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const minRem = filterMinRemaining.trim()
      ? Number(filterMinRemaining)
      : null;
    const maxRem = filterMaxRemaining.trim()
      ? Number(filterMaxRemaining)
      : null;

    return orderViews.filter((view) => {
      if (filterStatus !== "all" && view.statusLabel !== filterStatus) {
        return false;
      }
      if (filterParty !== "all" && view.party !== filterParty) {
        return false;
      }
      if (filterSalesPerson !== "all") {
        if (filterSalesPerson === "unassigned") {
          if (view.salesPerson && view.salesPerson !== "—") return false;
        } else if (view.salesPerson !== filterSalesPerson) {
          return false;
        }
      }
      if (filterCreateOrder === "yes" && !view.canCreateOrder) return false;
      if (filterCreateOrder === "no" && view.canCreateOrder) return false;

      if (minRem != null && Number.isFinite(minRem) && view.remaining < minRem) {
        return false;
      }
      if (maxRem != null && Number.isFinite(maxRem) && view.remaining > maxRem) {
        return false;
      }

      if (!q) return true;
      if (
        view.orderNo.toLowerCase().includes(q) ||
        view.party.toLowerCase().includes(q) ||
        view.salesPerson.toLowerCase().includes(q) ||
        view.statusLabel.toLowerCase().includes(q)
      ) {
        return true;
      }
      return view.lines.some(
        (line) =>
          line.productName.toLowerCase().includes(q) ||
          line.sku.toLowerCase().includes(q),
      );
    });
  }, [
    orderViews,
    searchQuery,
    filterStatus,
    filterParty,
    filterSalesPerson,
    filterCreateOrder,
    filterMinRemaining,
    filterMaxRemaining,
  ]);

  const filteredListTabViews = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return listTabViews.filter((view) => {
      if (filterStatus !== "all" && view.statusLabel !== filterStatus) {
        return false;
      }
      if (filterParty !== "all" && view.party !== filterParty) {
        return false;
      }
      if (filterSalesPerson !== "all") {
        if (filterSalesPerson === "unassigned") {
          if (view.salesPerson && view.salesPerson !== "—") return false;
        } else if (view.salesPerson !== filterSalesPerson) {
          return false;
        }
      }
      if (!q) return true;
      if (
        view.orderNo.toLowerCase().includes(q) ||
        view.party.toLowerCase().includes(q) ||
        view.salesPerson.toLowerCase().includes(q) ||
        view.statusLabel.toLowerCase().includes(q)
      ) {
        return true;
      }
      return view.lines.some(
        (line) =>
          line.productName.toLowerCase().includes(q) ||
          line.sku.toLowerCase().includes(q),
      );
    });
  }, [listTabViews, searchQuery, filterStatus, filterParty, filterSalesPerson]);

  const totalAmount = useMemo(() => {
    const list = isUnbilledTab ? filtered : filteredListTabViews;
    return list.reduce((sum, v) => sum + (v.amount || 0), 0);
  }, [isUnbilledTab, filtered, filteredListTabViews]);

  const totalPrimaryQty = useMemo(() => {
    if (isUnbilledTab) {
      return filtered.reduce((sum, v) => sum + v.remaining, 0);
    }
    return filteredListTabViews.reduce((sum, v) => sum + v.ordered, 0);
  }, [isUnbilledTab, filtered, filteredListTabViews]);

  const totalPendingQty = useMemo(() => {
    if (isUnbilledTab) return 0;
    return filteredListTabViews.reduce((sum, v) => sum + v.pending, 0);
  }, [isUnbilledTab, filteredListTabViews]);

  const groupedUnbilledViews = useMemo(() => {
    const map = new Map<string, UnbilledOrderView[]>();
    for (const view of filtered) {
      const key =
        view.salesPerson && view.salesPerson !== "—"
          ? view.salesPerson
          : "Unassigned";
      const group = map.get(key) ?? [];
      group.push(view);
      map.set(key, group);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "Unassigned") return 1;
      if (b === "Unassigned") return -1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  const groupedListTabViews = useMemo(() => {
    const map = new Map<string, ListOrderView[]>();
    for (const view of filteredListTabViews) {
      const key =
        view.salesPerson && view.salesPerson !== "—"
          ? view.salesPerson
          : "Unassigned";
      const group = map.get(key) ?? [];
      group.push(view);
      map.set(key, group);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "Unassigned") return 1;
      if (b === "Unassigned") return -1;
      return a.localeCompare(b);
    });
  }, [filteredListTabViews]);

  const handleRefresh = useCallback(() => {
    void unbilledQ.refetch();
    void allOrdersQ.refetch();
  }, [unbilledQ, allOrdersQ]);

  const openCreateOrder = useCallback((view: UnbilledOrderView) => {
    if (!view.unbilledId) {
      toast.error("Missing unbilled tracking id for this order.");
      return;
    }
    setCreateTarget({
      unbilledId: view.unbilledId,
      orderId: view.orderId,
      orderNo: view.orderNo,
      partyId: view.partyId,
      salesUserId: view.salesUserId,
      linePrefills: view.lines
        .filter((line) => line.productId && line.remaining > 0)
        .map((line) => ({
          productId: line.productId,
          quantity: line.remaining,
          product_name: line.productName,
          sku: line.sku,
        })),
    });
  }, []);

  const openResolveConfirm = useCallback((view: UnbilledOrderView) => {
    if (!view.unbilledId) {
      toast.error("Missing unbilled tracking id for this order.");
      return;
    }
    setResolveTarget({
      unbilledId: view.unbilledId,
      orderNo: view.orderNo,
      remaining: view.remaining,
    });
  }, []);

  const handleConfirmResolve = useCallback(async () => {
    if (!resolveTarget?.unbilledId) return;
    setIsResolving(true);
    try {
      await patchUnbilledOrder({
        id: resolveTarget.unbilledId,
        patch: {
          status: "resolved",
          manual_resolved: true,
          remarks: `Manually resolved from Un Billed Orders (${resolveTarget.orderNo})`,
        },
      }).unwrap();
      toast.success(`Unbilled order ${resolveTarget.orderNo} resolved.`);
      setResolveTarget(null);
      void unbilledQ.refetch();
    } catch (rejected) {
      toast.error(
        mutationRejectedMessage(rejected) ||
        "Failed to resolve this unbilled order.",
      );
    } finally {
      setIsResolving(false);
    }
  }, [resolveTarget, patchUnbilledOrder, unbilledQ]);

  const filterListTabRecords = useCallback(
    (views: ListOrderView[]): ListOrderView[] => {
      const q = searchQuery.trim().toLowerCase();
      return views.filter((view) => {
        if (filterStatus !== "all" && view.statusLabel !== filterStatus) {
          return false;
        }
        if (filterParty !== "all" && view.party !== filterParty) {
          return false;
        }
        if (filterSalesPerson !== "all") {
          if (filterSalesPerson === "unassigned") {
            if (view.salesPerson && view.salesPerson !== "—") return false;
          } else if (view.salesPerson !== filterSalesPerson) {
            return false;
          }
        }
        if (!q) return true;
        if (
          view.orderNo.toLowerCase().includes(q) ||
          view.party.toLowerCase().includes(q) ||
          view.salesPerson.toLowerCase().includes(q) ||
          view.statusLabel.toLowerCase().includes(q) ||
          (view.remarks && view.remarks.toLowerCase().includes(q))
        ) {
          return true;
        }
        return view.lines.some(
          (line) =>
            line.productName.toLowerCase().includes(q) ||
            line.sku.toLowerCase().includes(q),
        );
      });
    },
    [searchQuery, filterStatus, filterParty, filterSalesPerson],
  );

  const pdfUnbilledLines = useMemo((): UnbilledOrdersPdfUnbilledLine[] => {
    const lines: UnbilledOrdersPdfUnbilledLine[] = [];
    const source =
      hasActiveFilters || searchQuery.trim() ? filtered : orderViews;
    for (const view of source) {
      if (view.lines.length === 0) {
        lines.push({
          orderNo: view.orderNo,
          party: view.party,
          salesPerson: view.salesPerson,
          statusLabel: view.statusLabel,
          refOrderDate: view.refOrderDate,
          productName: "—",
          approved: view.approved,
          submittedDispatch: view.submittedDispatch,
          remaining: view.remaining,
          amount: view.amount,
          remarks: view.remarks !== "—" ? view.remarks : undefined,
        });
        continue;
      }
      for (const line of view.lines) {
        lines.push({
          orderNo: view.orderNo,
          party: view.party,
          salesPerson: view.salesPerson,
          statusLabel: view.statusLabel,
          refOrderDate: view.refOrderDate,
          productName: line.productName,
          sku: line.sku || undefined,
          approved: line.approved,
          submittedDispatch: line.submittedDispatch,
          remaining: line.remaining,
          amount: line.amount,
          remarks: view.remarks !== "—" ? view.remarks : undefined,
        });
      }
    }
    return lines;
  }, [hasActiveFilters, searchQuery, filtered, orderViews]);

  const pdfProcessPendingLines = useMemo((): UnbilledOrdersPdfListLine[] => {
    const lines: UnbilledOrdersPdfListLine[] = [];
    const source =
      hasActiveFilters || searchQuery.trim()
        ? filterListTabRecords(processPendingViews)
        : processPendingViews;
    for (const view of source) {
      if (view.lines.length === 0) {
        lines.push({
          orderNo: view.orderNo,
          party: view.party,
          salesPerson: view.salesPerson,
          statusLabel: view.statusLabel,
          refOrderDate: view.refOrderDate,
          productName: "—",
          ordered: view.ordered,
          pending: view.pending,
          amount: view.amount,
          remarks: view.remarks !== "—" ? view.remarks : undefined,
        });
        continue;
      }
      for (const line of view.lines) {
        lines.push({
          orderNo: view.orderNo,
          party: view.party,
          salesPerson: view.salesPerson,
          statusLabel: view.statusLabel,
          refOrderDate: view.refOrderDate,
          productName: line.productName,
          sku: line.sku || undefined,
          ordered: line.ordered,
          pending: line.pending,
          amount: line.amount,
          remarks:
            line.remarks || (view.remarks !== "—" ? view.remarks : undefined),
        });
      }
    }
    return lines;
  }, [
    hasActiveFilters,
    searchQuery,
    filterListTabRecords,
    processPendingViews,
  ]);

  const pdfOnHoldLines = useMemo((): UnbilledOrdersPdfListLine[] => {
    const lines: UnbilledOrdersPdfListLine[] = [];
    const source =
      hasActiveFilters || searchQuery.trim()
        ? filterListTabRecords(onHoldViews)
        : onHoldViews;
    for (const view of source) {
      if (view.lines.length === 0) {
        lines.push({
          orderNo: view.orderNo,
          party: view.party,
          salesPerson: view.salesPerson,
          statusLabel: view.statusLabel,
          refOrderDate: view.refOrderDate,
          productName: "—",
          ordered: view.ordered,
          pending: view.pending,
          amount: view.amount,
          remarks: view.remarks !== "—" ? view.remarks : undefined,
        });
        continue;
      }
      for (const line of view.lines) {
        lines.push({
          orderNo: view.orderNo,
          party: view.party,
          salesPerson: view.salesPerson,
          statusLabel: view.statusLabel,
          refOrderDate: view.refOrderDate,
          productName: line.productName,
          sku: line.sku || undefined,
          ordered: line.ordered,
          pending: line.pending,
          amount: line.amount,
          remarks:
            line.remarks || (view.remarks !== "—" ? view.remarks : undefined),
        });
      }
    }
    return lines;
  }, [
    hasActiveFilters,
    searchQuery,
    filterListTabRecords,
    onHoldViews,
  ]);

  const totalPdfOrders =
    pdfUnbilledLines.length + pdfProcessPendingLines.length + pdfOnHoldLines.length;

  const handleDownloadPdf = useCallback(async () => {
    if (totalPdfOrders === 0) return;
    setIsDownloadingPdf(true);
    try {
      const dateStamp = new Date().toISOString().slice(0, 10);
      const isSalesPersonWise =
        isGroupBySalesPerson || filterSalesPerson !== "all";

      const pdf = await buildUnbilledOrdersPdf({
        letterhead,
        portalLabel,
        downloadedBy,
        generatedAt: formatDateTime(new Date()),
        groupBySalesPerson: isSalesPersonWise,
        selectedSalesPerson:
          filterSalesPerson !== "all" ? filterSalesPerson : undefined,
        unbilledLines: pdfUnbilledLines,
        processPendingLines: pdfProcessPendingLines,
        onHoldLines: pdfOnHoldLines,
      });
      const fileSuffix =
        filterSalesPerson !== "all"
          ? `_${filterSalesPerson.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`
          : isGroupBySalesPerson
            ? "_sales_person_wise"
            : "";
      pdf.save(`unbilled_orders${fileSuffix}_${dateStamp}.pdf`);
      toast.success(
        isSalesPersonWise
          ? "Sales person-wise orders PDF downloaded."
          : "Orders PDF downloaded.",
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not generate PDF.";
      toast.error(message);
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [
    downloadedBy,
    filterSalesPerson,
    isGroupBySalesPerson,
    letterhead,
    pdfOnHoldLines,
    pdfProcessPendingLines,
    pdfUnbilledLines,
    portalLabel,
    totalPdfOrders,
  ]);

  if (!isOpen) return null;

  const ordersBusy = allOrdersQ.isLoading || allOrdersQ.isFetching;
  const busy = isUnbilledTab
    ? unbilledQ.isLoading || unbilledQ.isFetching || catalogLoading
    : ordersBusy || catalogLoading;
  const isError = isUnbilledTab ? unbilledQ.isError : allOrdersQ.isError;
  const activeCount = isUnbilledTab
    ? filtered.length
    : filteredListTabViews.length;
  const unbilledBusy = unbilledQ.isLoading || unbilledQ.isFetching;
  const canDownload =
    !unbilledBusy &&
    !ordersBusy &&
    !catalogLoading &&
    !isDownloadingPdf &&
    totalPdfOrders > 0;
  const lineCount = filtered.reduce((sum, view) => sum + view.lines.length, 0);
  const listTabLineCount = filteredListTabViews.reduce(
    (sum, view) => sum + view.lines.length,
    0,
  );

  const tabTitle = isUnbilledTab
    ? "Un Billed Orders"
    : isOnHoldTab
      ? "On Hold Orders"
      : "Process Pending Orders";
  const tabSubtitle = isUnbilledTab
    ? "Unbilled / partially billed — approved qty greater than dispatched qty"
    : isOnHoldTab
      ? "Orders currently on hold — from the orders list"
      : "Admin, due sheet, finance, account, and dispatch pending — from the orders list";
  const TabIcon = isUnbilledTab
    ? Receipt
    : isOnHoldTab
      ? PauseCircle
      : ClipboardList;

  const renderListOrderRow = (view: ListOrderView) => (
    <Fragment key={view.orderId || view.orderNo}>
      <tr className="border-t border-slate-200 bg-slate-50/70 dark:border-white/10 dark:bg-slate-800/40">
        <td className="px-4 py-2.5 font-mono font-bold text-slate-800 dark:text-slate-100">
          {view.orderNo}
          <span className="ml-2 font-sans text-2xs font-medium text-slate-500">
            {view.lines.length} item{view.lines.length === 1 ? "" : "s"}
          </span>
        </td>
        <td className="px-4 py-2.5 whitespace-nowrap text-slate-600 dark:text-slate-300">
          {view.refOrderDate}
        </td>
        <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300">
          {view.party}
        </td>
        <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300">
          {view.salesPerson}
        </td>
        <td className="px-4 py-2.5">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-bold uppercase tracking-wider ring-1 ring-inset ${isOnHoldTab
                ? "bg-rose-50 text-rose-700 ring-rose-600/10 dark:bg-rose-950/30 dark:text-rose-400"
                : "bg-amber-50 text-amber-700 ring-amber-600/10 dark:bg-amber-950/30 dark:text-amber-400"
              }`}
          >
            {view.statusLabel}
          </span>
        </td>
        <td className="px-4 py-2.5 tabular-nums font-semibold text-slate-700 dark:text-slate-300">
          {view.ordered}
        </td>
        <td className="px-4 py-2.5 tabular-nums font-semibold text-cyan-700 dark:text-cyan-400">
          {view.pending}
        </td>
        <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-slate-800 dark:text-slate-100">
          ₹{formatMoney(view.amount)}
        </td>
        <td className="px-4 py-2.5 max-w-[220px] text-slate-600 dark:text-slate-300">
          <div className="flex items-center justify-between gap-1.5 group">
            <span
              className="truncate"
              title={view.remarks !== "—" ? view.remarks : undefined}
            >
              {view.remarks || "—"}
            </span>
            {view.orderId ? (
              <button
                type="button"
                onClick={() =>
                  setRemarkTarget({
                    type: "order",
                    id: view.orderId,
                    orderNo: view.orderNo,
                    party: view.party,
                    statusLabel: view.statusLabel,
                    existingRemarks: view.remarks !== "—" ? view.remarks : "",
                  })
                }
                className="shrink-0 rounded p-1 text-slate-400 opacity-60 transition hover:bg-cyan-50 hover:text-cyan-700 hover:opacity-100 group-hover:opacity-100 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-300"
                title="Add / edit remark"
              >
                <MessageSquarePlus className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </td>
        <td className="px-4 py-2.5 text-right">
          {view.orderId ? (
            <Link
              href={view.href}
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-md border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-2xs font-semibold text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-700/50 dark:bg-cyan-950/40 dark:text-cyan-400 dark:hover:bg-cyan-900/30"
            >
              <ExternalLink className="h-3 w-3" />
              View
            </Link>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </td>
      </tr>
      {view.lines.map((line) => (
        <tr
          key={`${view.orderId}-${line.orderItemId}`}
          className="border-t border-slate-100 bg-white dark:border-white/5 dark:bg-slate-900"
        >
          <td className="px-4 py-2 pl-8 text-slate-700 dark:text-slate-300">
            <div className="font-medium">{line.productName}</div>
            {line.sku ? (
              <div className="text-2xs text-slate-400">SKU {line.sku}</div>
            ) : null}
          </td>
          <td className="px-4 py-2 text-slate-400">—</td>
          <td className="px-4 py-2 text-slate-400">—</td>
          <td className="px-4 py-2 text-slate-400">—</td>
          <td className="px-4 py-2 text-slate-400">—</td>
          <td className="px-4 py-2 tabular-nums text-slate-600 dark:text-slate-400">
            {line.ordered}
          </td>
          <td className="px-4 py-2 tabular-nums font-semibold text-cyan-700 dark:text-cyan-400">
            {line.pending}
          </td>
          <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
            {line.amount != null && line.amount > 0
              ? `₹${formatMoney(line.amount)}`
              : "—"}
          </td>
          <td
            className="px-4 py-2 max-w-[200px] truncate text-slate-500 dark:text-slate-400"
            title={line.remarks}
          >
            {line.remarks || "—"}
          </td>
          <td className="px-4 py-2" />
        </tr>
      ))}
    </Fragment>
  );

  const renderUnbilledOrderRow = (view: UnbilledOrderView) => (
    <Fragment key={view.orderId || view.orderNo}>
      <tr className="border-t border-slate-200 bg-slate-50/70 dark:border-white/10 dark:bg-slate-800/40">
        <td className="px-4 py-2.5 font-mono font-bold text-slate-800 dark:text-slate-100">
          {view.orderNo}
          <span className="ml-2 font-sans text-2xs font-medium text-slate-500">
            {view.lines.length} item{view.lines.length === 1 ? "" : "s"}
          </span>
        </td>
        <td className="px-4 py-2.5 whitespace-nowrap text-slate-600 dark:text-slate-300">
          {view.refOrderDate}
        </td>
        <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300">
          {view.party}
        </td>
        <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300">
          {view.salesPerson}
        </td>
        <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-bold uppercase tracking-wider ring-1 ring-inset ${view.statusLabel.includes("Pending")
                ? "bg-amber-50 text-amber-700 ring-amber-600/10 dark:bg-amber-950/30 dark:text-amber-400"
                : "bg-emerald-50 text-emerald-700 ring-emerald-600/10 dark:bg-emerald-950/30 dark:text-emerald-400"
              }`}
          >
            {view.statusLabel}
          </span>
        </td>
        <td className="px-4 py-2.5 tabular-nums font-semibold text-cyan-700 dark:text-cyan-400">
          {view.remaining}
        </td>
        <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-slate-800 dark:text-slate-100">
          ₹{formatMoney(view.amount)}
        </td>
        <td className="px-4 py-2.5 max-w-[220px] text-slate-600 dark:text-slate-300">
          <div className="flex items-center justify-between gap-1.5 group">
            <span
              className="truncate"
              title={view.remarks !== "—" ? view.remarks : undefined}
            >
              {view.remarks || "—"}
            </span>
            <button
              type="button"
              onClick={() =>
                setRemarkTarget({
                  type: "unbilled",
                  id: view.unbilledId,
                  linkedOrderId: view.orderId,
                  orderNo: view.orderNo,
                  party: view.party,
                  statusLabel: view.statusLabel,
                  existingRemarks: view.remarks !== "—" ? view.remarks : "",
                })
              }
              className="shrink-0 rounded p-1 text-slate-400 opacity-60 transition hover:bg-cyan-50 hover:text-cyan-700 hover:opacity-100 group-hover:opacity-100 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-300"
              title="Add / edit remark"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
        <td className="px-4 py-2.5">
          {view.orderId ? (
            <Link
              href={view.href}
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-md border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-2xs font-semibold text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-700/50 dark:bg-cyan-950/40 dark:text-cyan-400 dark:hover:bg-cyan-900/30"
            >
              <ExternalLink className="h-3 w-3" />
              View
            </Link>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </td>
        <td className="px-4 py-2.5 text-right">
          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => openEditModal(view.rawRecord)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-2xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5"
              title="Edit unbilled order items, quantities or remarks"
            >
              <Pencil className="h-3 w-3 text-slate-500" />
              Edit
            </button>
            {view.canCreateOrder ? (
              <button
                type="button"
                onClick={() => openCreateOrder(view)}
                className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1 text-2xs font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-700/50 dark:bg-blue-950/40 dark:text-blue-400 dark:hover:bg-blue-900/30"
                title="Create a new order for this unbilled party"
              >
                <Plus className="h-3 w-3" />
                Create Order
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => openResolveConfirm(view)}
              className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-2xs font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/30"
              title="Resolve this unbilled tracking row"
            >
              <CheckCircle2 className="h-3 w-3" />
              Resolve
            </button>
          </div>
        </td>
      </tr>
      {view.lines.map((line) => (
        <tr
          key={`${view.orderId}-${line.orderItemId}`}
          className="border-t border-slate-100 bg-white dark:border-white/5 dark:bg-slate-900"
        >
          <td className="px-4 py-2 pl-8 text-slate-700 dark:text-slate-300">
            <div className="font-medium">{line.productName}</div>
            {line.sku ? (
              <div className="text-2xs text-slate-400">SKU {line.sku}</div>
            ) : null}
          </td>
          <td className="px-4 py-2 text-slate-400">—</td>
          <td className="px-4 py-2 text-slate-400">—</td>
          <td className="px-4 py-2 text-slate-400">—</td>
          <td className="px-4 py-2 text-slate-400">—</td>
          <td className="px-4 py-2 tabular-nums font-semibold text-cyan-700 dark:text-cyan-400">
            {line.remaining}
          </td>
          <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
            {line.amount != null && line.amount > 0
              ? `₹${formatMoney(line.amount)}`
              : "—"}
          </td>
          <td className="px-4 py-2 text-slate-400">—</td>
          <td className="px-4 py-2 text-slate-400">—</td>
          <td className="px-4 py-2" />
        </tr>
      ))}
    </Fragment>
  );

  return (
    <div
      aria-labelledby="unbilled-orders-title"
      className="flex min-h-[calc(100vh-4rem)] w-full flex-col overflow-hidden bg-white shadow-xs dark:bg-slate-900"
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400">
              <TabIcon className="h-4 w-4" />
            </span>
            <div>
              <h2
                id="unbilled-orders-title"
                className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-50"
              >
                {tabTitle}
              </h2>
              <p className="mt-0.5 text-2xs text-slate-500 dark:text-slate-400">
                {tabSubtitle}
                {!busy && activeCount > 0
                  ? isUnbilledTab
                    ? ` · ${filtered.length} order${filtered.length === 1 ? "" : "s"} · ${lineCount} item${lineCount === 1 ? "" : "s"} · ₹${formatMoney(totalAmount)}`
                    : ` · ${filteredListTabViews.length} order${filteredListTabViews.length === 1 ? "" : "s"} · ${listTabLineCount} item${listTabLineCount === 1 ? "" : "s"} · ₹${formatMoney(totalAmount)}`
                  : ""}
              </p>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isUnbilledTab ? (
            <button
              type="button"
              onClick={() => setIsAddUnbilledOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-600 bg-cyan-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-cyan-700 dark:border-cyan-500 dark:bg-cyan-600 dark:hover:bg-cyan-500"
              title="Add an unbilled order manually by selecting an order"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Unbilled Order
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-white/5"
            title="Reload list"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void handleDownloadPdf()}
            disabled={!canDownload}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300 bg-cyan-50 px-2.5 py-1.5 text-xs font-semibold text-cyan-700 shadow-sm transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-cyan-700/50 dark:bg-cyan-950/40 dark:text-cyan-400 dark:hover:bg-cyan-900/30"
            title={
              canDownload
                ? isGroupBySalesPerson || filterSalesPerson !== "all"
                  ? "Download sales person-wise orders report as PDF"
                  : "Download unbilled, process pending, and on hold orders as PDF"
                : unbilledBusy
                  ? "Loading orders…"
                  : "Nothing to download"
            }
          >
            <Download className={`h-3.5 w-3.5 ${isDownloadingPdf ? "animate-pulse" : ""}`} />
            {isDownloadingPdf
              ? "Generating…"
              : isGroupBySalesPerson || filterSalesPerson !== "all"
                ? "Download Sales Wise PDF"
                : "Download PDF"}
          </button>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-slate-200"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 border-b border-slate-100 px-5 dark:border-white/5">
        <div className="flex gap-1" role="tablist" aria-label="Orders modal tabs">
          {(
            [
              {
                id: "unbilled" as const,
                label: "Un Billed",
                count: orderViews.length,
              },
              {
                id: "process_pending" as const,
                label: "Process Pending",
                count: processPendingViews.length,
              },
              {
                id: "on_hold" as const,
                label: "On Hold",
                count: onHoldViews.length,
              },
            ] as const
          ).map((tab) => {
            const selected = mainTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setMainTab(tab.id)}
                className={`relative px-3 py-2.5 text-xs font-semibold transition ${selected
                    ? "text-cyan-700 dark:text-cyan-400"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
              >
                {tab.label}
                <span className="ml-1.5 tabular-nums text-2xs font-medium opacity-70">
                  {tab.count}
                </span>
                {selected ? (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-cyan-600 dark:bg-cyan-400" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative z-20 shrink-0 border-b border-slate-100 px-5 py-3 dark:border-white/5">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by order no, party, sales person, status, or product…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs text-slate-800 outline-none ring-cyan-500/30 placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-2 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsGroupBySalesPerson((prev) => !prev)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${isGroupBySalesPerson
                ? "border-cyan-500 bg-cyan-50 text-cyan-700 dark:border-cyan-700/50 dark:bg-cyan-950/40 dark:text-cyan-400"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-white/5"
              }`}
            title={
              isGroupBySalesPerson
                ? "Show standard flat list"
                : "Group orders by assigned sales person"
            }
          >
            <Users className="h-3.5 w-3.5" />
            {isGroupBySalesPerson ? "Grouped by Sales" : "Group by Sales"}
          </button>

          <button
            type="button"
            onClick={() => setIsFilterPanelOpen((prev) => !prev)}
            className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${isFilterPanelOpen || hasActiveFilters
                ? "border-cyan-500 bg-cyan-50 text-cyan-700 dark:border-cyan-700/50 dark:bg-cyan-950/40 dark:text-cyan-400"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-white/5"
              }`}
            aria-expanded={isFilterPanelOpen}
            aria-controls="unbilled-filter-panel"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {hasActiveFilters ? (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-cyan-500 dark:border-slate-900" />
            ) : null}
          </button>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={handleClearFilters}
              className="shrink-0 px-1 py-2 text-xs font-semibold text-rose-500 transition hover:text-rose-600"
              title="Clear all filters"
            >
              Clear
            </button>
          ) : null}
        </div>

        {isFilterPanelOpen ? (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsFilterPanelOpen(false)}
              aria-hidden
            />
            <div
              id="unbilled-filter-panel"
              className="absolute right-5 top-full z-50 mt-2 w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-4 text-xs shadow-xl dark:border-white/10 dark:bg-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-white/5">
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {isUnbilledTab
                    ? "Unbilled Filters"
                    : isOnHoldTab
                      ? "On Hold Filters"
                      : "Process Pending Filters"}
                </span>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  disabled={!hasActiveFilters}
                  className="text-2xs font-semibold text-slate-400 transition hover:text-cyan-600 disabled:opacity-40 dark:hover:text-cyan-400"
                >
                  Reset All
                </button>
              </div>

              <div className="space-y-3.5 select-none">
                <div>
                  <label className="mb-1 block font-semibold text-slate-500 dark:text-slate-400">
                    Status
                  </label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className={SELECT_CLASS}
                  >
                    <option value="all">All statuses</option>
                    {uniqueStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-slate-500 dark:text-slate-400">
                    Party
                  </label>
                  <select
                    value={filterParty}
                    onChange={(e) => setFilterParty(e.target.value)}
                    className={SELECT_CLASS}
                  >
                    <option value="all">All parties</option>
                    {uniqueParties.map((party) => (
                      <option key={party} value={party}>
                        {party}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-slate-500 dark:text-slate-400">
                    Assigned Sales Person
                  </label>
                  <select
                    value={filterSalesPerson}
                    onChange={(e) => setFilterSalesPerson(e.target.value)}
                    className={SELECT_CLASS}
                  >
                    <option value="all">All sales persons</option>
                    {hasUnassignedSalesPerson && (
                      <option value="unassigned">Unassigned (—)</option>
                    )}
                    {uniqueSalesPersons.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                {isUnbilledTab ? (
                  <>
                    <div>
                      <label className="mb-1 block font-semibold text-slate-500 dark:text-slate-400">
                        Create Order
                      </label>
                      <select
                        value={filterCreateOrder}
                        onChange={(e) =>
                          setFilterCreateOrder(
                            e.target.value as CreateOrderEligibleFilter,
                          )
                        }
                        className={SELECT_CLASS}
                      >
                        <option value="all">All orders</option>
                        <option value="yes">Eligible only</option>
                        <option value="no">Not eligible</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block font-semibold text-slate-500 dark:text-slate-400">
                        Unbilled qty range
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={filterMinRemaining}
                          onChange={(e) => setFilterMinRemaining(e.target.value)}
                          placeholder="Min"
                          className={INPUT_CLASS}
                        />
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={filterMaxRemaining}
                          onChange={(e) => setFilterMaxRemaining(e.target.value)}
                          placeholder="Max"
                          className={INPUT_CLASS}
                        />
                      </div>
                    </div>
                  </>
                ) : null}
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-white/5">
                <span className="text-2xs text-slate-500 dark:text-slate-400">
                  Showing {activeCount} of{" "}
                  {isUnbilledTab ? orderViews.length : listTabViews.length}{" "}
                  orders
                </span>
                <button
                  type="button"
                  onClick={() => setIsFilterPanelOpen(false)}
                  className="rounded-lg bg-cyan-600 px-3 py-1.5 text-2xs font-semibold text-white transition hover:bg-cyan-700"
                >
                  Done
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {isListOrdersTab ? (
          filteredListTabViews.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {isOnHoldTab
                  ? "No on hold orders"
                  : "No process pending orders"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {listTabViews.length === 0
                  ? isOnHoldTab
                    ? "No orders are currently on hold."
                    : "No orders are in admin, due sheet, finance, account, or dispatch pending."
                  : hasActiveFilters || searchQuery.trim()
                    ? "No orders match your search and filters."
                    : "No orders match your search."}
              </p>
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur dark:bg-slate-900/95">
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-slate-500">
                    Order / Item
                  </th>
                  <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-slate-500">
                    Ref Order Date
                  </th>
                  <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-slate-500">
                    Party
                  </th>
                  <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-slate-500">
                    Sales Person
                  </th>
                  <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-slate-500">
                    Ordered
                  </th>
                  <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-slate-500">
                    Pending
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold uppercase tracking-wider text-slate-500">
                    Amount
                  </th>
                  <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-slate-500">
                    Order Remarks
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold uppercase tracking-wider text-slate-500">
                    View
                  </th>
                </tr>
              </thead>
              <tbody>
                {isGroupBySalesPerson
                  ? groupedListTabViews.map(
                    ([salesPersonName, viewsInGroup]) => (
                      <Fragment key={`group-${salesPersonName}`}>
                        <tr className="border-t-2 border-slate-200 bg-slate-100/90 text-slate-800 dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-100">
                          <td colSpan={10} className="px-4 py-2 text-xs font-bold">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <UserCheck className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                                <span className="font-semibold text-slate-900 dark:text-slate-100">
                                  {salesPersonName}
                                </span>
                                <span className="text-2xs font-normal text-slate-500 dark:text-slate-400">
                                  ({viewsInGroup.length} order
                                  {viewsInGroup.length === 1 ? "" : "s"} ·{" "}
                                  {viewsInGroup.reduce(
                                    (s, v) => s + v.lines.length,
                                    0,
                                  )}{" "}
                                  item
                                  {viewsInGroup.reduce(
                                    (s, v) => s + v.lines.length,
                                    0,
                                  ) === 1
                                    ? ""
                                    : "s"}
                                  )
                                </span>
                              </div>
                              <div className="text-right font-mono font-bold text-cyan-700 dark:text-cyan-400">
                                ₹
                                {formatMoney(
                                  viewsInGroup.reduce(
                                    (s, v) => s + (v.amount || 0),
                                    0,
                                  ),
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                        {viewsInGroup.map((view) => renderListOrderRow(view))}
                      </Fragment>
                    ),
                  )
                  : filteredListTabViews.map((view) => renderListOrderRow(view))}
              </tbody>
              <tfoot className="sticky bottom-0 z-10 border-t-2 border-slate-200 bg-slate-50/95 font-semibold text-slate-800 backdrop-blur dark:border-white/10 dark:bg-slate-900/95 dark:text-slate-100">
                <tr>
                  <td className="px-4 py-2.5">
                    Total ({filteredListTabViews.length} order
                    {filteredListTabViews.length === 1 ? "" : "s"})
                  </td>
                  <td className="px-4 py-2.5" colSpan={4}></td>
                  <td className="px-4 py-2.5 tabular-nums text-slate-700 dark:text-slate-300">
                    {totalPrimaryQty}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-cyan-700 dark:text-cyan-400">
                    {totalPendingQty}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-900 dark:text-slate-50">
                    ₹{formatMoney(totalAmount)}
                  </td>
                  <td className="px-4 py-2.5" colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          )
        ) : isError ? (
          <div className="px-5 py-16 text-center">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Failed to load un billed orders
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Could not fetch UnbilledOrder tracking. Try Refresh again.
            </p>
          </div>
        ) : busy && records.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Loading un billed orders…
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              No un billed orders
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {records.length === 0
                ? "No unbilled or partially billed orders (approved qty greater than dispatched qty)."
                : hasActiveFilters || searchQuery.trim()
                  ? "No orders match your search and filters."
                  : "No orders match your search."}
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur dark:bg-slate-900/95">
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-slate-500">
                  Order / Item
                </th>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-slate-500">
                  Ref Order Date
                </th>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-slate-500">
                  Party
                </th>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-slate-500">
                  Sales Person
                </th>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-slate-500">
                  Status
                </th>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-slate-500">
                  Unbilled
                </th>
                <th className="px-4 py-2.5 text-right font-semibold uppercase tracking-wider text-slate-500">
                  Amount
                </th>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-slate-500">
                  Order Remarks
                </th>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-slate-500">
                  View Ref Order
                </th>
                <th className="px-4 py-2.5 text-right font-semibold uppercase tracking-wider text-slate-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {isGroupBySalesPerson
                ? groupedUnbilledViews.map(
                  ([salesPersonName, viewsInGroup]) => (
                    <Fragment key={`group-${salesPersonName}`}>
                      <tr className="border-t-2 border-slate-200 bg-slate-100/90 text-slate-800 dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-100">
                        <td colSpan={10} className="px-4 py-2 text-xs font-bold">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <UserCheck className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {salesPersonName}
                              </span>
                              <span className="text-2xs font-normal text-slate-500 dark:text-slate-400">
                                ({viewsInGroup.length} order
                                {viewsInGroup.length === 1 ? "" : "s"} ·{" "}
                                {viewsInGroup.reduce(
                                  (s, v) => s + v.lines.length,
                                  0,
                                )}{" "}
                                item
                                {viewsInGroup.reduce(
                                  (s, v) => s + v.lines.length,
                                  0,
                                ) === 1
                                  ? ""
                                  : "s"}
                                )
                              </span>
                            </div>
                            <div className="text-right font-mono font-bold text-cyan-700 dark:text-cyan-400">
                              ₹
                              {formatMoney(
                                viewsInGroup.reduce(
                                  (s, v) => s + (v.amount || 0),
                                  0,
                                ),
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                      {viewsInGroup.map((view) => renderUnbilledOrderRow(view))}
                    </Fragment>
                  ),
                )
                : filtered.map((view) => renderUnbilledOrderRow(view))}
            </tbody>
            <tfoot className="sticky bottom-0 z-10 border-t-2 border-slate-200 bg-slate-50/95 font-semibold text-slate-800 backdrop-blur dark:border-white/10 dark:bg-slate-900/95 dark:text-slate-100">
              <tr>
                <td className="px-4 py-2.5">
                  Total ({filtered.length} order
                  {filtered.length === 1 ? "" : "s"})
                </td>
                <td className="px-4 py-2.5" colSpan={4}></td>
                <td className="px-4 py-2.5 tabular-nums text-cyan-700 dark:text-cyan-400">
                  {totalPrimaryQty}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-900 dark:text-slate-50">
                  ₹{formatMoney(totalAmount)}
                </td>
                <td className="px-4 py-2.5" colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {resolveTarget ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-[1px]"
          role="presentation"
          onClick={() => {
            if (!isResolving) setResolveTarget(null);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="resolve-unbilled-title"
            aria-describedby="resolve-unbilled-desc"
            className="w-full max-w-md rounded-xl border border-amber-200 bg-white p-5 shadow-xl dark:border-amber-800/60 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h3
                  id="resolve-unbilled-title"
                  className="text-sm font-bold text-slate-900 dark:text-slate-50"
                >
                  Resolve unbilled order?
                </h3>
                <p
                  id="resolve-unbilled-desc"
                  className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300"
                >
                  This will permanently close unbilled tracking for{" "}
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">
                    {resolveTarget.orderNo}
                  </span>
                  {resolveTarget.remaining > 0
                    ? ` with ${resolveTarget.remaining} remaining unit${resolveTarget.remaining === 1 ? "" : "s"
                    }.`
                    : "."}{" "}
                  It will leave the Un Billed list and will not create a
                  replacement order. This cannot be undone from here.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={isResolving}
                onClick={() => setResolveTarget(null)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isResolving}
                onClick={() => void handleConfirmResolve()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {isResolving ? "Resolving…" : "Yes, resolve"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AddUnbilledOrderModal
        isOpen={isAddUnbilledOpen}
        onClose={() => setIsAddUnbilledOpen(false)}
        onSuccess={() => {
          void unbilledQ.refetch();
          void allOrdersQ.refetch();
        }}
        orders={liveOrders}
        existingUnbilledOrderIds={existingUnbilledOrderIds}
        partyNameById={partyNameById}
        mode="create"
      />

      <AddUnbilledOrderModal
        isOpen={Boolean(editRecord)}
        onClose={closeEditModal}
        onSuccess={() => {
          void unbilledQ.refetch();
          void allOrdersQ.refetch();
        }}
        orders={liveOrders}
        existingUnbilledOrderIds={existingUnbilledOrderIds}
        partyNameById={partyNameById}
        mode="edit"
        initialRecord={editRecord}
      />

      <UnbilledCreateOrderModal
        createTarget={createTarget}
        onClose={() => setCreateTarget(null)}
        portalBasePath={portalBasePath}
      />

      {remarkTarget ? (
        <AddOrderRemarkModal
          isOpen={Boolean(remarkTarget)}
          onClose={() => setRemarkTarget(null)}
          orderNo={remarkTarget.orderNo}
          partyName={remarkTarget.party}
          statusLabel={remarkTarget.statusLabel}
          existingRemarks={remarkTarget.existingRemarks}
          userName={downloadedBy !== "—" ? downloadedBy : "User"}
          onSave={handleSaveRemark}
        />
      ) : null}
    </div>
  );
}

export default UnbilledOrdersPage;
