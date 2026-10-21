"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Building2,
  ShieldCheck,
  Plus,
  Edit,
  Trash2,
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  X,
  ArrowLeft,
  Briefcase,
  Star,
  Check,
  Search,
  Filter,
  Layers,
  Users,
  RefreshCw,
} from "lucide-react";
import { readSessionFromStorage } from "@/utils/authStorage";
import { API_BASE, getAuthHeaders, extractList } from "@/utils/apiHelpers";
import { DeptBadge } from "@/components/DeptBadge";
import type { DepartmentItem, RoleItem } from "@/types/userManager";

type TabType = "departments" | "roles" | "hierarchy";

export default function DepartmentsAndRolesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialTab = (searchParams.get("tab") as TabType) || "departments";
  const [activeTab, setActiveTab] = useState<TabType>(
    ["departments", "roles", "hierarchy"].includes(initialTab) ? initialTab : "departments"
  );

  const [session, setSession] = useState<any>(null);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [systemUsers, setSystemUsers] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters & Search
  const [roleDeptFilter, setRoleDeptFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Department Modal State
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentItem | null>(null);
  const [isDeptSubmitting, setIsDeptSubmitting] = useState(false);
  const [deptForm, setDeptForm] = useState({
    name: "",
    code: "",
    description: "",
    is_active: true,
  });

  // Role Modal State
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
  const [isRoleSubmitting, setIsRoleSubmitting] = useState(false);
  const [roleForm, setRoleForm] = useState({
    name: "",
    code: "",
    department: "sales",
    is_default_role: false,
    is_system_role: false,
    is_active: true,
  });

  useEffect(() => {
    setSession(readSessionFromStorage());
  }, []);

  const token = session?.token;

  // Fetch Departments, Roles, and Users
  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const [deptsRes, rolesRes, usersRes] = await Promise.all([
        fetch(`${API_BASE}/api/departments?include_inactive=true`, { headers: getAuthHeaders(token) }),
        fetch(`${API_BASE}/api/users/roles?include_inactive=true`, { headers: getAuthHeaders(token) }),
        fetch(`${API_BASE}/api/users`, { headers: getAuthHeaders(token) }),
      ]);

      if (deptsRes.ok) {
        const data = await deptsRes.json();
        setDepartments(extractList(data));
      } else {
        throw new Error("Could not fetch departments.");
      }

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(extractList(rolesData));
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setSystemUsers(extractList(usersData));
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load departments and roles.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token, fetchData]);

  // Handle Tab Switch & Sync Query Param
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    router.replace(`/dashboard/departments?tab=${tab}`, { scroll: false });
  };

  // Seed Handlers
  const handleSeedDepartments = async () => {
    if (!token) return;
    setIsSeeding(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/departments/seed`, {
        method: "POST",
        headers: getAuthHeaders(token),
      });
      if (res.ok) {
        setSuccessMsg("Standard departments seeded successfully.");
        await fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Seeding departments failed.");
      }
    } catch (e: any) {
      setError(e?.message || "Could not seed departments.");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSeedRoles = async () => {
    if (!token) return;
    setIsSeeding(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/users/roles/seed`, {
        method: "POST",
        headers: getAuthHeaders(token),
      });
      if (res.ok) {
        setSuccessMsg("Standard roles seeded successfully.");
        await fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Seeding roles failed.");
      }
    } catch (e: any) {
      setError(e?.message || "Could not seed roles.");
    } finally {
      setIsSeeding(false);
    }
  };

  // Department Modal Handlers
  const handleOpenCreateDept = () => {
    setEditingDept(null);
    setDeptForm({ name: "", code: "", description: "", is_active: true });
    setShowDeptModal(true);
  };

  const handleOpenEditDept = (dept: DepartmentItem) => {
    setEditingDept(dept);
    setDeptForm({
      name: dept.name,
      code: dept.code,
      description: dept.description || "",
      is_active: dept.is_active !== false,
    });
    setShowDeptModal(true);
  };

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsDeptSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: deptForm.name.trim(),
        code: deptForm.code.trim().toLowerCase(),
        description: deptForm.description.trim(),
        is_active: deptForm.is_active,
      };

      const url = editingDept
        ? `${API_BASE}/api/departments/${editingDept._id || editingDept.id}`
        : `${API_BASE}/api/departments`;

      const method = editingDept ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(token),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.message || "Failed to save department.");
      }

      setSuccessMsg(`Department '${deptForm.name}' saved successfully.`);
      setShowDeptModal(false);
      await fetchData();
    } catch (err: any) {
      setError(err?.message || "Failed to save department.");
    } finally {
      setIsDeptSubmitting(false);
    }
  };

  const handleDeleteDepartment = async (dept: DepartmentItem) => {
    const did = dept._id || dept.id;
    if (!token || !did) return;
    if (!confirm(`Are you sure you want to delete department '${dept.name}'?`)) return;

    try {
      const res = await fetch(`${API_BASE}/api/departments/${did}`, {
        method: "DELETE",
        headers: getAuthHeaders(token),
      });

      if (!res.ok) {
        throw new Error("Failed to delete department.");
      }

      setSuccessMsg(`Department '${dept.name}' deleted.`);
      await fetchData();
    } catch (err: any) {
      setError(err?.message || "Failed to delete department.");
    }
  };

  // Role Modal Handlers
  const handleOpenCreateRole = () => {
    setEditingRole(null);
    const defaultDept = departments.length > 0 ? departments[0].code : "sales";
    setRoleForm({
      name: "",
      code: "",
      department: defaultDept,
      is_default_role: false,
      is_system_role: false,
      is_active: true,
    });
    setShowRoleModal(true);
  };

  const handleOpenEditRole = (role: RoleItem) => {
    setEditingRole(role);
    setRoleForm({
      name: role.name,
      code: role.code,
      department: role.department,
      is_default_role: role.is_default_role === true,
      is_system_role: role.is_system_role === true,
      is_active: role.is_active !== false,
    });
    setShowRoleModal(true);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsRoleSubmitting(true);
    setError(null);

    try {
      const payload = {
        name: roleForm.name.trim(),
        code: roleForm.code.trim().toLowerCase(),
        department: roleForm.department.trim().toLowerCase(),
        is_default_role: roleForm.is_default_role,
        is_system_role: roleForm.is_system_role,
        is_active: roleForm.is_active,
      };

      const url = editingRole
        ? `${API_BASE}/api/users/roles/${editingRole._id || editingRole.id}`
        : `${API_BASE}/api/users/roles`;

      const method = editingRole ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(token),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.message || "Failed to save role.");
      }

      setSuccessMsg(`Role '${roleForm.name}' saved successfully.`);
      setShowRoleModal(false);
      await fetchData();
    } catch (err: any) {
      setError(err?.message || "Failed to save role.");
    } finally {
      setIsRoleSubmitting(false);
    }
  };

  const handleSetDefaultRole = async (role: RoleItem) => {
    const rid = role._id || role.id;
    if (!token || !rid) return;

    try {
      const res = await fetch(`${API_BASE}/api/users/roles/${rid}`, {
        method: "PUT",
        headers: getAuthHeaders(token),
        body: JSON.stringify({ is_default_role: true }),
      });

      if (!res.ok) {
        throw new Error("Failed to set default role.");
      }

      setSuccessMsg(`Role '${role.name}' set as default for department '${role.department}'.`);
      await fetchData();
    } catch (err: any) {
      setError(err?.message || "Failed to set default role.");
    }
  };

  const handleDeleteRole = async (role: RoleItem) => {
    const rid = role._id || role.id;
    if (!token || !rid) return;
    if (!confirm(`Are you sure you want to delete role '${role.name}'?`)) return;

    try {
      const res = await fetch(`${API_BASE}/api/users/roles/${rid}`, {
        method: "DELETE",
        headers: getAuthHeaders(token),
      });

      if (!res.ok) {
        throw new Error("Failed to delete role.");
      }

      setSuccessMsg(`Role '${role.name}' deleted.`);
      await fetchData();
    } catch (err: any) {
      setError(err?.message || "Failed to delete role.");
    }
  };

  // Filtered Roles List
  const filteredRoles = useMemo(() => {
    return roles.filter((r) => {
      const matchesDept = roleDeptFilter === "all" || r.department === roleDeptFilter;
      const q = searchQuery.toLowerCase();
      const matchesQuery =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q);
      return matchesDept && matchesQuery;
    });
  }, [roles, roleDeptFilter, searchQuery]);

  // Filtered Departments List
  const filteredDepartments = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return departments;
    return departments.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        (d.description || "").toLowerCase().includes(q)
    );
  }, [departments, searchQuery]);

  // Map Roles and User counts to Departments
  const deptStatsMap = useMemo(() => {
    const map: Record<string, { roleCount: number; userCount: number; defaultRole?: string }> = {};

    departments.forEach((d) => {
      map[d.code] = { roleCount: 0, userCount: 0 };
    });

    roles.forEach((r) => {
      const dCode = r.department || "other";
      if (!map[dCode]) map[dCode] = { roleCount: 0, userCount: 0 };
      map[dCode].roleCount += 1;
      if (r.is_default_role) {
        map[dCode].defaultRole = r.name;
      }
    });

    systemUsers.forEach((u) => {
      const dCode = (u.department || "").toLowerCase();
      if (map[dCode]) {
        map[dCode].userCount += 1;
      }
    });

    return map;
  }, [departments, roles, systemUsers]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto pb-10">
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-16 text-muted gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs font-semibold">Loading departments and roles configuration…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
            </Link>
          </div>
          <h1 className="text-xl font-extrabold text-foreground tracking-tight mt-1 flex items-center gap-2.5">
            <Building2 className="h-6 w-6 text-primary" />
            Departments & System Roles Hub
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Manage organization departments, access control roles, and permission hierarchies
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchData}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted transition shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
          </button>

          {activeTab === "departments" && (
            <>
              <button
                type="button"
                onClick={handleSeedDepartments}
                disabled={isSeeding}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition shadow-xs disabled:opacity-60"
              >
                {isSeeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-amber-500" />}
                Seed Departments
              </button>
              <button
                type="button"
                onClick={handleOpenCreateDept}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-primary/90 transition active:scale-95"
              >
                <Plus className="h-4 w-4" /> Create Department
              </button>
            </>
          )}

          {activeTab === "roles" && (
            <>
              <button
                type="button"
                onClick={handleSeedRoles}
                disabled={isSeeding}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition shadow-xs disabled:opacity-60"
              >
                {isSeeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-amber-500" />}
                Seed Roles
              </button>
              <button
                type="button"
                onClick={handleOpenCreateRole}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-primary/90 transition active:scale-95"
              >
                <Plus className="h-4 w-4" /> Create Role
              </button>
            </>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-center justify-between rounded-xl bg-rose-500/10 border border-rose-500/20 p-4 text-xs text-rose-600 dark:text-rose-400">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs text-emerald-600 dark:text-emerald-400">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Overview Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => handleTabChange("departments")}
          className={`rounded-2xl border p-5 shadow-xs flex items-center gap-4 text-left transition group ${
            activeTab === "departments"
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "border-border bg-card hover:border-primary/40"
          }`}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary group-hover:scale-105 transition font-bold">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-3xs uppercase font-bold text-muted tracking-wider">Total Departments</p>
            <p className="text-2xl font-black text-foreground mt-0.5">{departments.length}</p>
          </div>
        </button>

        <button
          onClick={() => handleTabChange("roles")}
          className={`rounded-2xl border p-5 shadow-xs flex items-center gap-4 text-left transition group ${
            activeTab === "roles"
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "border-border bg-card hover:border-primary/40"
          }`}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary group-hover:scale-105 transition font-bold">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-3xs uppercase font-bold text-muted tracking-wider">Configured Roles</p>
            <p className="text-2xl font-black text-foreground mt-0.5">{roles.length}</p>
          </div>
        </button>

        <button
          onClick={() => handleTabChange("hierarchy")}
          className={`rounded-2xl border p-5 shadow-xs flex items-center gap-4 text-left transition group ${
            activeTab === "hierarchy"
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "border-border bg-card hover:border-primary/40"
          }`}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary group-hover:scale-105 transition font-bold">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <p className="text-3xs uppercase font-bold text-muted tracking-wider">Org Structure</p>
            <p className="text-sm font-bold text-foreground mt-1">Hierarchical View</p>
          </div>
        </button>
      </div>

      {/* Tabs Header & Search Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => handleTabChange("departments")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition ${
              activeTab === "departments"
                ? "bg-primary text-white shadow-sm"
                : "text-muted hover:text-foreground hover:bg-surface-muted"
            }`}
          >
            <Building2 className="h-4 w-4" />
            <span>Departments</span>
            <span
              className={`rounded-full px-2 py-0.2 text-3xs font-extrabold ${
                activeTab === "departments" ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
              }`}
            >
              {departments.length}
            </span>
          </button>

          <button
            onClick={() => handleTabChange("roles")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition ${
              activeTab === "roles"
                ? "bg-primary text-white shadow-sm"
                : "text-muted hover:text-foreground hover:bg-surface-muted"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>System Roles</span>
            <span
              className={`rounded-full px-2 py-0.2 text-3xs font-extrabold ${
                activeTab === "roles" ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
              }`}
            >
              {roles.length}
            </span>
          </button>

          <button
            onClick={() => handleTabChange("hierarchy")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition ${
              activeTab === "hierarchy"
                ? "bg-primary text-white shadow-sm"
                : "text-muted hover:text-foreground hover:bg-surface-muted"
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Hierarchy & Mapping</span>
          </button>
        </div>

        {/* Search & Filter Inputs */}
        <div className="flex items-center gap-2">
          {activeTab === "roles" && (
            <div className="relative">
              <select
                value={roleDeptFilter}
                onChange={(e) => setRoleDeptFilter(e.target.value)}
                className="rounded-xl border border-border bg-card py-2 pl-3 pr-8 text-xs text-foreground focus:border-primary focus:outline-none shadow-xs"
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="relative w-48 sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none shadow-xs"
            />
          </div>
        </div>
      </div>

      {/* TAB 1: DEPARTMENTS */}
      {activeTab === "departments" && (
        <div className="space-y-4">
          {filteredDepartments.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-16 text-center space-y-3">
              <Building2 className="h-10 w-10 text-muted opacity-50" />
              <h3 className="text-base font-bold text-foreground">No Departments Found</h3>
              <p className="text-xs text-muted max-w-md">
                {searchQuery
                  ? "No departments match your search term."
                  : "Click 'Seed Departments' or 'Create Department' to add organization units."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredDepartments.map((dept) => {
                const isActive = dept.is_active !== false;
                const stats = deptStatsMap[dept.code] || { roleCount: 0, userCount: 0 };

                return (
                  <div
                    key={dept.code}
                    className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col justify-between space-y-4 hover:border-primary/40 transition duration-200"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <DeptBadge dept={dept.code} />
                          <div>
                            <p className="text-3xs font-mono text-muted">code: {dept.code}</p>
                          </div>
                        </div>

                        <span
                          className={`rounded-full px-2.5 py-0.5 text-3xs font-semibold ${
                            isActive
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : "bg-slate-500/10 text-slate-500 border border-slate-500/20"
                          }`}
                        >
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </div>

                      <p className="text-xs text-muted mt-3 line-clamp-2">
                        {dept.description || "No description provided for this department."}
                      </p>

                      <div className="mt-4 pt-3 border-t border-border grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-surface-muted border border-border p-2">
                          <p className="text-3xs uppercase font-bold text-muted">Roles Count</p>
                          <p className="text-sm font-extrabold text-foreground mt-0.5">{stats.roleCount}</p>
                        </div>
                        <div className="rounded-xl bg-surface-muted border border-border p-2">
                          <p className="text-3xs uppercase font-bold text-muted">Active Users</p>
                          <p className="text-sm font-extrabold text-foreground mt-0.5">{stats.userCount}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <button
                        onClick={() => {
                          setRoleDeptFilter(dept.code);
                          handleTabChange("roles");
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" /> View Roles
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEditDept(dept)}
                          className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
                        >
                          <Edit className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => handleDeleteDepartment(dept)}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ROLES */}
      {activeTab === "roles" && (
        <div className="space-y-4">
          {filteredRoles.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-16 text-center space-y-3">
              <ShieldCheck className="h-10 w-10 text-muted opacity-50" />
              <h3 className="text-base font-bold text-foreground">No Roles Found</h3>
              <p className="text-xs text-muted max-w-md">
                {searchQuery || roleDeptFilter !== "all"
                  ? "No system roles match your search or department filter criteria."
                  : "Click 'Seed Roles' or 'Create Role' to define department permission roles."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredRoles.map((role) => {
                const isActive = role.is_active !== false;

                return (
                  <div
                    key={role.code}
                    className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col justify-between space-y-4 hover:border-primary/40 transition duration-200"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary font-bold">
                            <ShieldCheck className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-foreground">{role.name}</h3>
                            <p className="text-3xs font-mono text-muted">code: {role.code}</p>
                          </div>
                        </div>

                        <span
                          className={`rounded-full px-2.5 py-0.5 text-3xs font-semibold ${
                            isActive
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : "bg-slate-500/10 text-slate-500 border border-slate-500/20"
                          }`}
                        >
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </div>

                      <div className="mt-4 pt-3 border-t border-border space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-3xs uppercase font-bold text-muted">Department</span>
                          <DeptBadge dept={role.department} />
                        </div>

                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {role.is_default_role && (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 text-3xs font-bold">
                              <Star className="h-3 w-3 fill-amber-500" /> Default Dept Role
                            </span>
                          )}
                          {role.is_system_role && (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-primary/15 text-primary border border-primary/30 px-2 py-0.5 text-3xs font-bold">
                              System Built-in
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                      {!role.is_default_role && (
                        <button
                          onClick={() => handleSetDefaultRole(role)}
                          title="Make Default Role for Department"
                          className="inline-flex items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition"
                        >
                          <Star className="h-3.5 w-3.5" /> Make Default
                        </button>
                      )}

                      <button
                        onClick={() => handleOpenEditRole(role)}
                        className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
                      >
                        <Edit className="h-3.5 w-3.5" /> Edit
                      </button>

                      {!role.is_system_role && (
                        <button
                          onClick={() => handleDeleteRole(role)}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: HIERARCHY & MAPPING */}
      {activeTab === "hierarchy" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
            <div className="border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">Organization Hierarchy & Role Mapping</h3>
              <p className="text-xs text-muted mt-0.5">
                Overview of system departments mapped to their configured access roles and active user counts
              </p>
            </div>

            <div className="space-y-6">
              {departments.map((dept) => {
                const deptRoles = roles.filter((r) => r.department === dept.code);
                const stats = deptStatsMap[dept.code] || { roleCount: 0, userCount: 0 };

                return (
                  <div
                    key={dept.code}
                    className="rounded-2xl border border-border bg-surface-muted/50 p-5 space-y-4 shadow-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                      <div className="flex items-center gap-3">
                        <DeptBadge dept={dept.code} />
                        <div>
                          <p className="text-xs font-semibold text-muted font-mono">code: {dept.code}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <span className="rounded-lg bg-card border border-border px-2.5 py-1 font-semibold text-foreground">
                          {stats.userCount} Active Users
                        </span>
                        <span className="rounded-lg bg-card border border-border px-2.5 py-1 font-semibold text-foreground">
                          {deptRoles.length} Roles Configured
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-3xs uppercase font-bold text-muted tracking-wider">Associated Department Roles</p>
                      {deptRoles.length === 0 ? (
                        <p className="text-xs text-muted italic">No custom roles configured for this department yet.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {deptRoles.map((r) => (
                            <div
                              key={r.code}
                              className="rounded-xl border border-border bg-card p-3 space-y-1.5 flex items-center justify-between"
                            >
                              <div>
                                <p className="text-xs font-bold text-foreground">{r.name}</p>
                                <p className="text-3xs font-mono text-muted">{r.code}</p>
                              </div>
                              {r.is_default_role && (
                                <span className="rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-3xs font-bold px-2 py-0.5">
                                  Default
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal for Create / Edit Department */}
      {showDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  {editingDept ? "Edit Department" : "Create New Department"}
                </h3>
              </div>
              <button onClick={() => setShowDeptModal(false)} className="rounded-lg p-1 text-muted hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDepartment} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1">Department Name</label>
                <input
                  type="text"
                  required
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  placeholder="e.g. Sales, Finance, Dispatch"
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Department Code</label>
                <input
                  type="text"
                  required
                  disabled={!!editingDept}
                  value={deptForm.code}
                  onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                  placeholder="e.g. sales, finance, dispatch"
                  className="w-full rounded-xl border border-border bg-background p-2.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Description</label>
                <textarea
                  rows={3}
                  value={deptForm.description}
                  onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  placeholder="Brief summary of department responsibilities..."
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="deptIsActive"
                  checked={deptForm.is_active}
                  onChange={(e) => setDeptForm({ ...deptForm, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="deptIsActive" className="font-semibold text-foreground cursor-pointer">
                  Department is Active
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowDeptModal(false)}
                  className="rounded-xl border border-border px-4 py-2 font-semibold text-muted hover:text-foreground transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeptSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-bold text-white shadow-md hover:bg-primary/90 transition disabled:opacity-50"
                >
                  {isDeptSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {editingDept ? "Save Changes" : "Create Department"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Create / Edit Role */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  {editingRole ? "Edit Role" : "Create New Role"}
                </h3>
              </div>
              <button onClick={() => setShowRoleModal(false)} className="rounded-lg p-1 text-muted hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1">Role Name</label>
                <input
                  type="text"
                  required
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  placeholder="e.g. Sales Executive, Lead Manager"
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Role Code</label>
                <input
                  type="text"
                  required
                  disabled={!!editingRole}
                  value={roleForm.code}
                  onChange={(e) => setRoleForm({ ...roleForm, code: e.target.value })}
                  placeholder="e.g. sales_executive"
                  className="w-full rounded-xl border border-border bg-background p-2.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Assigned Department</label>
                <select
                  value={roleForm.department}
                  onChange={(e) => setRoleForm({ ...roleForm, department: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
                >
                  {departments.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="roleIsDefault"
                    checked={roleForm.is_default_role}
                    onChange={(e) => setRoleForm({ ...roleForm, is_default_role: e.target.checked })}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <label htmlFor="roleIsDefault" className="font-semibold text-foreground cursor-pointer">
                    Default Role for Department
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="roleIsActive"
                    checked={roleForm.is_active}
                    onChange={(e) => setRoleForm({ ...roleForm, is_active: e.target.checked })}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <label htmlFor="roleIsActive" className="font-semibold text-foreground cursor-pointer">
                    Role is Active
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="rounded-xl border border-border px-4 py-2 font-semibold text-muted hover:text-foreground transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRoleSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-bold text-white shadow-md hover:bg-primary/90 transition disabled:opacity-50"
                >
                  {isRoleSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {editingRole ? "Save Changes" : "Create Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
