"use client";

import {
  FileText,
  DollarSign,
  ShieldCheck,
  Receipt,
  RotateCcw,
  Info,
  Check,
  Sliders,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import type { WorkflowSettingsData } from "@/store/api";
import { WorkflowPipelineVisualizer } from "./WorkflowPipelineVisualizer";

export type WorkflowManagementTabProps = {
  data: WorkflowSettingsData;
  onChange: (updated: WorkflowSettingsData) => void;
};

export function WorkflowManagementTab({
  data,
  onChange,
}: WorkflowManagementTabProps) {
  const toggleFlag = (key: keyof Omit<WorkflowSettingsData, "buy_back_config">) => {
    onChange({
      ...data,
      [key]: !data[key],
    });
  };

  const updateBuyBackConfig = (patch: Partial<NonNullable<WorkflowSettingsData["buy_back_config"]>>) => {
    onChange({
      ...data,
      buy_back_config: {
        require_inspection: data.buy_back_config?.require_inspection ?? true,
        auto_credit_ledger: data.buy_back_config?.auto_credit_ledger ?? false,
        default_valuation_rate: data.buy_back_config?.default_valuation_rate ?? 30,
        terms: data.buy_back_config?.terms ?? "",
        ...patch,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Live Pipeline Flowchart */}
      <WorkflowPipelineVisualizer
        isPerformaEnabled={data.performa_invoice_enabled}
        isCostSheetEnabled={data.cost_sheet_enabled}
        isKycEnabled={data.kyc_verification_enabled}
        isPOEnabled={data.purchase_order_enabled}
        isBuyBackEnabled={data.buy_back_enabled}
      />

      {/* Group 1: Core Order Documents & Compliance Gates */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Document & Verification Compliance Gates
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Configure mandatory approval stages and document verification rules in the order lifecycle.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-2xs font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
            <Info className="h-3.5 w-3.5" /> Affects Order Processing & Detail Tabs
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1. Proforma Invoice (PI) */}
          <div
            onClick={() => toggleFlag("performa_invoice_enabled")}
            className={`relative flex items-start gap-3.5 rounded-xl border p-4.5 transition cursor-pointer select-none ${
              data.performa_invoice_enabled
                ? "border-blue-300 bg-blue-50/40 shadow-xs dark:border-blue-900/60 dark:bg-blue-950/20"
                : "border-slate-200 bg-slate-50/40 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800/40 dark:hover:bg-slate-800/60"
            }`}
          >
            <div className="pt-0.5">
              <input
                type="checkbox"
                checked={data.performa_invoice_enabled}
                onChange={() => {}}
                className="h-4.5 w-4.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Performa Invoice (PI)
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-3xs font-bold uppercase tracking-wider ${
                    data.performa_invoice_enabled
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                      : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                  }`}
                >
                  {data.performa_invoice_enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Requires generating and confirming a formal Proforma Invoice with payment terms, freight, and tax concessions before dispatch.
              </p>
              <div className="mt-2.5 flex items-center gap-1.5 text-2xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Tab Impact:</span> Shows or hides the{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                  Performa
                </code>{" "}
                tab on order details.
              </div>
            </div>
          </div>

          {/* 2. Cost Sheet (Margin Sheet) */}
          <div
            onClick={() => toggleFlag("cost_sheet_enabled")}
            className={`relative flex items-start gap-3.5 rounded-xl border p-4.5 transition cursor-pointer select-none ${
              data.cost_sheet_enabled
                ? "border-emerald-300 bg-emerald-50/40 shadow-xs dark:border-emerald-900/60 dark:bg-emerald-950/20"
                : "border-slate-200 bg-slate-50/40 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800/40 dark:hover:bg-slate-800/60"
            }`}
          >
            <div className="pt-0.5">
              <input
                type="checkbox"
                checked={data.cost_sheet_enabled}
                onChange={() => {}}
                className="h-4.5 w-4.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Cost Sheet (Margin Sheet)
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-3xs font-bold uppercase tracking-wider ${
                    data.cost_sheet_enabled
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                  }`}
                >
                  {data.cost_sheet_enabled ? "Mandatory" : "Optional"}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Mandates commercial margin calculation and internal approved cost sheet attachment prior to Admin & Finance sign-off.
              </p>
              <div className="mt-2.5 flex items-center gap-1.5 text-2xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Tab Impact:</span> Shows or hides the{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                  Cost Sheet
                </code>{" "}
                tab on order details.
              </div>
            </div>
          </div>

          {/* 3. KYC Verification */}
          <div
            onClick={() => toggleFlag("kyc_verification_enabled")}
            className={`relative flex items-start gap-3.5 rounded-xl border p-4.5 transition cursor-pointer select-none ${
              data.kyc_verification_enabled
                ? "border-purple-300 bg-purple-50/40 shadow-xs dark:border-purple-900/60 dark:bg-purple-950/20"
                : "border-slate-200 bg-slate-50/40 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800/40 dark:hover:bg-slate-800/60"
            }`}
          >
            <div className="pt-0.5">
              <input
                type="checkbox"
                checked={data.kyc_verification_enabled}
                onChange={() => {}}
                className="h-4.5 w-4.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  Party KYC & Verification
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-3xs font-bold uppercase tracking-wider ${
                    data.kyc_verification_enabled
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                      : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                  }`}
                >
                  {data.kyc_verification_enabled ? "Required" : "Bypassed"}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Enforces compliance documents (Aadhaar, PAN, GST, Cheque, MSME) to be verified before order reaches final account clearance.
              </p>
              <div className="mt-2.5 flex items-center gap-1.5 text-2xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Tab Impact:</span> Shows or hides the{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                  KYC
                </code>{" "}
                tab on order details.
              </div>
            </div>
          </div>

          {/* 4. Purchase Order (PO) */}
          <div
            onClick={() => toggleFlag("purchase_order_enabled")}
            className={`relative flex items-start gap-3.5 rounded-xl border p-4.5 transition cursor-pointer select-none ${
              data.purchase_order_enabled
                ? "border-amber-300 bg-amber-50/40 shadow-xs dark:border-amber-900/60 dark:bg-amber-950/20"
                : "border-slate-200 bg-slate-50/40 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800/40 dark:hover:bg-slate-800/60"
            }`}
          >
            <div className="pt-0.5">
              <input
                type="checkbox"
                checked={data.purchase_order_enabled}
                onChange={() => {}}
                className="h-4.5 w-4.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  Customer Purchase Order (PO)
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-3xs font-bold uppercase tracking-wider ${
                    data.purchase_order_enabled
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                      : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                  }`}
                >
                  {data.purchase_order_enabled ? "Mandatory" : "Optional"}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Mandates the entry of a customer purchase order number and document upload during order booking.
              </p>
              <div className="mt-2.5 flex items-center gap-1.5 text-2xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Tab Impact:</span> Shows or hides the{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                  PO
                </code>{" "}
                tab on order details.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Group 2: Buy Back Program */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              Buy Back & Trade-In Program
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Enable trade-in exchanges and repurchasing of customer equipment with warehouse verification.
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-2xs font-semibold ${
              data.buy_back_enabled
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            }`}
          >
            {data.buy_back_enabled ? "● Program Active" : "○ Program Disabled"}
          </span>
        </div>

        {/* Master Buy Back Toggle */}
        <div
          onClick={() => toggleFlag("buy_back_enabled")}
          className={`flex items-start gap-4 rounded-xl border p-4.5 transition cursor-pointer select-none ${
            data.buy_back_enabled
              ? "border-indigo-300 bg-indigo-50/30 dark:border-indigo-900/50 dark:bg-indigo-950/20"
              : "border-slate-200 bg-slate-50/50 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800/40"
          }`}
        >
          <div className="pt-0.5">
            <input
              type="checkbox"
              checked={data.buy_back_enabled}
              onChange={() => {}}
              className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Enable Buy Back & Trade-In Operations
              </h4>
              <span
                className={`text-2xs font-bold uppercase px-2 py-0.5 rounded-full ${
                  data.buy_back_enabled
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
                    : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                }`}
              >
                {data.buy_back_enabled ? "Activated" : "Deactivated"}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              When activated, sales and admin portals can attach Buy Back items to orders, allowing credit offsets against new equipment purchases, and generating Buy Back return slips for warehouse intake.
            </p>
          </div>
        </div>

        {/* Sub-Configurations when Buy Back is Enabled */}
        {data.buy_back_enabled && (
          <div className="mt-5 space-y-4 rounded-xl border border-indigo-100 bg-indigo-50/20 p-4.5 dark:border-indigo-900/30 dark:bg-indigo-950/10">
            <h5 className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
              <Sliders className="h-3.5 w-3.5" /> Buy Back Execution Policies
            </h5>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Inspection Check */}
              <label className="flex items-start gap-3 rounded-lg border border-slate-200/80 bg-white p-3 dark:border-white/10 dark:bg-slate-800/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.buy_back_config?.require_inspection ?? true}
                  onChange={(e) =>
                    updateBuyBackConfig({ require_inspection: e.target.checked })
                  }
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                    Mandatory Technical Inspection
                  </span>
                  <span className="text-2xs text-slate-500 dark:text-slate-400">
                    Warehouse staff must inspect equipment physical & serial condition before credit clearance.
                  </span>
                </div>
              </label>

              {/* Auto Credit Ledger */}
              <label className="flex items-start gap-3 rounded-lg border border-slate-200/80 bg-white p-3 dark:border-white/10 dark:bg-slate-800/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.buy_back_config?.auto_credit_ledger ?? false}
                  onChange={(e) =>
                    updateBuyBackConfig({ auto_credit_ledger: e.target.checked })
                  }
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                    Auto-Credit Customer Ledger
                  </span>
                  <span className="text-2xs text-slate-500 dark:text-slate-400">
                    Automatically credit the customer&apos;s financial ledger upon warehouse receipt confirmation.
                  </span>
                </div>
              </label>

              {/* Default Valuation Rate */}
              <div className="rounded-lg border border-slate-200/80 bg-white p-3 dark:border-white/10 dark:bg-slate-800/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Default Buy Back Valuation (%)
                  </label>
                  <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                    {data.buy_back_config?.default_valuation_rate ?? 30}%
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="80"
                  step="5"
                  value={data.buy_back_config?.default_valuation_rate ?? 30}
                  onChange={(e) =>
                    updateBuyBackConfig({
                      default_valuation_rate: Number(e.target.value),
                    })
                  }
                  className="mt-2 w-full accent-indigo-600 cursor-pointer"
                />
                <span className="text-2xs text-slate-500 dark:text-slate-400 block mt-1">
                  Default base percentage against original product MRP when calculating trade-in value.
                </span>
              </div>

              {/* Terms note */}
              <div className="rounded-lg border border-slate-200/80 bg-white p-3 dark:border-white/10 dark:bg-slate-800/80">
                <label className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                  Buy Back Agreement Terms Note
                </label>
                <input
                  type="text"
                  value={data.buy_back_config?.terms ?? ""}
                  onChange={(e) =>
                    updateBuyBackConfig({ terms: e.target.value })
                  }
                  placeholder="e.g. Subject to serial validation & physical condition"
                  className="mt-1.5 w-full rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

