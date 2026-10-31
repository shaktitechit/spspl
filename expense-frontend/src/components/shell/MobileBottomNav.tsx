/**
 * @fileoverview Mobile Bottom Navigation for Expense Portal with independent routes.
 * @module components/shell/MobileBottomNav
 */
"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Receipt,
  Wallet,
  Scale,
  CreditCard,
  Menu,
} from "lucide-react";
import { useExpenseRole } from "@/context/ExpenseRoleContext";

export function MobileBottomNav({
  onOpenMobileDrawer,
}: {
  onOpenMobileDrawer: () => void;
}) {
  const pathname = usePathname();
  const { isCurrentFinanceMode } = useExpenseRole();

  const isHomeActive = pathname === "/dashboard";
  const isClaimsActive = pathname.startsWith("/dashboard/claims");
  const isAdvancesActive = pathname.startsWith("/dashboard/advances");
  const isLedgersActive = pathname.startsWith("/dashboard/ledgers");
  const isSettlementsActive = pathname.startsWith("/dashboard/settlements");

  const navItems = [
    {
      name: "Home",
      href: "/dashboard",
      icon: LayoutGrid,
      active: isHomeActive,
    },
    {
      name: isCurrentFinanceMode ? "Audit" : "Claims",
      href: "/dashboard/claims",
      icon: Receipt,
      active: isClaimsActive,
    },
    {
      name: isCurrentFinanceMode ? "Disburse" : "Advances",
      href: "/dashboard/advances",
      icon: Wallet,
      active: isAdvancesActive,
    },
    {
      name: "Ledgers",
      href: "/dashboard/ledgers",
      icon: Scale,
      active: isLedgersActive,
    },
    {
      name: "Settle",
      href: "/dashboard/settlements",
      icon: CreditCard,
      active: isSettlementsActive,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center justify-around border-t border-border bg-card/95 backdrop-blur-md px-2 lg:hidden">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.name}
            href={item.href}
            className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition ${
              item.active ? "text-primary font-bold" : "text-muted hover:text-foreground"
            }`}
          >
            <Icon className={`h-5 w-5 ${item.active ? "text-primary" : ""}`} />
            <span className="text-[10px] tracking-tight">{item.name}</span>
          </Link>
        );
      })}

      <button
        type="button"
        onClick={onOpenMobileDrawer}
        className="flex flex-col items-center justify-center gap-1 flex-1 py-1 text-muted hover:text-foreground transition cursor-pointer"
      >
        <Menu className="h-5 w-5" />
        <span className="text-[10px] tracking-tight">Menu</span>
      </button>
    </nav>
  );
}
