export type ThemeColor = "indigo" | "emerald" | "amber" | "rose" | "sky" | "violet" | "slate";

export interface UserPortalAccess {
  portal_code: string;
  access_roles: string[];
}

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  department?: string;
  roles?: string[];
  role_codes?: string[];
  role_names?: string[];
  portals?: UserPortalAccess[];
}

export interface UserSession {
  token: string;
  refreshToken?: string;
  refreshExpiresAt?: number;
  refreshExpiresIn?: number;
  user: AuthUser;
}

export const THEME_COLORS: Record<
  ThemeColor,
  { label: string; primaryClass: string; bgClass: string; textClass: string; borderClass: string }
> = {
  indigo: {
    label: "Indigo",
    primaryClass: "bg-indigo-600",
    bgClass: "bg-indigo-50",
    textClass: "text-indigo-600",
    borderClass: "border-indigo-600",
  },
  emerald: {
    label: "Emerald",
    primaryClass: "bg-emerald-600",
    bgClass: "bg-emerald-50",
    textClass: "text-emerald-600",
    borderClass: "border-emerald-600",
  },
  amber: {
    label: "Amber",
    primaryClass: "bg-amber-600",
    bgClass: "bg-amber-50",
    textClass: "text-amber-600",
    borderClass: "border-amber-600",
  },
  rose: {
    label: "Rose",
    primaryClass: "bg-rose-600",
    bgClass: "bg-rose-50",
    textClass: "text-rose-600",
    borderClass: "border-rose-600",
  },
  sky: {
    label: "Sky",
    primaryClass: "bg-sky-600",
    bgClass: "bg-sky-50",
    textClass: "text-sky-600",
    borderClass: "border-sky-600",
  },
  violet: {
    label: "Violet",
    primaryClass: "bg-violet-600",
    bgClass: "bg-violet-50",
    textClass: "text-violet-600",
    borderClass: "border-violet-600",
  },
  slate: {
    label: "Slate",
    primaryClass: "bg-slate-700",
    bgClass: "bg-slate-100",
    textClass: "text-slate-700",
    borderClass: "border-slate-700",
  },
};
