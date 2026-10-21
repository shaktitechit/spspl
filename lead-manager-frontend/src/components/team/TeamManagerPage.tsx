"use client";

import React, { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  Network,
  ShieldCheck,
  Users,
  UserPlus,
  Trash2,
  RefreshCw,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  GripVertical,
  CheckCircle2,
  AlertCircle,
  Search,
  Shield,
  Layers,
  UserMinus,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Download,
  Briefcase,
  Eye,
  GitBranch,
  Crown,
  Plus,
  X,
} from "lucide-react";
import { toast } from "@/lib/toast";
import {
  useGetTeamTreeQuery,
  useGetMyTeamQuery,
  useUpsertTeamEdgeMutation,
  useRemoveTeamEdgeMutation,
} from "@/store/api/slices/teamApi";
import {
  isAdmin as checkIsAdmin,
  isManager as checkIsManager,
  isCoordinator as checkIsCoordinator,
  readSessionFromStorage,
} from "@/utils/authStorage";

interface TreeUser {
  _id: string;
  id?: string;
  name: string;
  email: string;
  department?: string | { name?: string };
  wp_role: "admin" | "manager" | "coordinator" | "executive" | string;
  reports_to?: string | null;
  manager_ids?: string[];
  report_ids?: string[];
  is_active?: boolean;
}

interface DraggedUserState {
  _id: string;
  name: string;
  email: string;
  wp_role: string;
  reports_to?: string | null;
}

const ROLE_CONFIG: Record<
  string,
  {
    bg: string;
    text: string;
    border: string;
    label: string;
    dot: string;
    avatarBg: string;
    icon: React.ElementType;
    badgeStyle: string;
  }
> = {
  admin: {
    bg: "bg-purple-500/10 dark:bg-purple-500/20",
    text: "text-purple-600 dark:text-purple-300",
    border: "border-purple-500/30",
    label: "Admin",
    dot: "bg-purple-500 shadow-purple-500/50",
    avatarBg: "from-purple-600 to-indigo-600 text-white",
    icon: Crown,
    badgeStyle: "bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30",
  },
  manager: {
    bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
    text: "text-emerald-600 dark:text-emerald-300",
    border: "border-emerald-500/30",
    label: "Manager",
    dot: "bg-emerald-500 shadow-emerald-500/50",
    avatarBg: "from-emerald-600 to-teal-600 text-white",
    icon: Briefcase,
    badgeStyle: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
  },
  coordinator: {
    bg: "bg-indigo-500/10 dark:bg-indigo-500/20",
    text: "text-indigo-600 dark:text-indigo-300",
    border: "border-indigo-500/30",
    label: "Coordinator",
    dot: "bg-indigo-500 shadow-indigo-500/50",
    avatarBg: "from-indigo-600 to-blue-600 text-white",
    icon: GitBranch,
    badgeStyle: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/30",
  },
  executive: {
    bg: "bg-sky-500/10 dark:bg-sky-500/20",
    text: "text-sky-600 dark:text-sky-300",
    border: "border-sky-500/30",
    label: "Executive",
    dot: "bg-sky-500 shadow-sky-500/50",
    avatarBg: "from-sky-600 to-cyan-600 text-white",
    icon: Users,
    badgeStyle: "bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30",
  },
};

function getInitials(name: string): string {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function TeamManagerPage() {
  const sessionUser = useMemo(() => readSessionFromStorage()?.user, []);
  const adminAccess = checkIsAdmin(sessionUser);
  const teamLeadAccess = checkIsManager(sessionUser) || checkIsCoordinator(sessionUser);

  if (!adminAccess && teamLeadAccess) {
    return <MyTeamView />;
  }
  return <AdminTeamStudio adminAccess={adminAccess} />;
}

/** Read-only team view for Managers & Coordinators (non-admin). */
function MyTeamView() {
  const { data, isLoading, refetch } = useGetMyTeamQuery();
  const [search, setSearch] = useState("");

  const selfId = data?.self_id || "";
  const members = useMemo(() => (data?.members || []) as any[], [data?.members]);
  const edges = useMemo(() => (data?.edges || []) as any[], [data?.edges]);

  const supervisors = useMemo(
    () => edges.filter((e) => String(e.subordinate?._id || e.subordinate) === selfId).map((e) => e.manager),
    [edges, selfId]
  );
  const directReportIds = useMemo(
    () => new Set(edges.filter((e) => String(e.manager?._id || e.manager) === selfId).map((e) => String(e.subordinate?._id || e.subordinate))),
    [edges, selfId]
  );
  const downline = useMemo(() => {
    const q = search.toLowerCase().trim();
    return members
      .filter((m) => String(m._id) !== selfId)
      .filter((m) => !q || m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q));
  }, [members, selfId, search]);

  const roleCounts = useMemo(() => {
    const c: Record<string, number> = {};
    downline.forEach((m) => (c[m.wp_role || "executive"] = (c[m.wp_role || "executive"] || 0) + 1));
    return c;
  }, [downline]);

  return (
    <div className="space-y-6 font-sans pb-20">
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-r from-card via-card to-primary/5 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 text-white shadow-md shrink-0">
              <Users className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">My Team</h1>
              <p className="text-xs text-muted mt-1 max-w-xl">
                Your reporting line and everyone in your downline. You can view and work on leads assigned to these members.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted hover:text-foreground transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-primary" : ""}`} /> Refresh
          </button>
        </div>
        <div className="absolute right-0 top-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Team Size", value: downline.length, cls: "text-foreground" },
          { label: "Direct Reports", value: directReportIds.size, cls: "text-emerald-500" },
          { label: "Coordinators", value: roleCounts.coordinator || 0, cls: "text-indigo-500" },
          { label: "Executives", value: roleCounts.executive || 0, cls: "text-sky-500" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-border/70 bg-card p-4 shadow-2xs">
            <span className="text-3xs font-extrabold uppercase tracking-wider text-muted">{k.label}</span>
            <div className={`mt-2 text-2xl font-black ${k.cls}`}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr] items-start">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-primary" /> I Report To ({supervisors.length})
          </h3>
          {supervisors.length === 0 ? (
            <p className="text-xs text-muted italic bg-surface-muted/40 p-3 rounded-xl">No supervisor mapped yet.</p>
          ) : (
            supervisors.map((s: any) => (
              <div key={s?._id} className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-muted/50 p-2.5">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center font-bold text-xs">
                  {getInitials(s?.name || "M")}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">{s?.name}</p>
                  <p className="text-3xs text-muted truncate">{s?.email}</p>
                </div>
              </div>
            ))
          )}
          {supervisors.length > 1 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-600 px-2 py-0.5 text-[10px] font-black">
              <GitBranch className="h-3 w-3" /> Matrix reporting
            </span>
          )}
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Network className="h-4 w-4 text-primary" /> My Downline
            </h3>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search team…"
                className="h-8 rounded-xl border border-border bg-card pl-8 pr-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none w-56"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-xs text-muted gap-2">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" /> Loading team…
            </div>
          ) : downline.length === 0 ? (
            <div className="py-16 text-center text-muted">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-bold text-foreground">No team members yet</p>
              <p className="text-xs mt-1">Ask a Lead Manager admin to map reports to you in Team Manager.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {downline.map((m) => {
                const rs = ROLE_CONFIG[m.wp_role] || ROLE_CONFIG.executive;
                const isDirect = directReportIds.has(String(m._id));
                return (
                  <div key={m._id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:border-primary/40 hover:shadow-xs transition">
                    <div className={`h-9 w-9 rounded-xl bg-gradient-to-tr ${rs.avatarBg} flex items-center justify-center font-bold text-xs shrink-0`}>
                      {getInitials(m.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-foreground truncate">{m.name}</span>
                        <span className={`rounded px-1.5 text-[9px] font-bold border ${rs.badgeStyle}`}>{rs.label}</span>
                        <span className={`rounded-full px-1.5 text-[9px] font-bold ${isDirect ? "bg-emerald-500/15 text-emerald-600" : "bg-surface-muted text-muted"}`}>
                          {isDirect ? "Direct" : "Indirect"}
                        </span>
                      </div>
                      <p className="text-3xs text-muted truncate">{m.email}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminTeamStudio({ adminAccess }: { adminAccess: boolean }) {
  const { data: tree, isLoading, refetch } = useGetTeamTreeQuery(undefined, {
    skip: !adminAccess,
  });
  const [upsertEdge, { isLoading: saving }] = useUpsertTeamEdgeMutation();
  const [removeEdge, { isLoading: removing }] = useRemoveTeamEdgeMutation();

  // Manual Assign Modal / Form states
  const [subordinateId, setSubordinateId] = useState("");
  const [managerId, setManagerId] = useState("");
  const [formError, setFormError] = useState("");
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Inspector Drawer State
  const [inspectedUserId, setInspectedUserId] = useState<string | null>(null);
  const [inspectorNewMgrId, setInspectorNewMgrId] = useState("");

  // UI state
  const [activeTab, setActiveTab] = useState<"tree" | "matrix" | "list">("tree");
  const [unassignedSearch, setUnassignedSearch] = useState("");
  const [unassignedRoleFilter, setUnassignedRoleFilter] = useState<"all" | "manager" | "coordinator" | "executive">("all");
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});
  const [treeSearch, setTreeSearch] = useState("");
  const [treeRoleFilter, setTreeRoleFilter] = useState<string>("all");
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Drag and Drop state
  const [draggedUser, setDraggedUser] = useState<DraggedUserState | null>(null);
  const [dragOverTargetId, setDragOverTargetId] = useState<string | null>(null);
  const [dragOverValid, setDragOverValid] = useState<boolean | null>(null);
  const [isOverUnassignZone, setIsOverUnassignZone] = useState(false);

  // Process data
  const rawTree = tree as any;
  const allUsers = useMemo<TreeUser[]>(() => (rawTree?.users || rawTree?.all || []) as TreeUser[], [rawTree]);
  const userMap = useMemo(() => {
    const map = new Map<string, TreeUser>();
    allUsers.forEach((u) => map.set(String(u._id), u));
    return map;
  }, [allUsers]);

  const admins = useMemo(() => (rawTree?.admins || []) as TreeUser[], [rawTree?.admins]);
  const managers = useMemo(() => (rawTree?.managers || []) as TreeUser[], [rawTree?.managers]);
  const coordinators = useMemo(() => (rawTree?.coordinators || []) as TreeUser[], [rawTree?.coordinators]);
  const executives = useMemo(() => (rawTree?.executives || []) as TreeUser[], [rawTree?.executives]);

  const unassignedManagers = useMemo(() => (rawTree?.unassignedManagers || []) as TreeUser[], [rawTree?.unassignedManagers]);
  const unassignedCoordinators = useMemo(() => (rawTree?.unassignedCoordinators || []) as TreeUser[], [rawTree?.unassignedCoordinators]);
  const unassignedExecutives = useMemo(() => (rawTree?.unassignedExecutives || []) as TreeUser[], [rawTree?.unassignedExecutives]);

  const allUnassigned = useMemo(() => {
    const list = [...unassignedManagers, ...unassignedCoordinators, ...unassignedExecutives];
    return list.filter((u) => {
      if (unassignedRoleFilter !== "all" && u.wp_role !== unassignedRoleFilter) return false;
      if (!unassignedSearch.trim()) return true;
      const q = unassignedSearch.toLowerCase().trim();
      return (
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.wp_role?.toLowerCase().includes(q)
      );
    });
  }, [unassignedManagers, unassignedCoordinators, unassignedExecutives, unassignedRoleFilter, unassignedSearch]);

  // Matrix-managed members (users with >= 2 managers)
  const matrixUsers = useMemo(() => {
    return allUsers.filter((u) => Array.isArray(u.manager_ids) && u.manager_ids.length > 1);
  }, [allUsers]);

  // Analytics Metrics
  const totalCount = allUsers.length;
  const unassignedTotal = unassignedManagers.length + unassignedCoordinators.length + unassignedExecutives.length;
  const assignedTotal = totalCount - unassignedTotal;
  const coveragePercent = totalCount > 0 ? Math.round((assignedTotal / totalCount) * 100) : 0;
  const edgesCount = (rawTree?.edges || []).length;

  // Options for assignment form
  const subordinateOptions = useMemo(() => {
    return [...managers, ...coordinators, ...executives].sort((a: any, b: any) =>
      String(a.name || "").localeCompare(String(b.name || ""))
    );
  }, [managers, coordinators, executives]);

  const managerOptions = useMemo(() => {
    const sub = subordinateOptions.find((u: any) => String(u._id) === subordinateId);
    const role = sub?.wp_role;
    if (role === "executive") return [...coordinators, ...managers];
    if (role === "coordinator") return [...managers, ...admins];
    if (role === "manager") return [...managers, ...admins];
    return [...coordinators, ...managers, ...admins];
  }, [subordinateId, subordinateOptions, coordinators, managers, admins]);

  // Validation rules for drag and drop
  const checkCanDrop = useCallback(
    (source: DraggedUserState | null, target: TreeUser | null): { allowed: boolean; reason?: string } => {
      if (!source || !target) return { allowed: false, reason: "Invalid drag data" };
      if (String(source._id) === String(target._id)) {
        return { allowed: false, reason: "A user cannot report to themselves" };
      }
      const sourceUser = userMap.get(source._id);
      const currentMgrIds = sourceUser?.manager_ids || (source.reports_to ? [source.reports_to] : []);
      if (currentMgrIds.includes(String(target._id))) {
        return { allowed: false, reason: `Already reporting to ${target.name}` };
      }

      // Hierarchy rule validation
      if (source.wp_role === "executive") {
        if (target.wp_role !== "coordinator" && target.wp_role !== "manager") {
          return { allowed: false, reason: "Executives can report to Coordinators or Managers" };
        }
      } else if (source.wp_role === "coordinator") {
        if (target.wp_role !== "manager" && target.wp_role !== "admin") {
          return { allowed: false, reason: "Coordinators can report to Managers or Admins" };
        }
      } else if (source.wp_role === "manager") {
        if (target.wp_role !== "admin" && target.wp_role !== "manager") {
          return { allowed: false, reason: "Managers can report to Admins or Senior Managers" };
        }
      } else if (source.wp_role === "admin") {
        return { allowed: false, reason: "Admins are at the root level and cannot report to anyone" };
      }

      // Cycle detection: target cannot be a descendant of source
      const queue = [String(target._id)];
      const visited = new Set<string>();
      let hops = 0;
      while (queue.length > 0 && hops < 50) {
        const curr = queue.shift()!;
        if (curr === String(source._id)) {
          return { allowed: false, reason: "Circular reporting detected: cannot report to your own subordinate" };
        }
        if (!visited.has(curr)) {
          visited.add(curr);
          const tUser = userMap.get(curr);
          if (tUser?.report_ids) {
            queue.push(...tUser.report_ids);
          }
        }
        hops++;
      }

      return { allowed: true };
    },
    [userMap]
  );

  // Drag Handlers
  const handleDragStart = (e: React.DragEvent, user: DraggedUserState) => {
    setDraggedUser(user);
    e.dataTransfer.setData("application/json", JSON.stringify(user));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedUser(null);
    setDragOverTargetId(null);
    setDragOverValid(null);
    setIsOverUnassignZone(false);
  };

  const handleNodeDragOver = (e: React.DragEvent, target: TreeUser) => {
    e.preventDefault();
    if (!draggedUser) return;
    const { allowed } = checkCanDrop(draggedUser, target);
    setDragOverTargetId(target._id);
    setDragOverValid(allowed);
    e.dataTransfer.dropEffect = allowed ? "move" : "none";
  };

  const handleNodeDragLeave = (_e: React.DragEvent, targetId: string) => {
    if (dragOverTargetId === targetId) {
      setDragOverTargetId(null);
      setDragOverValid(null);
    }
  };

  const handleNodeDrop = async (e: React.DragEvent, target: TreeUser) => {
    e.preventDefault();
    if (!draggedUser) return;
    const { allowed, reason } = checkCanDrop(draggedUser, target);
    if (!allowed) {
      toast.error(reason || "Invalid mapping action");
      setDragOverTargetId(null);
      setDragOverValid(null);
      return;
    }

    const toastId = toast.loading(`Assigning ${draggedUser.name} → ${target.name}…`);
    try {
      await upsertEdge({ subordinate: draggedUser._id, manager: target._id }).unwrap();
      toast.success(`Saved: ${draggedUser.name} now reports to ${target.name}`, { id: toastId });
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.error || "Failed to save mapping", { id: toastId });
    } finally {
      setDraggedUser(null);
      setDragOverTargetId(null);
      setDragOverValid(null);
    }
  };

  // Unassign Dropzone handlers
  const handleUnassignDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedUser) {
      const sourceUser = userMap.get(draggedUser._id);
      const hasMgr = (sourceUser?.manager_ids || []).length > 0 || Boolean(draggedUser.reports_to);
      if (hasMgr) {
        setIsOverUnassignZone(true);
        e.dataTransfer.dropEffect = "move";
        return;
      }
    }
    e.dataTransfer.dropEffect = "none";
  };

  const handleUnassignDragLeave = () => {
    setIsOverUnassignZone(false);
  };

  const handleUnassignDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsOverUnassignZone(false);
    if (!draggedUser) return;
    const sourceUser = userMap.get(draggedUser._id);
    const hasManagers = (sourceUser?.manager_ids || []).length > 0 || Boolean(draggedUser.reports_to);
    if (!hasManagers) {
      toast.info(`${draggedUser.name} is already unassigned`);
      return;
    }

    const toastId = toast.loading(`Removing all reporting for ${draggedUser.name}…`);
    try {
      await removeEdge({ subordinateId: draggedUser._id }).unwrap();
      toast.success(`Removed reporting for ${draggedUser.name}`, { id: toastId });
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.error || "Failed to remove mapping", { id: toastId });
    } finally {
      setDraggedUser(null);
    }
  };

  // Manual Form Submission
  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!subordinateId || !managerId) {
      setFormError("Select both the report and their manager.");
      return;
    }
    const sub = userMap.get(subordinateId);
    const mgr = userMap.get(managerId);
    const toastId = toast.loading(`Assigning ${sub?.name || "User"} → ${mgr?.name || "Manager"}…`);
    try {
      await upsertEdge({ subordinate: subordinateId, manager: managerId }).unwrap();
      toast.success(`Saved: ${sub?.name || "User"} reports to ${mgr?.name || "Manager"}`, { id: toastId });
      setSubordinateId("");
      setManagerId("");
      setShowAssignModal(false);
      refetch();
    } catch (err: any) {
      const msg = err?.data?.message || err?.error || "Failed to save mapping";
      setFormError(msg);
      toast.error(msg, { id: toastId });
    }
  }

  async function handleUnmap(id: string, specificManagerId?: string) {
    setFormError("");
    const sub = userMap.get(id);
    const mgr = specificManagerId ? userMap.get(specificManagerId) : null;
    const toastId = toast.loading(
      mgr ? `Removing ${sub?.name || "User"} from ${mgr.name}…` : `Removing reporting for ${sub?.name || "User"}…`
    );
    try {
      await removeEdge({ subordinateId: id, managerId: specificManagerId }).unwrap();
      toast.success(
        mgr ? `Removed: ${sub?.name || "User"} no longer reports to ${mgr.name}` : `Removed reporting for ${sub?.name || "User"}`,
        { id: toastId }
      );
      refetch();
    } catch (err: any) {
      const msg = err?.data?.message || err?.error || "Failed to remove mapping";
      setFormError(msg);
      toast.error(msg, { id: toastId });
    }
  }

  const toggleCollapse = (nodeId: string) => {
    setCollapsedNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const expandAll = () => setCollapsedNodes({});
  const collapseAll = () => {
    const collapsed: Record<string, boolean> = {};
    allUsers.forEach((u) => {
      if (u.report_ids && u.report_ids.length > 0) {
        collapsed[u._id] = true;
      }
    });
    setCollapsedNodes(collapsed);
  };

  // Get direct children of any node (supports matrix: multiple managers per subordinate)
  const getDirectReports = useCallback(
    (parentId: string) => {
      return allUsers.filter((u) => {
        if (Array.isArray(u.manager_ids) && u.manager_ids.length > 0) {
          return u.manager_ids.includes(parentId);
        }
        return u.reports_to === parentId;
      });
    },
    [allUsers]
  );

  // Standalone roots (Managers / Coordinators that are not assigned to an Admin but have subordinates)
  const standaloneLeads = useMemo(() => {
    return allUsers.filter((u) => {
      if (u.wp_role === "admin") return false;
      const hasMgr = (u.manager_ids || []).length > 0 || Boolean(u.reports_to);
      if (hasMgr) return false;
      const reports = getDirectReports(u._id);
      return reports.length > 0;
    });
  }, [allUsers, getDirectReports]);

  // CSV Export Function
  const handleExportCsv = () => {
    if (!rawTree?.edges || rawTree.edges.length === 0) {
      toast.info("No reporting edges to export");
      return;
    }
    const headers = ["Subordinate Name", "Subordinate Role", "Subordinate Email", "Manager Name", "Manager Role", "Manager Email"];
    const rows = rawTree.edges.map((e: any) => {
      const sub = userMap.get(String(e.subordinate?._id || e.subordinate));
      const mgr = userMap.get(String(e.manager?._id || e.manager));
      return [
        `"${sub?.name || ""}"`,
        `"${e.subordinate_role || sub?.wp_role || ""}"`,
        `"${sub?.email || ""}"`,
        `"${mgr?.name || ""}"`,
        `"${e.manager_role || mgr?.wp_role || ""}"`,
        `"${mgr?.email || ""}"`,
      ].join(",");
    });
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `lead-team-hierarchy-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Reporting hierarchy exported as CSV");
  };

  // Inspected User details
  const inspectedUser = useMemo(() => {
    if (!inspectedUserId) return null;
    return userMap.get(inspectedUserId) || null;
  }, [inspectedUserId, userMap]);

  if (!adminAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 mb-4 border border-amber-500/20 shadow-lg">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Admin Access Required</h2>
        <p className="mt-2 text-sm text-muted max-w-md">
          Team Manager (who reports to whom) is restricted to Lead Manager administrators.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition shadow-sm"
        >
          Return to Dashboard Overview
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans pb-20">
      {/* Top Header Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-r from-card via-card to-primary/5 p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 text-white shadow-md shadow-primary/25 shrink-0">
              <Network className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-black tracking-tight text-foreground">
                  Team Hierarchy & Matrix Manager
                </h1>
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                  <ShieldCheck className="h-3 w-3" /> Admin Studio
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <GitBranch className="h-3 w-3" /> Matrix Enabled
                </span>
              </div>
              <p className="text-xs text-muted mt-1 max-w-2xl leading-relaxed">
                Configure organizational reporting lines for Lead Manager. Supports matrix co-management (1 Executive ➔ Multiple Coordinators/Managers) and scopes lead visibility down the hierarchy.
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* View Mode Toggle */}
            <div className="inline-flex items-center rounded-2xl border border-border/80 bg-surface-muted/60 p-1 text-xs backdrop-blur-xs">
              <button
                type="button"
                onClick={() => setActiveTab("tree")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                  activeTab === "tree"
                    ? "bg-card text-foreground shadow-xs border border-border/50"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <Network className="h-3.5 w-3.5 text-primary" />
                Org Tree
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("matrix")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                  activeTab === "matrix"
                    ? "bg-card text-foreground shadow-xs border border-border/50"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <GitBranch className="h-3.5 w-3.5 text-indigo-500" />
                Matrix Hub ({matrixUsers.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("list")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                  activeTab === "list"
                    ? "bg-card text-foreground shadow-xs border border-border/50"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <Layers className="h-3.5 w-3.5 text-emerald-500" />
                Table View ({edgesCount})
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowAssignModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 active:scale-95 transition shadow-sm"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Quick Map
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted transition shadow-2xs"
              title="Export reporting hierarchy as CSV"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>

            <button
              type="button"
              onClick={() => refetch()}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted transition shadow-2xs disabled:opacity-50"
              title="Refresh hierarchy from server"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-primary" : ""}`} />
            </button>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute right-0 top-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Workforce */}
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-2xs relative overflow-hidden group hover:border-primary/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-3xs font-extrabold uppercase tracking-wider text-muted">Total Workforce</span>
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground">{totalCount}</span>
            <span className="text-3xs text-muted font-medium">members</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[10px] text-muted font-medium">
            <span className="text-purple-600 font-bold">{admins.length} Admins</span> •{" "}
            <span className="text-emerald-600 font-bold">{managers.length} Mgrs</span> •{" "}
            <span className="text-indigo-600 font-bold">{coordinators.length} Coords</span>
          </div>
        </div>

        {/* Coverage */}
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-2xs relative overflow-hidden group hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-3xs font-extrabold uppercase tracking-wider text-muted">Assigned Coverage</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground">{coveragePercent}%</span>
            <span className="text-3xs text-muted font-medium">{assignedTotal} of {totalCount}</span>
          </div>
          <div className="mt-2 w-full bg-surface-muted rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${coveragePercent}%` }}
            />
          </div>
        </div>

        {/* Matrix Co-Managed */}
        <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-card to-indigo-500/5 p-4 shadow-2xs relative overflow-hidden group hover:border-indigo-500/50 transition">
          <div className="flex items-center justify-between">
            <span className="text-3xs font-extrabold uppercase tracking-wider text-indigo-500">Matrix Co-Managed</span>
            <div className="h-8 w-8 rounded-xl bg-indigo-500/15 flex items-center justify-center text-indigo-500">
              <GitBranch className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{matrixUsers.length}</span>
            <span className="text-3xs text-muted font-medium">shared subordinates</span>
          </div>
          <div className="mt-2 text-[10px] text-indigo-600/80 dark:text-indigo-300 font-medium">
            Reporting to ≥ 2 managers simultaneously
          </div>
        </div>

        {/* Unassigned Pool */}
        <div
          onClick={() => {
            const el = document.getElementById("unassigned-pool-card");
            el?.scrollIntoView({ behavior: "smooth" });
          }}
          className="rounded-2xl border border-border/70 bg-card p-4 shadow-2xs relative overflow-hidden group hover:border-amber-500/40 cursor-pointer transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-3xs font-extrabold uppercase tracking-wider text-muted">Unassigned Pool</span>
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${unassignedTotal > 0 ? "bg-amber-500/15 text-amber-500" : "bg-emerald-500/10 text-emerald-500"}`}>
              <UserMinus className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-black ${unassignedTotal > 0 ? "text-amber-500" : "text-emerald-500"}`}>
              {unassignedTotal}
            </span>
            <span className="text-3xs text-muted font-medium">pending mapping</span>
          </div>
          <div className="mt-2 text-[10px] text-muted font-medium">
            {unassignedTotal > 0 ? "Drag onto any lead to map" : "All members assigned"}
          </div>
        </div>
      </div>

      {/* Main Content Workspace Layout */}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px] items-start">
        {/* Left Column: Views (Tree, Matrix, or List) */}
        <div className="space-y-4">
          {activeTab === "tree" && (
            <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
              {/* Tree Canvas Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-surface-muted/40 px-5 py-3.5 backdrop-blur-xs">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <Network className="h-4 w-4 text-primary" />
                    <span>Visual Org Chart</span>
                  </div>
                  <span className="h-3.5 w-px bg-border" />
                  {/* Role filter chips */}
                  <div className="flex items-center gap-1 text-3xs font-bold">
                    <button
                      type="button"
                      onClick={() => setTreeRoleFilter("all")}
                      className={`px-2 py-0.5 rounded-md transition ${treeRoleFilter === "all" ? "bg-primary text-white" : "text-muted hover:text-foreground"}`}
                    >
                      All Roles
                    </button>
                    <button
                      type="button"
                      onClick={() => setTreeRoleFilter("manager")}
                      className={`px-2 py-0.5 rounded-md transition ${treeRoleFilter === "manager" ? "bg-emerald-500 text-white" : "text-muted hover:text-foreground"}`}
                    >
                      Managers
                    </button>
                    <button
                      type="button"
                      onClick={() => setTreeRoleFilter("coordinator")}
                      className={`px-2 py-0.5 rounded-md transition ${treeRoleFilter === "coordinator" ? "bg-indigo-500 text-white" : "text-muted hover:text-foreground"}`}
                    >
                      Coordinators
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
                    <input
                      type="text"
                      value={treeSearch}
                      onChange={(e) => setTreeSearch(e.target.value)}
                      placeholder="Search tree by name…"
                      className="h-8 rounded-xl border border-border bg-card pl-8 pr-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none w-44 sm:w-56"
                    />
                  </div>

                  {/* Zoom controls */}
                  <div className="flex items-center rounded-xl border border-border bg-card p-0.5 text-muted">
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.max(75, z - 10))}
                      title="Zoom out"
                      className="p-1.5 hover:text-foreground transition rounded-lg hover:bg-surface-muted"
                    >
                      <ZoomOut className="h-3 w-3" />
                    </button>
                    <span className="text-[10px] font-bold px-1.5">{zoomLevel}%</span>
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
                      title="Zoom in"
                      className="p-1.5 hover:text-foreground transition rounded-lg hover:bg-surface-muted"
                    >
                      <ZoomIn className="h-3 w-3" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={expandAll}
                    title="Expand all tree branches"
                    className="flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1.5 text-3xs font-bold text-muted hover:text-foreground transition"
                  >
                    <Maximize2 className="h-3 w-3" /> Expand
                  </button>
                  <button
                    type="button"
                    onClick={collapseAll}
                    title="Collapse all tree branches"
                    className="flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1.5 text-3xs font-bold text-muted hover:text-foreground transition"
                  >
                    <Minimize2 className="h-3 w-3" /> Collapse
                  </button>
                </div>
              </div>

              {/* Tree Canvas */}
              <div
                className="p-6 overflow-x-auto min-h-[500px] bg-gradient-to-b from-card via-card to-background/50 transition-all"
                style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "top left" }}
              >
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-24 text-muted text-xs gap-3">
                    <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                    <span className="font-semibold text-foreground">Rendering interactive team hierarchy…</span>
                  </div>
                ) : admins.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center text-muted">
                    <Shield className="h-12 w-12 mb-3 opacity-30 text-purple-500" />
                    <p className="text-sm font-bold text-foreground">No Admin Roots Configured</p>
                    <p className="text-xs max-w-sm mt-1 text-muted">
                      Assign at least one user with Lead Manager Admin portal role to anchor the root hierarchy.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Root Admins Trees */}
                    <div className="space-y-8">
                      {admins
                        .filter((admin) => {
                          if (!treeSearch.trim()) return true;
                          const q = treeSearch.toLowerCase().trim();
                          return admin.name?.toLowerCase().includes(q) || admin.email?.toLowerCase().includes(q);
                        })
                        .map((admin) => (
                          <TreeNode
                            key={admin._id}
                            user={admin}
                            getDirectReports={getDirectReports}
                            collapsedNodes={collapsedNodes}
                            onToggleCollapse={toggleCollapse}
                            draggedUser={draggedUser}
                            dragOverTargetId={dragOverTargetId}
                            dragOverValid={dragOverValid}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            onDragOver={handleNodeDragOver}
                            onDragLeave={handleNodeDragLeave}
                            onDrop={handleNodeDrop}
                            onUnmap={handleUnmap}
                            onInspect={(u) => setInspectedUserId(u._id)}
                            treeSearch={treeSearch}
                            treeRoleFilter={treeRoleFilter}
                          />
                        ))}
                    </div>

                    {/* Standalone Leads (Managers / Coordinators without an assigned Admin) */}
                    {standaloneLeads.length > 0 && (
                      <div className="pt-8 border-t-2 border-dashed border-border/80">
                        <div className="flex items-center gap-2 mb-5">
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                          <span className="text-xs font-bold text-foreground">
                            Standalone Leads (Managers / Coordinators without assigned Admin)
                          </span>
                          <span className="rounded-full bg-amber-500/15 border border-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-[10px] font-black">
                            {standaloneLeads.length}
                          </span>
                        </div>
                        <div className="space-y-6 pl-2">
                          {standaloneLeads.map((lead) => (
                            <TreeNode
                              key={lead._id}
                              user={lead}
                              getDirectReports={getDirectReports}
                              collapsedNodes={collapsedNodes}
                              onToggleCollapse={toggleCollapse}
                              draggedUser={draggedUser}
                              dragOverTargetId={dragOverTargetId}
                              dragOverValid={dragOverValid}
                              onDragStart={handleDragStart}
                              onDragEnd={handleDragEnd}
                              onDragOver={handleNodeDragOver}
                              onDragLeave={handleNodeDragLeave}
                              onDrop={handleNodeDrop}
                              onUnmap={handleUnmap}
                              onInspect={(u) => setInspectedUserId(u._id)}
                              treeSearch={treeSearch}
                              treeRoleFilter={treeRoleFilter}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Matrix Hub View (Dedicated Matrix Management) */}
          {activeTab === "matrix" && (
            <div className="rounded-3xl border border-border bg-card shadow-sm p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-indigo-500" />
                    Matrix Co-Management Relationships ({matrixUsers.length})
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    Subordinates reporting to multiple Coordinators or Managers simultaneously.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAssignModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-indigo-700 transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Co-Manager Link
                </button>
              </div>

              {matrixUsers.length === 0 ? (
                <div className="py-16 text-center text-muted">
                  <GitBranch className="h-10 w-10 mx-auto mb-2 text-indigo-400 opacity-40" />
                  <p className="text-sm font-bold text-foreground">No Matrix Relationships Configured Yet</p>
                  <p className="text-xs text-muted max-w-sm mx-auto mt-1">
                    To enable matrix reporting, drag any Executive or Coordinator onto an additional Manager/Coordinator in the Org Tree, or use the Quick Map button.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {matrixUsers.map((mUser) => {
                    const managerDocs = (mUser.manager_ids || [])
                      .map((mId) => userMap.get(mId))
                      .filter(Boolean) as TreeUser[];

                    return (
                      <div
                        key={mUser._id}
                        className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-card via-card to-indigo-500/5 p-4 space-y-3.5 shadow-2xs hover:border-indigo-500/40 transition"
                      >
                        {/* Subordinate Card Header */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                              {getInitials(mUser.name)}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-foreground">{mUser.name}</span>
                                <span className="rounded px-1.5 py-0.2 text-[9px] font-bold border bg-sky-500/10 text-sky-600 border-sky-500/30">
                                  {mUser.wp_role}
                                </span>
                              </div>
                              <span className="text-3xs text-muted truncate block">{mUser.email}</span>
                            </div>
                          </div>

                          <span className="rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 text-3xs font-extrabold shrink-0">
                            {managerDocs.length} Managers
                          </span>
                        </div>

                        {/* Connected Managers Chips */}
                        <div className="space-y-1.5 pt-2 border-t border-border/60">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                            Direct Supervisors & Approvers
                          </span>
                          <div className="space-y-1.5">
                            {managerDocs.map((mgr) => (
                              <div
                                key={mgr._id}
                                className="flex items-center justify-between gap-2 rounded-xl border border-border/80 bg-surface-muted/50 px-3 py-1.5 text-xs group hover:bg-surface-muted transition"
                              >
                                <div className="flex items-center gap-2">
                                  <span className={`h-2 w-2 rounded-full ${mgr.wp_role === "manager" ? "bg-emerald-500" : "bg-indigo-500"}`} />
                                  <span className="font-semibold text-foreground text-xs">{mgr.name}</span>
                                  <span className="text-3xs text-muted">({mgr.wp_role})</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleUnmap(mUser._id, mgr._id)}
                                  className="text-muted hover:text-rose-500 p-1 transition opacity-70 group-hover:opacity-100"
                                  title={`Remove reporting to ${mgr.name}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="pt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => setInspectedUserId(mUser._id)}
                            className="text-3xs font-bold text-primary hover:underline flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" /> Inspect Details
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* List View (Table of Edges) */}
          {activeTab === "list" && (
            <div className="rounded-3xl border border-border bg-card shadow-sm p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Layers className="h-4 w-4 text-emerald-500" />
                  Active Reporting Relationships ({edgesCount})
                </h3>
                <span className="text-xs text-muted">
                  Full tabular ledger of all individual reporting lines.
                </span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-muted/60 text-muted border-b border-border text-[11px] font-bold">
                    <tr>
                      <th className="py-3 px-4">Subordinate (Report)</th>
                      <th className="py-3 px-4">Subordinate Role</th>
                      <th className="py-3 px-4">Reports To (Manager)</th>
                      <th className="py-3 px-4">Manager Role</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {(rawTree?.edges || []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted">
                          No active reporting relationships.
                        </td>
                      </tr>
                    ) : (
                      (rawTree?.edges || []).map((edge: any) => {
                        const sub = userMap.get(String(edge.subordinate?._id || edge.subordinate));
                        const mgr = userMap.get(String(edge.manager?._id || edge.manager));
                        const subId = String(edge.subordinate?._id || edge.subordinate);
                        const mgrId = String(edge.manager?._id || edge.manager);
                        const subRole = edge.subordinate_role || sub?.wp_role || "executive";
                        const mgrRole = edge.manager_role || mgr?.wp_role || "manager";

                        return (
                          <tr key={`${subId}-${mgrId}`} className="hover:bg-surface-muted/40 transition">
                            <td className="py-3 px-4 font-bold text-foreground">
                              {sub?.name || edge.subordinate?.name || subId}
                              <span className="block text-3xs font-normal text-muted">{sub?.email}</span>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`rounded px-2 py-0.5 text-[9px] font-bold border ${ROLE_CONFIG[subRole]?.badgeStyle || "bg-surface-muted"}`}
                              >
                                {ROLE_CONFIG[subRole]?.label || subRole}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-bold text-foreground">
                              {mgr?.name || edge.manager?.name || mgrId}
                              <span className="block text-3xs font-normal text-muted">{mgr?.email}</span>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`rounded px-2 py-0.5 text-[9px] font-bold border ${ROLE_CONFIG[mgrRole]?.badgeStyle || "bg-surface-muted"}`}
                              >
                                {ROLE_CONFIG[mgrRole]?.label || mgrRole}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                disabled={removing}
                                onClick={() => handleUnmap(subId, mgrId)}
                                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition disabled:opacity-50"
                                title="Delete relationship edge"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Unassigned Pool Tray & Detach Dropzone */}
        <div className="space-y-5">
          {/* Unassign / Detach Dropzone */}
          <div
            onDragOver={handleUnassignDragOver}
            onDragLeave={handleUnassignDragLeave}
            onDrop={handleUnassignDrop}
            className={`rounded-3xl border-2 border-dashed p-5 text-center transition-all duration-200 ${
              isOverUnassignZone
                ? "border-rose-500 bg-rose-500/15 scale-102 shadow-lg ring-4 ring-rose-500/20"
                : draggedUser && draggedUser.reports_to
                ? "border-amber-500/60 bg-amber-500/10 animate-pulse"
                : "border-border/80 bg-surface-muted/30"
            }`}
          >
            <div className="flex flex-col items-center justify-center gap-2">
              <div
                className={`p-2.5 rounded-2xl transition ${
                  isOverUnassignZone ? "bg-rose-500 text-white shadow-md" : "bg-surface-muted text-muted"
                }`}
              >
                <UserMinus className="h-5 w-5" />
              </div>
              <h4 className="text-xs font-bold text-foreground">Drop Here to Unassign</h4>
              <p className="text-3xs text-muted max-w-xs leading-relaxed">
                Drag any mapped subordinate here to remove their reporting lines and return them to the unassigned pool.
              </p>
            </div>
          </div>

          {/* Unassigned Pool Tray */}
          <div
            id="unassigned-pool-card"
            className="rounded-3xl border border-border bg-card p-5 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Users className="h-4 w-4 text-primary" />
                <span>Unassigned Pool</span>
              </div>
              <span className="rounded-full bg-primary/10 border border-primary/20 text-primary px-2.5 py-0.5 text-3xs font-black">
                {allUnassigned.length}
              </span>
            </div>

            {/* Filter & Search */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
                <input
                  type="text"
                  value={unassignedSearch}
                  onChange={(e) => setUnassignedSearch(e.target.value)}
                  placeholder="Filter by name/email…"
                  className="w-full h-8 rounded-xl border border-border bg-surface-muted/50 pl-8 pr-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>

              {/* Role filter pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-3xs font-bold">
                <button
                  type="button"
                  onClick={() => setUnassignedRoleFilter("all")}
                  className={`rounded-lg px-2.5 py-1 transition ${
                    unassignedRoleFilter === "all"
                      ? "bg-primary text-white shadow-2xs"
                      : "bg-surface-muted text-muted hover:text-foreground"
                  }`}
                >
                  All ({unassignedManagers.length + unassignedCoordinators.length + unassignedExecutives.length})
                </button>
                <button
                  type="button"
                  onClick={() => setUnassignedRoleFilter("manager")}
                  className={`rounded-lg px-2 py-1 transition ${
                    unassignedRoleFilter === "manager"
                      ? "bg-emerald-500 text-white shadow-2xs"
                      : "bg-surface-muted text-muted hover:text-foreground"
                  }`}
                >
                  Mgr ({unassignedManagers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setUnassignedRoleFilter("coordinator")}
                  className={`rounded-lg px-2 py-1 transition ${
                    unassignedRoleFilter === "coordinator"
                      ? "bg-indigo-500 text-white shadow-2xs"
                      : "bg-surface-muted text-muted hover:text-foreground"
                  }`}
                >
                  Coord ({unassignedCoordinators.length})
                </button>
                <button
                  type="button"
                  onClick={() => setUnassignedRoleFilter("executive")}
                  className={`rounded-lg px-2 py-1 transition ${
                    unassignedRoleFilter === "executive"
                      ? "bg-sky-500 text-white shadow-2xs"
                      : "bg-surface-muted text-muted hover:text-foreground"
                  }`}
                >
                  Exec ({unassignedExecutives.length})
                </button>
              </div>
            </div>

            {/* Draggable Unassigned Items */}
            <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-1">
              {allUnassigned.length === 0 ? (
                <div className="py-10 text-center text-muted text-xs">
                  <CheckCircle2 className="h-7 w-7 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="font-bold text-foreground">All members assigned!</p>
                  <p className="text-3xs text-muted mt-0.5">No unassigned users matching criteria.</p>
                </div>
              ) : (
                allUnassigned.map((user) => {
                  const roleStyle = ROLE_CONFIG[user.wp_role] || ROLE_CONFIG.executive;
                  const isBeingDragged = draggedUser?._id === user._id;

                  return (
                    <div
                      key={user._id}
                      draggable={true}
                      onDragStart={(e) =>
                        handleDragStart(e, {
                          _id: user._id,
                          name: user.name,
                          email: user.email,
                          wp_role: user.wp_role,
                          reports_to: null,
                        })
                      }
                      onDragEnd={handleDragEnd}
                      className={`group flex items-center justify-between gap-2.5 rounded-2xl border border-border bg-card p-3 transition-all cursor-grab active:cursor-grabbing hover:border-primary/50 hover:shadow-xs ${
                        isBeingDragged ? "opacity-30 scale-95 border-primary border-dashed" : ""
                      }`}
                      title={`Drag ${user.name} onto a manager or coordinator in the tree`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <GripVertical className="h-4 w-4 text-muted/40 group-hover:text-primary transition shrink-0" />
                        <div
                          className={`h-8 w-8 rounded-xl bg-gradient-to-tr ${roleStyle.avatarBg} flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs`}
                        >
                          {getInitials(user.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-foreground truncate">{user.name}</span>
                            <span
                              className={`rounded px-1.5 py-0.2 text-[9px] font-bold border ${roleStyle.badgeStyle}`}
                            >
                              {roleStyle.label}
                            </span>
                          </div>
                          <p className="text-3xs text-muted truncate">{user.email}</p>
                        </div>
                      </div>

                      <div className="shrink-0 text-muted/40 group-hover:text-primary transition">
                        <ArrowRight className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Map Reporting Relationship</h3>
                  <p className="text-3xs text-muted">Assign a subordinate to a supervisor or add an additional matrix manager.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="rounded-lg p-1 text-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAssign} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  1. Select Subordinate (Report)
                </label>
                <select
                  value={subordinateId}
                  onChange={(e) => {
                    setSubordinateId(e.target.value);
                    setManagerId("");
                  }}
                  className="w-full rounded-xl border border-border bg-surface-muted/60 px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
                  required
                >
                  <option value="">Choose report…</option>
                  {subordinateOptions.map((u: any) => (
                    <option key={String(u._id)} value={String(u._id)}>
                      {u.name} ({u.wp_role})
                      {Array.isArray(u.manager_ids) && u.manager_ids.length > 0
                        ? ` — mapped to ${u.manager_ids.length} manager(s)`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  2. Select Direct Supervisor / Manager
                </label>
                <select
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-muted/60 px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
                  disabled={!subordinateId}
                  required
                >
                  <option value="">Choose supervisor…</option>
                  {managerOptions.map((u: any) => (
                    <option key={String(u._id)} value={String(u._id)}>
                      {u.name} ({u.wp_role})
                    </option>
                  ))}
                </select>
              </div>

              {formError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-600 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !subordinateId || !managerId}
                  className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50 shadow-sm"
                >
                  {saving ? "Saving…" : "Save Mapping"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Inspector Slide-over Drawer */}
      {inspectedUser && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-2xs animate-in fade-in duration-200">
          <div className="w-full max-w-md h-full bg-card border-l border-border shadow-2xl p-6 overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`h-12 w-12 rounded-2xl bg-gradient-to-tr ${ROLE_CONFIG[inspectedUser.wp_role]?.avatarBg || "from-sky-500 to-indigo-600 text-white"} flex items-center justify-center font-bold text-sm shadow-md`}
                >
                  {getInitials(inspectedUser.name)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">{inspectedUser.name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`rounded px-1.5 py-0.2 text-[9px] font-bold border ${ROLE_CONFIG[inspectedUser.wp_role]?.badgeStyle || "bg-surface-muted"}`}
                    >
                      {ROLE_CONFIG[inspectedUser.wp_role]?.label || inspectedUser.wp_role}
                    </span>
                    <span className="text-3xs text-muted">{inspectedUser.email}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectedUserId(null)}
                className="rounded-lg p-1.5 text-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Current Direct Supervisors */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Reporting Supervisors ({(inspectedUser.manager_ids || []).length})
                </h4>
              </div>

              {(inspectedUser.manager_ids || []).length === 0 ? (
                <p className="text-xs text-muted italic bg-surface-muted/40 p-3 rounded-xl">
                  Not currently reporting to any manager (unassigned lead or root admin).
                </p>
              ) : (
                <div className="space-y-2">
                  {(inspectedUser.manager_ids || []).map((mId) => {
                    const mgr = userMap.get(mId);
                    return (
                      <div
                        key={mId}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-muted/50 p-2.5"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs">
                            {getInitials(mgr?.name || "M")}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-foreground">{mgr?.name || mId}</span>
                            <span className="block text-3xs text-muted">{mgr?.wp_role}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleUnmap(inspectedUser._id, mId)}
                          className="text-xs font-bold text-rose-500 hover:bg-rose-500/10 px-2 py-1 rounded-lg transition"
                          title="Unlink manager"
                        >
                          Unlink
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add Co-Manager inline */}
              <div className="pt-2">
                <label className="block text-3xs font-bold text-muted uppercase tracking-wider mb-1">
                  Add Additional Co-Manager
                </label>
                <div className="flex gap-2">
                  <select
                    value={inspectorNewMgrId}
                    onChange={(e) => setInspectorNewMgrId(e.target.value)}
                    className="flex-1 rounded-xl border border-border bg-surface-muted/60 px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                  >
                    <option value="">Select manager…</option>
                    {[...managers, ...coordinators, ...admins]
                      .filter((m) => m._id !== inspectedUser._id && !(inspectedUser.manager_ids || []).includes(m._id))
                      .map((m) => (
                        <option key={m._id} value={m._id}>
                          {m.name} ({m.wp_role})
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    disabled={!inspectorNewMgrId}
                    onClick={async () => {
                      if (!inspectorNewMgrId) return;
                      await upsertEdge({ subordinate: inspectedUser._id, manager: inspectorNewMgrId }).unwrap();
                      toast.success("Added co-manager link");
                      setInspectorNewMgrId("");
                      refetch();
                    }}
                    className="rounded-xl bg-primary text-primary-foreground px-3 py-1.5 text-xs font-bold hover:opacity-90 disabled:opacity-50"
                  >
                    Link
                  </button>
                </div>
              </div>
            </div>

            {/* Direct Reports / Subordinates */}
            <div className="space-y-3 pt-3 border-t border-border">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Users className="h-4 w-4 text-emerald-500" />
                Direct Subordinates ({getDirectReports(inspectedUser._id).length})
              </h4>
              {getDirectReports(inspectedUser._id).length === 0 ? (
                <p className="text-xs text-muted italic bg-surface-muted/40 p-3 rounded-xl">
                  No subordinates reporting directly to this person.
                </p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {getDirectReports(inspectedUser._id).map((sub) => (
                    <div
                      key={sub._id}
                      className="flex items-center justify-between gap-2.5 rounded-xl border border-border bg-surface-muted/30 p-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-md bg-sky-500/10 text-sky-600 flex items-center justify-center font-bold text-[10px]">
                          {getInitials(sub.name)}
                        </div>
                        <span className="text-xs font-medium text-foreground">{sub.name}</span>
                      </div>
                      <span className="text-[10px] text-muted font-bold">{sub.wp_role}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Tree Node Subcomponent for recursive hierarchy rendering
interface TreeNodeProps {
  user: TreeUser;
  parentUser?: TreeUser;
  getDirectReports: (id: string) => TreeUser[];
  collapsedNodes: Record<string, boolean>;
  onToggleCollapse: (id: string) => void;
  draggedUser: DraggedUserState | null;
  dragOverTargetId: string | null;
  dragOverValid: boolean | null;
  onDragStart: (e: React.DragEvent, user: DraggedUserState) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, target: TreeUser) => void;
  onDragLeave: (e: React.DragEvent, targetId: string) => void;
  onDrop: (e: React.DragEvent, target: TreeUser) => void;
  onUnmap: (id: string, managerId?: string) => void;
  onInspect: (user: TreeUser) => void;
  treeSearch: string;
  treeRoleFilter?: string;
  level?: number;
}

function TreeNode({
  user,
  parentUser,
  getDirectReports,
  collapsedNodes,
  onToggleCollapse,
  draggedUser,
  dragOverTargetId,
  dragOverValid,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onUnmap,
  onInspect,
  treeRoleFilter = "all",
  level = 0,
}: TreeNodeProps) {
  const directReports = useMemo(() => getDirectReports(user._id), [getDirectReports, user._id]);
  const isCollapsed = Boolean(collapsedNodes[user._id]);
  const hasChildren = directReports.length > 0;

  const isDragTarget = dragOverTargetId === user._id;
  const isBeingDragged = draggedUser?._id === user._id;

  const roleStyle = ROLE_CONFIG[user.wp_role] || ROLE_CONFIG.executive;
  const isDroppableRole = user.wp_role === "admin" || user.wp_role === "manager" || user.wp_role === "coordinator";
  const hasManager = Boolean(user.reports_to) || (Array.isArray(user.manager_ids) && user.manager_ids.length > 0);
  const isMatrix = Array.isArray(user.manager_ids) && user.manager_ids.length > 1;

  // Filter check
  const matchesFilter =
    treeRoleFilter === "all" ||
    user.wp_role === treeRoleFilter ||
    hasChildren;

  if (!matchesFilter) return null;

  return (
    <div className={`relative ${level > 0 ? "ml-6 sm:ml-8 pl-4 border-l-2 border-border/70" : ""}`}>
      {/* Node Card */}
      <div
        draggable={user.wp_role !== "admin"}
        onDragStart={(e) =>
          onDragStart(e, {
            _id: user._id,
            name: user.name,
            email: user.email,
            wp_role: user.wp_role,
            reports_to: user.reports_to || null,
          })
        }
        onDragEnd={onDragEnd}
        onDragOver={(e) => isDroppableRole && onDragOver(e, user)}
        onDragLeave={() => isDroppableRole && onDragLeave(null as any, user._id)}
        onDrop={(e) => isDroppableRole && onDrop(e, user)}
        className={`group relative inline-flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-2xl border p-3.5 transition-all duration-200 w-full sm:w-auto min-w-0 sm:min-w-[300px] max-w-full backdrop-blur-xs ${
          isBeingDragged
            ? "opacity-30 scale-95 border-dashed border-primary shadow-none"
            : isDragTarget && dragOverValid
            ? "border-emerald-500 bg-emerald-500/10 ring-4 ring-emerald-500/20 scale-102 shadow-lg"
            : isDragTarget && !dragOverValid
            ? "border-rose-500 bg-rose-500/10 ring-4 ring-rose-500/20 scale-102 shadow-lg"
            : "border-border/90 bg-card hover:border-border hover:shadow-xs"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Collapse Toggle / Grab Handle */}
          <div className="flex items-center gap-1 shrink-0">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => onToggleCollapse(user._id)}
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface-muted active:scale-90 text-muted hover:text-foreground transition cursor-pointer"
                title={isCollapsed ? "Expand subordinates" : "Collapse subordinates"}
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            ) : (
              <div className="w-7 flex justify-center text-muted/30">
                <span className="h-1.5 w-1.5 rounded-full bg-border" />
              </div>
            )}

            {user.wp_role !== "admin" && (
              <GripVertical className="h-4 w-4 text-muted/40 group-hover:text-primary transition cursor-grab active:cursor-grabbing shrink-0" />
            )}
          </div>

          {/* Avatar Icon */}
          <div
            className={`h-9 w-9 rounded-xl bg-gradient-to-tr ${roleStyle.avatarBg} flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs`}
          >
            {getInitials(user.name)}
          </div>

          {/* User Details */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="text-xs font-bold text-foreground truncate">{user.name}</span>
              <span
                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.2 text-[9px] font-bold border ${roleStyle.badgeStyle}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${roleStyle.dot}`} />
                {roleStyle.label}
              </span>

              {isMatrix && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.2 text-[9px] font-black"
                  title={`Reports to ${user.manager_ids?.length} managers simultaneously`}
                >
                  <GitBranch className="h-2.5 w-2.5" /> Matrix ({user.manager_ids?.length})
                </span>
              )}

              {hasChildren && (
                <span className="rounded-full bg-surface-muted border border-border/80 px-2 py-0.2 text-[9px] font-extrabold text-muted">
                  {directReports.length} {directReports.length === 1 ? "report" : "reports"}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 text-3xs text-muted mt-0.5 truncate">
              <span className="truncate">{user.email}</span>
              {user.department && (
                <>
                  <span>•</span>
                  <span className="truncate font-medium text-muted/80">
                    {typeof user.department === "object" ? (user.department as any)?.name : user.department}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons & Indicator */}
        <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
          {isDragTarget && (
            <span
              className={`rounded-lg px-2 py-0.5 text-[9px] font-bold animate-pulse ${
                dragOverValid ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
              }`}
            >
              {dragOverValid ? "Drop to Link" : "Invalid Target"}
            </span>
          )}

          <button
            type="button"
            onClick={() => onInspect(user)}
            title="Inspect member details & reporting lines"
            className="rounded-lg p-1.5 text-muted hover:text-foreground hover:bg-surface-muted transition opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>

          {user.wp_role !== "admin" && hasManager && (
            <button
              type="button"
              onClick={() => onUnmap(user._id, parentUser?._id)}
              title={parentUser ? `Unassign from ${parentUser.name}` : "Unassign manager"}
              className="rounded-lg p-1.5 text-muted hover:text-rose-500 hover:bg-rose-500/10 active:scale-95 transition opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Child Subordinates Branch */}
      {hasChildren && !isCollapsed && (
        <div className="mt-3.5 space-y-3.5">
          {directReports.map((child) => (
            <TreeNode
              key={`${child._id}-${user._id}`}
              user={child}
              parentUser={user}
              getDirectReports={getDirectReports}
              collapsedNodes={collapsedNodes}
              onToggleCollapse={onToggleCollapse}
              draggedUser={draggedUser}
              dragOverTargetId={dragOverTargetId}
              dragOverValid={dragOverValid}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onUnmap={onUnmap}
              onInspect={onInspect}
              treeSearch=""
              treeRoleFilter={treeRoleFilter}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
