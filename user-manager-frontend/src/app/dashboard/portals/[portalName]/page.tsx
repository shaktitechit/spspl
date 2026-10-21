"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Globe,
  ArrowLeft,
  Shield,
  Users,
  Edit,
  Trash2,
  Search,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  Building2,
  Check,
  X,
  Plus,
  Settings,
  UserCheck,
  Sparkles,
  RefreshCw,
  Layers,
} from "lucide-react";
import { readSessionFromStorage } from "@/utils/authStorage";
import { API_BASE, getAuthHeaders, extractList } from "@/utils/apiHelpers";
import { DeptBadge } from "@/components/DeptBadge";
import type { Portal } from "@/types/userManager";

type TabType = "overview" | "users" | "roles" | "settings";

export default function PortalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const rawParam = (params?.portalName as string) || "";
  const portalParam = decodeURIComponent(rawParam).trim();

  const [session, setSession] = useState<any>(null);
  const [portal, setPortal] = useState<Portal | null>(null);
  const [allPortals, setAllPortals] = useState<Portal[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Edit & Roles Form State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    code: "",
    description: "",
    access_roles_input: "",
    is_active: true,
  });

  // Quick Role Add State
  const [newRoleInput, setNewRoleInput] = useState("");

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setSession(readSessionFromStorage());
  }, []);

  const token = session?.token;

  // Fetch portal details & assigned users
  const fetchData = useCallback(async () => {
    if (!token || !portalParam) return;
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch all portals to locate target portal
      const resPortals = await fetch(`${API_BASE}/api/portals?include_inactive=true`, {
        headers: getAuthHeaders(token),
      });

      if (!resPortals.ok) {
        throw new Error("Could not fetch portals data.");
      }

      const portalData = await resPortals.json();
      const portalsList: Portal[] = extractList(portalData);
      setAllPortals(portalsList);

      const target = portalsList.find((p) => {
        const pId = String(p._id || p.id || "").toLowerCase();
        const pCode = String(p.code || "").toLowerCase();
        const pName = String(p.name || "").toLowerCase();
        const searchVal = portalParam.toLowerCase();
        return pId === searchVal || pCode === searchVal || pName === searchVal;
      });

      if (!target) {
        throw new Error(`Portal "${portalParam}" not found in system.`);
      }

      setPortal(target);
      setEditForm({
        name: target.name,
        code: target.code,
        description: target.description || "",
        access_roles_input: (target.access_roles || ["executive", "manager"]).join(", "),
        is_active: target.is_active !== false,
      });

      // 2. Fetch all system users to calculate assigned users for this portal
      const resUsers = await fetch(`${API_BASE}/api/users`, {
        headers: getAuthHeaders(token),
      });

      if (resUsers.ok) {
        const uData = await resUsers.json();
        const usersList = extractList(uData);

        const targetCode = String(target.code || "").toLowerCase();
        const targetName = String(target.name || "").toLowerCase();
        const targetId = String(target._id || target.id || "").toLowerCase();

        const filtered = usersList.filter((u: any) => {
          const userPortals = Array.isArray(u.portals)
            ? u.portals
            : Array.isArray(u.portal_access)
            ? u.portal_access
            : [];

          return userPortals.some((up: any) => {
            if (!up) return false;
            const upCode = String(up.portal_code || up.portal?.code || (typeof up.portal === "string" ? up.portal : "")).toLowerCase();
            const upName = String(up.portal_name || up.portal?.name || "").toLowerCase();
            const upId = String(up.portal_id || up.portal?._id || up.portal?.id || "").toLowerCase();
            return upCode === targetCode || (upName && upName === targetName) || (upId && upId === targetId);
          });
        });

        setAssignedUsers(filtered);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load portal details.");
    } finally {
      setIsLoading(false);
    }
  }, [token, portalParam]);

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token, fetchData]);

  // Handle Edit / Save Portal Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !portal) return;

    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    const rolesArr = editForm.access_roles_input
      .split(",")
      .map((r) => r.trim().toLowerCase())
      .filter(Boolean);

    const portalId = portal._id || portal.id;

    try {
      const res = await fetch(`${API_BASE}/api/portals/${portalId}`, {
        method: "PUT",
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          name: editForm.name.trim(),
          code: editForm.code.trim().toLowerCase(),
          description: editForm.description.trim(),
          access_roles: rolesArr.length > 0 ? rolesArr : ["executive", "manager"],
          is_active: editForm.is_active,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to update portal.");
      }

      const updated = await res.json();
      const newPortal = updated?.data || updated?.portal || { ...portal, ...editForm, access_roles: rolesArr };
      setPortal(newPortal);
      setSuccessMsg("Portal configuration updated successfully.");
      await fetchData();
    } catch (e: any) {
      setError(e?.message || "Could not update portal.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add / Remove Role quickly in Roles tab
  const handleUpdateRoles = async (newRoles: string[]) => {
    if (!token || !portal) return;
    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    const portalId = portal._id || portal.id;
    try {
      const res = await fetch(`${API_BASE}/api/portals/${portalId}`, {
        method: "PUT",
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          access_roles: newRoles,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update access roles.");
      }

      setEditForm((prev) => ({
        ...prev,
        access_roles_input: newRoles.join(", "),
      }));
      setSuccessMsg("Portal access roles updated.");
      await fetchData();
    } catch (e: any) {
      setError(e?.message || "Could not update access roles.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleInput.trim() || !portal) return;
    const cleanRole = newRoleInput.trim().toLowerCase();
    const currentRoles = portal.access_roles || ["executive", "manager"];
    if (currentRoles.includes(cleanRole)) {
      setNewRoleInput("");
      return;
    }
    const updated = [...currentRoles, cleanRole];
    handleUpdateRoles(updated);
    setNewRoleInput("");
  };

  const handleRemoveRole = (roleToRemove: string) => {
    if (!portal) return;
    const currentRoles = portal.access_roles || ["executive", "manager"];
    const updated = currentRoles.filter((r) => r !== roleToRemove);
    handleUpdateRoles(updated);
  };

  // Delete Portal
  const handleDeletePortal = async () => {
    if (!token || !portal) return;
    const portalId = portal._id || portal.id;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/portals/${portalId}`, {
        method: "DELETE",
        headers: getAuthHeaders(token),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to delete portal.");
      }
      router.push("/dashboard/portals");
    } catch (e: any) {
      setError(e?.message || "Could not delete portal.");
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // Filter users by search query
  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();
    return assignedUsers.filter((u) => {
      return (
        (u.name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.department || "").toLowerCase().includes(q)
      );
    });
  }, [assignedUsers, search]);

  // Compute User Counts per Access Role
  const roleUserCounts = useMemo(() => {
    if (!portal) return {};
    const targetCode = String(portal.code || "").toLowerCase();
    const targetName = String(portal.name || "").toLowerCase();
    const counts: Record<string, number> = {};

    (portal.access_roles || []).forEach((r) => {
      counts[r] = 0;
    });

    assignedUsers.forEach((u) => {
      const userPortals = Array.isArray(u.portals)
        ? u.portals
        : Array.isArray(u.portal_access)
        ? u.portal_access
        : [];

      const match = userPortals.find((up: any) => {
        if (!up) return false;
        const upCode = String(up.portal_code || up.portal?.code || (typeof up.portal === "string" ? up.portal : "")).toLowerCase();
        const upName = String(up.portal_name || up.portal?.name || "").toLowerCase();
        return upCode === targetCode || (upName && upName === targetName);
      });

      if (match) {
        const roles: string[] = Array.isArray(match.access_roles) && match.access_roles.length > 0
          ? match.access_roles
          : match.access_role
          ? [match.access_role]
          : [];

        roles.forEach((r) => {
          counts[r] = (counts[r] || 0) + 1;
        });
      }
    });

    return counts;
  }, [portal, assignedUsers]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto pb-10">
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard/portals"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted transition shadow-xs"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Portals
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-16 text-muted gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs font-semibold">Loading portal details…</p>
        </div>
      </div>
    );
  }

  if (error && !portal) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto pb-10">
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard/portals"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted transition shadow-xs"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Portals
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center space-y-3">
          <AlertTriangle className="h-10 w-10 text-rose-500" />
          <h3 className="text-base font-bold text-foreground">Portal Not Found</h3>
          <p className="text-xs text-muted max-w-md">{error}</p>
          <Link
            href="/dashboard/portals"
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary/90 transition"
          >
            Return to Portals List
          </Link>
        </div>
      </div>
    );
  }

  const isActive = portal?.is_active !== false;
  const accessRoles = portal?.access_roles || ["executive", "manager"];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Alert Messages */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-600 dark:text-rose-400">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs text-emerald-600 dark:text-emerald-400">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/portals"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted transition shadow-xs"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-foreground tracking-tight">{portal?.name}</h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-3xs font-semibold border ${
                  isActive
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-slate-500/10 text-slate-500 border-slate-500/20"
                }`}
              >
                {isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="text-3xs font-mono text-muted mt-0.5">code: {portal?.code}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted transition shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="flex items-center gap-2 border-b border-border pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition ${
            activeTab === "overview"
              ? "bg-primary text-white shadow-sm"
              : "text-muted hover:text-foreground hover:bg-surface-muted"
          }`}
        >
          <Globe className="h-4 w-4" /> Overview
        </button>

        <button
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition ${
            activeTab === "users"
              ? "bg-primary text-white shadow-sm"
              : "text-muted hover:text-foreground hover:bg-surface-muted"
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Assigned Users</span>
          <span
            className={`rounded-full px-2 py-0.2 text-3xs font-extrabold ${
              activeTab === "users" ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
            }`}
          >
            {assignedUsers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("roles")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition ${
            activeTab === "roles"
              ? "bg-primary text-white shadow-sm"
              : "text-muted hover:text-foreground hover:bg-surface-muted"
          }`}
        >
          <Shield className="h-4 w-4" />
          <span>Access Roles</span>
          <span
            className={`rounded-full px-2 py-0.2 text-3xs font-extrabold ${
              activeTab === "roles" ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
            }`}
          >
            {accessRoles.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition ${
            activeTab === "settings"
              ? "bg-primary text-white shadow-sm"
              : "text-muted hover:text-foreground hover:bg-surface-muted"
          }`}
        >
          <Settings className="h-4 w-4" /> Settings & Danger Zone
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => setActiveTab("users")}
              className="rounded-2xl border border-border bg-card p-5 shadow-xs flex items-center gap-4 text-left hover:border-primary/40 transition group"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary group-hover:scale-105 transition font-bold">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-3xs uppercase font-bold text-muted tracking-wider">Assigned Accounts</p>
                <p className="text-2xl font-black text-foreground mt-0.5">{assignedUsers.length}</p>
              </div>
            </button>

            <button
              onClick={() => setActiveTab("roles")}
              className="rounded-2xl border border-border bg-card p-5 shadow-xs flex items-center gap-4 text-left hover:border-primary/40 transition group"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary group-hover:scale-105 transition font-bold">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <p className="text-3xs uppercase font-bold text-muted tracking-wider">Allowed Access Roles</p>
                <p className="text-2xl font-black text-foreground mt-0.5">{accessRoles.length}</p>
              </div>
            </button>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary font-bold">
                <Globe className="h-6 w-6" />
              </div>
              <div>
                <p className="text-3xs uppercase font-bold text-muted tracking-wider">Portal System Code</p>
                <p className="text-sm font-bold text-foreground mt-1 font-mono">{portal?.code}</p>
              </div>
            </div>
          </div>

          {/* Configuration Card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <Globe className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Portal Description & Details</h3>
              </div>

              <button
                onClick={() => setActiveTab("settings")}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <Edit className="h-3.5 w-3.5" /> Edit Configuration
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="space-y-3">
                <div>
                  <p className="text-3xs uppercase font-bold text-muted tracking-wider mb-1">Description</p>
                  <p className="text-foreground leading-relaxed">
                    {portal?.description || "No description provided for this portal."}
                  </p>
                </div>

                <div>
                  <p className="text-3xs uppercase font-bold text-muted tracking-wider mb-1">System Code</p>
                  <span className="rounded-lg bg-surface-muted border border-border font-mono text-3xs px-2.5 py-1 font-bold text-foreground">
                    {portal?.code}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-3xs uppercase font-bold text-muted tracking-wider mb-2">
                    Role Distribution Breakdown
                  </p>
                  <div className="space-y-2">
                    {accessRoles.map((role, idx) => {
                      const count = roleUserCounts[role] || 0;
                      return (
                        <div key={idx} className="flex items-center justify-between rounded-xl border border-border bg-surface-muted p-2.5">
                          <span className="font-semibold text-foreground capitalize">{role}</span>
                          <span className="rounded-full bg-primary/15 text-primary text-3xs font-extrabold px-2 py-0.5">
                            {count} {count === 1 ? "User" : "Users"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ASSIGNED USERS */}
      {activeTab === "users" && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Assigned System Accounts</h3>
              <p className="text-xs text-muted mt-0.5">
                All user accounts that have permission to log in and use {portal?.name}
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Users className="h-8 w-8 text-muted mx-auto opacity-50" />
              <p className="text-xs font-semibold text-foreground">No accounts found</p>
              <p className="text-3xs text-muted">
                {search ? "No users match your search criteria." : `No users have been assigned access to ${portal?.name} yet.`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted bg-surface-muted font-semibold uppercase tracking-wider">
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Access Role in {portal?.name}</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {filteredUsers.map((u: any) => {
                    const uid = String(u._id || u.id || "");
                    const isUserActive = u.is_active !== false;

                    const userPortals = Array.isArray(u.portals)
                      ? u.portals
                      : Array.isArray(u.portal_access)
                      ? u.portal_access
                      : [];

                    const targetCode = String(portal?.code || "").toLowerCase();
                    const targetName = String(portal?.name || "").toLowerCase();

                    const matchingAssignment = userPortals.find((up: any) => {
                      if (!up) return false;
                      const upCode = String(up.portal_code || up.portal?.code || (typeof up.portal === "string" ? up.portal : "")).toLowerCase();
                      const upName = String(up.portal_name || up.portal?.name || "").toLowerCase();
                      return upCode === targetCode || (upName && upName === targetName);
                    });

                    const rolesInPortal: string[] = Array.isArray(matchingAssignment?.access_roles) && matchingAssignment.access_roles.length > 0
                      ? matchingAssignment.access_roles
                      : matchingAssignment?.access_role
                      ? [matchingAssignment.access_role]
                      : [];

                    return (
                      <tr key={uid} className="hover:bg-surface-muted transition">
                        <td className="px-4 py-3">
                          <Link href={`/dashboard/portals/${portal?.code || portalParam}/${uid}`} className="flex items-center gap-3 group">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-xs font-extrabold text-primary group-hover:scale-105 transition">
                              {(u.name || "U").charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-foreground group-hover:text-primary transition">{u.name || "—"}</p>
                              <p className="truncate text-xs text-muted">{u.email || "—"}</p>
                            </div>
                          </Link>
                        </td>

                        <td className="px-4 py-3">
                          <DeptBadge dept={u.department || "unknown"} />
                        </td>

                        <td className="px-4 py-3">
                          {rolesInPortal.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {rolesInPortal.map((r, rIdx) => (
                                <span
                                  key={rIdx}
                                  className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 text-3xs font-semibold capitalize"
                                >
                                  {r}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted italic">General access</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-center">
                          {isUserActive ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                              <CheckCircle className="h-3 w-3" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                              <XCircle className="h-3 w-3" /> Inactive
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/dashboard/portals/${portal?.code || portalParam}/${uid}`}
                              className="rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition"
                            >
                              Portal Access
                            </Link>
                            <Link
                              href={`/dashboard/user-directory/${uid}`}
                              className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted hover:text-foreground hover:bg-surface-muted transition"
                            >
                              Account Profile
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ACCESS ROLES MANAGEMENT */}
      {activeTab === "roles" && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Configure Portal Access Roles</h3>
              <p className="text-xs text-muted mt-0.5">
                Define allowed user roles for {portal?.name} (e.g. executive, manager, admin)
              </p>
            </div>

            {/* Quick Add Role Form */}
            <form onSubmit={handleAddRole} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="New role name..."
                value={newRoleInput}
                onChange={(e) => setNewRoleInput(e.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSubmitting || !newRoleInput.trim()}
                className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-primary/90 transition disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> Add Role
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {accessRoles.map((role, idx) => {
              const userCount = roleUserCounts[role] || 0;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex flex-col justify-between space-y-3 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-foreground capitalize">{role}</h4>
                      <p className="text-3xs text-muted mt-0.5 font-mono">role_code: {role}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveRole(role)}
                      title={`Remove ${role} role`}
                      className="rounded-lg p-1 text-muted hover:text-rose-500 hover:bg-rose-500/10 transition"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="pt-2 border-t border-primary/10 flex items-center justify-between text-2xs">
                    <span className="text-muted">Assigned Users</span>
                    <span className="rounded-full bg-primary/20 text-primary font-bold px-2 py-0.5">
                      {userCount}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: SETTINGS & DANGER ZONE */}
      {activeTab === "settings" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Settings className="h-5 w-5 text-primary" />
              <h3 className="text-base font-bold text-foreground">Edit Portal Settings</h3>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs max-w-xl">
              <div>
                <label className="block font-semibold text-foreground mb-1">Portal Display Name</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Portal Code Identifier</label>
                <input
                  type="text"
                  required
                  value={editForm.code}
                  onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background p-2.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Allowed Access Roles (Comma Separated)
                </label>
                <input
                  type="text"
                  value={editForm.access_roles_input}
                  onChange={(e) => setEditForm({ ...editForm, access_roles_input: e.target.value })}
                  placeholder="executive, manager, admin"
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="tabIsActive"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="tabIsActive" className="font-semibold text-foreground cursor-pointer">
                  Portal is Active
                </label>
              </div>

              <div className="pt-3 border-t border-border">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-bold text-white shadow-md hover:bg-primary/90 transition disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Settings
                </button>
              </div>
            </form>
          </div>

          {/* Danger Zone */}
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 border-b border-rose-500/20 pb-3">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-base font-bold">Danger Zone</h3>
            </div>
            <p className="text-xs text-muted max-w-xl leading-relaxed">
              Deleting this portal will remove its configuration entry from the auth-service portal directory. This action is permanent.
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-rose-700 transition"
            >
              <Trash2 className="h-4 w-4" /> Delete Portal
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-500">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="text-base font-bold text-foreground">Delete Portal</h3>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Are you sure you want to delete <strong className="text-foreground">{portal?.name}</strong> ({portal?.code})? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted hover:text-foreground transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePortal}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-rose-700 transition disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Delete Portal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
