"use client";

import React from "react";
import {
  DollarSign,
  Clock,
  CheckCircle2,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
} from "lucide-react";
import { formatCurrency } from "../workPlanUtils";
import type { ExpenseKpiSummaryData } from "@/types/workPlanner";

interface ExpenseKpiSummaryProps {
  kpis?: ExpenseKpiSummaryData;
  loading?: boolean;
}

export function ExpenseKpiSummary({ kpis, loading }: ExpenseKpiSummaryProps) {
  const pendingClaims = kpis?.pending_approval?.amount ?? 0;
  const pendingCount = kpis?.pending_approval?.count ?? 0;
  const unsettledApproved = kpis?.approved_unsettled?.amount ?? 0;
  const unsettledCount = kpis?.approved_unsettled?.count ?? 0;
  const activeAdvance = kpis?.active_tour_advances?.amount ?? 0;
  const activeAdvanceCount = kpis?.active_tour_advances?.count ?? 0;

  const netPosition = unsettledApproved - activeAdvance;
  const positionStatus =
    netPosition > 0
      ? "due_to_employee"
      : netPosition < 0
      ? "due_to_company"
      : "balanced";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* 1. Pending Approval */}
      <div className="rounded-2xl border border-border bg-card p-3.5 sm:p-4 shadow-2xs hover:shadow-xs transition">
        <div className="flex items-center justify-between">
          <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted">
            Pending Claims
          </span>
          <div className="rounded-xl bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
            <Clock className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-xl sm:text-2xl font-bold text-foreground">
            {loading ? "…" : formatCurrency(pendingClaims)}
          </span>
          <span className="text-[11px] font-medium text-muted">
            ({pendingCount} {pendingCount === 1 ? "claim" : "claims"})
          </span>
        </div>
        <p className="mt-1 text-[11px] text-muted">Awaiting senior verification</p>
      </div>

      {/* 2. Unsettled Approved Claims */}
      <div className="rounded-2xl border border-border bg-card p-3.5 sm:p-4 shadow-2xs hover:shadow-xs transition">
        <div className="flex items-center justify-between">
          <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted">
            Unsettled Claims
          </span>
          <div className="rounded-xl bg-sky-500/10 p-2 text-sky-600 dark:text-sky-400">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-xl sm:text-2xl font-bold text-foreground">
            {loading ? "…" : formatCurrency(unsettledApproved)}
          </span>
          <span className="text-[11px] font-medium text-muted">
            ({unsettledCount} {unsettledCount === 1 ? "approved" : "approved"})
          </span>
        </div>
        <p className="mt-1 text-[11px] text-muted">Approved & ready for settlement</p>
      </div>

      {/* 3. Active Advance in Hand */}
      <div className="rounded-2xl border border-border bg-card p-3.5 sm:p-4 shadow-2xs hover:shadow-xs transition">
        <div className="flex items-center justify-between">
          <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted">
            Active Advances
          </span>
          <div className="rounded-xl bg-purple-500/10 p-2 text-purple-600 dark:text-purple-400">
            <Wallet className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-xl sm:text-2xl font-bold text-foreground">
            {loading ? "…" : formatCurrency(activeAdvance)}
          </span>
          <span className="text-[11px] font-medium text-muted">
            ({activeAdvanceCount} active)
          </span>
        </div>
        <p className="mt-1 text-[11px] text-muted">Advance balances in hand</p>
      </div>

      {/* 4. Net Position */}
      <div className="rounded-2xl border border-border bg-card p-3.5 sm:p-4 shadow-2xs hover:shadow-xs transition">
        <div className="flex items-center justify-between">
          <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted">
            Net Position
          </span>
          <div
            className={`rounded-xl p-2 ${
              positionStatus === "due_to_employee"
                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                : positionStatus === "due_to_company"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-muted/10 text-muted"
            }`}
          >
            {positionStatus === "due_to_employee" ? (
              <ArrowUpRight className="h-4 w-4" />
            ) : positionStatus === "due_to_company" ? (
              <ArrowDownRight className="h-4 w-4" />
            ) : (
              <Scale className="h-4 w-4" />
            )}
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span
            className={`text-xl sm:text-2xl font-bold ${
              positionStatus === "due_to_employee"
                ? "text-rose-600 dark:text-rose-400"
                : positionStatus === "due_to_company"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-foreground"
            }`}
          >
            {loading ? "…" : formatCurrency(Math.abs(netPosition))}
          </span>
        </div>
        <p className="mt-1 text-[11px] font-medium">
          {positionStatus === "due_to_employee" ? (
            <span className="text-rose-600 dark:text-rose-400">Due to Employee (Payout)</span>
          ) : positionStatus === "due_to_company" ? (
            <span className="text-emerald-600 dark:text-emerald-400">Due to Company (Refund)</span>
          ) : (
            <span className="text-muted">Balanced / Settled</span>
          )}
        </p>
      </div>
    </div>
  );
}
