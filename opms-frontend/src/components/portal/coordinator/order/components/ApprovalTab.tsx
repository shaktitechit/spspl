"use client";

import { useMemo, useState, useCallback } from "react";
import { Clock } from "lucide-react";
import {
  useListOrderApprovalsQuery,
  useListUsersQuery,
  useListDispatchesQuery,
} from "@/store/api";
import { useAppSelector } from "@/store";
import { hasOpmsRole } from "@/lib/opmsAuth";
import { DashboardCard } from "@/components/widgets";
import { ApprovalRecordCard } from "@/components/portal/shared/orders/detail/approvals/ApprovalRecordCard";
import { ApprovalModal } from "@/components/portal/shared/orders/detail/modals/ApprovalModal";
import { buildUserRoleById } from "@/components/portal/shared/lib/userDisplay";

type ApprovalTabProps = {
  orderId: string;
  detail: Record<string, unknown> | null;
  partyLabel?: string;
  isDraft?: boolean;
  onSubmitOrder?: () => void;
  onRefetch?: () => void;
};

function pickList(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.items)) return o.items as Record<string, unknown>[];
    if (Array.isArray(o.data)) return o.data as Record<string, unknown>[];
  }
  return [];
}

export function ApprovalTab({
  orderId,
  detail,
  partyLabel = "—",
  isDraft = false,
  onSubmitOrder,
  onRefetch,
}: ApprovalTabProps) {
  const currentUser = useAppSelector((state) => state.auth.user);
  const isSuperAdmin = hasOpmsRole(currentUser, "super_admin");

  const approvalsQ = useListOrderApprovalsQuery({ order: orderId }, { skip: !orderId });
  const usersQ = useListUsersQuery({});
  const dispatchesQ = useListDispatchesQuery({ order: orderId }, { skip: !orderId });

  const [amendApprovalId, setAmendApprovalId] = useState<string | null>(null);
  const [isAmendModalOpen, setIsAmendModalOpen] = useState(false);

  const hasActiveDispatch = useMemo(() => {
    const list = pickList(dispatchesQ?.data);
    return list.some(
      (d) => String(d.dispatch_status).toLowerCase() !== "cancelled"
    );
  }, [dispatchesQ.data]);

  const approvals = useMemo(() => {
    const rows = pickList(approvalsQ.data);
    return [...rows].sort(
      (a, b) => Number(b.revision_number ?? 0) - Number(a.revision_number ?? 0)
    );
  }, [approvalsQ.data]);

  const selectedApproval = useMemo(
    () =>
      amendApprovalId
        ? (approvals.find(
            (app) => String(app._id ?? app.id) === amendApprovalId
          ) ?? null)
        : null,
    [approvals, amendApprovalId]
  );

  const openAmendModal = useCallback((approvalId: string) => {
    setAmendApprovalId(approvalId);
    setIsAmendModalOpen(true);
  }, []);

  const handleAmended = useCallback(async () => {
    const tasks: Promise<unknown>[] = [];
    if (onRefetch) {
      const res = onRefetch() as unknown;
      if (res instanceof Promise) tasks.push(res);
    }
    if (!approvalsQ.isUninitialized) {
      tasks.push(approvalsQ.refetch() as Promise<unknown>);
    }
    if (tasks.length > 0) await Promise.all(tasks);
  }, [onRefetch, approvalsQ]);

  const userNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of pickList(usersQ.data)) {
      const id = String(u._id ?? u.id ?? "");
      if (id) map[id] = String(u.name || u.username || id);
    }
    return map;
  }, [usersQ.data]);

  const userRoleById = useMemo(() => buildUserRoleById(usersQ.data), [usersQ.data]);

  const orderNo = String(detail?.order_no ?? orderId);
  const readOnlyItems = useMemo(() => {
    return Array.isArray(detail?.order_items)
      ? (detail.order_items as Record<string, unknown>[])
      : [];
  }, [detail?.order_items]);

  return (
    <div className="space-y-4">
      <DashboardCard
        title="Order Approval History"
        description="View administrative, financial, account sign-offs, and coordinator amendments for this order with pricing, item rates, and financial totals."
      >
        {hasActiveDispatch && !isSuperAdmin && (
          <div className="mb-4 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-500/30">
            Amendment is locked because a dispatch execution has already been initiated for this order.
          </div>
        )}

        {approvalsQ.isLoading ? (
          <div className="flex items-center gap-2 text-xs font-sans text-slate-500 py-6">
            <svg className="animate-spin h-4 w-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Loading approval history…</span>
          </div>
        ) : approvalsQ.isError ? (
          <p className="text-xs font-sans text-rose-600 dark:text-rose-400 py-6">
            Could not load approvals for this order. Please refresh the page or try again.
          </p>
        ) : approvals.length === 0 ? (
          isDraft ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 mb-2">
                <Clock className="h-6 w-6" />
              </div>
              <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                Draft Order — Not Yet Submitted
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                This order was saved as a draft and has not been submitted for approval yet. Submit the order to begin the approval process.
              </p>
              {onSubmitOrder && (
                <button
                  type="button"
                  onClick={onSubmitOrder}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition active:scale-[0.98] cursor-pointer dark:bg-emerald-500 dark:hover:bg-emerald-400"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Submit Order</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700" />
              <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-200">
                No approval revisions found
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                Approval revisions will appear here once the order is reviewed and signed off by the Admin department.
              </p>
            </div>
          )
        ) : (
          <div className="space-y-6">
            {approvals.map((app) => (
              <ApprovalRecordCard
                key={String(app._id ?? app.id)}
                portal="coordinator"
                approval={app}
                orderNo={orderNo}
                partyLabel={partyLabel}
                orderDate={detail?.order_date}
                expectedDeliveryDate={detail?.expected_delivery_date}
                userNameById={userNameById}
                userRoleById={userRoleById}
                onAmend={openAmendModal}
                amendingApprovalId={amendApprovalId}
                isAmendBlocked={hasActiveDispatch && !isSuperAdmin}
              />
            ))}
          </div>
        )}
      </DashboardCard>

      <ApprovalModal
        key={amendApprovalId || (isAmendModalOpen ? "coordinator-open" : "closed")}
        open={isAmendModalOpen}
        onClose={() => {
          setIsAmendModalOpen(false);
          setAmendApprovalId(null);
        }}
        mode="coordinator"
        approval={selectedApproval}
        orderId={orderId}
        orderStatus={String(detail?.status ?? "")}
        readOnlyItems={readOnlyItems}
        refetchOrder={onRefetch}
        detail={detail}
        onSuccess={() => void handleAmended()}
      />
    </div>
  );
}

export default ApprovalTab;
