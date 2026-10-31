"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { readSessionFromStorage, isExpenseAdmin, isExpenseFinance, isSuperAdmin } from "@/utils/authStorage";
import type { AuthUser } from "@/types/workPlanner";

export type ExpensePortalMode = "admin" | "finance";

interface ExpenseRoleContextType {
  activeMode: ExpensePortalMode;
  setActiveMode: (mode: ExpensePortalMode) => void;
  isAdmin: boolean;
  isFinance: boolean;
  isSuper: boolean;
  hasDualRole: boolean;
  isCurrentAdminMode: boolean;
  isCurrentFinanceMode: boolean;
  user: AuthUser | null;
}

const ExpenseRoleContext = createContext<ExpenseRoleContextType>({
  activeMode: "admin",
  setActiveMode: () => {},
  isAdmin: false,
  isFinance: false,
  isSuper: false,
  hasDualRole: false,
  isCurrentAdminMode: true,
  isCurrentFinanceMode: false,
  user: null,
});

const STORAGE_KEY = "shakti.expense.active_mode";

export function ExpenseRoleProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeMode, setActiveModeState] = useState<ExpensePortalMode>("admin");

  useEffect(() => {
    const session = readSessionFromStorage();
    if (session?.user) {
      setUser(session.user);
    }
  }, []);

  const isAdmin = useMemo(() => isExpenseAdmin(user), [user]);
  const isFinance = useMemo(() => isExpenseFinance(user), [user]);
  const isSuper = useMemo(() => isSuperAdmin(user), [user]);
  const hasDualRole = useMemo(() => (isAdmin && isFinance) || isSuper, [isAdmin, isFinance, isSuper]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(STORAGE_KEY) as ExpensePortalMode | null;

    if (hasDualRole) {
      if (saved === "finance" || saved === "admin") {
        setActiveModeState(saved);
      } else {
        setActiveModeState("admin");
      }
    } else if (isFinance && !isAdmin) {
      setActiveModeState("finance");
    } else {
      setActiveModeState("admin");
    }
  }, [isAdmin, isFinance, hasDualRole]);

  const setActiveMode = (mode: ExpensePortalMode) => {
    setActiveModeState(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, mode);
    }
  };

  const isCurrentAdminMode = activeMode === "admin";
  const isCurrentFinanceMode = activeMode === "finance";

  return (
    <ExpenseRoleContext.Provider
      value={{
        activeMode,
        setActiveMode,
        isAdmin,
        isFinance,
        isSuper,
        hasDualRole,
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

