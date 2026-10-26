"use client";

import { LargeModalPortal } from "@/components/portal/shared/ui/modals/LargeModalPortal";
import { MapPin } from "lucide-react";

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  detail: any;
  createdBy: string;
  resolveUser: (userVal: unknown) => { name: string; phone: string };
  activeTransportInfo?: { agentName?: string; scheduledDate?: string } | null;
  onEditAddress?: () => void;
}

function formatDate(v: unknown): string {
  if (v == null || v === "") return "—";
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
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

export default function OrderDetailsModal({
  isOpen,
  onClose,
  detail,
  createdBy,
  resolveUser,
  activeTransportInfo,
  onEditAddress,
}: OrderDetailsModalProps) {
  if (!isOpen || !detail) return null;

  return (
    <LargeModalPortal>
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-slate-900 transition-all max-h-[85vh] flex flex-col font-sans">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/5">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            Order Details
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md text-slate-400 hover:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 p-1 cursor-pointer"
          >
            <span className="sr-only">Close</span>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="mt-4 overflow-y-auto flex-1 pr-1">
          <dl className="grid gap-3 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-slate-500">Order No</dt>
              <dd className="mt-0.5 font-mono font-semibold text-slate-900 dark:text-slate-100">
                {String(detail.order_no ?? "—")}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Priority</dt>
              <dd className="mt-0.5 capitalize font-semibold text-slate-900 dark:text-slate-100">
                {typeof detail.priority === "string" ? detail.priority : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Order Date</dt>
              <dd className="mt-0.5 text-slate-900 dark:text-slate-100">
                {formatDate(detail.order_date)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Expected Delivery</dt>
              <dd className="mt-0.5 text-slate-900 dark:text-slate-100">
                {formatDate(detail.expected_delivery_date)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Created By</dt>
              <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                {createdBy}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Created On</dt>
              <dd className="mt-0.5 text-slate-900 dark:text-slate-100">
                {formatDate(detail.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Last Modified</dt>
              <dd className="mt-0.5 text-slate-900 dark:text-slate-100">
                {formatDate(detail.updatedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Assigned Sales</dt>
              <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                {resolveUser(detail.assigned_sales_user).name}
                {resolveUser(detail.assigned_sales_user).phone && (
                  <span className="ml-1 text-slate-500 dark:text-slate-400 font-normal">
                    ({resolveUser(detail.assigned_sales_user).phone})
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Assigned Admin</dt>
              <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                {resolveUser(detail.assigned_admin_user).name}
                {resolveUser(detail.assigned_admin_user).phone && (
                  <span className="ml-1 text-slate-500 dark:text-slate-400 font-normal">
                    ({resolveUser(detail.assigned_admin_user).phone})
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Assigned Finance</dt>
              <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                {resolveUser(detail.assigned_finance_user).name}
                {resolveUser(detail.assigned_finance_user).phone && (
                  <span className="ml-1 text-slate-500 dark:text-slate-400 font-normal">
                    ({resolveUser(detail.assigned_finance_user).phone})
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Assigned Account</dt>
              <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                {resolveUser(detail.assigned_account_user).name}
                {resolveUser(detail.assigned_account_user).phone && (
                  <span className="ml-1 text-slate-500 dark:text-slate-400 font-normal">
                    ({resolveUser(detail.assigned_account_user).phone})
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Assigned Dispatch</dt>
              <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                {resolveUser(detail.assigned_dispatch_user).name}
                {resolveUser(detail.assigned_dispatch_user).phone && (
                  <span className="ml-1 text-slate-500 dark:text-slate-400 font-normal">
                    ({resolveUser(detail.assigned_dispatch_user).phone})
                  </span>
                )}
              </dd>
            </div>
            {activeTransportInfo?.agentName || activeTransportInfo?.scheduledDate ? (
              <>
                <div>
                  <dt className="text-xs font-medium text-slate-500">Transport Agent</dt>
                  <dd className="mt-0.5 font-semibold text-blue-700 dark:text-blue-400">
                    {activeTransportInfo.agentName || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">Scheduled Dispatch Date</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                    {activeTransportInfo.scheduledDate ? formatDate(activeTransportInfo.scheduledDate) : "—"}
                  </dd>
                </div>
              </>
            ) : null}
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-slate-500">Remarks</dt>
              <dd className="mt-0.5 min-h-[32px] whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-slate-900 dark:bg-slate-900/40 dark:text-slate-100">
                {typeof detail.remarks === "string" && detail.remarks.trim()
                  ? detail.remarks
                  : "—"}
              </dd>
            </div>

            <div className="sm:col-span-2 pt-2 border-t border-slate-100 dark:border-white/5">
              <div className="flex items-center justify-between mb-2">
                <dt className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Order Billing & Shipping Addresses (Snapshot)
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
                  <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Billing Address</div>
                  <div className="whitespace-pre-line text-slate-600 dark:text-slate-400">
                    {formatAddress(detail.billing_address || detail.party?.billing_address || detail.customer?.billing_address)}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-900/40 p-3 border border-slate-100 dark:border-white/5">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Shipping / Delivery Address</div>
                  {(detail.shipping_address?.recipient_name || detail.shipping_address?.phone) && (
                    <div className="text-2xs font-semibold text-blue-600 dark:text-blue-400">
                      Contact: {detail.shipping_address.recipient_name} {detail.shipping_address.phone ? `(${detail.shipping_address.phone})` : ""}
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

        <div className="mt-5 flex justify-end border-t border-slate-100 pt-3 dark:border-white/5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-100 dark:hover:bg-white/5 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
    </LargeModalPortal>
  );
}
