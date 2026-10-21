"use client";

import { useEffect, useState } from "react";
import type { AuthUser, UserSession } from "@/types/leadManager";
import { isAdmin, isCoordinator, isExecutive, isManager, readSessionFromStorage } from "@/utils/authStorage";

export interface LeadManagerRoleState {
  user: AuthUser | null;
  session: UserSession | null;
  loading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isCoordinator: boolean;
  isExecutive: boolean;
  roleLabel: string;
}

export function useLeadManagerRole(): LeadManagerRoleState {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = readSessionFromStorage();
    setSession(s);
    setLoading(false);
  }, []);

  const user = session?.user || null;
  const admin = isAdmin(user);
  const manager = isManager(user);
  const coordinator = isCoordinator(user);
  const executive = isExecutive(user);

  return {
    user,
    session,
    loading,
    isAdmin: admin,
    isManager: manager,
    isCoordinator: coordinator,
    isExecutive: executive,
    roleLabel: admin
      ? "Admin"
      : manager
      ? "Manager"
      : coordinator
      ? "Coordinator"
      : executive
      ? "Executive"
      : "User",
  };
}
