"use client";

import { useState } from "react";
import {
  Building2,
  Globe,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";
import { useAuthProfile } from "@/hooks/useAuthProfile";
import { formatLabel } from "@/constants/dashboardAccess";
import {
  useChangePasswordMutation,
  useGetMeQuery,
} from "@/store/api/authApiSlice";
import { resolveRoleLabels } from "@/utils/resolveRoleLabels";
import { PasswordChangePanel } from "@/components/profile/PasswordChangePanel";

type Tab = "overview" | "password";

export default function ProfilePage() {
  const [tab, setTab] = useState<Tab>("overview");
  const { user: sessionUser, loading: sessionLoading, department } =
    useAuthProfile();
  const { data } = useGetMeQuery(undefined, { skip: !sessionUser });
  const [changePassword] = useChangePasswordMutation();

  const user = data?.user || sessionUser;

  if (sessionLoading || !user) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-16 text-muted gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs font-semibold">Loading profile…</p>
      </div>
    );
  }

  const dept =
    formatLabel(String(user.department || department || "")) ||
    user.department ||
    department ||
    "—";
  const roleLabels = resolveRoleLabels(user);
  const portals = Array.isArray(user.portals) ? user.portals : [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10 font-sans">
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-2xl font-black text-primary shadow-sm">
            {(user.name || user.email || "U").charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-foreground tracking-tight">
              {user.name || "Unnamed User"}
            </h1>
            <p className="text-xs text-muted mt-1">{user.email || "No email"}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {dept !== "—" ? (
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary uppercase">
                  {dept}
                </span>
              ) : null}
              {roleLabels.map((label) => (
                <span
                  key={label}
                  className="rounded-full bg-surface-muted px-2.5 py-0.5 text-[10px] font-bold text-muted uppercase"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
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
                <h3 className="text-sm font-bold text-foreground">
                  Personal Information
                </h3>
              </div>
              <div className="space-y-3.5 text-xs">
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 text-muted shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted tracking-wider">
                      Email Address
                    </p>
                    <p className="font-semibold text-foreground mt-0.5">
                      {user.email || "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 text-muted shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted tracking-wider">
                      Phone Number
                    </p>
                    <p className="font-semibold text-foreground mt-0.5">
                      {user.phone || "Not specified"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 border-b border-border pb-3">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  Department & Access
                </h3>
              </div>
              <div className="space-y-3.5 text-xs">
                <div className="flex items-start gap-3">
                  <Building2 className="h-4 w-4 text-muted shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted tracking-wider">
                      Department
                    </p>
                    <p className="font-semibold text-foreground mt-0.5">{dept}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted tracking-wider mb-1.5">
                    Roles
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
                    <p className="text-xs text-muted italic">No roles listed</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {portals.length > 0 ? (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 border-b border-border pb-3">
                <Globe className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Portal Access</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {portals.map((p, idx) => {
                  const code = p.portal_code || "portal";
                  const name = p.portal_name || formatLabel(code) || code;
                  const accessRoles = Array.isArray(p.access_roles)
                    ? p.access_roles
                    : [];
                  return (
                    <div
                      key={`${code}-${idx}`}
                      className="rounded-xl border border-border bg-surface-muted/40 p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-bold text-foreground truncate">
                          {name}
                        </h4>
                        <span className="rounded-full bg-primary/15 text-primary text-[9px] font-mono px-2 py-0.5 font-bold shrink-0">
                          {code}
                        </span>
                      </div>
                      {accessRoles.length > 0 ? (
                        <div className="flex flex-wrap gap-1 pt-1 border-t border-border/60">
                          {accessRoles.map((role) => (
                            <span
                              key={role}
                              className="rounded-lg bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5"
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
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
