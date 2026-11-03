"use client";

import { useMemo } from "react";
import {
  FileText,
  DollarSign,
  ShieldCheck,
  Receipt,
  RotateCcw,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export type WorkflowPipelineVisualizerProps = {
  isPerformaEnabled: boolean;
  isCostSheetEnabled: boolean;
  isKycEnabled: boolean;
  isPOEnabled: boolean;
  isBuyBackEnabled: boolean;
};

export function WorkflowPipelineVisualizer({
  isPerformaEnabled,
  isCostSheetEnabled,
  isKycEnabled,
  isPOEnabled,
  isBuyBackEnabled,
}: WorkflowPipelineVisualizerProps) {
  const steps = useMemo(() => {
    return [
      {
        id: "sales_draft",
        title: "Sales Draft",
        desc: "Order created",
        icon: FileText,
        isOptional: false,
        isActive: true,
      },
      {
        id: "po",
        title: "Purchase Order",
        desc: "Customer PO attachment",
        icon: Receipt,
        isOptional: true,
        isActive: isPOEnabled,
      },
      {
        id: "cost_sheet",
        title: "Cost Sheet",
        desc: "Margin & cost approval",
        icon: DollarSign,
        isOptional: true,
        isActive: isCostSheetEnabled,
      },
      {
        id: "admin_review",
        title: "Admin Review",
        desc: "Commercial sign-off",
        icon: ShieldCheck,
        isOptional: false,
        isActive: true,
      },
      {
        id: "performa",
        title: "Performa Invoice",
        desc: "Proforma generation & terms",
        icon: Receipt,
        isOptional: true,
        isActive: isPerformaEnabled,
      },
      {
        id: "kyc",
        title: "KYC Verification",
        desc: "PAN, GST & compliance",
        icon: ShieldCheck,
        isOptional: true,
        isActive: isKycEnabled,
      },
      {
        id: "finance_account",
        title: "Finance & Accounts",
        desc: "Credit clearance",
        icon: CheckCircle2,
        isOptional: false,
        isActive: true,
      },
      {
        id: "dispatch_delivery",
        title: "Dispatch & Logistics",
        desc: "Shipment & handover",
        icon: CheckCircle2,
        isOptional: false,
        isActive: true,
      },
      {
        id: "buy_back",
        title: "Buy Back",
        desc: "Trade-in return & credit",
        icon: RotateCcw,
        isOptional: true,
        isActive: isBuyBackEnabled,
      },
    ];
  }, [
    isPerformaEnabled,
    isCostSheetEnabled,
    isKycEnabled,
    isPOEnabled,
    isBuyBackEnabled,
  ]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50/50 to-white p-5 shadow-sm dark:border-white/10 dark:from-slate-900/40 dark:to-slate-900/80">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Live Order Workflow Lifecycle Simulation
          </h3>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Active Stage
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600"></span> Bypassed / Disabled
          </span>
        </div>
      </div>

      <div className="relative overflow-x-auto pb-3 pt-2 scrollbar-thin">
        <div className="flex items-center gap-2 min-w-[860px]">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isLast = idx === steps.length - 1;

            return (
              <div key={step.id} className="flex items-center shrink-0">
                <div
                  className={`group relative flex w-36 flex-col items-center rounded-xl p-3 text-center transition-all ${
                    step.isActive
                      ? "border border-emerald-200 bg-white shadow-sm ring-1 ring-emerald-500/20 dark:border-emerald-900/50 dark:bg-slate-800/90"
                      : "border border-dashed border-slate-200 bg-slate-100/60 opacity-60 dark:border-white/10 dark:bg-slate-800/30"
                  }`}
                >
                  <div
                    className={`mb-2 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${
                      step.isActive
                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                        : "bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  <span
                    className={`text-xs font-bold leading-tight ${
                      step.isActive
                        ? "text-slate-900 dark:text-slate-100"
                        : "text-slate-400 line-through dark:text-slate-500"
                    }`}
                  >
                    {step.title}
                  </span>

                  <span className="mt-1 text-2xs leading-snug text-slate-500 dark:text-slate-400">
                    {step.desc}
                  </span>

                  {step.isOptional && (
                    <div className="mt-2">
                      {step.isActive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-3xs font-bold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Mandated
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-3xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-400">
                          <XCircle className="h-2.5 w-2.5" /> Bypassed
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {!isLast && (
                  <div className="px-1.5 text-slate-300 dark:text-slate-600">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

