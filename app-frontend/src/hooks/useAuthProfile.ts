"use client";

import { useEffect, useState } from "react";
import type { AuthUser, UserSession } from "@/types/leadManager";
import {
  formatLabel,
  getDepartment,
  getPrimaryRoleCode,
  getRoleCodes,
} from "@/constants/dashboardAccess";
import { readSessionFromStorage } from "@/utils/authStorage";

export interface AuthProfileState {
  user: AuthUser | null;
  session: UserSession | null;
  loading: boolean;
  department: string;
  departmentLabel: string;
  roleCodes: string[];
  primaryRole: string;
  roleLabel: string;
}

export function useAuthProfile(): AuthProfileState {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSession(readSessionFromStorage());
    setLoading(false);
  }, []);

  const user = session?.user || null;
  const department = getDepartment(user);
  const roleCodes = getRoleCodes(user);
  const primaryRole = getPrimaryRoleCode(user);

  return {
    user,
    session,
    loading,
    department,
    departmentLabel: formatLabel(department) || department || "Department",
    roleCodes,
    primaryRole,
    roleLabel: primaryRole
      ? formatLabel(primaryRole)
      : roleCodes.map(formatLabel).filter(Boolean).join(", ") || "User",
  };
}

/** @deprecated Prefer {@link useAuthProfile}. */
export function useLeadManagerRole() {
  return useAuthProfile();
}
