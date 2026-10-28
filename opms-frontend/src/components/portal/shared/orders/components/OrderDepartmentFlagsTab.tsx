"use client";

import { useCallback, useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  MessageSquare,
  AlertTriangle,
  User,
  Shield,
  CheckCircle2,
  Clock,
  Plus,
  Filter,
  Sparkles,
} from "lucide-react";
import { LargeModalPortal } from "@/components/portal/shared/ui/modals/LargeModalPortal";
import { DashboardCard } from "@/components/widgets";
import { ALL_FLAG_TYPES, FLAGS_FOR_TARGET_DEPARTMENT } from "@/components/portal/shared/orders/lib/flagTypes";
import { ResolveFlagModal } from "@/components/portal/shared/orders/modals/ResolveFlagModal";
import { FlagChatDrawer } from "@/components/portal/shared/orders/modals/FlagChatDrawer";
import {
  usePatchFlagMutation,
  useCreateAttachmentMutation,
  useCreateFlagMutation,
  useListOpmsMembersQuery,
  type OpmsMember,
} from "@/store/api";
import { useAppSelector } from "@/store";
import { toast } from "@/lib/toast";
import { mutationRejectedMessage } from "@/lib/mutationMessages";

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-500/25 dark:border-white/15 dark:bg-slate-950 dark:text-slate-50";
const btnSecondaryClass =
  "rounded-lg border border-slate-200/95 px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:text-slate-100 dark:hover:bg-white/5";
const labelClass = "text-xs font-medium text-slate-700 dark:text-slate-300";

const departmentLabels: Record<string, string> = {
  sales: "Sales",
  finance: "Finance",
  dispatch: "Dispatch",
  admin: "Admin",
  account: "Account",
  coordinator: "Coordinator",
};

export type OrderDepartmentFlagsTabProps = {
  orderId: string;
  orderNo?: any;
  flagsQ: {
    refetch: () => unknown;
    isFetching: boolean;
    isUninitialized?: boolean;
  };
  rawFlags: Record<string, unknown>[];
  formatDate: (v: unknown) => string;
  userNameById: Record<string, string>;
  setShowRaiseFlagModal?: (v: boolean) => void;
  currentDepartment: string;
  refetchOrder: () => void;
};

/** Flags list + interactive chat loop drawer + OPMS member assignment. */
export function OrderDepartmentFlagsTab({
  orderId,
  orderNo,
  flagsQ,
  rawFlags,
  formatDate,
  userNameById,
  setShowRaiseFlagModal,
  currentDepartment,
  refetchOrder,
}: OrderDepartmentFlagsTabProps) {
  const currentUser = useAppSelector((s) => s.auth.user);
  const currentUserId = String(currentUser?._id ?? currentUser?.id ?? "");

  // OPMS Members Roster
  const { data: opmsMembers = [] } = useListOpmsMembersQuery();

  // Active Chat Drawer state
  const [activeChatFlag, setActiveChatFlag] = useState<Record<string, any> | null>(null);

  // Deep linking: Auto-open flag chat when arriving from notification or email CTA (?openFlag=<flagId>)
  const searchParams = useSearchParams();
  const openFlagParam = searchParams?.get("openFlag") || searchParams?.get("flagId");

  useEffect(() => {
    if (openFlagParam && Array.isArray(rawFlags) && rawFlags.length > 0 && !activeChatFlag) {
      const target = rawFlags.find((f: any) => String(f._id || f.id) === String(openFlagParam));
      if (target) {
        setActiveChatFlag(target);
      }
    }
  }, [openFlagParam, rawFlags, activeChatFlag]);

  // Quick Resolve Modal state
  const [resolvingFlag, setResolvingFlag] = useState<Record<string, unknown> | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [resolveFile, setResolveFile] = useState<File | null>(null);

  const [patchFlag, { isLoading: isPatchingFlag }] = usePatchFlagMutation();
  const [createAttachment, { isLoading: isUploadingAttachment }] =
    useCreateAttachmentMutation();
  const isBusy = isPatchingFlag || isUploadingAttachment;

  // Filter tab state
  const [filterTab, setFilterTab] = useState<"all" | "assigned_to_me" | "raised_by_me" | "active" | "resolved">("all");

  // Raise Flag State & Logic
  const [internalShowRaiseFlagModal, setInternalShowRaiseFlagModal] = useState(false);
  const [newFlagAssignee, setNewFlagAssignee] = useState<string>("");
  const [newFlagTaggedMembers, setNewFlagTaggedMembers] = useState<string[]>([]);
  const [newFlagType, setNewFlagType] = useState("urgent");
  const [newFlagSeverity, setNewFlagSeverity] = useState("medium");
  const [newFlagTitle, setNewFlagTitle] = useState("");
  const [newFlagDesc, setNewFlagDesc] = useState("");
  const [newFlagDueDate, setNewFlagDueDate] = useState("");

  const [createFlag, { isLoading: isCreatingFlag }] = useCreateFlagMutation();

  const handleRaiseFlag = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!orderId || !newFlagTitle.trim()) return;

      try {
        await createFlag({
          order: orderId,
          flag_type: newFlagType,
          severity: newFlagSeverity,
          title: newFlagTitle.trim(),
          description: newFlagDesc.trim(),
          assigned_to: newFlagAssignee || undefined,
          tagged_members: newFlagTaggedMembers,
          due_date: newFlagDueDate ? new Date(newFlagDueDate).toISOString() : undefined,
        }).unwrap();

        toast.success("Flag raised and assigned successfully.");
        setInternalShowRaiseFlagModal(false);
        if (setShowRaiseFlagModal) setShowRaiseFlagModal(false);
        setNewFlagTitle("");
        setNewFlagDesc("");
        setNewFlagAssignee("");
        setNewFlagTaggedMembers([]);
        setNewFlagType("urgent");
        setNewFlagSeverity("medium");
        setNewFlagDueDate("");
        if (!flagsQ.isUninitialized) flagsQ.refetch();
        refetchOrder();
      } catch (err) {
        toast.error(mutationRejectedMessage(err));
      }
    },
    [
      orderId,
      newFlagType,
      newFlagSeverity,
      newFlagTitle,
      newFlagDesc,
      newFlagAssignee,
      newFlagTaggedMembers,
      newFlagDueDate,
      createFlag,
      flagsQ,
      refetchOrder,
      setShowRaiseFlagModal,
    ]
  );


  const closeResolveModal = () => {
    setResolvingFlag(null);
    setResolutionNote("");
    setResolveFile(null);
  };

  const openResolveModal = (flag: Record<string, unknown>) => {
    setResolvingFlag(flag);
    setResolutionNote("");
    setResolveFile(null);
  };

  const handleResolveFlag = useCallback(async () => {
    if (!resolvingFlag) return;
    const id = String(resolvingFlag._id ?? resolvingFlag.id ?? "");

    try {
      await patchFlag({
        id,
        patch: {
          status: "resolved",
          resolution_note: resolutionNote.trim() || undefined,
        },
      }).unwrap();

      if (resolveFile) {
        const formData = new FormData();
        formData.append("file", resolveFile);
        formData.append("entity_type", "order");
        formData.append("entity_id", orderId);
        formData.append(
          "remarks",
          `Flag resolution attachment — ${String(resolvingFlag.title ?? ALL_FLAG_TYPES[String(resolvingFlag.flag_type ?? "")]?.label ?? "Flag")}`
        );
        await createAttachment(formData).unwrap();
      }

      toast.success("Flag resolved successfully.");
      closeResolveModal();
      if (!flagsQ.isUninitialized) flagsQ.refetch();
      refetchOrder();
    } catch (err) {
      toast.error(mutationRejectedMessage(err));
    }
  }, [
    resolvingFlag,
    resolutionNote,
    resolveFile,
    patchFlag,
    createAttachment,
    orderId,
    flagsQ,
    refetchOrder,
  ]);

  // Counts for filter pills
  const counts = useMemo(() => {
    let assignedToMe = 0;
    let raisedByMe = 0;
    let active = 0;
    let resolved = 0;

    for (const f of rawFlags) {
      const assignedId =
        typeof f.assigned_to === "object" && f.assigned_to !== null
          ? String((f.assigned_to as any)._id || (f.assigned_to as any).id)
          : String(f.assigned_to || "");
      const raisedId =
        typeof f.raised_by === "object" && f.raised_by !== null
          ? String((f.raised_by as any)._id || (f.raised_by as any).id)
          : String(f.raised_by || "");
      const isRes = f.status === "resolved" || f.status === "dismissed";

      const isTagged = Array.isArray(f.tagged_members) && f.tagged_members.some((tm: any) =>
        String(typeof tm === "object" && tm !== null ? tm._id || tm.id : tm) === currentUserId
      );

      if (currentUserId && (assignedId === currentUserId || isTagged)) assignedToMe++;
      if (currentUserId && raisedId === currentUserId) raisedByMe++;
      if (isRes) resolved++;
      else active++;
    }

    return { all: rawFlags.length, assignedToMe, raisedByMe, active, resolved };
  }, [rawFlags, currentUserId]);

  // Filtered list
  const displayedFlags = useMemo(() => {
    return rawFlags.filter((f) => {
      const assignedId =
        typeof f.assigned_to === "object" && f.assigned_to !== null
          ? String((f.assigned_to as any)._id || (f.assigned_to as any).id)
          : String(f.assigned_to || "");
      const raisedId =
        typeof f.raised_by === "object" && f.raised_by !== null
          ? String((f.raised_by as any)._id || (f.raised_by as any).id)
          : String(f.raised_by || "");
      const isRes = f.status === "resolved" || f.status === "dismissed";

      const isTagged = Array.isArray(f.tagged_members) && f.tagged_members.some((tm: any) =>
        String(typeof tm === "object" && tm !== null ? tm._id || tm.id : tm) === currentUserId
      );

      if (filterTab === "assigned_to_me") return assignedId === currentUserId || isTagged;
      if (filterTab === "raised_by_me") return raisedId === currentUserId;
      if (filterTab === "active") return !isRes;
      if (filterTab === "resolved") return isRes;
      return true;
    });
  }, [rawFlags, filterTab, currentUserId]);

  const modalSubtitle =
    resolvingFlag &&
    String(
      resolvingFlag.title ??
        ALL_FLAG_TYPES[String(resolvingFlag.flag_type ?? "")]?.label ??
        "Flag",
    );

  return (
    <>
      <DashboardCard
        title="Order Issue Flags & Chat Loops"
        description="Collaborative issue resolution. Assign flags directly to any OPMS team member and participate in the live chat loop."
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-white/5">
          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setFilterTab("all")}
              className={`rounded-lg px-2.5 py-1 font-medium transition cursor-pointer ${
                filterTab === "all"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              All Flags ({counts.all})
            </button>

            {counts.assignedToMe > 0 && (
              <button
                type="button"
                onClick={() => setFilterTab("assigned_to_me")}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition cursor-pointer ${
                  filterTab === "assigned_to_me"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300"
                }`}
              >
                <span>Assigned to Me</span>
                <span className="rounded-full bg-blue-700/30 px-1.5 py-0.2 text-2xs text-white">
                  {counts.assignedToMe}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setFilterTab("active")}
              className={`rounded-lg px-2.5 py-1 font-medium transition cursor-pointer ${
                filterTab === "active"
                  ? "bg-rose-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              Active ({counts.active})
            </button>

            <button
              type="button"
              onClick={() => setFilterTab("resolved")}
              className={`rounded-lg px-2.5 py-1 font-medium transition cursor-pointer ${
                filterTab === "resolved"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              Resolved ({counts.resolved})
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setInternalShowRaiseFlagModal(true);
              if (setShowRaiseFlagModal) setShowRaiseFlagModal(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Raise Flag
          </button>
        </div>

        {flagsQ.isFetching ? (
          <p className="text-sm text-slate-500 py-4">Loading flags...</p>
        ) : displayedFlags.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <p className="text-sm font-medium">No flags match this filter.</p>
            <p className="text-xs text-slate-400 mt-1">
              Click &quot;Raise Flag&quot; above to report an issue or assign a task to an OPMS member.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedFlags.map((flag) => {
              const id = String(flag._id ?? flag.id ?? "");
              const type = String(flag.flag_type ?? "");
              const severity = String(flag.severity ?? "medium");
              const status = String(flag.status ?? "open");
              const isResolved = status === "resolved" || status === "dismissed";
              const isTargetDept = String(flag.department) === currentDepartment;

              // Assignee Details
              const assignedToObj =
                typeof flag.assigned_to === "object" && flag.assigned_to !== null
                  ? (flag.assigned_to as any)
                  : null;
              const assignedToName = assignedToObj
                ? String(assignedToObj.name || assignedToObj.username || "")
                : userNameById[String(flag.assigned_to || "")] || null;
              const assignedToRole = assignedToObj
                ? String(assignedToObj.department || assignedToObj.opms_role || "")
                : null;

              const isPrimaryAssignedToMe = currentUserId && (
                (assignedToObj && String(assignedToObj._id || assignedToObj.id) === currentUserId) ||
                String(flag.assigned_to) === currentUserId
              );

              const taggedMembersList: any[] = Array.isArray(flag.tagged_members) ? flag.tagged_members : [];
              const isTaggedToMe = currentUserId && taggedMembersList.some((tm: any) =>
                String(typeof tm === "object" && tm !== null ? tm._id || tm.id : tm) === currentUserId
              );
              const isAssignedToMe = isPrimaryAssignedToMe || isTaggedToMe;

              // Raised by Details
              const raisedByObj =
                typeof flag.raised_by === "object" && flag.raised_by !== null
                  ? (flag.raised_by as any)
                  : null;
              const raisedByName = raisedByObj
                ? String(raisedByObj.name || raisedByObj.username || "")
                : userNameById[String(flag.raised_by || "")] || "Team Member";

              let severityColor = "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400";
              if (severity === "low") {
                severityColor = "bg-slate-50 text-slate-700 dark:bg-slate-900/20 dark:text-slate-400";
              } else if (severity === "high") {
                severityColor = "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400";
              } else if (severity === "critical") {
                severityColor = "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400";
              }

              const messageCount = Number(flag.message_count ?? (flag.description ? 1 : 0));
              const hasLastPreview = typeof flag.last_message_preview === "string" && flag.last_message_preview;

              return (
                <div
                  key={id}
                  className={`group relative rounded-xl border p-4.5 transition duration-150 ${
                    isResolved
                      ? "border-slate-200 bg-slate-50/50 dark:border-white/5 dark:bg-slate-900/40"
                      : isPrimaryAssignedToMe
                        ? "border-blue-300 bg-blue-50/20 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20"
                        : isTaggedToMe
                          ? "border-indigo-300 bg-indigo-50/20 shadow-sm dark:border-indigo-900/40 dark:bg-indigo-950/20"
                          : "border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-[200px] flex-1 space-y-2">
                      {/* Badge strip */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            isResolved
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                              : status === "in_progress"
                                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                                : "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400"
                          }`}
                        >
                          {status.replace("_", " ")}
                        </span>

                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${severityColor}`}>
                          {severity}
                        </span>

                        {isPrimaryAssignedToMe && !isResolved && (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                            Primary Assignee (You)
                          </span>
                        )}

                        {!isPrimaryAssignedToMe && isTaggedToMe && !isResolved && (
                          <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                            Tagged Member (You)
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h4 className="text-base font-bold text-slate-900 dark:text-slate-50">
                        {String(flag.title ?? ALL_FLAG_TYPES[type]?.label ?? type)}
                      </h4>

                      {/* Description / Initial Text */}
                      {typeof flag.description === "string" && flag.description ? (
                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                          {String(flag.description)}
                        </p>
                      ) : null}

                      {/* Latest Chat Loop Snippet */}
                      {hasLastPreview && (
                        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 border border-slate-100 dark:border-white/5">
                          <MessageSquare className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                          <span className="truncate italic">&quot;{String(flag.last_message_preview)}&quot;</span>
                        </div>
                      )}

                      {/* Metadata / Stakeholders bar */}
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-sans text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">Raised by:</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{raisedByName}</span>
                        </div>

                        <span>•</span>

                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">Primary:</span>
                          {assignedToName ? (
                            <span className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                              <User className="h-3 w-3 inline" /> {assignedToName}
                              {assignedToRole && (
                                <span className="rounded bg-blue-50 px-1 py-0.2 text-2xs uppercase text-blue-600 dark:bg-blue-950/40 font-medium">
                                  {assignedToRole}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="italic text-slate-400">Unassigned</span>
                          )}
                        </div>

                        {taggedMembersList.length > 0 && (
                          <>
                            <span>•</span>
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="text-slate-400">Tagged:</span>
                              {taggedMembersList.map((tm: any, idx: number) => {
                                const tmName = typeof tm === "object" && tm !== null
                                  ? tm.name || tm.username || "Member"
                                  : userNameById[String(tm)] || "Member";
                                return (
                                  <span
                                    key={idx}
                                    className="rounded-full bg-slate-100 px-2 py-0.5 text-2xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                  >
                                    {tmName}
                                  </span>
                                );
                              })}
                            </div>
                          </>
                        )}

                        <span>•</span>
                        <span>{formatDate(flag.createdAt)}</span>

                        {typeof flag.due_date === "string" && flag.due_date ? (
                          <>
                            <span>•</span>
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                              Due: {formatDate(flag.due_date)}
                            </span>
                          </>
                        ) : null}
                      </div>

                      {/* Resolution summary card */}
                      {isResolved ? (
                        <div className="mt-3 rounded-lg border border-emerald-100/50 bg-emerald-50/50 p-3 text-sm text-emerald-800 dark:border-emerald-900/20 dark:bg-emerald-950/20 dark:text-emerald-300">
                          <p className="font-semibold">Resolution summary</p>
                          {typeof flag.resolution_note === "string" && flag.resolution_note ? (
                            <p className="mt-1">{flag.resolution_note}</p>
                          ) : null}
                          <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                            Resolved by: {userNameById[String(flag.resolved_by)] || String(flag.resolved_by ?? "System")}{" "}
                            on {formatDate(flag.resolved_at)}
                          </p>
                        </div>
                      ) : null}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveChatFlag(flag)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-300 cursor-pointer"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>Chat Loop</span>
                        {messageCount > 0 && (
                          <span className="rounded-full bg-blue-600 px-1.5 py-0.2 text-2xs text-white">
                            {messageCount}
                          </span>
                        )}
                      </button>

                      {!isResolved && (isAssignedToMe || isTargetDept || currentDepartment === "admin") ? (
                        <button
                          type="button"
                          onClick={() => openResolveModal(flag)}
                          className="rounded-lg border border-emerald-600 px-3 py-1.5 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-950/20 cursor-pointer"
                        >
                          Resolve flag
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DashboardCard>

      {/* Flag Chat Loop Drawer */}
      {activeChatFlag && (
        <FlagChatDrawer
          flag={activeChatFlag}
          orderId={orderId}
          orderNo={orderNo}
          onClose={() => setActiveChatFlag(null)}
          onFlagUpdated={() => {
            if (!flagsQ.isUninitialized) flagsQ.refetch();
            refetchOrder();
          }}
        />
      )}

      {/* Quick Resolve Modal */}
      <ResolveFlagModal
        open={Boolean(resolvingFlag)}
        subtitle={modalSubtitle || ""}
        resolutionNote={resolutionNote}
        onResolutionNoteChange={setResolutionNote}
        file={resolveFile}
        onFileChange={setResolveFile}
        onClose={closeResolveModal}
        onConfirm={handleResolveFlag}
        isBusy={isBusy}
      />

      {/* Raise Flag Modal with OPMS Member Assignment */}
      {internalShowRaiseFlagModal && (
        <LargeModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]">
            <div className="w-full max-w-lg rounded-xl border border-slate-200/90 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-50 font-sans">
                      Raise Flag to OPMS Member
                    </h3>
                    <p className="text-xs text-slate-400">
                      Assign this issue to any team member to start a chat loop.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setInternalShowRaiseFlagModal(false);
                    if (setShowRaiseFlagModal) setShowRaiseFlagModal(false);
                  }}
                  className="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={(e) => void handleRaiseFlag(e)} className="mt-4 space-y-4 font-sans text-xs">
                {/* Primary Assignee (One Primary Member) */}
                <div className="space-y-1.5">
                  <label htmlFor="flag-assignee" className={labelClass}>
                    Primary Assignee (Required)
                  </label>
                  <select
                    id="flag-assignee"
                    value={newFlagAssignee}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      setNewFlagAssignee(selectedId);
                      setNewFlagTaggedMembers((prev) => prev.filter((id) => id !== selectedId));
                    }}
                    className={inputClass}
                    required
                  >
                    <option value="">-- Select Primary Assignee --</option>
                    {opmsMembers.map((m: OpmsMember) => (
                      <option key={m._id} value={m._id}>
                        {m.name} ({m.opms_role.toUpperCase()}) — {m.email || m.department}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tagged Members (Multiple Tagged Members) */}
                <div className="space-y-1.5">
                  <label className={labelClass}>
                    Tagged Members (CC / Collaborators)
                  </label>

                  {/* Render Selected Tagged Members as interactive chips */}
                  {newFlagTaggedMembers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {newFlagTaggedMembers.map((tmId) => {
                        const member = opmsMembers.find((m) => m._id === tmId);
                        return (
                          <span
                            key={tmId}
                            className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-600/20 dark:bg-blue-950/40 dark:text-blue-300"
                          >
                            <span>{member?.name || "Member"}</span>
                            <span className="text-2xs opacity-70 uppercase font-mono">({member?.opms_role || ""})</span>
                            <button
                              type="button"
                              onClick={() =>
                                setNewFlagTaggedMembers((prev) => prev.filter((id) => id !== tmId))
                              }
                              className="ml-0.5 rounded-full p-0.5 hover:bg-blue-200 dark:hover:bg-blue-900 cursor-pointer"
                              title="Remove member"
                            >
                              ✕
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <select
                    value=""
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      if (selectedId && !newFlagTaggedMembers.includes(selectedId)) {
                        setNewFlagTaggedMembers((prev) => [...prev, selectedId]);
                      }
                    }}
                    className={inputClass}
                  >
                    <option value="">+ Tag an additional team member...</option>
                    {opmsMembers
                      .filter(
                        (m: OpmsMember) =>
                          m._id !== newFlagAssignee && !newFlagTaggedMembers.includes(m._id)
                      )
                      .map((m: OpmsMember) => (
                        <option key={m._id} value={m._id}>
                          {m.name} ({m.opms_role.toUpperCase()}) — {m.email || m.department}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="flag-type" className={labelClass}>
                      Flag Type
                    </label>
                    <select
                      id="flag-type"
                      value={newFlagType}
                      onChange={(e) => setNewFlagType(e.target.value)}
                      className={inputClass}
                      required
                    >
                      {Object.keys(ALL_FLAG_TYPES).map((val) => (
                        <option key={val} value={val}>
                          {ALL_FLAG_TYPES[val]?.label || val}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="flag-severity" className={labelClass}>
                      Severity
                    </label>
                    <select
                      id="flag-severity"
                      value={newFlagSeverity}
                      onChange={(e) => setNewFlagSeverity(e.target.value)}
                      className={inputClass}
                      required
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="flag-title" className={labelClass}>
                      Flag Title
                    </label>
                    <input
                      id="flag-title"
                      type="text"
                      value={newFlagTitle}
                      onChange={(e) => setNewFlagTitle(e.target.value)}
                      className={inputClass}
                      placeholder="E.g., Payment verification / Stock query"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="flag-due" className={labelClass}>
                      Due Date (Optional)
                    </label>
                    <input
                      id="flag-due"
                      type="date"
                      value={newFlagDueDate}
                      onChange={(e) => setNewFlagDueDate(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="flag-desc" className={labelClass}>
                    Initial Message / Description
                  </label>
                  <textarea
                    id="flag-desc"
                    rows={3}
                    value={newFlagDesc}
                    onChange={(e) => setNewFlagDesc(e.target.value)}
                    className={inputClass}
                    placeholder="Provide details or questions for the chat loop..."
                  />
                </div>

                <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-white/5 font-sans font-medium">
                  <button
                    type="button"
                    onClick={() => {
                      setInternalShowRaiseFlagModal(false);
                      if (setShowRaiseFlagModal) setShowRaiseFlagModal(false);
                    }}
                    className={btnSecondaryClass}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingFlag}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400 cursor-pointer"
                  >
                    {isCreatingFlag ? "Raising Flag..." : "Raise Flag & Start Chat"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </LargeModalPortal>
      )}
    </>
  );
}
