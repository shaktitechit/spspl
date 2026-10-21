"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw, Plus, ChevronLeft, ChevronRight, Search, X } from "lucide-react";

import { readSessionFromStorage } from "@/utils/authStorage";
import { API_BASE, getAuthHeaders, extractList } from "@/utils/apiHelpers";

import { KpiStatsCards } from "@/components/dashboard/KpiStatsCards";
import { UserTable } from "@/components/dashboard/UserTable";
import { DeleteUserModal } from "@/components/modals/DeleteUserModal";

export default function UserDirectoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<any>(null);

  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter, Pagination & Modal state
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  useEffect(() => {
    setSession(readSessionFromStorage());
  }, []);

  useEffect(() => {
    if (searchParams.get("action") === "create") {
      router.replace("/dashboard/user-directory/add");
    }
  }, [searchParams, router]);

  // Reset pagination on search or filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

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

  const fetchRoles = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/users/roles`, {
        headers: getAuthHeaders(token),
      });
      if (res.ok) {
        const data = await res.json();
        setRoles(extractList(data));
      }
    } catch (e) {
      console.warn("Could not fetch roles:", e);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchUsers();
      fetchRoles();
    }
  }, [token, fetchUsers, fetchRoles]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      return (
        !search.trim() ||
        (u.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (u.email ?? "").toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [users, search]);

  // Pagination calculation
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  }, [filteredUsers.length, pageSize]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  const startItem = filteredUsers.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, filteredUsers.length);

  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, currentPage]);



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
      {/* Modals */}
      {deleteTarget && token && (
        <DeleteUserModal
          user={deleteTarget}
          token={token}
          onClose={() => setDeleteTarget(null)}
          onDeleted={fetchUsers}
        />
      )}

      {/* Stats Widgets */}
      <KpiStatsCards stats={stats} />

      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
        <div>
          <h3 className="text-xl font-bold text-foreground tracking-tight">System User Directory</h3>
          <p className="text-xs text-muted mt-0.5">
            Manage system permissions, active user accounts, and department roles
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
            <input
              type="text"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 sm:w-56 rounded-xl border border-border bg-card py-2.5 pl-9 pr-8 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-inner"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
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
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-primary/90 transition active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Add New User
          </Link>
        </div>
      </div>

      {/* User Directory Data Table */}
      <UserTable
        users={paginatedUsers}
        isLoading={isLoadingUsers}
        error={error}
        currentUserId={currentUserId}
        onDeleteClick={(u) => setDeleteTarget(u)}
      />

      {/* Pagination Footer */}
      {!isLoadingUsers && filteredUsers.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
            <span>
              Showing <strong className="font-bold text-foreground">{startItem}</strong> to{" "}
              <strong className="font-bold text-foreground">{endItem}</strong> of{" "}
              <strong className="font-bold text-foreground">{filteredUsers.length}</strong> accounts
            </span>

            <div className="flex items-center gap-1.5 pl-3 border-l border-border">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
              >
                {[5, 10, 25, 50].map((sz) => (
                  <option key={sz} value={sz}>
                    {sz}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center justify-center rounded-lg border border-border bg-card p-2 text-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="Previous Page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {pageNumbers.map((p, idx) =>
              typeof p === "number" ? (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentPage(p)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition ${
                    currentPage === p
                      ? "bg-primary text-white font-bold shadow-sm"
                      : "border border-border bg-card text-muted hover:bg-surface-muted hover:text-foreground"
                  }`}
                >
                  {p}
                </button>
              ) : (
                <span key={idx} className="px-1 text-xs text-muted">
                  …
                </span>
              )
            )}

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center justify-center rounded-lg border border-border bg-card p-2 text-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="Next Page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

