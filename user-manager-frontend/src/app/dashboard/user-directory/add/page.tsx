"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck, AlertTriangle, CheckCircle, Loader2, Plus, Users } from "lucide-react";
import { readSessionFromStorage } from "@/utils/authStorage";
import { API_BASE, getAuthHeaders, extractList } from "@/utils/apiHelpers";
import { DEPARTMENTS, type Dept, type UserPortalAssignment, type DepartmentItem } from "@/types/userManager";
import { PortalAccessSelector } from "@/components/PortalAccessSelector";

export default function AddUserPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [rolesList, setRolesList] = useState<any[]>([]);
  const [departmentsList, setDepartmentsList] = useState<DepartmentItem[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    department: "sales" as Dept,
    roles: [] as string[],
    portals: [] as UserPortalAssignment[],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setSession(readSessionFromStorage());
  }, []);

  const token = session?.token;

  const fetchRolesAndDepartments = useCallback(async () => {
    if (!token) return;
    setIsLoadingRoles(true);
    try {
      const [rolesRes, deptsRes] = await Promise.all([
        fetch(`${API_BASE}/api/users/roles`, { headers: getAuthHeaders(token) }),
        fetch(`${API_BASE}/api/departments`, { headers: getAuthHeaders(token) }),
      ]);
      if (rolesRes.ok) {
        const data = await rolesRes.json();
        setRolesList(extractList(data));
      } else {
        setRolesList([]);
      }
      if (deptsRes.ok) {
        const data = await deptsRes.json();
        const depts = extractList(data) as DepartmentItem[];
        setDepartmentsList(depts);
        // Keep selected department valid once API departments arrive
        if (depts.length > 0) {
          setForm((f) => {
            const stillValid = depts.some((d) => d.code === f.department);
            return stillValid ? f : { ...f, department: depts[0].code as Dept, roles: [] };
          });
        }
      } else {
        setDepartmentsList([]);
      }
    } catch (e) {
      console.warn("Could not fetch roles or departments:", e);
      setRolesList([]);
      setDepartmentsList([]);
    } finally {
      setIsLoadingRoles(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchRolesAndDepartments();
    }
  }, [token, fetchRolesAndDepartments]);

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

  useEffect(() => {
    if (form.roles.length > 0 || !rolesList.length) return;
    const defaultRole = defaultRoleIdForDept(form.department);
    if (defaultRole) {
      setForm((f) => ({ ...f, roles: [defaultRole] }));
    }
  }, [form.department, form.roles.length, rolesList, defaultRoleIdForDept]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const pickedRoles = form.roles.map((id) => String(id).trim()).filter(Boolean);
    const roles = pickedRoles.length > 0 ? pickedRoles : [defaultRoleIdForDept(form.department)].filter(Boolean);

    try {
      const res = await fetch(`${API_BASE}/api/users`, {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          password: form.password,
          department: form.department,
          roles,
          roleCode: form.department,
          portals: form.portals,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || errData?.message || "Failed to create user account.");
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err?.message ?? "Failed to create user.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setForm({
      name: "",
      email: "",
      phone: "",
      password: "",
      department: "sales" as Dept,
      roles: [],
      portals: [],
    });
    setSuccess(false);
    setError(null);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/user-directory"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted transition shadow-xs"
        >
          <ArrowLeft className="h-4 w-4" /> Back to User Directory
        </Link>
      </div>

      {/* Main Container Card */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="border-b border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground tracking-tight">Create User Account</h2>
              <p className="text-xs text-muted mt-0.5">
                Register a new team member and assign department credentials
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {success ? (
            <div className="flex flex-col items-center justify-center py-10 text-center max-w-md mx-auto space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                <CheckCircle className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">User Created Successfully!</h3>
                <p className="text-xs text-muted mt-1">
                   Account for <strong className="text-foreground">{form.name}</strong> ({form.email}) has been provisioned.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-4 w-full">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
                >
                  Add Another User
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

                {/* Password */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-foreground">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="Min. 8 characters"
                    required
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                  />
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
                  <label className="mb-1.5 block text-xs font-semibold text-foreground">
                    Assigned Roles
                    {form.roles.length === 0 && (
                      <span className="font-normal text-muted"> — defaults to department role</span>
                    )}
                  </label>

                  {isLoadingRoles ? (
                    <div className="flex items-center gap-2 py-2 text-xs text-muted">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading roles…
                    </div>
                  ) : availableRoles.length > 0 ? (
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
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <Link
                  href="/dashboard/user-directory"
                  className="rounded-xl border border-border bg-card px-5 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
                >
                  Cancel
                </Link>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-primary/90 transition active:scale-95 disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating Account…
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Create User Account
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
