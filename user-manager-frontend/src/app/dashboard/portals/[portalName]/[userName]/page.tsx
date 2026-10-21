"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Globe,
  User,
  ArrowLeft,
  Shield,
  Mail,
  Phone,
  Building2,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Loader2,
  AlertTriangle,
  Key,
  Layers,
  ExternalLink,
  Save,
  X,
  Plus,
  ShieldCheck,
  Check,
  RefreshCw,
  UserCheck,
} from "lucide-react";
import { readSessionFromStorage } from "@/utils/authStorage";
import { API_BASE, getAuthHeaders, extractList } from "@/utils/apiHelpers";
import { DeptBadge } from "@/components/DeptBadge";
import type { Portal, UserPortalAssignment } from "@/types/userManager";

type TabType = "overview" | "roles" | "portals" | "account";

export default function PortalUserDetailPage() {
  const params = useParams();
  const router = useRouter();

  const rawPortalParam = (params?.portalName as string) || "";
  const rawUserParam = (params?.userName as string) || "";

  const portalParam = decodeURIComponent(rawPortalParam).trim();
  const userParam = decodeURIComponent(rawUserParam).trim();

  const [session, setSession] = useState<any>(null);
  const [portal, setPortal] = useState<Portal | null>(null);
  const [targetUser, setTargetUser] = useState<any | null>(null);
  const [allPortals, setAllPortals] = useState<Portal[]>([]);

  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Portal Access Roles Editing State
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [isSavingRoles, setIsSavingRoles] = useState(false);

  useEffect(() => {
    setSession(readSessionFromStorage());
  }, []);

  const token = session?.token;

  // Fetch Portal & User Data
  const fetchData = useCallback(async () => {
    if (!token || !portalParam || !userParam) return;
    setIsLoading(true);
    setError(null);

    try {
      // 1. Fetch Portals list
      const resPortals = await fetch(`${API_BASE}/api/portals?include_inactive=true`, {
        headers: getAuthHeaders(token),
      });

      if (!resPortals.ok) {
        throw new Error("Could not fetch portals data.");
      }

      const portalData = await resPortals.json();
      const portalsList: Portal[] = extractList(portalData);
      setAllPortals(portalsList);

      const foundPortal = portalsList.find((p) => {
        const pId = String(p._id || p.id || "").toLowerCase();
        const pCode = String(p.code || "").toLowerCase();
        const pName = String(p.name || "").toLowerCase();
        const searchVal = portalParam.toLowerCase();
        return pId === searchVal || pCode === searchVal || pName === searchVal;
      });

      if (!foundPortal) {
        throw new Error(`Portal "${portalParam}" not found.`);
      }

      setPortal(foundPortal);

      // 2. Fetch User details
      let foundUser: any = null;

      const resUser = await fetch(`${API_BASE}/api/users/${userParam}`, {
        headers: getAuthHeaders(token),
      }).catch(() => null);

      if (resUser && resUser.ok) {
        const uRes = await resUser.json();
        foundUser = uRes?.data || uRes?.user || uRes;
      }

      if (!foundUser) {
        const resAllUsers = await fetch(`${API_BASE}/api/users`, {
          headers: getAuthHeaders(token),
        });

        if (resAllUsers.ok) {
          const uListData = await resAllUsers.json();
          const usersList = extractList(uListData);
          const searchVal = userParam.toLowerCase();

          foundUser = usersList.find((u: any) => {
            const uId = String(u._id || u.id || "").toLowerCase();
            const uEmail = String(u.email || "").toLowerCase();
            const uName = String(u.name || "").toLowerCase();
            return uId === searchVal || uEmail === searchVal || uName === searchVal;
          });
        }
      }

      if (!foundUser) {
        throw new Error(`User "${userParam}" not found in system.`);
      }

      setTargetUser(foundUser);

      // Extract existing access roles for this portal
      const targetCode = String(foundPortal.code || "").toLowerCase();
      const targetName = String(foundPortal.name || "").toLowerCase();
      const userPortals = Array.isArray(foundUser.portals)
        ? foundUser.portals
        : Array.isArray(foundUser.portal_access)
        ? foundUser.portal_access
        : [];

      const currentAssignment = userPortals.find((up: any) => {
        if (!up) return false;
        const upCode = String(up.portal_code || up.portal?.code || (typeof up.portal === "string" ? up.portal : "")).toLowerCase();
        const upName = String(up.portal_name || up.portal?.name || "").toLowerCase();
        return upCode === targetCode || (upName && upName === targetName);
      });

      const roles: string[] = Array.isArray(currentAssignment?.access_roles) && currentAssignment.access_roles.length > 0
        ? currentAssignment.access_roles
        : currentAssignment?.access_role
        ? [currentAssignment.access_role]
        : [];

      setSelectedRoles(roles);
    } catch (e: any) {
      setError(e?.message || "Failed to load details.");
    } finally {
      setIsLoading(false);
    }
  }, [token, portalParam, userParam]);

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token, fetchData]);

  // Handle Save Portal Access Roles for this User
  const handleSavePortalRoles = async () => {
    if (!token || !targetUser || !portal) return;

    setIsSavingRoles(true);
    setError(null);
    setSuccessMsg(null);

    const uid = String(targetUser._id || targetUser.id || "");
    const targetCode = String(portal.code || "").toLowerCase();

    const existingPortals: UserPortalAssignment[] = Array.isArray(targetUser.portals)
      ? targetUser.portals
      : Array.isArray(targetUser.portal_access)
      ? targetUser.portal_access
      : [];

    let updatedPortals: UserPortalAssignment[] = [];
    const matchIndex = existingPortals.findIndex((p: any) => {
      const pCode = String(p.portal_code || p.portal?.code || (typeof p.portal === "string" ? p.portal : "")).toLowerCase();
      return pCode === targetCode;
    });

    if (matchIndex >= 0) {
      updatedPortals = existingPortals.map((p: any, idx: number) => {
        if (idx === matchIndex) {
          return {
            ...p,
            portal_code: portal.code,
            portal_name: portal.name,
            access_roles: selectedRoles,
          };
        }
        return p;
      });
    } else {
      updatedPortals = [
        ...existingPortals,
        {
          portal_code: portal.code,
          portal_name: portal.name,
          access_roles: selectedRoles,
        },
      ];
    }

    try {
      const res = await fetch(`${API_BASE}/api/users/${uid}`, {
        method: "PATCH",
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          portals: updatedPortals,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to update user portal access roles.");
      }

      setSuccessMsg(`Access roles for ${targetUser.name} in ${portal.name} updated successfully.`);
      await fetchData();
    } catch (e: any) {
      setError(e?.message || "Could not save role changes.");
    } finally {
      setIsSavingRoles(false);
    }
  };

  const toggleRoleSelection = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-10">
        <div className="flex items-center justify-between">
          <Link
            href={`/dashboard/portals/${portalParam}`}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted transition shadow-xs"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Portal
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-16 text-muted gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs font-semibold">Loading user portal access details…</p>
        </div>
      </div>
    );
  }

  if (error && (!portal || !targetUser)) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-10">
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
          <h3 className="text-base font-bold text-foreground">Record Not Found</h3>
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

  const uid = String(targetUser._id || targetUser.id || "");
  const isUserActive = targetUser.is_active !== false;
  const allowedPortalRoles = portal?.access_roles || ["executive", "manager"];

  // Other portals this user has access to
  const userPortalsList = Array.isArray(targetUser.portals)
    ? targetUser.portals
    : Array.isArray(targetUser.portal_access)
    ? targetUser.portal_access
    : [];

  const otherPortals = userPortalsList.filter((up: any) => {
    if (!up) return false;
    const upCode = String(up.portal_code || up.portal?.code || (typeof up.portal === "string" ? up.portal : "")).toLowerCase();
    return upCode !== String(portal?.code || "").toLowerCase();
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* Messages */}
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

      {/* Navigation & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/portals/${portal?.code || portalParam}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted transition shadow-xs"
          >
            <ArrowLeft className="h-4 w-4" /> Back to {portal?.name}
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-3xs text-muted">Portals</span>
              <span className="text-3xs text-muted">/</span>
              <Link
                href={`/dashboard/portals/${portal?.code || portalParam}`}
                className="text-3xs font-semibold text-primary hover:underline"
              >
                {portal?.name}
              </Link>
              <span className="text-3xs text-muted">/</span>
              <span className="text-3xs font-semibold text-foreground">{targetUser.name}</span>
            </div>
            <h1 className="text-xl font-bold text-foreground tracking-tight mt-0.5">{targetUser.name}</h1>
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

      {/* User Header Profile Card */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-2xl font-black text-primary shadow-xs">
            {(targetUser.name || "U").charAt(0).toUpperCase()}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg font-bold text-foreground">{targetUser.name}</h2>
              {isUserActive ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-0.5 text-3xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle className="h-3 w-3" /> Active User
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 text-3xs font-semibold text-slate-600 dark:text-slate-400">
                  <XCircle className="h-3 w-3" /> Inactive Account
                </span>
              )}
            </div>

            <p className="text-xs text-muted flex items-center gap-2">
              <Mail className="h-3.5 w-3.5" /> {targetUser.email || "No email"}
            </p>

            <div className="flex items-center gap-2 pt-1">
              <DeptBadge dept={targetUser.department || "unknown"} />
              {targetUser.phone && (
                <span className="text-3xs text-muted flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {targetUser.phone}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:w-64 space-y-1.5 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <Globe className="h-4 w-4 text-primary" />
            <span>Target Portal</span>
          </div>
          <p className="text-sm font-black text-primary">{portal?.name}</p>
          <p className="text-3xs font-mono text-muted">code: {portal?.code}</p>
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
          <ShieldCheck className="h-4 w-4" /> Access Overview
        </button>

        <button
          onClick={() => setActiveTab("roles")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition ${
            activeTab === "roles"
              ? "bg-primary text-white shadow-sm"
              : "text-muted hover:text-foreground hover:bg-surface-muted"
          }`}
        >
          <Key className="h-4 w-4" />
          <span>Manage Roles</span>
          <span
            className={`rounded-full px-2 py-0.2 text-3xs font-extrabold ${
              activeTab === "roles" ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
            }`}
          >
            {selectedRoles.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("portals")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition ${
            activeTab === "portals"
              ? "bg-primary text-white shadow-sm"
              : "text-muted hover:text-foreground hover:bg-surface-muted"
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Other Portals</span>
          <span
            className={`rounded-full px-2 py-0.2 text-3xs font-extrabold ${
              activeTab === "portals" ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
            }`}
          >
            {otherPortals.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("account")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition ${
            activeTab === "account"
              ? "bg-primary text-white shadow-sm"
              : "text-muted hover:text-foreground hover:bg-surface-muted"
          }`}
        >
          <User className="h-4 w-4" /> Account Profile
        </button>
      </div>

      {/* TAB 1: ACCESS OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary font-bold">
                <Globe className="h-6 w-6" />
              </div>
              <div>
                <p className="text-3xs uppercase font-bold text-muted tracking-wider">Portal Context</p>
                <p className="text-sm font-bold text-foreground mt-1">{portal?.name}</p>
              </div>
            </div>

            <button
              onClick={() => setActiveTab("roles")}
              className="rounded-2xl border border-border bg-card p-5 shadow-xs flex items-center gap-4 text-left hover:border-primary/40 transition group"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary group-hover:scale-105 transition font-bold">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-3xs uppercase font-bold text-muted tracking-wider">Active Roles in Portal</p>
                <p className="text-2xl font-black text-foreground mt-0.5">{selectedRoles.length}</p>
              </div>
            </button>

            <button
              onClick={() => setActiveTab("portals")}
              className="rounded-2xl border border-border bg-card p-5 shadow-xs flex items-center gap-4 text-left hover:border-primary/40 transition group"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary group-hover:scale-105 transition font-bold">
                <Layers className="h-6 w-6" />
              </div>
              <div>
                <p className="text-3xs uppercase font-bold text-muted tracking-wider">Total Portals Access</p>
                <p className="text-2xl font-black text-foreground mt-0.5">{userPortalsList.length}</p>
              </div>
            </button>
          </div>

          {/* Access Roles for THIS Portal Section */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Current Access Roles in {portal?.name}
                  </h3>
                  <p className="text-xs text-muted">
                    Active permissions for {targetUser.name} within {portal?.name}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveTab("roles")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition"
              >
                <Edit className="h-3.5 w-3.5" /> Modify Roles
              </button>
            </div>

            <div className="space-y-4">
              {selectedRoles.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedRoles.map((role, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-xs font-bold text-primary shadow-xs"
                    >
                      <Check className="h-4 w-4" />
                      <span className="capitalize">{role}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-surface-muted p-4 text-xs text-muted italic">
                  No specific access roles assigned for this portal. Standard executive access permissions apply.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MANAGE PORTAL ROLES */}
      {activeTab === "roles" && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="text-base font-bold text-foreground">
                Edit Access Roles in {portal?.name}
              </h3>
              <p className="text-xs text-muted mt-0.5">
                Toggle roles to grant or revoke specific portal permissions for {targetUser.name}
              </p>
            </div>

            <button
              onClick={handleSavePortalRoles}
              disabled={isSavingRoles}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-primary/90 transition disabled:opacity-50"
            >
              {isSavingRoles ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Changes
            </button>
          </div>

          <div className="space-y-4 text-xs">
            <p className="font-semibold text-foreground">
              Select allowed access roles for {targetUser.name} in {portal?.name}:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {allowedPortalRoles.map((role, idx) => {
                const isSelected = selectedRoles.includes(role);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleRoleSelection(role)}
                    className={`flex items-center justify-between rounded-xl border p-4 text-xs font-semibold transition text-left ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                        : "border-border bg-card text-foreground hover:bg-surface-muted"
                    }`}
                  >
                    <div>
                      <span className="capitalize text-sm font-bold block">{role}</span>
                      <span className="text-3xs text-muted font-mono font-normal">code: {role}</span>
                    </div>
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                        isSelected
                          ? "bg-primary border-primary text-white"
                          : "border-border bg-background"
                      }`}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-4 border-t border-border flex justify-end">
              <button
                onClick={handleSavePortalRoles}
                disabled={isSavingRoles}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-primary/90 transition disabled:opacity-50"
              >
                {isSavingRoles ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Portal Roles
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: OTHER ASSIGNED PORTALS */}
      {activeTab === "portals" && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Layers className="h-5 w-5 text-primary" />
            <h3 className="text-base font-bold text-foreground">Other Portal Assignments</h3>
          </div>

          {otherPortals.length === 0 ? (
            <p className="text-xs text-muted italic">
              This account is not assigned to any other portals besides {portal?.name}.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {otherPortals.map((p: any, idx: number) => {
                const pCode = p.portal_code || p.portal?.code || (typeof p.portal === "string" ? p.portal : "portal");
                const pName = p.portal_name || p.portal?.name || pCode;
                const pRoles: string[] = Array.isArray(p.access_roles)
                  ? p.access_roles
                  : p.access_role
                  ? [p.access_role]
                  : [];

                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-border bg-surface-muted p-4 space-y-3 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground text-sm">{pName}</span>
                      <span className="font-mono text-3xs text-muted font-semibold">{pCode}</span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {pRoles.map((r, rIdx) => (
                        <span
                          key={rIdx}
                          className="rounded-lg bg-card border border-border px-2 py-0.5 text-3xs font-semibold text-foreground capitalize"
                        >
                          {r}
                        </span>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-border/50 text-right">
                      <Link
                        href={`/dashboard/portals/${pCode}/${uid}`}
                        className="inline-flex items-center gap-1 text-3xs font-bold text-primary hover:underline"
                      >
                        View Access Profile <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ACCOUNT PROFILE DETAILS */}
      {activeTab === "account" && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <h3 className="text-base font-bold text-foreground">User Account Profile</h3>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/dashboard/user-directory/${uid}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition shadow-xs"
              >
                View Directory Profile
              </Link>
              <Link
                href={`/dashboard/user-directory/${uid}/edit`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-primary/90 transition"
              >
                <Edit className="h-3.5 w-3.5" /> Edit Account
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="space-y-4">
              <div>
                <p className="text-3xs uppercase font-bold text-muted tracking-wider mb-1">Full Name</p>
                <p className="text-sm font-bold text-foreground">{targetUser.name}</p>
              </div>

              <div>
                <p className="text-3xs uppercase font-bold text-muted tracking-wider mb-1">Email Address</p>
                <p className="text-sm font-medium text-foreground">{targetUser.email || "—"}</p>
              </div>

              <div>
                <p className="text-3xs uppercase font-bold text-muted tracking-wider mb-1">Phone Number</p>
                <p className="text-sm font-medium text-foreground">{targetUser.phone || "—"}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-3xs uppercase font-bold text-muted tracking-wider mb-1">Assigned Department</p>
                <div className="mt-1">
                  <DeptBadge dept={targetUser.department || "unknown"} />
                </div>
              </div>

              <div>
                <p className="text-3xs uppercase font-bold text-muted tracking-wider mb-1">Account Status</p>
                <div className="mt-1">
                  {isUserActive ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle className="h-3 w-3" /> Active Account
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                      <XCircle className="h-3 w-3" /> Inactive
                    </span>
                  )}
                </div>
              </div>

              <div>
                <p className="text-3xs uppercase font-bold text-muted tracking-wider mb-1">System User ID</p>
                <span className="rounded-lg bg-surface-muted border border-border font-mono text-3xs px-2.5 py-1 font-bold text-foreground">
                  {uid}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
