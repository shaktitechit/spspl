"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileText,
  LayoutDashboard,
  Plus,
  Receipt,
  RefreshCw,
  TableProperties,
  Trash2,
  TrendingUp,
  Truck,
  X,
} from "lucide-react";

import TransportPlanModal from "../detail/modals/TransportPlanModal";

import { ConfirmDeleteDraftModal } from "@/components/portal/sales/components/modals/ConfirmDeleteDraftModal";
import { OrderDetailModal } from "@/components/portal/sales/components/modals/OrderDetailModal";
import {
  buildPartyNameById,
  buildPartySraById,
  checkOrderPartySra,
  resolveOrderCounterparty,
} from "@/components/portal/sales/partyDisplay";
import {
  normalizeSalesTabFromUrl,
  type SalesOrderTabCategory,
} from "@/components/portal/sales/orderUtils";
import { GoogleSheetAnalyticsModal } from "@/components/portal/shared/orders/integrations/GoogleSheetAnalyticsModal";
import { GoogleSheetOrdersModal } from "./GoogleSheetOrdersModal";
import { deriveOrderWorkflowStatus } from "@/components/portal/shared/orders/lib/orderLifecycle";
import { OrderDueSheetBadge } from "@/components/portal/shared/ui/badges/OrderDueSheetBadge";
import { OrderFlagBadge } from "@/components/portal/shared/ui/badges/OrderFlagBadge";
import { pickOrders } from "@/components/portal/shared/lib/pickOrders";
import {
  buildUserNameById,
  resolveUserDisplay,
} from "@/components/portal/shared/lib/userDisplay";
import { SuperAdminOrdersSheetModal } from "@/components/portal/super_admin/order/SuperAdminOrdersSheetModal";
import {
  mutationRejectedMessage,
  mutationSuccessCopy,
} from "@/lib/mutationMessages";
import { toast } from "@/lib/toast";
import {
  useDeleteOrderMutation,
  useListOrdersQuery,
  useListPartiesQuery,
  useListUsersQuery,
} from "@/store/api";

import { dateFilterToRange } from "./orderListDateFilter";
import {
  orderMasterPortalKeyFromHome,
  resolveOrderStageLabel,
} from "./orderMasterNav";
import {
  formatDateShort,
  formatDateTime,
  formatMoney,
  orderKey,
  renderPendingApprovalBadge,
  renderPriorityBadge,
  renderWorkflowStatusBadge,
  type OrderListRow,
} from "./orderListDisplay";
import { OrderListPaginationBar } from "./OrderListPaginationBar";
import { OrderListSearchDatePanel } from "./OrderListSearchDatePanel";
import type {
  ListOrdersPageConfig,
  ListOrdersTabId,
} from "./listOrdersPageConfig";
import { type OrderWorkflowTabCategory } from "./orderWorkflowTabs";
import { UnbilledOrdersModal } from "./UnbilledOrdersModal";
import { useOrderListUrlState } from "./useOrderListUrlState";
import { useOrderWorkflowCategoryOptions } from "./useOrderWorkflowCategoryOptions";

type ListOrdersPageProps = {
  config: ListOrdersPageConfig;
  /** Process queue for this route (`/orders/:stage`). */
  processStage?: ListOrdersTabId;
};

type ListOrdersPagePayload = {
  data?: unknown[];
  total?: number;
  pages?: number;
  scopeTotal?: number;
  tabCounts?: Record<string, number>;
};

export default function ListOrdersPage({
  config,
  processStage: processStageProp,
}: ListOrdersPageProps) {
  const processStage = processStageProp ?? config.defaultTab;
  const router = useRouter();
  const {
    portalHome,
    title,
    subtitle,
    defaultTab,
    flagDepartment,
    showDueSheetBadge,
    showFlagBadge,
    showPricing,
    includeDraftTab,
    headerActions,
    createDraftLabel = "Draft Order",
    emptyNoOrdersHint,
    accents,
    sheetPortal,
    allowDraftDelete,
    allowSuperAdminEdit,
    useSuperAdminSheet,
  } = config;

  const normalizeSalesTab = useCallback(
    (value: string | null, fallback: ListOrdersTabId): ListOrdersTabId =>
      normalizeSalesTabFromUrl(value, fallback as SalesOrderTabCategory),
    [],
  );

  const portalKey = orderMasterPortalKeyFromHome(portalHome);
  const queueTitle =
    (portalKey && resolveOrderStageLabel(portalKey, processStage)) ||
    title;

  const {
    searchQuery,
    setSearchQuery,
    priorityFilter,
    setPriorityFilter,
    dateFilter,
    handleDateFilterChange,
    customDateFrom,
    handleCustomDateFromChange,
    customDateTo,
    handleCustomDateToChange,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    handleResetFilters,
    showReset,
  } = useOrderListUrlState({
    defaultTab,
    includeDraftTab,
    normalizeTab: includeDraftTab ? normalizeSalesTab : undefined,
    processStageFromPath: processStage,
  });

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isUnbilledOrdersOpen, setIsUnbilledOrdersOpen] = useState(false);
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    label: string;
  } | null>(null);

  const [deleteOrder, { isLoading: isDeletingOrder }] = useDeleteOrderMutation();

  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  // One page of the open process. Sheet and unbilled load that same stage only.
  const listQueryParams = useMemo(() => {
    const range = dateFilterToRange(dateFilter, customDateFrom, customDateTo);
    const searching = debouncedSearch.trim().length > 0;
    const params: Record<string, string> = {
      view: "list",
      paginate: "true",
      page: String(currentPage),
      limit: String(itemsPerPage),
    };
    if (includeDraftTab) params.sales_tabs = "true";
    else params.exclude_status = "draft";
    if (searching) params.search = debouncedSearch.trim();
    params.tab = processStage;
    if (priorityFilter !== "all") params.priority = priorityFilter;
    if (range.dateFrom) params.dateFrom = range.dateFrom;
    if (range.dateTo) params.dateTo = range.dateTo;
    return params;
  }, [
    currentPage,
    customDateFrom,
    customDateTo,
    dateFilter,
    debouncedSearch,
    includeDraftTab,
    itemsPerPage,
    priorityFilter,
    processStage,
  ]);

  const { data, isLoading, isFetching, isError, refetch } =
    useListOrdersQuery(listQueryParams);
  const needsBulkOrders = isSheetOpen || isUnbilledOrdersOpen;
  const bulkListParams = {
    view: "list",
    paginate: "true",
    all: "true",
    page: "1",
    tab: processStage,
    ...(includeDraftTab ? { sales_tabs: "true" } : { exclude_status: "draft" }),
  };
  const bulkQ = useListOrdersQuery(bulkListParams, { skip: !needsBulkOrders });
  const partiesQ = useListPartiesQuery({});
  const salesUsersQ = useListUsersQuery({ department: "sales" });
  const categoryOptions = useOrderWorkflowCategoryOptions();

  const pagePayload =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as ListOrdersPagePayload)
      : null;

  const orders = useMemo(
    () => pickOrders(data) as OrderListRow[],
    [data],
  );

  const bulkOrders = useMemo(
    () => pickOrders(bulkQ.data) as OrderListRow[],
    [bulkQ.data],
  );

  const getActiveTransportInfoForOrder = useCallback((o: Record<string, unknown>) => {
    const at = o.active_transport as
      | { agent_name?: string; scheduled_date?: string }
      | undefined;
    if (at && (at.agent_name || at.scheduled_date)) {
      return {
        agentName: at.agent_name || undefined,
        scheduledDate: at.scheduled_date || undefined,
      };
    }
    return null;
  }, []);

  const [transportPlanOrderId, setTransportPlanOrderId] = useState<string | null>(null);

  const selectedTransportOrder = useMemo(() => {
    if (!transportPlanOrderId) return null;
    return orders.find((o) => orderKey(o) === transportPlanOrderId) || null;
  }, [transportPlanOrderId, orders]);

  const partyNameById = useMemo(
    () => buildPartyNameById(partiesQ.data),
    [partiesQ.data],
  );

  const partySraById = useMemo(
    () => buildPartySraById(partiesQ.data),
    [partiesQ.data],
  );

  const salesUserNameById = useMemo(
    () => buildUserNameById(salesUsersQ.data),
    [salesUsersQ.data],
  );

  const tabCounts = pagePayload?.tabCounts ?? {};
  const totalEntries = pagePayload?.total ?? orders.length;
  const totalPages = Math.max(1, pagePayload?.pages ?? 1);
  const scopeTotal = pagePayload?.scopeTotal ?? totalEntries;

  // Keep current page in range when filters shrink the result set.
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages, setCurrentPage]);

  const startEntry =
    totalEntries > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endEntry = Math.min(currentPage * itemsPerPage, totalEntries);

  const stageForUi = processStage;
  const isPendingTab =
    stageForUi === "pending_admin_approval" ||
    stageForUi === "due_sheet_pending" ||
    stageForUi === "pending_finance_approval" ||
    stageForUi === "pending_account_approval";

  const queueCount =
    tabCounts[processStage] ??
    (isFetching ? undefined : totalEntries);

  const hasAction = useCallback(
    (action: (typeof headerActions)[number]) => headerActions.includes(action),
    [headerActions],
  );

  const closeDeleteModal = useCallback(() => setDeleteTarget(null), []);

  const confirmDeleteDraft = useCallback(async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    try {
      await deleteOrder(id).unwrap();
      toast.success(mutationSuccessCopy("deleteOrder"));
      setDeleteTarget(null);
    } catch (rejected) {
      toast.error(mutationRejectedMessage(rejected));
    }
  }, [deleteOrder, deleteTarget]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">

      {allowDraftDelete && (
        <ConfirmDeleteDraftModal
          orderId={deleteTarget?.id ?? null}
          orderLabel={deleteTarget?.label ?? ""}
          isDeleting={isDeletingOrder}
          onClose={closeDeleteModal}
          onConfirm={confirmDeleteDraft}
        />
      )}

      <div
        className={`relative shrink-0 overflow-hidden rounded-xl border px-4 py-2.5 shadow-sm ${accents.strip}`}
      >
        <div className="relative flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-50">
              {queueTitle}
              {queueCount != null ? (
                <span
                  className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-2xs font-bold ${accents.countBadge} text-white`}
                >
                  {queueCount}
                </span>
              ) : null}
            </h1>
            {subtitle ? (
              <p className="mt-0.5 max-w-xl text-xs text-slate-600 dark:text-slate-400">
                {subtitle}
              </p>
            ) : (
              <p className="mt-0.5 max-w-xl text-xs text-slate-500 dark:text-slate-400">
                Order Master
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasAction("unbilled") && (
              <button
                type="button"
                onClick={() => setIsUnbilledOrdersOpen(true)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-cyan-300 bg-cyan-50 px-2.5 py-1.5 text-xs font-semibold text-cyan-700 shadow-sm transition hover:bg-cyan-100 dark:border-cyan-700/50 dark:bg-cyan-950/40 dark:text-cyan-400 dark:hover:bg-cyan-900/30"
                title="View unbilled / partially billed orders (approved qty greater than dispatched qty)"
              >
                <Receipt className="h-3 w-3" />
                Un Billed Orders
              </button>
            )}
            {hasAction("sheet") && (
              <button
                type="button"
                onClick={() => setIsSheetOpen(true)}
                className={
                  useSuperAdminSheet || sheetPortal === "admin"
                    ? "inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/5"
                    : "inline-flex cursor-pointer items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100 dark:border-emerald-700/50 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                }
                title={
                  useSuperAdminSheet
                    ? "Open super-admin live orders sheet (bypass)"
                    : "Open spreadsheet view"
                }
              >
                {useSuperAdminSheet || sheetPortal === "admin" ? (
                  <FileText
                    className={`h-3 w-3 ${
                      useSuperAdminSheet
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-purple-600 dark:text-purple-400"
                    }`}
                  />
                ) : (
                  <TableProperties className="h-3 w-3" />
                )}
                {useSuperAdminSheet ? "Orders Sheet" : "Sheet"}
              </button>
            )}
            {hasAction("analytics") && (
              <button
                type="button"
                onClick={() => setIsAnalyticsOpen(true)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/5"
                title="View analytics"
              >
                <TrendingUp className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                Analytics
              </button>
            )}
            {hasAction("refresh") && (
              <button
                type="button"
                onClick={() => {
                  void refetch();
                  if (needsBulkOrders) void bulkQ.refetch();
                }}
                disabled={isFetching || (needsBulkOrders && bulkQ.isFetching)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/5"
                title="Reload orders list"
              >
                <RefreshCw
                  className={`h-3 w-3 ${isFetching || (needsBulkOrders && bulkQ.isFetching) ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            )}
            {hasAction("dashboard") && (
              <Link
                href={portalHome}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/5"
              >
                <LayoutDashboard className="h-3 w-3" />
                Dashboard
              </Link>
            )}
            {hasAction("createDraft") && (
              <Link
                href={`${portalHome}/create-order`}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] dark:bg-blue-500 dark:hover:bg-blue-400"
              >
                <Plus className="h-3 w-3" />
                {createDraftLabel}
              </Link>
            )}
          </div>
        </div>
      </div>

      {partiesQ.isError && (
        <div className="shrink-0 rounded-lg border border-amber-200/50 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400">
          Party directory failed to load — names may show as shortened IDs.
        </div>
      )}

      <OrderListSearchDatePanel
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        priorityFilter={priorityFilter}
        onPriorityFilterChange={setPriorityFilter}
        showReset={showReset}
        onResetFilters={handleResetFilters}
        dateFilter={dateFilter}
        onDateFilterChange={handleDateFilterChange}
        customDateFrom={customDateFrom}
        customDateTo={customDateTo}
        onCustomDateFromChange={handleCustomDateFromChange}
        onCustomDateToChange={handleCustomDateToChange}
        searchFocusClass={accents.searchFocus}
        compact
      />

      {searchQuery.trim() ? (
        <div className="flex shrink-0 items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-white/10 dark:bg-slate-900">
          <span className="font-medium text-slate-700 dark:text-slate-300">
            Showing{" "}
            <span className={`font-bold ${accents.searchResult}`}>
              {totalEntries}
            </span>{" "}
            result{totalEntries !== 1 ? "s" : ""} for{" "}
            <span className="font-bold italic text-slate-900 dark:text-slate-100">
              &quot;{searchQuery}&quot;
            </span>
          </span>
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-2xs font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        {isFetching && pagePayload ? (
          <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-blue-100 dark:bg-blue-950">
            <div className="h-full w-1/3 animate-pulse bg-blue-600" />
          </div>
        ) : null}
        {(isLoading || (isFetching && !pagePayload)) && !isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-16">
            <RefreshCw className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Loading orders…
            </p>
          </div>
        ) : null}
        {isError && (
          <div className="px-4 py-16 text-center">
            <span className="text-2xl">⚠️</span>
            <h3 className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
              Failed to load orders
            </h3>
            <p className="mt-1.5 text-xs text-slate-500">
              Please check your database connection and try again.
            </p>
          </div>
        )}

        {!isLoading && !isError && !(isFetching && !pagePayload) && totalEntries === 0 && (
          <div className="px-4 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-xl text-slate-400 dark:border-white/5 dark:bg-slate-950">
              📋
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
              No orders found
            </h3>
            <p className="mx-auto mt-1.5 max-w-xs text-xs text-slate-500">
              {scopeTotal === 0
                ? emptyNoOrdersHint ||
                  "No orders exist in the database system."
                : "No orders match your search and filter parameters."}
            </p>
            {scopeTotal === 0 && hasAction("createDraft") && (
              <Link
                href={`${portalHome}/create-order`}
                className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] dark:bg-blue-500 dark:hover:bg-blue-400"
              >
                <Plus className="h-3.5 w-3.5" />
                {createDraftLabel}
              </Link>
            )}
          </div>
        )}

        {!isLoading && !isError && totalEntries > 0 && (
          <>
            <OrderListPaginationBar
              startEntry={startEntry}
              endEntry={endEntry}
              totalEntries={totalEntries}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={(value) => {
                setItemsPerPage(value);
                setCurrentPage(1);
              }}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />

            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 dark:border-white/5 dark:bg-slate-900/50">
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-slate-500">
                      Order No
                    </th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-slate-500">
                      Party
                    </th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-slate-500">
                      Sales Person
                    </th>
                    {showPricing && (
                      <th className="px-4 py-3 font-semibold uppercase tracking-wider text-slate-500">
                        Grand Total
                      </th>
                    )}
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-slate-500">
                      Order Date
                    </th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-slate-500">
                      Billing Date
                    </th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-slate-500">
                      Expected Delivery
                    </th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-slate-500">
                      Priority
                    </th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-slate-500">
                      Transport
                    </th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-slate-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {orders.map((o) => {
                    const id = orderKey(o);
                    const ref =
                      typeof o.order_no === "string"
                        ? o.order_no
                        : typeof o.order_number === "string"
                          ? o.order_number
                          : id || "—";
                    const total = Number(o.grand_total ?? o.total ?? 0);
                    const pri =
                      typeof o.priority === "string" ? o.priority : "normal";
                    const transportInfo = getActiveTransportInfoForOrder(
                      o as Record<string, unknown>,
                    );
                    const partyLabel = resolveOrderCounterparty(
                      o as Record<string, unknown>,
                      partyNameById,
                    );
                    const salesPersonLabel = resolveUserDisplay(
                      o.assigned_sales_user,
                      salesUserNameById,
                    );
                    const statusRaw = deriveOrderWorkflowStatus(o) || "draft";
                    const isDraftRow = statusRaw === "draft";
                    const orderDateStr = formatDateTime(
                      o.order_date ?? o.created_at ?? o.createdAt,
                    );
                    const billingDateStr = formatDateTime(
                      o.billing_date,
                    );
                    const expectedDeliveryStr = formatDateShort(
                      o.expected_delivery_date,
                    );

                    return (
                      <tr
                        key={id || ref}
                        className="cursor-pointer transition-colors hover:bg-slate-50/50 dark:hover:bg-white/5"
                        onClick={() => {
                          if (id) router.push(`${portalHome}/order/${id}`);
                        }}
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-mono font-bold">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (id) setViewOrderId(id);
                            }}
                            className="font-bold text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            {ref}
                          </button>
                          {(showDueSheetBadge || showFlagBadge) && (
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              {showDueSheetBadge && (
                                <OrderDueSheetBadge
                                  uploaded={o.due_sheet_uploaded}
                                />
                              )}
                              {showFlagBadge && (
                                <OrderFlagBadge
                                  orderId={o._id || o.id}
                                  department={flagDepartment}
                                />
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="break-words font-semibold text-slate-800 dark:text-slate-200">
                            {partyLabel}
                          </span>
                          {checkOrderPartySra(
                            o as Record<string, unknown>,
                            partySraById,
                          ) && (
                            <span className="ml-1.5 inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-2xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/10 dark:bg-emerald-500/10 dark:text-emerald-400">
                              SRA
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="break-words font-medium text-slate-700 dark:text-slate-300">
                            {salesPersonLabel}
                          </span>
                        </td>
                        {showPricing && (
                          <td className="whitespace-nowrap px-4 py-3 font-bold tabular-nums text-slate-900 dark:text-slate-50">
                            ₹{formatMoney(Number.isFinite(total) ? total : 0)}
                          </td>
                        )}
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-500 dark:text-slate-400">
                          {orderDateStr}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-500 dark:text-slate-400">
                          {billingDateStr}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-500 dark:text-slate-400">
                          {expectedDeliveryStr}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {renderPriorityBadge(pri)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {id && (
                            transportInfo?.agentName || transportInfo?.scheduledDate ? (
                              <div className="inline-flex flex-col items-start text-3xs font-medium text-amber-700 bg-amber-50/70 border border-amber-200/50 rounded px-1.5 py-0.5 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30 text-left shrink-0">
                                {transportInfo.agentName && (
                                  <span className="truncate max-w-[120px]" title={transportInfo.agentName}>
                                    Agent: <b>{transportInfo.agentName}</b>
                                  </span>
                                )}
                                {transportInfo.scheduledDate && (
                                  <span>
                                    Date: <b>{formatDateShort(transportInfo.scheduledDate)}</b>
                                  </span>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTransportPlanOrderId(id);
                                }}
                                className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-1 font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-400 dark:hover:bg-blue-950/40"
                                title="Transport Plan"
                              >
                                <Truck className="h-3.5 w-3.5" />
                                <span>Plan</span>
                              </button>
                            )
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {isPendingTab
                            ? renderPendingApprovalBadge(o)
                            : renderWorkflowStatusBadge(
                                ((o as { workflow_tab?: string }).workflow_tab as
                                  | OrderWorkflowTabCategory
                                  | "draft"
                                  | undefined) ||
                                  (includeDraftTab ? "draft" : "open_dispatched"),
                              )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (id) setViewOrderId(id);
                              }}
                              className="rounded border border-slate-200 px-2 py-1 font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                            >
                              View
                            </button>
                            {allowDraftDelete && isDraftRow && id && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteTarget({ id, label: ref });
                                }}
                                disabled={isDeletingOrder}
                                className="inline-flex cursor-pointer items-center justify-center rounded border border-slate-200 p-1 text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:border-white/10 dark:text-rose-400 dark:hover:bg-rose-950/30"
                                title="Delete Draft Order"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {hasAction("unbilled") && (
        <UnbilledOrdersModal
          isOpen={isUnbilledOrdersOpen}
          onClose={() => setIsUnbilledOrdersOpen(false)}
          orders={bulkOrders}
          categoryOptions={categoryOptions}
          partyNameById={partyNameById}
          portalBasePath={portalHome}
        />
      )}

      {hasAction("sheet") &&
        sheetPortal &&
        (useSuperAdminSheet ? (
          <SuperAdminOrdersSheetModal
            isOpen={isSheetOpen}
            onClose={() => setIsSheetOpen(false)}
            partyNameById={partyNameById}
            config={config}
            orders={bulkOrders}
            categoryOptions={categoryOptions}
            isOrdersFetching={bulkQ.isFetching || bulkQ.isLoading}
            onRefetchOrders={() => void bulkQ.refetch()}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            activeTab={processStage}
            onActiveTabChange={(tab) => {
              router.push(`${portalHome}/orders/${tab}`);
            }}
            priorityFilter={priorityFilter}
            onPriorityFilterChange={setPriorityFilter}
            dateFilter={dateFilter}
            onDateFilterChange={handleDateFilterChange}
            customDateFrom={customDateFrom}
            onCustomDateFromChange={handleCustomDateFromChange}
            customDateTo={customDateTo}
            onCustomDateToChange={handleCustomDateToChange}
            showReset={showReset}
            onResetFilters={handleResetFilters}
          />
        ) : (
          <GoogleSheetOrdersModal
            isOpen={isSheetOpen}
            onClose={() => setIsSheetOpen(false)}
            partyNameById={partyNameById}
            config={config}
            orders={bulkOrders}
            categoryOptions={categoryOptions}
            isOrdersFetching={bulkQ.isFetching || bulkQ.isLoading}
            onRefetchOrders={() => void bulkQ.refetch()}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            activeTab={processStage}
            onActiveTabChange={(tab) => {
              router.push(`${portalHome}/orders/${tab}`);
            }}
            priorityFilter={priorityFilter}
            onPriorityFilterChange={setPriorityFilter}
            dateFilter={dateFilter}
            customDateFrom={customDateFrom}
            customDateTo={customDateTo}
            showReset={showReset}
            onResetFilters={handleResetFilters}
          />
        ))}

      {hasAction("analytics") && sheetPortal && (
        <GoogleSheetAnalyticsModal
          isOpen={isAnalyticsOpen}
          onClose={() => setIsAnalyticsOpen(false)}
          partyNameById={partyNameById}
          portal={sheetPortal === "super_admin" ? "super_admin" : sheetPortal}
        />
      )}

      {viewOrderId && (
        <OrderDetailModal
          orderId={viewOrderId}
          partyNameById={partyNameById}
          onClose={() => setViewOrderId(null)}
        />
      )}

      {transportPlanOrderId && selectedTransportOrder && (
        <TransportPlanModal
          isOpen={!!transportPlanOrderId}
          onClose={() => setTransportPlanOrderId(null)}
          orderId={transportPlanOrderId}
          orderNo={
            typeof selectedTransportOrder.order_no === "string"
              ? selectedTransportOrder.order_no
              : typeof selectedTransportOrder.order_number === "string"
                ? selectedTransportOrder.order_number
                : transportPlanOrderId.slice(0, 8)
          }
          custLabel={resolveOrderCounterparty(
            selectedTransportOrder as Record<string, unknown>,
            partyNameById,
          )}
        />
      )}
    </div>
  );
}
