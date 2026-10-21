"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, UserCheck, AlertTriangle, CheckCircle, Loader2, Save, Trash2, ShieldCheck, Users } from "lucide-react";
import { readSessionFromStorage } from "@/utils/authStorage";
import { API_BASE, getAuthHeaders, extractList } from "@/utils/apiHelpers";
import { DEPARTMENTS, type Dept, type UserPortalAssignment, type DepartmentItem } from "@/types/userManager";
import { DeleteUserModal } from "@/components/modals/DeleteUserModal";
import { PortalAccessSelector } from "@/components/PortalAccessSelector";

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params?.id as string;

  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any | null>(null);
  const [rolesList, setRolesList] = useState<any[]>([]);
  const [departmentsList, setDepartmentsList] = useState<DepartmentItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    department: "sales" as Dept,
    is_active: true,
    roles: [] as string[],
    portals: [] as UserPortalAssignment[],
  });

  useEffect(() => {
    setSession(readSessionFromStorage());
  }, []);

  const token = session?.token;
  const currentUserId = String(session?.user?.id || session?.user?._id || "");
  const isSelf = String(userId) === currentUserId;

  const fetchUserData = useCallback(async () => {
    if (!token || !userId) return;
    setIsLoading(true);
    setError(null);
    try {
      // Fetch user details, system roles, and departments concurrently
      const [userRes, rolesRes, deptsRes] = await Promise.all([
        fetch(`${API_BASE}/api/users/${userId}`, { headers: getAuthHeaders(token) }),
        fetch(`${API_BASE}/api/users/roles`, { headers: getAuthHeaders(token) }),
        fetch(`${API_BASE}/api/departments`, { headers: getAuthHeaders(token) }),
      ]);

      if (!userRes.ok) {
        throw new Error("Could not fetch user details.");
      }

      const userData = await userRes.json();
      const u = userData?.data || userData?.user || userData;

      const rawPortals = Array.isArray(u.portals) ? u.portals : [];
      const portals = rawPortals.map((p: any) => ({
        portal_code: p.portal_code || (p.portal?.code ?? ""),
        portal_name: p.portal_name || (p.portal?.name ?? ""),
        access_roles: Array.isArray(p.access_roles) ? p.access_roles : (p.access_role ? [p.access_role] : []),
      }));

      setUser(u);
      setForm({
        name: u.name ?? "",
        email: u.email ?? "",
        phone: u.phone ?? "",
        department: (u.department as Dept) ?? "sales",
        is_active: u.is_active !== false,
        roles: Array.isArray(u.roles) ? u.roles.map((r: any) => String(r._id || r.id || r)) : [],
        portals,
      });

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRolesList(extractList(rolesData));
      } else {
        setRolesList([]);
      }
      if (deptsRes.ok) {
        const deptsData = await deptsRes.json();
        setDepartmentsList(extractList(deptsData) as DepartmentItem[]);
      } else {
        setDepartmentsList([]);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load user account.");
    } finally {
      setIsLoading(false);
    }
  }, [token, userId]);

  useEffect(() => {
    if (token && userId) {
      fetchUserData();
    }
  }, [token, userId, fetchUserData]);

  const availableRoles = useMemo(() => {
    const dept = String(form.department || "").toLowerCase();
    return rolesList.filter(
      (r: any) => String(r.department || "").toLowerCase() === dept && r.is_active !== false
    );
  }, [rolesList, form.department]);

  const defaultRoleIdForDept = useCallback(
    (dept: Dept) => {
      const code = String(dept || "").toLowerCase();
      const inDept = rolesList.filter(
        (r: any) => String(r.department || "").toLowerCase() === code && r.is_active !== false
      );
      const match =
        inDept.find((r: any) => r.is_default_role) ||
        inDept.find((r: any) => String(r.code || "").toLowerCase() === code) ||
        inDept[0];
      return match ? String(match._id || match.id || "") : "";
    },
    [rolesList]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const res = await fetch(`${API_BASE}/api/users/${userId}`, {
        method: "PATCH",
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          department: form.department,
          is_active: form.is_active,
          roles: form.roles,
          roleCode: form.department,
          portals: form.portals,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || errData?.message || "Failed to update user details.");
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err?.message ?? "Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      {/* Delete Confirmation Modal */}
      {showDeleteModal && token && user && (
        <DeleteUserModal
          user={user}
          token={token}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => {
            router.push("/dashboard/user-directory");
          }}
        />
      )}

      {/* Top Header Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/user-directory"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted transition shadow-xs"
        >
          <ArrowLeft className="h-4 w-4" /> Back to User Directory
        </Link>
      </div>

      {/* Main Card */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="border-b border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground tracking-tight">Edit System User</h2>
              <p className="text-xs text-muted mt-0.5">
                Update account information, active status, and department roles
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs font-semibold">Loading user account details…</p>
            </div>
          ) : error && !user ? (
            <div className="flex flex-col items-center justify-center py-12 text-center max-w-md mx-auto space-y-3">
              <AlertTriangle className="h-10 w-10 text-rose-500" />
              <p className="text-sm font-semibold text-foreground">{error}</p>
              <Link
                href="/dashboard/user-directory"
                className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary/90 transition"
              >
                Return to Directory
              </Link>
            </div>
          ) : success ? (
            <div className="flex flex-col items-center justify-center py-10 text-center max-w-md mx-auto space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                <CheckCircle className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">User Updated Successfully!</h3>
                <p className="text-xs text-muted mt-1">
                  Changes for <strong className="text-foreground">{form.name}</strong> have been saved to the database.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-4 w-full">
                <button
                  type="button"
                  onClick={() => setSuccess(false)}
                  className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
                >
                  Keep Editing
                </button>
                <Link
                  href="/dashboard/user-directory"
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-primary/90 transition"
                >
                  <Users className="h-4 w-4" />
                  View Directory
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="flex items-center gap-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 p-4 text-xs text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Full Name */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-foreground">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. John Doe"
                    required
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                  />
                </div>

                {/* Email Address */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-foreground">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="john@company.com"
                    required
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                  />
                </div>

                {/* Phone Number */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-foreground">
                    Phone Number <span className="text-muted font-normal">(optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+91 9876543210"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                  />
                </div>

                {/* Active Status Switch */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-foreground">Account Status</label>
                  <div className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        {form.is_active ? "Active Account" : "Inactive Account"}
                      </p>
                      <p className="text-3xs text-muted">
                        {form.is_active ? "User can sign in and perform actions" : "Login access disabled"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        form.is_active ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                          form.is_active ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Department & Role Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-border">
                {/* Department Dropdown */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-foreground">
                    Department Assignment <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={form.department}
                    onChange={(e) => {
                      const department = e.target.value as Dept;
                      const defaultRole = defaultRoleIdForDept(department);
                      setForm((f) => ({
                        ...f,
                        department,
                        roles: defaultRole ? [defaultRole] : [],
                      }));
                    }}
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                  >
                    {departmentsList.length > 0
                      ? departmentsList.map((d) => (
                          <option key={d.code} value={d.code}>
                            {d.name} ({d.code})
                          </option>
                        ))
                      : DEPARTMENTS.map((d) => (
                          <option key={d} value={d}>
                            {d.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                          </option>
                        ))}
                  </select>
                </div>

                {/* Roles Selection */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-foreground">Assigned Roles</label>
                  {availableRoles.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {availableRoles.map((r: any) => {
                        const rid = String(r._id || r.id || "");
                        const selected = form.roles.includes(rid);
                        return (
                          <button
                            key={rid}
                            type="button"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                roles: selected ? f.roles.filter((x) => x !== rid) : [...f.roles, rid],
                              }))
                            }
                            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                              selected
                                ? "bg-primary text-white shadow-xs font-semibold"
                                : "border border-border bg-surface-muted text-muted hover:text-foreground"
                            }`}
                          >
                            {r.name || r.code}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="py-2 text-xs text-muted italic">No specific sub-roles defined for this department</p>
                  )}
                </div>
              </div>

              {/* Portal Access Selection */}
              <div className="pt-4 border-t border-border">
                <PortalAccessSelector
                  token={token}
                  selectedPortals={form.portals}
                  onChange={(portals) => setForm((f) => ({ ...f, portals }))}
                />
              </div>

              {/* Form Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-border">
                <div>
                  {!isSelf ? (
                    <button
                      type="button"
                      onClick={() => setShowDeleteModal(true)}
                      className="inline-flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition"
                    >
                      <Trash2 className="h-4 w-4" /> Delete Account
                    </button>
                  ) : (
                    <p className="text-3xs text-muted italic">You cannot delete your own account</p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    href="/dashboard/user-directory"
                    className="rounded-xl border border-border bg-card px-5 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
                  >
                    Cancel
                  </Link>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-primary/90 transition active:scale-95 disabled:opacity-60"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving Changes…
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
