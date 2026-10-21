export const DEPARTMENTS = ["super_admin", "admin", "sales", "finance", "account", "dispatch"] as const;
export type Dept = (typeof DEPARTMENTS)[number] | (string & {});

export interface DepartmentItem {
  _id?: string;
  id?: string;
  name: string;
  code: string;
  description?: string;
  is_active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RoleItem {
  _id?: string;
  id?: string;
  name: string;
  code: string;
  department: string;
  is_system_role?: boolean;
  is_default_role?: boolean;
  is_active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const THEME_COLORS = [
  { name: "violet", label: "Violet", bg: "bg-purple-600", border: "border-purple-500", text: "text-purple-400" },
  { name: "indigo", label: "Indigo", bg: "bg-indigo-600", border: "border-indigo-500", text: "text-indigo-400" },
  { name: "blue", label: "Blue", bg: "bg-blue-600", border: "border-blue-500", text: "text-blue-400" },
  { name: "emerald", label: "Emerald", bg: "bg-emerald-600", border: "border-emerald-500", text: "text-emerald-400" },
  { name: "rose", label: "Rose", bg: "bg-rose-600", border: "border-rose-500", text: "text-rose-400" },
  { name: "amber", label: "Amber", bg: "bg-amber-600", border: "border-amber-500", text: "text-amber-400" },
] as const;

export type ThemeColor = (typeof THEME_COLORS)[number]["name"];

export interface Portal {
  _id?: string;
  id?: string;
  name: string;
  code: string;
  description?: string;
  access_roles?: string[];
  is_active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserPortalAssignment {
  portal?: string | Portal;
  portal_id?: string;
  portal_code: string;
  portal_name?: string;
  access_roles: string[];
}

export interface AuthUser {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  department: string;
  roles?: any[];
  role_codes?: string[];
  role_names?: string[];
  portals?: UserPortalAssignment[];
}

export interface UserSession {
  token: string;
  refreshToken?: string;
  refreshExpiresAt?: number;
  refreshExpiresIn?: number;
  user: AuthUser;
}
