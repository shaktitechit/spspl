/**
 * @fileoverview Portal Settings Page for Expense Portal.
 * Configures reimbursement limits, rate per km, receipt mandatory thresholds, and category policies.
 * @module components/workPlanner/PortalSettingsPage
 */
"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  ShieldCheck,
  Save,
  RotateCcw,
  IndianRupee,
  Receipt,
  Car,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { isExpenseAdmin, readSessionFromStorage } from "@/utils/authStorage";

export function PortalSettingsPage() {
  const session = readSessionFromStorage();
  const isAdmin = isExpenseAdmin(session?.user);

  const [ratePerKm, setRatePerKm] = useState<number>(3.5);
  const [receiptThreshold, setReceiptThreshold] = useState<number>(200);
  const [submissionWindowDays, setSubmissionWindowDays] = useState<number>(7);
  const [allowDirectIssueAdvance, setAllowDirectIssueAdvance] = useState<boolean>(true);
  const [requireOdometerPhotos, setRequireOdometerPhotos] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedRate = localStorage.getItem("expense_rate_per_km");
      if (savedRate) setRatePerKm(Number(savedRate));
      const savedThreshold = localStorage.getItem("expense_receipt_threshold");
      if (savedThreshold) setReceiptThreshold(Number(savedThreshold));
      const savedWindow = localStorage.getItem("expense_submission_window");
      if (savedWindow) setSubmissionWindowDays(Number(savedWindow));
    }
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined") {
      localStorage.setItem("expense_rate_per_km", String(ratePerKm));
      localStorage.setItem("expense_receipt_threshold", String(receiptThreshold));
      localStorage.setItem("expense_submission_window", String(submissionWindowDays));
      toast.success("Expense portal configuration saved successfully!");
    }
  };

  const handleReset = () => {
    setRatePerKm(3.5);
    setReceiptThreshold(200);
    setSubmissionWindowDays(7);
    setAllowDirectIssueAdvance(true);
    setRequireOdometerPhotos(true);
    toast.info("Reset to standard company defaults.");
  };

  return (
    <div className="space-y-6 font-sans max-w-4xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Expense Portal Settings</h1>
          <p className="mt-1 text-xs text-muted">
            Configure travel reimbursement rates, receipt requirement policies, and advance rules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted transition"
          >
            <RotateCcw className="h-4 w-4" />
            Reset Defaults
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Travel & Mileage Reimbursement Policy */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-border pb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <Car className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Travel &amp; Mileage Policy</h2>
              <p className="text-[11px] text-muted">Kilometer reimbursement and vehicle reading rules</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Rate per Kilometer (₹/km)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-muted">₹</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={ratePerKm}
                  onChange={(e) => setRatePerKm(Number(e.target.value))}
                  disabled={!isAdmin}
                  className="w-full rounded-xl border border-border bg-surface pl-8 pr-3 py-2 text-xs font-bold text-foreground focus:border-primary focus:outline-none"
                />
              </div>
              <p className="mt-1 text-[10px] text-muted">Applied when executive selects Private Bike / Car</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Receipt Mandatory Above (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-muted">₹</span>
                <input
                  type="number"
                  step="10"
                  min="0"
                  value={receiptThreshold}
                  onChange={(e) => setReceiptThreshold(Number(e.target.value))}
                  disabled={!isAdmin}
                  className="w-full rounded-xl border border-border bg-surface pl-8 pr-3 py-2 text-xs font-bold text-foreground focus:border-primary focus:outline-none"
                />
              </div>
              <p className="mt-1 text-[10px] text-muted">Bill / receipt attachment required when expense exceeds this amount</p>
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={requireOdometerPhotos}
                onChange={(e) => setRequireOdometerPhotos(e.target.checked)}
                disabled={!isAdmin}
                className="rounded border-border text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-xs font-medium text-foreground">
                Require start and closing odometer photos for personal vehicle travel claims
              </span>
            </label>
          </div>
        </div>

        {/* Claim Submission & Advance Controls */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-border pb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Submission Window &amp; Advance Rules</h2>
              <p className="text-[11px] text-muted">Timeline constraints and sanction permissions</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Submission Grace Window (Days)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={submissionWindowDays}
                onChange={(e) => setSubmissionWindowDays(Number(e.target.value))}
                disabled={!isAdmin}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs font-bold text-foreground focus:border-primary focus:outline-none"
              />
              <p className="mt-1 text-[10px] text-muted">Days after field tour during which claims can be logged</p>
            </div>

            <div className="flex flex-col justify-center">
              <label className="flex items-center gap-2 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={allowDirectIssueAdvance}
                  onChange={(e) => setAllowDirectIssueAdvance(e.target.checked)}
                  disabled={!isAdmin}
                  className="rounded border-border text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs font-medium text-foreground">
                  Allow Admin to directly sanction and issue tour advances for executives
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Save Bar */}
        {isAdmin && (
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 shadow-md transition"
            >
              <Save className="h-4 w-4" />
              Save Configuration
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
