/**
 * @fileoverview Slide-Over Drawer to assign or reassign a lead with one primary assignee and multiple secondary assignees.
 * @module components/leads/AssignLeadModal
 */
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { UserCheck, Search, Mail, Building2, X, Check, Star, Users } from "lucide-react";
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
} from "../../leadUtils";
import { SlideOverDrawer } from "@/components/portal/shared/SlideOverDrawer";

type Props = {
  lead: LeadRecord;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

type PortalUser = {
  _id: string;
  name: string;
  email?: string;
  department?: string;
  role?: string;
  portals?: Array<{ portal_code: string; access_roles?: string[] }>;
};

function getInitialAssignees(targetLead: LeadRecord): {
  primaryId: string;
  secondaryIds: string[];
} {
  const rawList = Array.isArray(targetLead.assigned_users)
    ? targetLead.assigned_users
        .map((u) => (typeof u === "object" && u !== null ? u._id : String(u)))
        .filter(Boolean)
    : [];

  const explicitPrimary = targetLead.assigned_to
    ? typeof targetLead.assigned_to === "object"
      ? targetLead.assigned_to?._id
      : String(targetLead.assigned_to)
    : "";

  const primaryId = explicitPrimary || rawList[0] || "";
  const secondaryIds = [...new Set(rawList.filter((id) => id && id !== primaryId))];

  return { primaryId, secondaryIds };
}

export function AssignLeadModal({ lead, open, onClose, onSuccess }: Props) {
  const authUser = useAppSelector((state) => state.auth.user);
  const authUserId = String(authUser?._id || authUser?.id || "");

  const initial = useMemo(() => getInitialAssignees(lead), [lead]);
  const [primaryAssigneeId, setPrimaryAssigneeId] = useState<string>(initial.primaryId);
  const [secondaryAssigneeIds, setSecondaryAssigneeIds] = useState<string[]>(initial.secondaryIds);
  const [notes, setNotes] = useState("");
  const [assignSearch, setAssignSearch] = useState<string>("");

  const { data: usersData, isLoading: loadingUsers } = useListUsersQuery();
  const [assignLead, { isLoading }] = useAssignLeadMutation();

  useEffect(() => {
    const next = getInitialAssignees(lead);
    setPrimaryAssigneeId(next.primaryId);
    setSecondaryAssigneeIds(next.secondaryIds);
  }, [lead]);

  const rawUsers: PortalUser[] = Array.isArray(usersData)
    ? (usersData as PortalUser[])
    : (usersData as { data?: PortalUser[] })?.data || [];

  const allPortalUsers = useMemo(() => {
    const filtered = rawUsers.filter(isUserInLeadManagerPortal);
    return filtered.length > 0 ? filtered : rawUsers;
  }, [rawUsers]);

  const userById = useMemo(() => {
    const map = new Map<string, PortalUser>();
    for (const u of allPortalUsers) {
      map.set(String(u._id), u);
    }
    return map;
  }, [allPortalUsers]);

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

  const selectPrimary = (userId: string) => {
    setPrimaryAssigneeId(userId);
    setSecondaryAssigneeIds((prev) => prev.filter((id) => id !== userId));
  };

  const toggleSecondary = (userId: string) => {
    if (userId === primaryAssigneeId) return;
    setSecondaryAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  if (!open || !canAssignLead(authUser)) return null;

  const primaryUser = primaryAssigneeId ? userById.get(primaryAssigneeId) : undefined;
  const totalSelected = (primaryAssigneeId ? 1 : 0) + secondaryAssigneeIds.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!primaryAssigneeId) {
      toast.error("Please select one primary assignee");
      return;
    }

    const cleanSecondary = secondaryAssigneeIds.filter((id) => id && id !== primaryAssigneeId);

    try {
      await assignLead({
        id: lead._id,
        assigned_to: primaryAssigneeId,
        assigned_users: [primaryAssigneeId, ...cleanSecondary],
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
        disabled={isLoading || !primaryAssigneeId}
        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary-hover transition cursor-pointer disabled:opacity-50"
      >
        <Check className="h-4 w-4" />
        <span>
          {isLoading
            ? "Saving..."
            : `Assign (${totalSelected}${secondaryAssigneeIds.length > 0 ? `: 1 Primary, ${secondaryAssigneeIds.length} Secondary` : " Primary"})`}
        </span>
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
        {/* Selected Summary */}
        <div className="rounded-xl border border-border bg-surface-muted/30 p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground">
              <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
              Primary Assignee <span className="text-rose-500">*</span>
            </span>
            {primaryUser ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/15 px-2.5 py-1 text-xs font-bold text-primary">
                {primaryUser.name}
                <button
                  type="button"
                  onClick={() => setPrimaryAssigneeId("")}
                  className="hover:text-rose-600 cursor-pointer"
                  title="Clear primary assignee"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ) : (
              <span className="text-[11px] italic text-rose-500">
                Select one primary assignee below
              </span>
            )}
          </div>

          <div className="border-t border-border/60 pt-2">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
                <Users className="h-3.5 w-3.5" />
                Secondary Assignees ({secondaryAssigneeIds.length})
              </span>
              {secondaryAssigneeIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSecondaryAssigneeIds([])}
                  className="text-[10px] font-semibold text-rose-500 hover:underline cursor-pointer"
                >
                  Clear secondary
                </button>
              )}
            </div>

            {secondaryAssigneeIds.length === 0 ? (
              <p className="text-[11px] text-muted italic">
                Optional: select one or more secondary assignees below.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {secondaryAssigneeIds.map((uid) => {
                  const u = userById.get(uid);
                  return (
                    <span
                      key={uid}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-foreground"
                    >
                      {u?.name || uid}
                      <button
                        type="button"
                        onClick={() => toggleSecondary(uid)}
                        className="text-muted hover:text-rose-600 cursor-pointer"
                        title="Remove secondary assignee"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Search Input */}
        <div>
          <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
            Select Primary &amp; Secondary Team Members
          </label>
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
            <div className="max-h-[340px] overflow-y-auto space-y-1.5 rounded-xl border border-border bg-surface-muted/30 p-2 scrollbar-none">
              {filteredAssignees.map((u) => {
                const uid = String(u._id);
                const isPrimary = primaryAssigneeId === uid;
                const isSecondary = secondaryAssigneeIds.includes(uid);
                const roleBadge = getLeadManagerPortalRole(u as any);
                const isCurrentUser = uid === authUserId;
                const deptLabel = getDeptLabel(u.department || "") || u.department || "General";

                return (
                  <div
                    key={uid}
                    className={`flex items-center justify-between gap-3 rounded-xl p-2.5 text-xs transition border ${
                      isPrimary
                        ? "bg-primary/10 border-primary/50 shadow-2xs"
                        : isSecondary
                          ? "bg-indigo-500/5 border-indigo-500/30 shadow-2xs"
                          : "bg-card border-border hover:bg-surface-muted"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-foreground truncate">{u.name}</span>
                        {isCurrentUser && (
                          <span className="rounded bg-primary/15 text-primary px-1.5 py-0.2 text-[10px] font-bold">
                            You
                          </span>
                        )}
                        {roleBadge && (
                          <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-primary">
                            {roleBadge}
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

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => selectPrimary(uid)}
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer border ${
                          isPrimary
                            ? "bg-primary text-white border-primary shadow-2xs"
                            : "bg-card text-foreground border-border hover:border-primary/50 hover:text-primary"
                        }`}
                        title="Set as Primary Assignee"
                      >
                        <Star className={`h-3 w-3 ${isPrimary ? "fill-white" : ""}`} />
                        <span>{isPrimary ? "Primary" : "Set Primary"}</span>
                      </button>

                      <button
                        type="button"
                        disabled={isPrimary}
                        onClick={() => toggleSecondary(uid)}
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition border ${
                          isPrimary
                            ? "opacity-35 cursor-not-allowed bg-surface-muted text-muted border-border"
                            : isSecondary
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs cursor-pointer"
                              : "bg-card text-muted border-border hover:text-foreground hover:border-indigo-400 cursor-pointer"
                        }`}
                        title={
                          isPrimary
                            ? "Primary assignee cannot also be secondary"
                            : isSecondary
                              ? "Remove secondary assignee"
                              : "Add as secondary assignee"
                        }
                      >
                        <Check className={`h-3 w-3 ${isSecondary ? "opacity-100" : "opacity-40"}`} />
                        <span>Secondary</span>
                      </button>
                    </div>
                  </div>
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
            rows={2}
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
