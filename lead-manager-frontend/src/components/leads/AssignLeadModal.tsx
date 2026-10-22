/**
 * @fileoverview Slide-Over Drawer to assign or reassign a lead to one or more team members.
 * @module components/leads/AssignLeadModal
 */
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { UserCheck, Search, Mail, Building2, X, Check } from "lucide-react";
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
import { SlideOverDrawer } from "@/components/portal/shared/SlideOverDrawer";

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

  const footerActions = (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onClose}
        className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted transition cursor-pointer"
      >
        Cancel
      </button>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isLoading || assignedUsers.length === 0}
        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary-hover transition cursor-pointer disabled:opacity-50"
      >
        <Check className="h-4 w-4" />
        <span>{isLoading ? "Saving..." : `Assign (${assignedUsers.length})`}</span>
      </button>
    </div>
  );

  return (
    <SlideOverDrawer
      open={open}
      onClose={onClose}
      title="Assign Lead to Team"
      subtitle={`Lead #${lead.lead_no} • ${lead.name}`}
      icon={UserCheck}
      footer={footerActions}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Search Input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-foreground uppercase tracking-wider">
              Select Team Members
            </label>
            {assignedUsers.length > 0 && (
              <button
                type="button"
                onClick={() => setAssignedUsers([])}
                className="text-[11px] font-semibold text-rose-500 hover:underline cursor-pointer"
              >
                Clear selection ({assignedUsers.length})
              </button>
            )}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" />
            <input
              type="text"
              value={assignSearch}
              onChange={(e) => setAssignSearch(e.target.value)}
              placeholder="Search by representative name, email, department..."
              className="w-full rounded-xl border border-border bg-surface-muted/50 pl-9 pr-8 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-card focus:outline-none transition"
            />
            {assignSearch && (
              <button
                type="button"
                onClick={() => setAssignSearch("")}
                className="absolute right-2.5 top-2.5 text-muted hover:text-foreground p-0.5 rounded cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* User Selection List */}
        <div>
          {loadingUsers ? (
            <div className="h-36 animate-pulse rounded-xl bg-surface-muted" />
          ) : filteredAssignees.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface-muted/30 p-6 text-center text-xs text-muted">
              No team members found matching &ldquo;{assignSearch}&rdquo;.
            </div>
          ) : (
            <div className="max-h-[380px] overflow-y-auto space-y-1.5 rounded-xl border border-border bg-surface-muted/30 p-2 scrollbar-none">
              {filteredAssignees.map((u) => {
                const isSelected = assignedUsers.includes(u._id);
                const roleBadge = getLeadManagerPortalRole(u as any);
                const isCurrentUser = String(u._id) === authUserId;
                const deptLabel = getDeptLabel(u.department || "") || u.department || "General";

                return (
                  <label
                    key={u._id}
                    className={`flex items-center justify-between gap-3 rounded-xl p-3 text-xs transition cursor-pointer border ${
                      isSelected
                        ? "bg-primary/10 border-primary/40 shadow-2xs"
                        : "bg-card border-border hover:bg-surface-muted"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleAssignedUser(u._id)}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-foreground truncate">{u.name}</span>
                          {isCurrentUser && (
                            <span className="rounded bg-primary/15 text-primary px-1.5 py-0.2 text-[10px] font-bold">
                              You
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted flex-wrap">
                          {u.email && (
                            <span className="flex items-center gap-1 truncate">
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate">{u.email}</span>
                            </span>
                          )}
                          <span className="flex items-center gap-1 rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                            <Building2 className="h-2.5 w-2.5 shrink-0" />
                            {deptLabel}
                          </span>
                        </div>
                      </div>
                    </div>

                    {roleBadge && (
                      <span className="shrink-0 rounded-md bg-surface-muted px-2 py-0.5 text-[10px] font-extrabold uppercase text-primary">
                        {roleBadge}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Assignment Notes */}
        <div>
          <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
            Assignment Note <span className="font-normal text-muted">(Optional)</span>
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Special instructions or reason for assigning..."
            className="w-full rounded-xl border border-border bg-surface-muted/50 p-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-card focus:outline-none transition"
          />
        </div>
      </form>
    </SlideOverDrawer>
  );
}
