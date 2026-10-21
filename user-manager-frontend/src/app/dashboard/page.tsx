"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Users, Building2, ShieldCheck, ArrowRight, RefreshCw, UserPlus } from "lucide-react";
import { readSessionFromStorage } from "@/utils/authStorage";
import { API_BASE, getAuthHeaders, extractList } from "@/utils/apiHelpers";
import { KpiStatsCards } from "@/components/dashboard/KpiStatsCards";
import { UserTable } from "@/components/dashboard/UserTable";

export default function DashboardOverviewPage() {
  const [session, setSession] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSession(readSessionFromStorage());
  }, []);

  const token = session?.token;
  const currentUserId = String(session?.user?.id || session?.user?._id || "");

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    setIsLoadingUsers(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/users`, {
        headers: getAuthHeaders(token),
      });
      if (!res.ok) {
        throw new Error("Could not fetch users list.");
      }
      const data = await res.json();
      setUsers(extractList(data));
    } catch (e: any) {
      setError(e?.message || "Failed to load users.");
    } finally {
      setIsLoadingUsers(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchUsers();
    }
  }, [token, fetchUsers]);

  const stats = useMemo(() => {
    let active = 0;
    let inactive = 0;
    let superAdmins = 0;

    users.forEach((u) => {
      if (u.is_active !== false) active++;
      else inactive++;

      if (u.department === "super_admin" || u.roleCode === "super_admin") {
        superAdmins++;
      }
    });

    return {
      total: users.length,
      active,
      inactive,
      superAdmins,
    };
  }, [users]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Banner / Welcome Header */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-card p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-foreground tracking-tight">
                Super Admin Control Center
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 border border-primary/30 px-2.5 py-0.5 text-[10px] font-bold text-primary">
                <ShieldCheck className="h-3 w-3" /> Master Access
              </span>
            </div>
            <p className="text-xs text-muted mt-1 max-w-2xl">
              Welcome to the centralized management portal. Oversee system users, department permissions, branding visual assets, and parent organization credentials.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => fetchUsers()}
              disabled={isLoadingUsers}
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingUsers ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <Link
              href="/dashboard/user-directory/add"
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-primary/90 transition"
            >
              <UserPlus className="h-4 w-4" />
              Add User
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Stats Widgets */}
      <KpiStatsCards stats={stats} />

      {/* Navigation Quick Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/dashboard/user-directory"
          className="group rounded-2xl border border-border bg-card p-5 shadow-sm hover:border-primary/40 hover:shadow-md transition flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary group-hover:scale-105 transition">
              <Users className="h-6 w-6" />
            </div>
            <ArrowRight className="h-5 w-5 text-muted group-hover:text-primary group-hover:translate-x-1 transition" />
          </div>
          <div className="mt-4">
            <h3 className="text-base font-bold text-foreground group-hover:text-primary transition">
              System User Directory
            </h3>
            <p className="text-xs text-muted mt-1">
              Manage accounts, reset passwords, update department permissions, and control access statuses across all divisions.
            </p>
          </div>
        </Link>

        <Link
          href="/dashboard/company-info"
          className="group rounded-2xl border border-border bg-card p-5 shadow-sm hover:border-primary/40 hover:shadow-md transition flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary group-hover:scale-105 transition">
              <Building2 className="h-6 w-6" />
            </div>
            <ArrowRight className="h-5 w-5 text-muted group-hover:text-primary group-hover:translate-x-1 transition" />
          </div>
          <div className="mt-4">
            <h3 className="text-base font-bold text-foreground group-hover:text-primary transition">
              Company Info & Branding
            </h3>
            <p className="text-xs text-muted mt-1">
              Update organization identity, logos, browser favicons, theme color palettes, GST/PAN credentials, and terms.
            </p>
          </div>
        </Link>
      </div>

      {/* Preview User Directory */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Recent Directory Users</h3>
            <p className="text-3xs text-muted">Quick preview of registered system accounts</p>
          </div>
          <Link
            href="/dashboard/user-directory"
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            View All Users ({users.length}) <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <UserTable
          users={users.slice(0, 5)}
          isLoading={isLoadingUsers}
          error={error}
          currentUserId={currentUserId}
          onEditClick={() => {}}
          onDeleteClick={() => {}}
        />
      </div>
    </div>
  );
}
