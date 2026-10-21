"use client";

import { useMemo } from "react";
import {
  ClipboardList,
  ExternalLink,
  Landmark,
  LayoutGrid,
  Shield,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Truck,
  UserCheck,
  Wallet,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { useAuthProfile } from "@/hooks/useAuthProfile";
import {
  LEAD_MANAGER_FRONTEND_URL,
  OPMS_FRONTEND_URL,
  USER_MANAGER_FRONTEND_URL,
  WORK_PLANNER_FRONTEND_URL,
} from "@/lib/env";
import { buildSsoLaunchUrl } from "@/lib/ssoHandoff";
import type { AuthUser } from "@/types/leadManager";

export type PortalDef = {
  code: string;
  name: string;
  subtitle: string;
  description: string;
  isMicroFrontend: boolean;
  getUrl: () => string;
  storageKey?: string;
  isOpmsWorkspace?: boolean;
  icon: React.ElementType;
  iconBg: string;
  access_roles: string[];
};

function normalizeCode(code: string): string {
  return String(code || "")
    .toLowerCase()
    .trim()
    .replace(/-/g, "_");
}

function resolvePortalDetails(
  code: string,
  rawName?: string,
  roles: string[] = [],
): PortalDef | null {
  const norm = normalizeCode(code);
  if (norm === "app" || norm === "app_frontend") return null;

  let name = rawName?.trim();
  let subtitle = "Assigned portal";
  let description = `Authorized portal from auth-service (${norm}).`;
  let getUrl = () => `${OPMS_FRONTEND_URL}/${norm}`;
  let storageKey: string | undefined;
  let isOpmsWorkspace = false;
  let icon: React.ElementType = LayoutGrid;
  let iconBg = "bg-primary text-primary-foreground";

  if (norm === "opms") {
    name = name || "OPMS Portal";
    subtitle = "Order & production hub";
    description =
      "Main OPMS workspaces for orders, parties, products, and operations.";
    getUrl = () =>
      roles[0]
        ? `${OPMS_FRONTEND_URL}/${normalizeCode(roles[0])}`
        : `${OPMS_FRONTEND_URL}/login`;
    storageKey = "medica.auth";
    isOpmsWorkspace = true;
    icon = LayoutGrid;
    iconBg = "bg-blue-600 text-white";
  } else if (norm === "admin") {
    name = name || "Admin Portal";
    subtitle = "OPMS workspace";
    description = "Order master, parties, products, and operations control.";
    getUrl = () => `${OPMS_FRONTEND_URL}/admin`;
    storageKey = "medica.auth";
    isOpmsWorkspace = true;
    icon = ShieldCheck;
    iconBg = "bg-blue-600 text-white";
  } else if (norm === "sales") {
    name = name || "Sales Portal";
    subtitle = "OPMS workspace";
    description = "Sales orders, quotations, targets, and portfolio analytics.";
    getUrl = () => `${OPMS_FRONTEND_URL}/sales`;
    storageKey = "medica.auth";
    isOpmsWorkspace = true;
    icon = TrendingUp;
    iconBg = "bg-emerald-600 text-white";
  } else if (norm === "finance") {
    name = name || "Finance Portal";
    subtitle = "OPMS workspace";
    description = "Financial clearance, credit, AR, and statements.";
    getUrl = () => `${OPMS_FRONTEND_URL}/finance`;
    storageKey = "medica.auth";
    isOpmsWorkspace = true;
    icon = Landmark;
    iconBg = "bg-purple-600 text-white";
  } else if (norm === "dispatch") {
    name = name || "Dispatch Portal";
    subtitle = "OPMS workspace";
    description = "Fulfillment, transport assignment, and delivery tracking.";
    getUrl = () => `${OPMS_FRONTEND_URL}/dispatch`;
    storageKey = "medica.auth";
    isOpmsWorkspace = true;
    icon = Truck;
    iconBg = "bg-amber-600 text-white";
  } else if (norm === "account") {
    name = name || "Account Portal";
    subtitle = "OPMS workspace";
    description = "Billing clearances, due sheets, and invoice handoffs.";
    getUrl = () => `${OPMS_FRONTEND_URL}/account`;
    storageKey = "medica.auth";
    isOpmsWorkspace = true;
    icon = Wallet;
    iconBg = "bg-cyan-600 text-white";
  } else if (norm === "super_admin") {
    name = name || "Super Admin Portal";
    subtitle = "OPMS workspace";
    description = "Root administration and organization governance.";
    getUrl = () => `${OPMS_FRONTEND_URL}/super_admin`;
    storageKey = "medica.auth";
    isOpmsWorkspace = true;
    icon = Shield;
    iconBg = "bg-rose-600 text-white";
  } else if (norm === "user_manager") {
    name = name || "User Management Portal";
    subtitle = "Micro-frontend";
    description = "Users, departments, roles, and access control.";
    getUrl = () => USER_MANAGER_FRONTEND_URL;
    storageKey = "shakti.user_manager.session";
    icon = UserCheck;
    iconBg = "bg-indigo-600 text-white";
  } else if (norm === "work_planner") {
    name = name || "Work Planner Portal";
    subtitle = "Micro-frontend";
    description = "Work planning, schedules, and field assignments.";
    getUrl = () => WORK_PLANNER_FRONTEND_URL;
    storageKey = "shakti.work_planner.session";
    icon = ClipboardList;
    iconBg = "bg-teal-600 text-white";
  } else if (norm === "lead_manager") {
    name = name || "Lead Manager Portal";
    subtitle = "Micro-frontend";
    description = "Lead pipelines, follow-ups, quotations, and reports.";
    getUrl = () => LEAD_MANAGER_FRONTEND_URL;
    storageKey = "shakti.lead_manager.session";
    icon = TrendingUp;
    iconBg = "bg-orange-600 text-white";
  } else {
    if (!name) {
      name = `${norm
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")} Portal`;
    }
    getUrl = () => `${OPMS_FRONTEND_URL}/${norm}`;
    storageKey = "medica.auth";
    isOpmsWorkspace = true;
  }

  return {
    code: norm,
    name,
    subtitle,
    description,
    isMicroFrontend: true,
    getUrl,
    storageKey,
    isOpmsWorkspace,
    icon,
    iconBg,
    access_roles: roles,
  };
}

const OPMS_ROLE_PRIORITY = [
  "super_admin",
  "admin",
  "finance",
  "account",
  "dispatch",
  "sales",
] as const;

export function PortalsSection() {
  const { user, session } = useAuthProfile();
  const token = session?.token || "";

  const assignedPortals = useMemo(() => {
    const list: PortalDef[] = [];
    const seen = new Set<string>();

    const push = (code: string, roles: string[] = [], name?: string) => {
      const def = resolvePortalDetails(code, name, roles);
      if (!def || seen.has(def.code)) return;
      seen.add(def.code);
      list.push(def);
    };

    const expandOpms = (roles: string[]) => {
      const normalized = roles.map(normalizeCode).filter(Boolean);
      if (!normalized.length) {
        push("opms", []);
        return;
      }
      const ordered = [
        ...OPMS_ROLE_PRIORITY.filter((r) => normalized.includes(r)),
        ...normalized.filter(
          (r) => !(OPMS_ROLE_PRIORITY as readonly string[]).includes(r as never),
        ),
      ];
      for (const role of ordered) push(role, [role]);
    };

    const portals = Array.isArray(user?.portals) ? user.portals : [];
    for (const item of portals) {
      if (!item || typeof item !== "object") continue;
      const code = String(
        (item as { portal_code?: string }).portal_code || "",
      );
      if (!code) continue;
      const name = String(
        (item as { portal_name?: string }).portal_name || "",
      );
      const roles = Array.isArray(item.access_roles)
        ? item.access_roles.map((r) => String(r).trim()).filter(Boolean)
        : [];

      if (normalizeCode(code) === "opms") {
        expandOpms(roles);
      } else {
        push(code, roles, name);
      }
    }

    return list;
  }, [user]);

  const handleLaunchSSO = (portal: PortalDef) => {
    if (!token || !user) {
      toast.error("No active session to SSO with");
      return;
    }

    void (async () => {
      try {
        const part = token.split(".")[1];
        let maxAge = 60 * 60 * 8;
        try {
          if (part) {
            const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
            const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
            const exp = Number(JSON.parse(atob(padded)).exp);
            const left = Math.floor(exp - Date.now() / 1000);
            if (left > 0) maxAge = left;
          }
        } catch {
          /* keep fallback */
        }
        document.cookie = `access_token=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
      } catch {
        /* ignore */
      }

      toast.success(`SSO: ${portal.name}`, {
        description: `Opening as ${user.email || user.name || "user"}`,
      });

      const url = await buildSsoLaunchUrl(portal.getUrl(), token);
      window.open(url, "_blank");
    })();
  };

  if (!assignedPortals.length) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
            <LayoutGrid className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground">
                Assigned Portals
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                <Sparkles className="h-2.5 w-2.5" />
                {assignedPortals.length}
              </span>
            </div>
            <p className="text-[11px] text-muted">
              Portals from your JWT — launch with single sign-on
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          SSO ready
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
        {assignedPortals.map((portal) => {
          const Icon = portal.icon;
          return (
            <button
              key={portal.code}
              type="button"
              onClick={() => handleLaunchSSO(portal)}
              className="group flex flex-col text-left rounded-xl border border-border bg-surface-muted/40 p-3 transition hover:border-primary/40 hover:bg-primary/5 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg shadow-sm ${portal.iconBg}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary">
                  Launch
                </span>
              </div>

              <h3 className="mt-2 text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                {portal.name}
              </h3>
              <p className="text-[10px] font-medium text-muted truncate">
                {portal.subtitle}
              </p>
              <p className="mt-1 text-[11px] text-muted line-clamp-2 leading-snug">
                {portal.description}
              </p>

              {portal.access_roles.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1 border-t border-border/60 pt-2">
                  <span className="text-[9px] font-bold uppercase text-muted">
                    Roles
                  </span>
                  {portal.access_roles.map((role) => (
                    <span
                      key={role}
                      className="rounded bg-card px-1.5 py-0.5 text-[9px] font-semibold text-foreground border border-border"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-auto flex items-center justify-between pt-2.5 border-t border-border/60 mt-2">
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> SSO
                </span>
                <span className="text-[11px] font-bold text-primary inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  Launch <ExternalLink className="h-3 w-3" />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
