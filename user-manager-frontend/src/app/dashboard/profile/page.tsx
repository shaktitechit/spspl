"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Edit,
  Globe,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";
import { readSessionFromStorage } from "@/utils/authStorage";
import { API_BASE, getAuthHeaders } from "@/utils/apiHelpers";
import { DeptBadge } from "@/components/DeptBadge";
import { PasswordChangePanel } from "@/components/profile/PasswordChangePanel";
import { useChangePasswordMutation } from "@/store/api/authApiSlice";
import { resolveRoleLabels } from "@/utils/resolveRoleLabels";
import type { AuthUser, UserSession } from "@/types/userManager";

function formatLabel(code: string): string {
  return String(code || "")
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

type Tab = "overview" | "password";

export default function ProfilePage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [session, setSession] = useState<UserSession | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [changePassword] = useChangePasswordMutation();

  useEffect(() => {
    setSession(readSessionFromStorage());
  }, []);

  const token = session?.token;
  const sessionUser = session?.user || null;
  const userId = String(sessionUser?._id || sessionUser?.id || "");

  const loadProfile = useCallback(async () => {
    if (!sessionUser) {
      setLoading(false);
      return;
    }
    setUser(sessionUser);
    if (!token || !userId) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/users/${userId}`, {
        headers: getAuthHeaders(token),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data?.data || data?.user || data);
      }
    } catch {
      /* keep session user */
    } finally {
      setLoading(false);
    }
  }, [sessionUser, token, userId]);

  useEffect(() => {
    if (session) {
      loadProfile();
    }
  }, [session, loadProfile]);

  if (loading || !user) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-16 text-muted gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs font-semibold">Loading profile…</p>
      </div>
    );
  }

  const uid = String(user._id || user.id || userId || "");
  const roleLabels = resolveRoleLabels(user);
  const portals = Array.isArray(user.portals) ? user.portals : [];
  const phone = (user as AuthUser & { phone?: string }).phone;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10 font-sans">
      <div className="flex items-center justify-end">
        {uid && tab === "overview" ? (
          <Link
            href={`/dashboard/user-directory/${uid}/edit`}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition shadow-xs"
          >
            <Edit className="h-3.5 w-3.5" /> Edit Profile
          </Link>
        ) : null}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-2xl font-black text-primary shadow-sm">
              {(user.name || "U").charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-extrabold text-foreground tracking-tight">
                  {user.name || "Unnamed User"}
                </h1>
                <span className="rounded-full bg-primary/15 border border-primary/30 text-primary text-[10px] px-2.5 py-0.5 font-bold">
                  You (Current Account)
                </span>
              </div>
              <p className="text-xs text-muted mt-1">{user.email || "No email"}</p>
              {roleLabels.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {roleLabels.map((label) => (
                    <span
                      key={label}
                      className="rounded-full bg-surface-muted px-2.5 py-0.5 text-[10px] font-bold text-muted uppercase"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <DeptBadge dept={user.department || "unknown"} />
        </div>
      </div>

      <div className="flex gap-1 rounded-xl border border-border bg-card p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab("overview")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            tab === "overview"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted hover:text-foreground hover:bg-surface-muted"
          }`}
        >
          <User className="h-3.5 w-3.5" />
          Overview
        </button>
        <button
          type="button"
          onClick={() => setTab("password")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            tab === "password"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted hover:text-foreground hover:bg-surface-muted"
          }`}
        >
          <KeyRound className="h-3.5 w-3.5" />
          Password
        </button>
      </div>

      {tab === "password" ? (
        <PasswordChangePanel
          onChangePassword={async ({ currentPassword, newPassword }) => {
            await changePassword({ currentPassword, newPassword }).unwrap();
          }}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 border-b border-border pb-3">
                <User className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Personal Information</h3>
              </div>
              <div className="space-y-3.5 text-xs">
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 text-muted shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted tracking-wider">
                      Email Address
                    </p>
                    <p className="font-semibold text-foreground mt-0.5">{user.email || "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 text-muted shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted tracking-wider">
                      Phone Number
                    </p>
                    <p className="font-semibold text-foreground mt-0.5">
                      {phone || "Not specified"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 border-b border-border pb-3">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Department & Access Control</h3>
              </div>
              <div className="space-y-3.5 text-xs">
                <div className="flex items-start gap-3">
                  <Building2 className="h-4 w-4 text-muted shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted tracking-wider">
                      Assigned Department
                    </p>
                    <div className="mt-1">
                      <DeptBadge dept={user.department || "unknown"} />
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted tracking-wider mb-1.5">
                    Assigned Roles
                  </p>
                  {roleLabels.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {roleLabels.map((label) => (
                        <span
                          key={label}
                          className="rounded-xl border border-border bg-surface-muted px-3 py-1 text-xs font-semibold text-foreground"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted italic">Default department role applied</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 border-b border-border pb-3">
              <Globe className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Portal Access & Roles</h3>
            </div>
            {portals.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {portals.map((p, idx) => {
                  const pCode = p.portal_code || "portal";
                  const pName = p.portal_name || formatLabel(pCode) || pCode;
                  const pRoles = Array.isArray(p.access_roles) ? p.access_roles : [];
                  return (
                    <div
                      key={idx}
                      className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2.5 shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-bold text-foreground truncate">{pName}</h4>
                        <span className="rounded-full bg-primary/20 text-primary text-[9px] font-mono px-2 py-0.5 font-bold shrink-0">
                          {pCode}
                        </span>
                      </div>
                      {pRoles.length > 0 ? (
                        <div className="pt-2 border-t border-primary/20 flex flex-wrap gap-1.5">
                          {pRoles.map((role) => (
                            <span
                              key={role}
                              className="rounded-lg bg-primary text-white text-[10px] font-bold px-2 py-0.5"
                            >
                              {formatLabel(role) || role}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted italic py-2">
                No specific portals assigned to this account.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
