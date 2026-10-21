/**
 * @fileoverview Visual Lifecycle Progress Stepper for Lead & Direct Quotations.
 * @module components/quotations/QuotationLifecycleStepper
 */
"use client";

import React from "react";
import {
  FileEdit,
  ShieldCheck,
  CheckCircle2,
  Send,
  MessageSquare,
  Trophy,
  XCircle,
  PauseCircle,
  Clock,
  AlertTriangle,
  ShoppingCart,
} from "lucide-react";
import type { LeadQuotationRecord, QuotationStatus } from "@/store/api";

type Props = {
  quotation?: LeadQuotationRecord | null;
};

type StepDef = {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const STANDARD_STEPS: StepDef[] = [
  { id: "draft", label: "Draft", description: "Created & Configured", icon: FileEdit },
  { id: "pending_approval", label: "Signatory Approval", description: "Internal Review", icon: ShieldCheck },
  { id: "approved", label: "Approved", description: "PDF Signed & Ready", icon: CheckCircle2 },
  { id: "sent", label: "Sent", description: "Delivered to Client", icon: Send },
  { id: "in_negotiation", label: "Follow-Up", description: "Active Negotiation", icon: MessageSquare },
  { id: "accepted", label: "Accepted", description: "Deal Won", icon: Trophy },
  { id: "converted", label: "Converted", description: "Order Submitted", icon: ShoppingCart },
];

export function QuotationLifecycleStepper({ quotation }: Props) {
  if (!quotation) return null;
  const status = quotation.status;

  const getStepIndex = (st: QuotationStatus): number => {
    switch (st) {
      case "draft":
        return 0;
      case "pending_approval":
        return 1;
      case "approved":
        return 2;
      case "sent":
        return 3;
      case "in_negotiation":
        return 4;
      case "accepted":
        return 5;
      case "converted":
        return 6;
      case "on_hold":
        return 4;
      case "expired":
      case "rejected":
        return 5;
      default:
        return 0;
    }
  };

  const currentIndex = getStepIndex(status);
  const isTerminalSpecial = ["rejected", "on_hold", "expired"].includes(status);

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900 transition-all">
      {/* Top Bar: Title & Current Status Pill */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100">
              Quotation Lifecycle Stage
            </h4>
            <p className="text-[11px] text-slate-500">
              {quotation.version && quotation.version > 1 ? `Version ${quotation.version} • ` : ""}
              Created {new Date(quotation.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
          </div>
        </div>

        {/* Status Pill Badge */}
        <div className="flex items-center gap-2">
          {status === "converted" && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-1 text-xs font-bold text-white shadow-xs">
              <ShoppingCart className="h-3.5 w-3.5" /> Converted to Order
            </span>
          )}
          {status === "accepted" && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 shadow-xs">
              <Trophy className="h-3.5 w-3.5" /> Won / Accepted
            </span>
          )}
          {status === "rejected" && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 shadow-xs">
              <XCircle className="h-3.5 w-3.5" /> Customer Rejected / Lost
            </span>
          )}
          {status === "on_hold" && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 shadow-xs">
              <PauseCircle className="h-3.5 w-3.5" /> Quotation On Hold
            </span>
          )}
          {status === "expired" && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-200 px-3 py-1 text-xs font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-300 shadow-xs">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Validity Expired
            </span>
          )}
          {status === "in_negotiation" && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 shadow-xs">
              <MessageSquare className="h-3.5 w-3.5" /> In Negotiation &amp; Follow-Up
            </span>
          )}
          {status === "sent" && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 shadow-xs">
              <Send className="h-3.5 w-3.5" /> Sent to Client
            </span>
          )}
          {status === "approved" && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-teal-100 px-3 py-1 text-xs font-bold text-teal-800 dark:bg-teal-950/80 dark:text-teal-300 shadow-xs">
              <CheckCircle2 className="h-3.5 w-3.5" /> Approved by Signatory
            </span>
          )}
          {status === "pending_approval" && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 shadow-xs">
              <ShieldCheck className="h-3.5 w-3.5" /> Pending Signatory Approval
            </span>
          )}
          {status === "draft" && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300 shadow-xs">
              <FileEdit className="h-3.5 w-3.5" /> Draft in Preparation
            </span>
          )}
        </div>
      </div>

      {/* Horizontal Progress Pipeline */}
      <div className="mt-5 overflow-x-auto pb-1">
        <div className="flex min-w-[640px] items-center justify-between relative">
          {/* Background Track Line */}
          <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-slate-100 dark:bg-slate-800 z-0" />

          {/* Active Fill Line */}
          <div
            className="absolute left-6 top-1/2 -translate-y-1/2 h-1 bg-primary transition-all duration-500 z-0"
            style={{
              width: `calc(${(Math.min(currentIndex, 6) / 6) * 100}% - 48px)`,
            }}
          />

          {STANDARD_STEPS.map((step, idx) => {
            const isCompleted = idx < currentIndex;
            const isCurrent = idx === currentIndex && !isTerminalSpecial;
            const StepIcon = step.icon;

            let circleClass = "border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900";
            let labelClass = "text-slate-400 dark:text-slate-500";

            if (isCompleted) {
              circleClass = "border-primary bg-primary text-white shadow-sm";
              labelClass = "text-slate-800 dark:text-slate-200 font-semibold";
            } else if (isCurrent) {
              circleClass = "border-primary bg-white text-primary ring-4 ring-primary/20 dark:bg-slate-900 font-bold";
              labelClass = "text-primary font-bold";
            } else if (idx === 6 && status === "converted") {
              circleClass = "border-emerald-500 bg-emerald-500 text-white shadow-md ring-4 ring-emerald-500/20";
              labelClass = "text-emerald-700 dark:text-emerald-400 font-black";
            } else if (idx === 5 && status === "accepted") {
              circleClass = "border-emerald-500 bg-emerald-500 text-white shadow-md ring-4 ring-emerald-500/20";
              labelClass = "text-emerald-700 dark:text-emerald-400 font-black";
            } else if (idx === 5 && status === "rejected") {
              circleClass = "border-rose-500 bg-rose-500 text-white shadow-md ring-4 ring-rose-500/20";
              labelClass = "text-rose-700 dark:text-rose-400 font-black";
            }

            return (
              <div
                key={step.id}
                className="flex flex-col items-center relative z-10 text-center px-1 group"
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-2xl border-2 transition-all duration-300 ${circleClass}`}
                >
                  <StepIcon className="h-4 w-4" />
                </div>
                <div className="mt-2.5">
                  <div className={`text-xs ${labelClass}`}>{step.label}</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 hidden sm:block">
                    {step.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reason notice if lost */}
      {status === "rejected" && quotation.lost_reason && (
        <div className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-900 dark:bg-rose-950/40 dark:text-rose-200 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2">
          <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Customer Lost Reason:</span> {quotation.lost_reason}
          </div>
        </div>
      )}
    </div>
  );
}
