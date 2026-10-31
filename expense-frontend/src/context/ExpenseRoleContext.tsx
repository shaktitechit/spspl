"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { readSessionFromStorage, isExpenseAdmin, isExpenseFinance, isSuperAdmin } from "@/utils/authStorage";
import type { AuthUser } from "@/types/workPlanner";

export type ExpensePortalMode = "admin" | "finance";

interface ExpenseRoleContextType {
  activeMode: ExpensePortalMode;
  isAdmin: boolean;
  isFinance: boolean;
  isSuper: boolean;
  isCurrentAdminMode: boolean;
  isCurrentFinanceMode: boolean;
  user: AuthUser | null;
}

const ExpenseRoleContext = createContext<ExpenseRoleContextType>({
  activeMode: "admin",
  isAdmin: false,
  isFinance: false,
  isSuper: false,
  isCurrentAdminMode: true,
  isCurrentFinanceMode: false,
  user: null,
});

export function ExpenseRoleProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const session = readSessionFromStorage();
    if (session?.user) {
      setUser(session.user);
    }
  }, []);

  const isAdmin = useMemo(() => isExpenseAdmin(user), [user]);
  const isFinance = useMemo(() => isExpenseFinance(user), [user]);
  const isSuper = useMemo(() => isSuperAdmin(user), [user]);

  // activeMode is fixed by the user's assigned role — no switching allowed.
  // Super admin and admin-role users → admin mode.
  // Pure finance-role users → finance mode.
  const activeMode: ExpensePortalMode = useMemo(() => {
    if (isAdmin || isSuper) return "admin";
    if (isFinance) return "finance";
    return "admin";
  }, [isAdmin, isFinance, isSuper]);

  const isCurrentAdminMode = activeMode === "admin";
  const isCurrentFinanceMode = activeMode === "finance";

  return (
    <ExpenseRoleContext.Provider
      value={{
        activeMode,
        isAdmin,
        isFinance,
        isSuper,
        isCurrentAdminMode,
        isCurrentFinanceMode,
        user,
      }}
    >
      {children}
    </ExpenseRoleContext.Provider>
  );
}

export function useExpenseRole() {
  return useContext(ExpenseRoleContext);
}

