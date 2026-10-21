/**
 * @fileoverview Modal to assign or reassign a lead to a team member.
 * @module components/portal/shared/leads/AssignLeadModal
 */
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { UserCheck, X, Search, Mail, Building2 } from "lucide-react";
import { LargeModalPortal } from "@/components/portal/shared/LargeModalPortal";
import { ModalOverlay } from "@/components/portal/shared/ModalOverlay";
import {
  useAssignLeadMutation,
  useListUsersQuery,
  type LeadRecord,
} from "@/store/api";
import { useAppSelector } from "@/store/hooks";
import { toast } from "@/lib/toast";
import { mutationRejectedMessage } from "@/lib/mutationMessages";
import {
  canAssignLead,
  isUserInLeadManagerPortal,
  getLeadManagerPortalRole,
  getDeptLabel,
} from "./leadUtils";

type Props = {
  lead: LeadRecord;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export function AssignLeadModal({ lead, open, onClose, onSuccess }: Props) {
  const authUser = useAppSelector((state) => state.auth.user);
  const authUserId = String(authUser?._id || authUser?.id || "");

  const getInitialAssignedList = (targetLead: LeadRecord): string[] => {
    if (Array.isArray(targetLead.assigned_users) && targetLead.assigned_users.length > 0) {
      return targetLead.assigned_users.map((u) => (typeof u === "object" && u !== null ? u._id : String(u)));
    }
    if (targetLead.assigned_to) {
      const pId = typeof targetLead.assigned_to === "object" ? targetLead.assigned_to?._id : targetLead.assigned_to;
      return pId ? [String(pId)] : [];
    }
    return [];
  };

  const [assignedUsers, setAssignedUsers] = useState<string[]>(() => getInitialAssignedList(lead));
  const [notes, setNotes] = useState("");
  const [assignSearch, setAssignSearch] = useState<string>("");

  const { data: usersData, isLoading: loadingUsers } = useListUsersQuery();
  const [assignLead, { isLoading }] = useAssignLeadMutation();

  useEffect(() => {
    setAssignedUsers(getInitialAssignedList(lead));
  }, [lead]);

  const rawUsers = Array.isArray(usersData)
    ? (usersData as Array<{ _id: string; name: string; email?: string; department?: string; role?: string; portals?: Array<{ portal_code: string; access_roles?: string[] }> }>)
    : (usersData as { data?: Array<{ _id: string; name: string; email?: string; department?: string; role?: string; portals?: Array<{ portal_code: string; access_roles?: string[] }> }> })?.data || [];

  const allPortalUsers = useMemo(() => {
    const filtered = rawUsers.filter(isUserInLeadManagerPortal);
    return filtered.length > 0 ? filtered : rawUsers;
  }, [rawUsers]);

  const filteredAssignees = useMemo(() => {
    if (!assignSearch.trim()) return allPortalUsers;
    const q = assignSearch.toLowerCase().trim();
    return allPortalUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        String(u.email || "").toLowerCase().includes(q) ||
        String(u.department || "").toLowerCase().includes(q) ||
        getDeptLabel(u.department || "").toLowerCase().includes(q)
    );
  }, [allPortalUsers, assignSearch]);

  const toggleAssignedUser = (userId: string) => {
    setAssignedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  if (!open || !canAssignLead(authUser)) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (assignedUsers.length === 0) {
      toast.error("Please select at least one team member to assign the lead");
      return;
    }

    try {
      await assignLead({
        id: lead._id,
        assigned_to: assignedUsers[0],
        assigned_users: assignedUsers,
        notes: notes.trim() || undefined,
      }).unwrap();
      toast.success("Lead assignment updated successfully");
      onClose();
      onSuccess?.();
    } catch (err) {
      toast.error(mutationRejectedMessage(err));
    }
  };

  return (
    <LargeModalPortal>
      <ModalOverlay onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition-all dark:border-white/10 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Assign Lead
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Lead #{lead.lead_no} • {lead.name}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Assign to Team Members */}
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Assign to Team Members ({allPortalUsers.length} available)
                </label>
                {assignedUsers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setAssignedUsers([])}
                    className="text-[11px] font-medium text-rose-500 hover:underline"
                  >
                    Clear All ({assignedUsers.length} selected)
                  </button>
                )}
              </div>

              {/* Instant Search Filter */}
              <div className="mt-1.5 relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  placeholder="Search user by name, email or department..."
                  className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-xs text-slate-800 placeholder-slate-400 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                />
                {assignSearch && (
                  <button
                    type="button"
                    onClick={() => setAssignSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {loadingUsers ? (
                <div className="mt-2 h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              ) : filteredAssignees.length === 0 ? (
                <div className="mt-2 rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-3 text-center text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-400">
                  No Lead Manager portal users found matching your search.
                </div>
              ) : (
                <div className="mt-2 max-h-56 overflow-y-auto space-y-1.5 rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 dark:border-white/10 dark:bg-slate-800/40">
                  {filteredAssignees.map((u) => {
                    const isSelected = assignedUsers.includes(u._id);
                    const roleBadge = getLeadManagerPortalRole(u);
                    const isCurrentUser = String(u._id) === authUserId;
                    const deptLabel = getDeptLabel(u.department || "") || u.department || "General";
                    return (
                      <label
                        key={u._id}
                        className={`flex items-center justify-between gap-2.5 rounded-lg p-2.5 text-xs transition cursor-pointer ${
                          isSelected
                            ? "bg-white dark:bg-slate-700 shadow-xs border border-primary/50 ring-1 ring-primary/20"
                            : "bg-white/70 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-700/70 border border-slate-200/60 dark:border-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleAssignedUser(u._id)}
                            className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-800 dark:text-slate-100">
                                {u.name}
                              </span>
                              {isCurrentUser && (
                                <span className="rounded bg-indigo-50 px-1 py-0.2 text-[10px] font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                              {u.email && (
                                <span className="inline-flex items-center gap-1 truncate text-slate-600 dark:text-slate-300">
                                  <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                                  <span className="truncate">{u.email}</span>
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                <Building2 className="h-2.5 w-2.5 text-slate-400 shrink-0" />
                                Dept: {deptLabel}
                              </span>
                            </div>
                          </div>
                        </div>
                        {roleBadge && (
                          <span className="shrink-0 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                            {roleBadge}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Assignment Note <span className="font-normal text-slate-400">(Optional)</span>
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason for reassignment or notes..."
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              >
                {isLoading ? "Saving..." : "Save Assignment"}
              </button>
            </div>
          </form>
        </div>
      </ModalOverlay>
    </LargeModalPortal>
  );
}
