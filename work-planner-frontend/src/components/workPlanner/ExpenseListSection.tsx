"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, CheckCircle, XCircle, Paperclip, Eye } from "lucide-react";
import { resolvePublicAssetUrl, withFileAccessToken } from "@/lib/env";
import { toast } from "sonner";
import {
  useAddExpenseMutation,
  useUpdateExpenseMutation,
  useRemoveExpenseMutation,
  useSubmitExpenseMutation,
  useApproveExpenseMutation,
  useRejectExpenseMutation,
  useSubmitAllExpensesMutation,
  useApproveAllExpensesMutation,
  useRejectAllExpensesMutation,
} from "@/store/api/workPlannerApiSlice";
import { isWpElevated, readSessionFromStorage } from "@/utils/authStorage";
import type { WorkPlanExpenseRecord, WorkPlanRecord, WorkPlanExpenseAttachment } from "@/types/workPlanner";
import { ExpenseFormModal, type ExpenseFormPayload } from "./ExpenseFormModal";
import { RejectExpenseModal } from "./RejectExpenseModal";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import { FilePreviewModal, useFilePreview } from "./FilePreviewModal";
import { canAddExpenseForPlanDate, expenseAddWindowHint, formatPlanDate } from "./workPlanUtils";

export type ExpenseListSectionProps = {
  plan: WorkPlanRecord;
  isManager?: boolean;
  onRefresh?: () => void | Promise<void>;
};

function formatMoney(n?: number) {
  const v = Number(n) || 0;
  return v.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function statusBadge(status?: string) {
  const s = status || "draft";
  const styles: Record<string, string> = {
    draft: "bg-surface-muted text-muted",
    submitted: "bg-primary/10 text-primary",
    approved: "bg-emerald-500/10 text-emerald-500",
    rejected: "bg-rose-500/10 text-rose-500",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${styles[s] || styles.draft}`}
    >
      {s === "submitted" ? "Pending Approval" : s}
    </span>
  );
}

export function ExpenseListSection({
  plan,
  isManager: isManagerProp,
  onRefresh,
}: ExpenseListSectionProps) {
  const sessionUser = readSessionFromStorage()?.user;
  const sessionToken = readSessionFromStorage()?.token;
  const isElevated = isWpElevated(sessionUser);
  const isManager = isManagerProp ?? isElevated;
  const { previewDoc, previewBlobUrl, previewLoading, openPreview, closePreview, downloadFile } =
    useFilePreview(sessionToken);
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<WorkPlanExpenseRecord | null>(null);
  const [rejectingExpense, setRejectingExpense] = useState<WorkPlanExpenseRecord | null>(null);
  const [deleteTargetExpense, setDeleteTargetExpense] = useState<WorkPlanExpenseRecord | null>(null);
  const [rejectAllOpen, setRejectAllOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [addExpenseMut] = useAddExpenseMutation();
  const [updateExpenseMut] = useUpdateExpenseMutation();
  const [removeExpenseMut] = useRemoveExpenseMutation();
  const [submitExpenseMut] = useSubmitExpenseMutation();
  const [approveExpenseMut] = useApproveExpenseMutation();
  const [rejectExpenseMut] = useRejectExpenseMutation();
  const [submitAllExpensesMut] = useSubmitAllExpensesMutation();
  const [approveAllExpensesMut] = useApproveAllExpensesMutation();
  const [rejectAllExpensesMut] = useRejectAllExpensesMutation();

  const expenses = plan.expenses || [];
  const planId = plan._id || plan.id || "";
  const visits = plan.visits || [];

  const isPlanCompleted = plan.status === "completed";
  const windowOpen = isElevated || canAddExpenseForPlanDate(plan.plan_date);
  const windowHint = isElevated
    ? "Elevated Authority: You can add and edit expense claims anytime for yourself and subordinates without date restrictions."
    : expenseAddWindowHint(plan.plan_date);

  const draftCount = expenses.filter((e) => e.status === "draft" || e.status === "rejected").length;
  const submittedCount = expenses.filter((e) => e.status === "submitted").length;

  async function handleAddOrUpdate(payload: ExpenseFormPayload) {
    setLoading(true);
    try {
      if (editingExpense) {
        await updateExpenseMut({
          planId,
          expenseId: editingExpense._id || editingExpense.id || "",
          body: payload,
        }).unwrap();
        toast.success("Expense updated successfully");
      } else {
        await addExpenseMut({ planId, body: payload }).unwrap();
        toast.success("Expense claim added successfully");
      }
      setFormOpen(false);
      setEditingExpense(null);
      await onRefresh?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save expense";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleDelete(exp: WorkPlanExpenseRecord) {
    const id = exp._id || exp.id;
    if (!id) return;
    setDeleteTargetExpense(exp);
  }

  async function handleConfirmDelete() {
    if (!deleteTargetExpense) return;
    const id = deleteTargetExpense._id || deleteTargetExpense.id;
    if (!id) return;

    setLoading(true);
    try {
      await removeExpenseMut({ planId, expenseId: id }).unwrap();
      toast.success("Expense claim deleted");
      setDeleteTargetExpense(null);
      await onRefresh?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete expense";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitSingle(exp: WorkPlanExpenseRecord) {
    const id = exp._id || exp.id;
    if (!id) return;

    setLoading(true);
    try {
      await submitExpenseMut({ planId, expenseId: id }).unwrap();
      toast.success("Expense submitted for manager approval");
      await onRefresh?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit expense";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitAll() {
    setLoading(true);
    try {
      await submitAllExpensesMut({ planId }).unwrap();
      toast.success("All draft expenses submitted for approval");
      await onRefresh?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit all expenses";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveSingle(exp: WorkPlanExpenseRecord) {
    const id = exp._id || exp.id;
    if (!id) return;

    setLoading(true);
    try {
      await approveExpenseMut({ planId, expenseId: id }).unwrap();
      toast.success("Expense approved");
      await onRefresh?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to approve expense";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleRejectSingle(reason: string) {
    if (!rejectingExpense) return;
    const id = rejectingExpense._id || rejectingExpense.id;
    if (!id) return;

    setLoading(true);
    try {
      await rejectExpenseMut({ planId, expenseId: id, rejection_reason: reason }).unwrap();
      toast.success("Expense rejected");
      setRejectingExpense(null);
      await onRefresh?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reject expense";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveAll() {
    setLoading(true);
    try {
      await approveAllExpensesMut({ planId }).unwrap();
      toast.success("All submitted expenses approved");
      await onRefresh?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to approve expenses";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleRejectAll(reason: string) {
    setLoading(true);
    try {
      await rejectAllExpensesMut({ planId, rejection_reason: reason }).unwrap();
      toast.success("All submitted expenses rejected");
      setRejectAllOpen(false);
      await onRefresh?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reject expenses";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Expense Claims ({expenses.length})
          </h3>
          <p className="text-xs text-muted">
            Total Claimed: ₹{formatMoney(plan.expense_total)} · Approved: ₹{formatMoney(plan.expense_approved_total)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted font-medium">
            ℹ️ {windowHint}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {draftCount > 0 && (windowOpen || isManager) ? (
            <button
              type="button"
              disabled={loading}
              onClick={handleSubmitAll}
              className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition"
            >
              Submit All Claims ({draftCount})
            </button>
          ) : null}

          {isManager && submittedCount > 0 ? (
            <>
              <button
                type="button"
                disabled={loading}
                onClick={handleApproveAll}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Approve All ({submittedCount})
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => setRejectAllOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition"
              >
                <XCircle className="h-3.5 w-3.5" />
                Reject All ({submittedCount})
              </button>
            </>
          ) : null}

          <button
            type="button"
            disabled={!windowOpen}
            title={!windowOpen ? windowHint : "Add expense claim"}
            onClick={() => {
              if (!windowOpen) return;
              setEditingExpense(null);
              setFormOpen(true);
            }}
            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              windowOpen
                ? "bg-primary text-primary-foreground hover:bg-primary-hover"
                : "bg-surface-muted border border-border text-muted cursor-not-allowed"
            }`}
          >
            <Plus className="h-4 w-4" />
            Add Expense Claim
          </button>
        </div>
      </div>

      {expenses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium text-muted">
            No expenses logged for this work plan.
          </p>
          {windowOpen && (
            <button
              type="button"
              onClick={() => {
                setEditingExpense(null);
                setFormOpen(true);
              }}
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              + Add first expense claim
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {/* Mobile Card View (< md) */}
          <div className="md:hidden divide-y divide-border">
            {expenses.map((exp) => {
              const id = exp._id || exp.id || "";
              const isDraft = exp.status === "draft" || exp.status === "rejected";
              const isSubmitted = exp.status === "submitted";
              const isBike = exp.category === "Travel" && exp.sub_category === "Private Bike";

              const attList: (WorkPlanExpenseAttachment | string)[] = [];
              if (Array.isArray(exp.attachments) && exp.attachments.length > 0) {
                attList.push(...exp.attachments);
              } else if (exp.receipt_attachment) {
                attList.push(exp.receipt_attachment);
              }

              return (
                <div key={id} className="p-4 space-y-2.5 hover:bg-surface-muted/30 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-foreground">
                          {exp.category}
                        </span>
                        {exp.sub_category && (
                          <span className="text-[11px] text-muted">
                            • {exp.sub_category}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
                        <span>{formatPlanDate(exp.expense_date)}</span>
                        {exp.payment_mode && (
                          <>
                            <span>•</span>
                            <span>{exp.payment_mode}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-extrabold tabular-nums text-foreground">
                        ₹{formatMoney(exp.amount)}
                      </div>
                      <div className="mt-0.5">{statusBadge(exp.status)}</div>
                    </div>
                  </div>

                  {/* Bike KM info */}
                  {isBike && exp.start_reading != null && exp.closing_reading != null && (
                    <div className="rounded-lg bg-surface-muted p-2 text-[11px] text-primary font-medium">
                      🏍️ Bike Odometer: {exp.start_reading} → {exp.closing_reading} KM ({Math.max(0, exp.closing_reading - exp.start_reading)} KM @ ₹3.5/km)
                    </div>
                  )}

                  {/* Vendor & Bill details */}
                  {(exp.vendor_name || exp.bill_number) && (
                    <div className="text-xs text-muted">
                      {exp.vendor_name && <span className="font-medium text-foreground">{exp.vendor_name}</span>}
                      {exp.bill_number && <span className="ml-1.5 text-[11px] text-muted">• Bill: {exp.bill_number}</span>}
                    </div>
                  )}

                  {/* Description */}
                  {exp.description && (
                    <p className="text-xs text-muted leading-relaxed">
                      {exp.description}
                    </p>
                  )}

                  {/* Rejection Reason */}
                  {exp.rejection_reason && (
                    <div className="rounded-lg bg-rose-500/10 p-2 text-xs text-rose-500">
                      <strong>Rejection Reason:</strong> {exp.rejection_reason}
                    </div>
                  )}

                  {/* Attachments / Receipts */}
                  {attList.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {attList.map((att, attIdx) => {
                        const attObj = typeof att === "object" && att !== null ? (att as any) : null;
                        const rawUrl =
                          attObj
                            ? attObj.url || (attObj._id ? `/api/work-planner/attachments/${attObj._id}/view` : "") || (attObj.id ? `/api/work-planner/attachments/${attObj.id}/view` : "") || (attObj.storage_path || "")
                            : typeof att === "string"
                            ? att
                            : "";
                        const docName =
                          attObj
                            ? attObj.original_name || attObj.file_name || `Receipt #${attIdx + 1}`
                            : `Receipt #${attIdx + 1}`;
                        const mimeType = attObj ? attObj.mime_type || "" : "";
                        const baseUrl = rawUrl ? resolvePublicAssetUrl(rawUrl, sessionToken) : "#";
                        const fullUrl = withFileAccessToken(baseUrl, sessionToken);
                        return (
                          <div key={attIdx} className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                openPreview({
                                  name: docName,
                                  url: fullUrl,
                                  mime: mimeType,
                                })
                              }
                              className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition cursor-pointer"
                            >
                              <Eye className="h-3 w-3" />
                              <span>{docName}</span>
                            </button>
                            <a
                              href={fullUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 text-muted hover:text-foreground"
                            >
                              <Paperclip className="h-3 w-3" />
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Mobile Actions Toolbar */}
                  <div className="flex flex-wrap items-center justify-end gap-1.5 pt-2 border-t border-border">
                    {isManager && isSubmitted ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleApproveSingle(exp)}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectingExpense(exp)}
                          className="rounded-lg bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/20 transition"
                        >
                          Reject
                        </button>
                      </>
                    ) : null}

                    {isDraft && (windowOpen || isManager) ? (
                      <button
                        type="button"
                        onClick={() => handleSubmitSingle(exp)}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover transition"
                      >
                        Submit Claim
                      </button>
                    ) : null}

                    {(isDraft && windowOpen) || isManager ? (
                      <div className="flex items-center gap-1 ml-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingExpense(exp);
                            setFormOpen(true);
                          }}
                          className="rounded-lg border border-border p-2 text-muted hover:bg-surface-muted hover:text-foreground transition"
                          title="Edit expense"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(exp)}
                          className="rounded-lg border border-rose-500/30 p-2 text-rose-500 hover:bg-rose-500/10 transition"
                          title="Delete expense"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-surface-muted font-medium text-muted">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Sub-Category</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Payment Mode</th>
                  <th className="px-4 py-3">Vendor / Bill</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {expenses.map((exp) => {
                  const id = exp._id || exp.id || "";
                  const isDraft = exp.status === "draft" || exp.status === "rejected";
                  const isSubmitted = exp.status === "submitted";

                  return (
                    <tr key={id} className="hover:bg-surface-muted/50 transition">
                      <td className="px-4 py-3 font-medium whitespace-nowrap">
                        {formatPlanDate(exp.expense_date)}
                      </td>
                      <td className="px-4 py-3 font-semibold">{exp.category}</td>
                      <td className="px-4 py-3 text-muted">
                        <div className="font-medium text-foreground">{exp.sub_category || "—"}</div>
                        {exp.category === "Travel" && exp.sub_category === "Private Bike" ? (
                          <div className="mt-0.5 text-[10px] text-primary font-medium">
                            {exp.start_reading ?? "—"} → {exp.closing_reading ?? "—"} KM
                            {exp.start_reading != null && exp.closing_reading != null ? (
                              <span className="ml-1 text-muted">
                                ({Math.max(0, exp.closing_reading - exp.start_reading)} KM @ ₹3.5/km)
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-bold tabular-nums text-foreground">
                        ₹{formatMoney(exp.amount)}
                      </td>
                      <td className="px-4 py-3 text-muted">{exp.payment_mode}</td>
                      <td className="px-4 py-3">
                        <div>{exp.vendor_name || "—"}</div>
                        {exp.bill_number ? (
                          <div className="text-[10px] text-muted">Bill: {exp.bill_number}</div>
                        ) : null}
                        {(() => {
                          const attList: (WorkPlanExpenseAttachment | string)[] = [];
                          if (Array.isArray(exp.attachments) && exp.attachments.length > 0) {
                            attList.push(...exp.attachments);
                          } else if (exp.receipt_attachment) {
                            attList.push(exp.receipt_attachment);
                          }

                          if (attList.length === 0) return null;

                          return (
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              {attList.map((att, attIdx) => {
                                const attObj = typeof att === "object" && att !== null ? (att as any) : null;
                                const rawUrl =
                                  attObj
                                    ? attObj.url || (attObj._id ? `/api/work-planner/attachments/${attObj._id}/view` : "") || (attObj.id ? `/api/work-planner/attachments/${attObj.id}/view` : "") || (attObj.storage_path || "")
                                    : typeof att === "string"
                                    ? att
                                    : "";
                                const docName =
                                  attObj
                                    ? attObj.original_name || attObj.file_name || `Receipt #${attIdx + 1}`
                                    : `Receipt #${attIdx + 1}`;
                                const mimeType = attObj ? attObj.mime_type || "" : "";
                                const baseUrl = rawUrl ? resolvePublicAssetUrl(rawUrl, sessionToken) : "#";
                                const fullUrl = withFileAccessToken(baseUrl, sessionToken);
                                return (
                                  <div key={attIdx} className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openPreview({
                                          name: docName,
                                          url: fullUrl,
                                          mime: mimeType,
                                        })
                                      }
                                      className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/20 transition cursor-pointer"
                                      title="Preview document"
                                    >
                                      <Eye className="h-3 w-3" />
                                      {docName}
                                    </button>
                                    <a
                                      href={fullUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-muted hover:text-foreground transition p-0.5"
                                      title="Open in new tab"
                                    >
                                      <Paperclip className="h-3 w-3" />
                                    </a>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        {statusBadge(exp.status)}
                        {exp.rejection_reason ? (
                          <div className="mt-0.5 text-[10px] text-rose-500">
                            Reason: {exp.rejection_reason}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {isManager && isSubmitted ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApproveSingle(exp)}
                                className="rounded px-2 py-1 text-xs font-semibold text-emerald-500 hover:bg-emerald-500/10 transition"
                                title="Approve expense"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => setRejectingExpense(exp)}
                                className="rounded px-2 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition"
                                title="Reject expense"
                              >
                                Reject
                              </button>
                            </>
                          ) : null}

                          {isDraft && (windowOpen || isManager) ? (
                            <button
                              type="button"
                              onClick={() => handleSubmitSingle(exp)}
                              className="rounded px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10 transition"
                              title="Submit expense for approval"
                            >
                              Submit
                            </button>
                          ) : null}

                          {(isDraft && windowOpen) || isManager ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingExpense(exp);
                                  setFormOpen(true);
                                }}
                                className="rounded p-1 text-muted hover:bg-surface-muted hover:text-foreground transition"
                                title="Edit expense"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(exp)}
                                className="rounded p-1 text-muted hover:bg-rose-500/10 hover:text-rose-500 transition"
                                title="Delete expense"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {formOpen ? (
        <ExpenseFormModal
          open={formOpen}
          isSaving={loading}
          visits={visits}
          initial={editingExpense}
          defaultDate={plan.plan_date}
          onClose={() => {
            setFormOpen(false);
            setEditingExpense(null);
          }}
          onConfirm={handleAddOrUpdate}
        />
      ) : null}

      {rejectingExpense ? (
        <RejectExpenseModal
          open={Boolean(rejectingExpense)}
          isRejecting={loading}
          onClose={() => setRejectingExpense(null)}
          onConfirm={handleRejectSingle}
        />
      ) : null}

      {rejectAllOpen ? (
        <RejectExpenseModal
          open={rejectAllOpen}
          isRejecting={loading}
          title="Reject all submitted expenses"
          subtitle="All pending expense claims for this work plan will be rejected."
          onClose={() => setRejectAllOpen(false)}
          onConfirm={handleRejectAll}
        />
      ) : null}

      {deleteTargetExpense && (
        <ConfirmDeleteModal
          open={Boolean(deleteTargetExpense)}
          title="Delete Expense Claim"
          description={`Are you sure you want to delete this expense claim (${deleteTargetExpense.category || "Expense"} - ${formatMoney(deleteTargetExpense.amount)})? This action cannot be undone.`}
          confirmLabel="Delete"
          isDeleting={loading}
          onClose={() => {
            if (!loading) setDeleteTargetExpense(null);
          }}
          onConfirm={handleConfirmDelete}
        />
      )}

      <FilePreviewModal
        doc={previewDoc}
        blobUrl={previewBlobUrl}
        loading={previewLoading}
        onClose={closePreview}
        onDownload={downloadFile}
      />
    </div>
  );
}

export default ExpenseListSection;
