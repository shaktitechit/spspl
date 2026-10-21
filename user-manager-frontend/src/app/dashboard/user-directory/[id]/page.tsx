"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, User, ShieldCheck, Mail, Phone, Calendar, Building2, CheckCircle, XCircle, Edit, Trash2, Loader2, AlertTriangle, Globe } from "lucide-react";
import { readSessionFromStorage } from "@/utils/authStorage";
import { API_BASE, getAuthHeaders } from "@/utils/apiHelpers";
import { DeptBadge } from "@/components/DeptBadge";
import { DeleteUserModal } from "@/components/modals/DeleteUserModal";

export default function UserDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params?.id as string;

  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
      const res = await fetch(`${API_BASE}/api/users/${userId}`, {
        headers: getAuthHeaders(token),
      });

      if (!res.ok) {
        throw new Error("Could not fetch user details.");
      }

      const data = await res.json();
      setUser(data?.data || data?.user || data);
    } catch (e: any) {
      setError(e?.message || "Failed to load user profile.");
    } finally {
      setIsLoading(false);
    }
  }, [token, userId]);

  useEffect(() => {
    if (token && userId) {
      fetchUserData();
    }
  }, [token, userId, fetchUserData]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-10">
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard/user-directory"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted transition shadow-xs"
          >
            <ArrowLeft className="h-4 w-4" /> Back to User Directory
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-16 text-muted gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs font-semibold">Loading user details…</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-10">
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard/user-directory"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted transition shadow-xs"
          >
            <ArrowLeft className="h-4 w-4" /> Back to User Directory
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center space-y-3">
          <AlertTriangle className="h-10 w-10 text-rose-500" />
          <h3 className="text-base font-bold text-foreground">User Not Found</h3>
          <p className="text-xs text-muted max-w-md">{error || "The requested user account could not be found."}</p>
          <Link
            href="/dashboard/user-directory"
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary/90 transition"
          >
            Return to Directory
          </Link>
        </div>
      </div>
    );
  }

  const uid = String(user._id || user.id || "");
  const isActive = user.is_active !== false;
  const roles = Array.isArray(user.roles) ? user.roles : [];

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

      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/user-directory"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted transition shadow-xs"
        >
          <ArrowLeft className="h-4 w-4" /> Back to User Directory
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/user-directory/${uid}/edit`}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition shadow-xs"
          >
            <Edit className="h-3.5 w-3.5" /> Edit Profile
          </Link>
          {!isSelf && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition shadow-xs"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete User
            </button>
          )}
        </div>
      </div>

      {/* Hero Profile Banner */}
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-2xl font-black text-primary shadow-sm">
              {(user.name || "U").charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-extrabold text-foreground tracking-tight">{user.name || "Unnamed User"}</h1>
                {isSelf && (
                  <span className="rounded-full bg-primary/15 border border-primary/30 text-primary text-3xs px-2.5 py-0.5 font-bold">
                    You (Current Account)
                  </span>
                )}
                {isActive ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle className="h-3 w-3" /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <XCircle className="h-3 w-3" /> Inactive
                  </span>
                )}
              </div>
              <p className="text-xs text-muted mt-1">{user.email || "No email provided"}</p>
            </div>
          </div>

          <div className="shrink-0">
            <DeptBadge dept={user.department || "unknown"} />
          </div>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact & Personal Details Card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 border-b border-border pb-3">
            <User className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Personal Information</h3>
          </div>

          <div className="space-y-3.5 text-xs">
            <div className="flex items-start gap-3">
              <Mail className="h-4 w-4 text-muted shrink-0 mt-0.5" />
              <div>
                <p className="text-3xs uppercase font-bold text-muted tracking-wider">Email Address</p>
                <p className="font-semibold text-foreground mt-0.5">{user.email || "—"}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="h-4 w-4 text-muted shrink-0 mt-0.5" />
              <div>
                <p className="text-3xs uppercase font-bold text-muted tracking-wider">Phone Number</p>
                <p className="font-semibold text-foreground mt-0.5">{user.phone || "Not specified"}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-muted shrink-0 mt-0.5" />
              <div>
                <p className="text-3xs uppercase font-bold text-muted tracking-wider">Account Created</p>
                <p className="font-semibold text-foreground mt-0.5">
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Department & Roles Card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 border-b border-border pb-3">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Department & Access Control</h3>
          </div>

          <div className="space-y-3.5 text-xs">
            <div className="flex items-start gap-3">
              <Building2 className="h-4 w-4 text-muted shrink-0 mt-0.5" />
              <div>
                <p className="text-3xs uppercase font-bold text-muted tracking-wider">Assigned Department</p>
                <div className="mt-1">
                  <DeptBadge dept={user.department || "unknown"} />
                </div>
              </div>
            </div>

            <div>
              <p className="text-3xs uppercase font-bold text-muted tracking-wider mb-1.5">Assigned Roles</p>
              {roles.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {roles.map((r: any, idx: number) => {
                    const roleName = typeof r === "object" ? (r.name || r.code) : String(r);
                    return (
                      <span
                        key={idx}
                        className="rounded-xl border border-border bg-surface-muted px-3 py-1 text-xs font-semibold text-foreground"
                      >
                        {roleName}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted italic">Default department role applied</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Assigned Portals & Portal Roles Section */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 border-b border-border pb-3">
          <Globe className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Portal Access & Roles Assignment</h3>
        </div>

        {Array.isArray(user.portals) && user.portals.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {user.portals.map((p: any, idx: number) => {
              const pCode = p.portal_code || p.portal?.code || "portal";
              const pName = p.portal_name || p.portal?.name || pCode;
              const pRoles: string[] = Array.isArray(p.access_roles)
                ? p.access_roles
                : p.access_role ? [p.access_role] : ["executive"];

              return (
                <div
                  key={idx}
                  className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2.5 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-foreground">{pName}</h4>
                    <span className="rounded-full bg-primary/20 text-primary text-3xs font-mono px-2 py-0.5 font-bold">
                      {pCode}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-primary/20 space-y-1">
                    <p className="text-3xs uppercase font-bold text-muted tracking-wider">
                      Portal Roles
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {pRoles.map((role: string, rIdx: number) => (
                        <span
                          key={rIdx}
                          className="rounded-lg bg-primary text-white text-3xs font-bold px-2 py-0.5 shadow-xs"
                        >
                          {role.charAt(0).toUpperCase() + role.slice(1)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted italic py-2">
            No specific portals assigned to this user account.
          </p>
        )}
      </div>
    </div>
  );
}
