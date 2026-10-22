"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Users,
  UserCheck,
  CheckCircle2,
  FileText,
  Trophy,
  XCircle,
  Package,
  Calendar,
  ArrowUpRight,
  Phone,
  Mail,
  MessageSquare,
  MapPin,
  Tv,
  HelpCircle,
  Clock,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Banknote,
  type LucideIcon,
} from "lucide-react";

import {
  useGetLeadDashboardStatsQuery,
  useGetLeadFollowUpCalendarQuery,
  type LeadFollowUpRecord,
  type LeadFollowUpType,
} from "@/store/api";
import PeriodHeadingCaption from "@/components/portal/shared/dashboard/PeriodHeadingCaption";
import {
  dashboardPeriodToStatsQuery,
  type DashboardPeriodQuery,
} from "@/components/portal/shared/dashboard/periodFilterUtils";
import {
  formatLeadDate,
  formatLeadDateTime,
  formatCurrencyINR,
  FOLLOWUP_TYPE_CONFIG,
  LEAD_STATUS_CONFIG,
  canViewLeadPricing,
  getFollowUpSalesRepName,
  getFollowUpSalesReps,
} from "./leadUtils";
import { canViewQuotations } from "@/components/quotations/quotationUtils";
import { useAppSelector } from "@/store/hooks";

type LeadManagerStatsWidgetsProps = {
  portalHome: "/sales" | "/admin" | "/super_admin" | string;
  assigned_to?: string;
  isExecutive?: boolean;
  isTeamScope?: boolean;
} & DashboardPeriodQuery;

type StatCard = {
  key: string;
  label: string;
  value: number | string;
  subValue?: string;
  href: string;
  accent: string;
  iconWrap: string;
  iconTone: string;
  Icon: LucideIcon;
};

function FollowUpTypeIcon({ type }: { type: LeadFollowUpType }) {
  switch (type) {
    case "call":
      return <Phone className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />;
    case "meeting":
      return <Users className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />;
    case "email":
      return <Mail className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />;
    case "whatsapp":
      return <MessageSquare className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />;
    case "visit":
      return <MapPin className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />;
    case "demo":
      return <Tv className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />;
    default:
      return <HelpCircle className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />;
  }
}

export default function LeadManagerStatsWidgets({
  portalHome,
  assigned_to,
  isExecutive = false,
  isTeamScope = false,
  dateFilter,
  customDateFrom,
  customDateTo,
  selectedYears,
  selectedMonths,
}: LeadManagerStatsWidgetsProps) {
  const [showFollowUpsTable, setShowFollowUpsTable] = useState(true);
  const authUser = useAppSelector((state) => state.auth.user);
  const showPricing = canViewLeadPricing(authUser, portalHome);
  const showQuotationsModule = canViewQuotations(authUser);

  const currentUserId = authUser?._id ? String(authUser._id) : undefined;
  const effectiveAssignedTo = assigned_to || (isExecutive && currentUserId ? currentUserId : undefined);

  const hasPeriod =
    dateFilter != null || selectedYears != null || selectedMonths != null;
  const statsQuery = useMemo(() => {
    const base = dashboardPeriodToStatsQuery({
      dateFilter,
      customDateFrom,
      customDateTo,
      selectedYears,
      selectedMonths,
    });
    if (effectiveAssignedTo) {
      return { ...base, assigned_to: effectiveAssignedTo };
    }
    return base;
  }, [dateFilter, customDateFrom, customDateTo, selectedYears, selectedMonths, effectiveAssignedTo]);

  const { data, isFetching } = useGetLeadDashboardStatsQuery(statsQuery);

  const todayYmd = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  // Fetch today's follow-up schedule
  const { data: followUpsData = [], isFetching: isFollowUpsFetching } =
    useGetLeadFollowUpCalendarQuery({
      from_date: todayYmd,
      to_date: todayYmd,
      ...(effectiveAssignedTo ? { assigned_to: effectiveAssignedTo } : {}),
    });

  const followUps = useMemo(() => {
    if (!Array.isArray(followUpsData)) return [];
    if (isExecutive && currentUserId) {
      return followUpsData.filter((fu) => {
        const leadObj = typeof fu.lead === "object" && fu.lead !== null ? fu.lead : null;
        const leadAssignee = leadObj?.assigned_to
          ? typeof leadObj.assigned_to === "object"
            ? String((leadObj.assigned_to as any)._id)
            : String(leadObj.assigned_to)
          : null;
        if (leadAssignee === currentUserId) return true;

        if (Array.isArray(leadObj?.assigned_users)) {
          const inAssignedUsers = leadObj.assigned_users.some((u) => {
            const uid = typeof u === "object" && u !== null ? String(u._id || (u as any).id) : String(u);
            return uid === currentUserId;
          });
          if (inAssignedUsers) return true;
        }

        const quoteObj = typeof fu.quotation === "object" && fu.quotation !== null ? fu.quotation : null;
        const quoteRep = quoteObj?.sales_person_user
          ? typeof quoteObj.sales_person_user === "object"
            ? String((quoteObj.sales_person_user as any)._id)
            : String(quoteObj.sales_person_user)
          : null;
        if (quoteRep === currentUserId) return true;

        return false;
      });
    }
    return followUpsData;
  }, [followUpsData, isExecutive, currentUserId]);

  const isTodayPeriod = !hasPeriod || dateFilter === "today";
  const overdueCount = data?.overdueFollowUps ?? 0;

  const cards: StatCard[] = [
    {
      key: "total",
      label: isTodayPeriod ? "Today's Inquiries" : "Total Leads",
      value: data?.totalLeads ?? 0,
      href: `${portalHome}/leads`,
      accent: "bg-sky-500",
      iconWrap: "bg-sky-50 dark:bg-sky-950/30",
      iconTone: "text-sky-600 dark:text-sky-400",
      Icon: Users,
    },
    {
      key: "new",
      label: "New Leads",
      value: data?.newLeads ?? 0,
      href: `${portalHome}/leads?status=new`,
      accent: "bg-blue-500",
      iconWrap: "bg-blue-50 dark:bg-blue-950/30",
      iconTone: "text-blue-600 dark:text-blue-400",
      Icon: UserCheck,
    },
    {
      key: "assigned",
      label: "Assigned Leads",
      value: data?.assignedLeads ?? 0,
      href: `${portalHome}/leads?status=assigned`,
      accent: "bg-indigo-500",
      iconWrap: "bg-indigo-50 dark:bg-indigo-950/30",
      iconTone: "text-indigo-600 dark:text-indigo-400",
      Icon: UserCheck,
    },
    {
      key: "follow_up",
      label: "Follow Up Leads",
      value: data?.followUpLeads ?? 0,
      href: `${portalHome}/leads?status=follow_up`,
      accent: "bg-amber-500",
      iconWrap: "bg-amber-50 dark:bg-amber-950/30",
      iconTone: "text-amber-600 dark:text-amber-400",
      Icon: CheckCircle2,
    },
    {
      key: "quotation",
      label: showQuotationsModule ? "Quotation Stage" : "Quotations",
      value: data?.quotationLeads ?? 0,
      href: showQuotationsModule
        ? `${portalHome}/quotations`
        : `${portalHome}/leads?status=quotation`,
      accent: "bg-purple-500",
      iconWrap: "bg-purple-50 dark:bg-purple-950/30",
      iconTone: "text-purple-600 dark:text-purple-400",
      Icon: FileText,
    },
    {
      key: "won",
      label: "Won Leads",
      value: data?.wonLeads ?? 0,
      href: `${portalHome}/leads?status=won`,
      accent: "bg-emerald-500",
      iconWrap: "bg-emerald-50 dark:bg-emerald-950/30",
      iconTone: "text-emerald-600 dark:text-emerald-400",
      Icon: Trophy,
    },
    {
      key: "converted",
      label: "Converted Leads",
      value: data?.convertedLeads ?? 0,
      href: `${portalHome}/leads?status=converted`,
      accent: "bg-teal-500",
      iconWrap: "bg-teal-50 dark:bg-teal-950/30",
      iconTone: "text-teal-600 dark:text-teal-400",
      Icon: Trophy,
    },
    {
      key: "lost",
      label: "Lost Inquiries",
      value: data?.lostLeads ?? 0,
      href: `${portalHome}/leads?status=lost`,
      accent: "bg-rose-500",
      iconWrap: "bg-rose-50 dark:bg-rose-950/30",
      iconTone: "text-rose-600 dark:text-rose-400",
      Icon: XCircle,
    },
    {
      key: "pipeline_qty",
      label: "Pipeline Qty",
      value: (data?.totalPipelineQuantity ?? 0).toLocaleString(),
      subValue: "units / items",
      href: `${portalHome}/leads/reports`,
      accent: "bg-violet-500",
      iconWrap: "bg-violet-50 dark:bg-violet-950/30",
      iconTone: "text-violet-600 dark:text-violet-400",
      Icon: Package,
    },
    ...(showPricing
      ? [
          {
            key: "pipeline_value",
            label: "Pipeline Value",
            value: formatCurrencyINR(data?.totalPipelineValue),
            href: `${portalHome}/leads/reports`,
            accent: "bg-indigo-500",
            iconWrap: "bg-indigo-50 dark:bg-indigo-950/30",
            iconTone: "text-indigo-600 dark:text-indigo-400",
            Icon: Banknote,
          } satisfies StatCard,
          {
            key: "won_value",
            label: "Won Value",
            value: formatCurrencyINR(data?.totalWonValue),
            href: `${portalHome}/leads?status=won`,
            accent: "bg-emerald-600",
            iconWrap: "bg-emerald-50 dark:bg-emerald-950/30",
            iconTone: "text-emerald-600 dark:text-emerald-400",
            Icon: Banknote,
          } satisfies StatCard,
        ]
      : []),
    {
      key: "followups",
      label: "Today's Follow-ups",
      value: data?.followUpsToday ?? 0,
      subValue: overdueCount > 0 ? `${overdueCount} overdue` : undefined,
      href: `${portalHome}/leads/follow-ups`,
      accent: overdueCount > 0 ? "bg-amber-500" : "bg-teal-500",
      iconWrap: overdueCount > 0 ? "bg-amber-50 dark:bg-amber-950/30" : "bg-teal-50 dark:bg-teal-950/30",
      iconTone: overdueCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-teal-600 dark:text-teal-400",
      Icon: Calendar,
    },
  ];

  return (
    <div className="space-y-4 font-sans w-full">
      {/* Header and Filter Info */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {isExecutive ? "My leads & follow-ups" : isTeamScope ? "Team pipeline KPIs" : "Leads & inquiries"}
          </h3>
          {hasPeriod ? (
            <PeriodHeadingCaption
              dateFilter={dateFilter}
              customDateFrom={customDateFrom}
              customDateTo={customDateTo}
              selectedYears={selectedYears ?? []}
              selectedMonths={selectedMonths}
            />
          ) : (
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Pipeline inquiries, follow-ups & conversion performance
            </p>
          )}
        </div>
        <Link
          href={`${portalHome}/leads`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Open Leads Manager
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* 8-Card Stat Grid */}
      <div className={`grid grid-cols-2 sm:grid-cols-4 ${showPricing ? "lg:grid-cols-5" : "lg:grid-cols-8"} gap-3`}>
        {cards.map(
          ({
            key,
            label,
            value,
            subValue,
            href,
            accent,
            iconWrap,
            iconTone,
            Icon,
          }) => (
            <Link
              key={key}
              href={href}
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-3.5 shadow-2xs transition-all hover:border-border/80 hover:bg-surface-muted/30 hover:shadow-xs"
            >
              <div
                className={`absolute inset-x-0 top-0 h-0.5 ${accent} transition-opacity opacity-70 group-hover:opacity-100`}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-muted-foreground line-clamp-1">
                  {label}
                </span>
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${iconWrap}`}
                >
                  <Icon className={`h-3.5 w-3.5 ${iconTone}`} />
                </div>
              </div>
              <div className="mt-2.5 flex flex-col">
                <span
                  className={`text-xl font-bold tracking-tight text-foreground ${
                    isFetching ? "opacity-40" : ""
                  }`}
                >
                  {value}
                </span>
                {subValue && (
                  <span
                    className={`text-[10px] font-medium mt-0.5 ${
                      key === "followups" && overdueCount > 0
                        ? "text-rose-600 dark:text-rose-400 font-semibold"
                        : "text-muted-foreground"
                    }`}
                  >
                    {subValue}
                  </span>
                )}
              </div>
            </Link>
          )
        )}
      </div>

      {/* Today's Follow-up Schedule Table */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs">
        <div className="flex items-center justify-between border-b border-border/70 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-teal-500/20 bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-foreground">
                  Today&apos;s Follow-up Schedule
                </h4>
                <span className="rounded-full border border-teal-500/20 bg-teal-500/5 px-2.5 py-0.5 text-[10px] font-semibold text-teal-700 dark:text-teal-300">
                  {followUps.length} Scheduled
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Actionable interactions scheduled for today ({new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`${portalHome}/leads/follow-ups`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <span>Full Agenda</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
            <button
              type="button"
              onClick={() => setShowFollowUpsTable((prev) => !prev)}
              className="rounded-lg p-1 text-muted-foreground hover:bg-surface-muted hover:text-foreground transition-colors cursor-pointer"
              title={showFollowUpsTable ? "Collapse table" : "Expand table"}
            >
              {showFollowUpsTable ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {showFollowUpsTable && (
          <div className="mt-3 overflow-x-auto">
            {isFollowUpsFetching ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Loading today&apos;s follow-up schedule...
              </div>
            ) : followUps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle className="h-8 w-8 text-emerald-500/70 mb-2" />
                <p className="text-xs font-bold text-foreground">
                  No follow-ups scheduled for today.
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  All communications are up to date. You can schedule new follow-ups directly from any lead.
                </p>
                <Link
                  href={`${portalHome}/leads`}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted/60 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors shadow-2xs"
                >
                  View Active Leads
                </Link>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/80 bg-surface-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3.5 py-2.5">Time / Type</th>
                    <th className="px-3.5 py-2.5">Lead / Quotation</th>
                    <th className="px-3.5 py-2.5">Phone / Email</th>
                    <th className="px-3.5 py-2.5">Sales rep</th>
                    <th className="px-3.5 py-2.5 min-w-[200px]">Agenda &amp; Objectives</th>
                    <th className="px-3.5 py-2.5 text-center w-28">Status</th>
                    <th className="px-3.5 py-2.5 text-right w-24">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {followUps.map((fu: LeadFollowUpRecord) => {
                    const leadObj =
                      typeof fu.lead === "object" && fu.lead !== null
                        ? fu.lead
                        : null;
                    const quoteObj =
                      typeof fu.quotation === "object" && fu.quotation !== null
                        ? fu.quotation
                        : null;
                    const isQuoteFollowUp = Boolean(quoteObj);
                    const leadId = leadObj?._id || (typeof fu.lead === "string" ? fu.lead : "");
                    const quoteId = quoteObj?._id || (typeof fu.quotation === "string" ? fu.quotation : "");
                    const leadNo = leadObj?.lead_no || "Lead";
                    const leadName = leadObj?.name || "—";
                    const companyName = leadObj?.company_name;
                    const quoteNo = quoteObj?.quotation_no || "Quote";
                    const customerName = quoteObj?.customer_name || quoteObj?.kind_attn || companyName;
                    const phone =
                      leadObj?.phone ||
                      (quoteObj as { phone?: string; cell?: string })?.phone ||
                      (quoteObj as { cell?: string })?.cell;
                    const email = leadObj?.email || (quoteObj as { email?: string })?.email;
                    const typeLabel =
                      FOLLOWUP_TYPE_CONFIG[fu.type]?.label || fu.type;
                    const reps = getFollowUpSalesReps(fu);

                    const isDone = fu.status === "completed";

                    return (
                      <tr
                        key={fu._id || fu.id}
                        className="hover:bg-surface-muted/40 transition-colors"
                      >
                        {/* Time & Type */}
                        <td className="px-3.5 py-2.5 font-medium">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-surface-muted/60">
                              <FollowUpTypeIcon type={fu.type} />
                            </div>
                            <div>
                              <div className="font-semibold text-foreground text-xs">
                                {typeLabel}
                              </div>
                              <div className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                                <Clock className="h-2.5 w-2.5" />
                                {fu.follow_up_time || "Today"}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Lead / Quotation */}
                        <td className="px-3.5 py-2.5">
                          {isQuoteFollowUp && quoteId ? (
                            <Link
                              href={`${portalHome}/quotations/${quoteId}`}
                              className="font-bold text-foreground hover:text-primary transition-colors text-xs"
                            >
                              {customerName || "Customer"}
                              <div className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400">
                                Quote #{quoteNo}
                              </div>
                            </Link>
                          ) : leadId ? (
                            <Link
                              href={`${portalHome}/leads/${leadId}`}
                              className="font-bold text-foreground hover:text-primary transition-colors text-xs"
                            >
                              {leadName}
                              {companyName && (
                                <span className="font-normal text-muted-foreground ml-1">
                                  ({companyName})
                                </span>
                              )}
                              <div className="text-[10px] font-mono text-primary">
                                #{leadNo}
                              </div>
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Phone / Email */}
                        <td className="px-3.5 py-2.5 space-y-0.5 text-[11px]">
                          {phone && (
                            <div className="flex items-center gap-1 text-foreground">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <span className="font-mono">{phone}</span>
                            </div>
                          )}
                          {email && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <span className="truncate max-w-[140px]">{email}</span>
                            </div>
                          )}
                          {!phone && !email && <span className="text-muted-foreground">—</span>}
                        </td>

                        {/* Executive / Sales Reps */}
                        <td className="px-3.5 py-2.5">
                          {reps.length === 0 ? (
                            <span className="text-muted-foreground italic text-xs">Unassigned</span>
                          ) : reps.length === 1 ? (
                            <span
                              className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-surface-muted/60 px-2.5 py-0.5 text-[11px] font-medium text-foreground max-w-[160px] truncate"
                              title={reps[0].name}
                            >
                              <UserCheck className="h-3 w-3 shrink-0 text-muted-foreground" />
                              <span className="truncate">{reps[0].name}</span>
                            </span>
                          ) : (
                            <div className="flex flex-col gap-1 max-w-[200px]">
                              <div className="flex flex-wrap items-center gap-1">
                                {reps.slice(0, 2).map((r, idx) => (
                                  <span
                                    key={r._id || r.name + idx}
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                                      r.isPrimary
                                        ? "border-primary/30 bg-primary/10 text-primary font-semibold"
                                        : "border-border/80 bg-surface-muted/70 text-foreground"
                                    }`}
                                    title={r.isPrimary ? `${r.name} (Primary Rep)` : r.name}
                                  >
                                    <UserCheck className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                                    <span className="truncate max-w-[95px]">{r.name}</span>
                                  </span>
                                ))}
                                {reps.length > 2 && (
                                  <span
                                    className="rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary"
                                    title={reps.slice(2).map((r) => r.name).join(", ")}
                                  >
                                    +{reps.length - 2}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-semibold text-primary">
                                {reps.length} reps assigned
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Agenda / Notes */}
                        <td className="px-3.5 py-2.5">
                          <p className="text-xs text-foreground line-clamp-2">
                            {fu.notes || "Routine lead follow-up & requirement review"}
                          </p>
                          {fu.outcome && (
                            <p className="mt-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              Outcome: {fu.outcome}
                            </p>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-3.5 py-2.5 text-center">
                          {isDone ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" />
                              Done
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                              <Clock className="h-3 w-3" />
                              Pending
                            </span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="px-3.5 py-2.5 text-right">
                          {isQuoteFollowUp && quoteId ? (
                            <Link
                              href={`${portalHome}/quotations/${quoteId}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-500/20 dark:text-indigo-300 transition-colors shadow-2xs"
                            >
                              <span>Quote</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </Link>
                          ) : leadId ? (
                            <Link
                              href={`${portalHome}/leads/${leadId}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-muted/60 px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-surface-muted transition-colors shadow-2xs"
                            >
                              <span>Open</span>
                              <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
