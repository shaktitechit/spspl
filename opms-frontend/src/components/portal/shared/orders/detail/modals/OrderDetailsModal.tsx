"use client";

import { useState, useEffect, useMemo } from "react";
import { LargeModalPortal } from "@/components/portal/shared/ui/modals/LargeModalPortal";
import { MapPin, Pencil, X, Check, Loader2, Lock } from "lucide-react";
import { usePatchOrderMutation, useListUsersQuery } from "@/store/api";
import { toast } from "@/lib/toast";
import { useAppSelector } from "@/store";
import { hasOpmsRole, isOpmsAdmin, primaryOpmsRole } from "@/lib/opmsAuth";
import { usePathname } from "next/navigation";

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  detail: any;
  createdBy: string;
  resolveUser: (userVal: unknown) => { name: string; phone: string };
  activeTransportInfo?: { agentName?: string; scheduledDate?: string } | null;
  onEditAddress?: () => void;
  onRefetch?: () => void;
}

function formatDate(v: unknown): string {
  if (v == null || v === "") return "—";
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
}

function toDateInputValue(v: unknown): string {
  if (v == null || v === "") return "";
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

function formatAddress(addr: unknown): string {
  if (!addr || typeof addr !== "object") return "—";
  const a = addr as Record<string, unknown>;
  const parts: string[] = [];
  if (a.address_line_1) parts.push(String(a.address_line_1).trim());
  if (a.address_line_2) parts.push(String(a.address_line_2).trim());
  const cityLine = [a.city, a.state, a.pincode]
    .map((x) => (x ? String(x).trim() : ""))
    .filter(Boolean)
    .join(", ");
  if (cityLine) parts.push(cityLine);
  if (a.country && String(a.country).trim() !== "India") {
    parts.push(String(a.country).trim());
  }
  return parts.length ? parts.join("\n") : "—";
}

function pickList(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.items)) return o.items as Record<string, unknown>[];
    if (Array.isArray(o.data)) return o.data as Record<string, unknown>[];
  }
  return [];
}

export default function OrderDetailsModal({
  isOpen,
  onClose,
  detail,
  createdBy,
  resolveUser,
  activeTransportInfo,
  onEditAddress,
  onRefetch,
}: OrderDetailsModalProps) {
  const pathname = usePathname();
  const currentUser = useAppSelector((state) => state.auth.user);
  const isAdmin = isOpmsAdmin(currentUser);
  const isCoordinator =
    hasOpmsRole(currentUser, "coordinator") ||
    primaryOpmsRole(currentUser) === "coordinator" ||
    Boolean(pathname?.includes("/portal/coordinator"));
  const isSalesPath = Boolean(pathname?.includes("/portal/sales"));
  const isSalesRole =
    !isAdmin &&
    !isCoordinator &&
    (hasOpmsRole(currentUser, "sales") ||
      primaryOpmsRole(currentUser) === "sales" ||
      currentUser?.department === "sales");
  const isSalesUser = !isAdmin && !isCoordinator && (isSalesPath || isSalesRole);
  const canEditAssignedSales = isAdmin || isCoordinator || !isSalesUser;

  const [patchOrder, { isLoading: isSaving }] = usePatchOrderMutation();
  const usersQ = useListUsersQuery({}, { skip: !isOpen });

  const [isEditing, setIsEditing] = useState(false);
  const [priority, setPriority] = useState<string>("medium");
  const [orderDate, setOrderDate] = useState<string>("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>("");
  const [assignedSalesUser, setAssignedSalesUser] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");

  useEffect(() => {
    if (detail) {
      setPriority(String(detail.priority ?? "medium").toLowerCase());
      setOrderDate(toDateInputValue(detail.order_date));
      setExpectedDeliveryDate(toDateInputValue(detail.expected_delivery_date));
      const salesId =
        typeof detail.assigned_sales_user === "object" && detail.assigned_sales_user !== null
          ? String(detail.assigned_sales_user._id ?? detail.assigned_sales_user.id ?? "")
          : String(detail.assigned_sales_user ?? "");
      setAssignedSalesUser(salesId);
      setRemarks(typeof detail.remarks === "string" ? detail.remarks : "");
    }
    setIsEditing(false);
  }, [detail, isOpen]);

  const users = useMemo(() => {
    const list = pickList(usersQ.data);
    return list.filter((u) => u.is_active !== false);
  }, [usersQ.data]);

  const createdByDisplay = useMemo(() => {
    if (detail?.created_by) {
      const res = resolveUser(detail.created_by);
      if (res && res.name && res.name !== "—") return res.name;
      if (typeof detail.created_by === "object") {
        const name = (detail.created_by as any).name || (detail.created_by as any).username;
        if (name) return String(name);
      }
    }
    return createdBy || "—";
  }, [detail?.created_by, resolveUser, createdBy]);

  const lastModifiedByDisplay = useMemo(() => {
    if (detail?.updated_by) {
      const res = resolveUser(detail.updated_by);
      if (res && res.name && res.name !== "—") return res.name;
      if (typeof detail.updated_by === "object") {
        const name = (detail.updated_by as any).name || (detail.updated_by as any).username;
        if (name) return String(name);
      }
    }
    return createdByDisplay || "—";
  }, [detail?.updated_by, resolveUser, createdByDisplay]);

  const handleCancel = () => {
    if (detail) {
      setPriority(String(detail.priority ?? "medium").toLowerCase());
      setOrderDate(toDateInputValue(detail.order_date));
      setExpectedDeliveryDate(toDateInputValue(detail.expected_delivery_date));
      const salesId =
        typeof detail.assigned_sales_user === "object" && detail.assigned_sales_user !== null
          ? String(detail.assigned_sales_user._id ?? detail.assigned_sales_user.id ?? "")
          : String(detail.assigned_sales_user ?? "");
      setAssignedSalesUser(salesId);
      setRemarks(typeof detail.remarks === "string" ? detail.remarks : "");
    }
    setIsEditing(false);
  };

  const handleSave = async () => {
    const orderId = String(detail?._id ?? detail?.id ?? "");
    if (!orderId) return;

    try {
      const payload: Record<string, unknown> = {
        priority,
        order_date: orderDate || undefined,
        expected_delivery_date: expectedDeliveryDate || undefined,
        remarks: remarks.trim(),
      };

      if (canEditAssignedSales) {
        payload.assigned_sales_user = assignedSalesUser || null;
      }

      await patchOrder({ id: orderId, patch: payload }).unwrap();
      toast.success("Order details updated successfully.");
      setIsEditing(false);
      if (onRefetch) onRefetch();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to update order details.");
    }
  };

  if (!isOpen || !detail) return null;

  return (
    <LargeModalPortal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
        <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-slate-900 transition-all max-h-[85vh] flex flex-col font-sans">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/5">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                {isEditing ? "Edit Order Details" : "Order Details"}
              </h3>
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {String(detail.order_no ?? "—")}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Edit</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="rounded-md text-slate-400 hover:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 p-1 cursor-pointer"
              >
                <span className="sr-only">Close</span>
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="mt-4 overflow-y-auto flex-1 pr-1">
            <dl className="grid gap-4 text-xs sm:grid-cols-2">
              {/* Order No */}
              <div>
                <dt className="text-xs font-medium text-slate-500">Order No</dt>
                <dd className="mt-1 font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {String(detail.order_no ?? "—")}
                </dd>
              </div>

              {/* Priority */}
              <div>
                <dt className="text-xs font-medium text-slate-500">Priority</dt>
                {isEditing ? (
                  <dd className="mt-1">
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-white/15 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </dd>
                ) : (
                  <dd className="mt-1">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-2xs font-bold uppercase tracking-wider ${
                        String(detail.priority).toLowerCase() === "urgent"
                          ? "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20 dark:bg-rose-950/40 dark:text-rose-300"
                          : String(detail.priority).toLowerCase() === "high"
                            ? "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-300"
                            : String(detail.priority).toLowerCase() === "low"
                              ? "bg-slate-100 text-slate-700 ring-1 ring-slate-600/10 dark:bg-slate-800 dark:text-slate-300"
                              : "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 dark:bg-blue-950/40 dark:text-blue-300"
                      }`}
                    >
                      {typeof detail.priority === "string" ? detail.priority : "Medium"}
                    </span>
                  </dd>
                )}
              </div>

              {/* Order Date */}
              <div>
                <dt className="text-xs font-medium text-slate-500">Order Date</dt>
                {isEditing ? (
                  <dd className="mt-1">
                    <input
                      type="date"
                      value={orderDate}
                      onChange={(e) => setOrderDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-white/15 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </dd>
                ) : (
                  <dd className="mt-1 text-slate-900 dark:text-slate-100 font-medium">
                    {formatDate(detail.order_date)}
                  </dd>
                )}
              </div>

              {/* Expected Delivery */}
              <div>
                <dt className="text-xs font-medium text-slate-500">Expected Delivery</dt>
                {isEditing ? (
                  <dd className="mt-1">
                    <input
                      type="date"
                      value={expectedDeliveryDate}
                      onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-white/15 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </dd>
                ) : (
                  <dd className="mt-1 text-slate-900 dark:text-slate-100 font-medium">
                    {formatDate(detail.expected_delivery_date)}
                  </dd>
                )}
              </div>

              {/* Created By */}
              <div>
                <dt className="text-xs font-medium text-slate-500">Created By</dt>
                <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                  {createdByDisplay}
                </dd>
              </div>

              {/* Created On */}
              <div>
                <dt className="text-xs font-medium text-slate-500">Created On</dt>
                <dd className="mt-1 text-slate-900 dark:text-slate-100 font-medium">
                  {formatDate(detail.createdAt)}
                </dd>
              </div>

              {/* Last Modified By */}
              <div>
                <dt className="text-xs font-medium text-slate-500">Last Modified By</dt>
                <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                  {lastModifiedByDisplay}
                </dd>
              </div>

              {/* Last Modified On */}
              <div>
                <dt className="text-xs font-medium text-slate-500">Last Modified On</dt>
                <dd className="mt-1 text-slate-900 dark:text-slate-100 font-medium">
                  {formatDate(detail.updatedAt)}
                </dd>
              </div>

              {/* Assigned Sales */}
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between">
                  <dt className="text-xs font-medium text-slate-500">Assigned Sales</dt>
                  {isEditing && !canEditAssignedSales && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                      <Lock className="h-3 w-3" />
                      Locked for Sales
                    </span>
                  )}
                </div>
                {isEditing ? (
                  canEditAssignedSales ? (
                    <dd className="mt-1">
                      <select
                        value={assignedSalesUser}
                        onChange={(e) => setAssignedSalesUser(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-white/15 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="">— Unassigned —</option>
                        {users.map((u) => {
                          const id = String(u._id ?? u.id);
                          const dept =
                            typeof u.department === "object" && u.department !== null
                              ? (u.department as any).name || (u.department as any).code
                              : u.department;
                          return (
                            <option key={id} value={id}>
                              {String(u.name || u.username || id)}
                              {dept ? ` (${dept})` : ""}
                            </option>
                          );
                        })}
                      </select>
                    </dd>
                  ) : (
                    <dd className="mt-1">
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-300">
                        <span className="font-medium">
                          {resolveUser(detail.assigned_sales_user).name}
                          {resolveUser(detail.assigned_sales_user).phone && (
                            <span className="ml-1 text-slate-500 dark:text-slate-400 font-normal">
                              ({resolveUser(detail.assigned_sales_user).phone})
                            </span>
                          )}
                        </span>
                        <Lock className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                    </dd>
                  )
                ) : (
                  <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                    {resolveUser(detail.assigned_sales_user).name}
                    {resolveUser(detail.assigned_sales_user).phone && (
                      <span className="ml-1 text-slate-500 dark:text-slate-400 font-normal">
                        ({resolveUser(detail.assigned_sales_user).phone})
                      </span>
                    )}
                  </dd>
                )}
              </div>

              {/* Active Transport Info */}
              {activeTransportInfo?.agentName || activeTransportInfo?.scheduledDate ? (
                <>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Transport Agent</dt>
                    <dd className="mt-1 font-semibold text-blue-700 dark:text-blue-400">
                      {activeTransportInfo.agentName || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Scheduled Dispatch Date</dt>
                    <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                      {activeTransportInfo.scheduledDate ? formatDate(activeTransportInfo.scheduledDate) : "—"}
                    </dd>
                  </div>
                </>
              ) : null}

              {/* Remarks */}
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-slate-500">Remarks</dt>
                {isEditing ? (
                  <dd className="mt-1">
                    <textarea
                      rows={3}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Enter order remarks…"
                      className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-white/15 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </dd>
                ) : (
                  <dd className="mt-1 min-h-[32px] whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-slate-900 dark:bg-slate-900/40 dark:text-slate-100">
                    {typeof detail.remarks === "string" && detail.remarks.trim()
                      ? detail.remarks
                      : "—"}
                  </dd>
                )}
              </div>

              {/* Address Snapshot */}
              <div className="sm:col-span-2 pt-2 border-t border-slate-100 dark:border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <dt className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Order Billing &amp; Shipping Addresses (Snapshot)
                  </dt>
                  {onEditAddress && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onEditAddress();
                      }}
                      className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-2xs font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 transition cursor-pointer"
                    >
                      <MapPin className="h-3 w-3" />
                      <span>Update Address</span>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-900/40 p-3 border border-slate-100 dark:border-white/5">
                    <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      Billing Address
                    </div>
                    <div className="whitespace-pre-line text-slate-600 dark:text-slate-400">
                      {formatAddress(detail.billing_address || detail.party?.billing_address || detail.customer?.billing_address)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-900/40 p-3 border border-slate-100 dark:border-white/5">
                    <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      Shipping / Delivery Address
                    </div>
                    {(detail.shipping_address?.recipient_name || detail.shipping_address?.phone) && (
                      <div className="text-2xs font-semibold text-blue-600 dark:text-blue-400">
                        Contact: {detail.shipping_address.recipient_name}{" "}
                        {detail.shipping_address.phone ? `(${detail.shipping_address.phone})` : ""}
                      </div>
                    )}
                    {detail.shipping_address?.gst_no && (
                      <div className="text-2xs font-mono text-slate-500">
                        GSTIN: {detail.shipping_address.gst_no}
                      </div>
                    )}
                    <div className="whitespace-pre-line text-slate-600 dark:text-slate-400 mt-0.5">
                      {formatAddress(detail.shipping_address || detail.party?.shipping_address || detail.customer?.shipping_address)}
                    </div>
                  </div>
                </div>
              </div>
            </dl>
          </div>

          {/* Footer */}
          <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-white/5">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 transition cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving…</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </LargeModalPortal>
  );
}
