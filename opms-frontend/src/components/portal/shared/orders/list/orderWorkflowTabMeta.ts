/**
 * Shared accent colors for Quick Access tiles and list workflow tabs.
 * Icons come from `getOrderListTabIcon` so both surfaces stay aligned.
 */
export const ORDER_WORKFLOW_TAB_ACCENT: Record<
  string,
  {
    accent: string;
    labelTone: string;
    iconWrap: string;
    iconTone: string;
    borderHover: string;
    badgeWrap: string;
    badgeTone: string;
  }
> = {
  draft: {
    accent: "bg-slate-400",
    labelTone: "text-slate-600 dark:text-slate-400",
    iconWrap: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    iconTone: "text-slate-500 dark:text-slate-400",
    borderHover: "hover:border-slate-300 dark:hover:border-slate-700",
    badgeWrap: "bg-slate-100 dark:bg-slate-800",
    badgeTone: "text-slate-700 dark:text-slate-300",
  },
  all: {
    accent: "bg-blue-600",
    labelTone: "text-blue-600 dark:text-blue-400",
    iconWrap: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    iconTone: "text-blue-600 dark:text-blue-400",
    borderHover: "hover:border-blue-300 dark:hover:border-blue-800",
    badgeWrap: "bg-blue-50 dark:bg-blue-950/60",
    badgeTone: "text-blue-700 dark:text-blue-300",
  },
  pending_admin_approval: {
    accent: "bg-blue-600",
    labelTone: "text-blue-600 dark:text-blue-400",
    iconWrap: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    iconTone: "text-blue-600 dark:text-blue-400",
    borderHover: "hover:border-blue-300 dark:hover:border-blue-800",
    badgeWrap: "bg-blue-50 dark:bg-blue-950/60",
    badgeTone: "text-blue-700 dark:text-blue-300",
  },
  due_sheet_pending: {
    accent: "bg-amber-500",
    labelTone: "text-amber-600 dark:text-amber-400",
    iconWrap: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    iconTone: "text-amber-600 dark:text-amber-400",
    borderHover: "hover:border-amber-300 dark:hover:border-amber-800",
    badgeWrap: "bg-amber-50 dark:bg-amber-950/60",
    badgeTone: "text-amber-700 dark:text-amber-300",
  },
  pending_finance_approval: {
    accent: "bg-purple-600",
    labelTone: "text-purple-600 dark:text-purple-400",
    iconWrap: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
    iconTone: "text-purple-600 dark:text-purple-400",
    borderHover: "hover:border-purple-300 dark:hover:border-purple-800",
    badgeWrap: "bg-purple-50 dark:bg-purple-950/60",
    badgeTone: "text-purple-700 dark:text-purple-300",
  },
  pending_account_approval: {
    accent: "bg-violet-600",
    labelTone: "text-violet-600 dark:text-violet-400",
    iconWrap: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
    iconTone: "text-violet-600 dark:text-violet-400",
    borderHover: "hover:border-violet-300 dark:hover:border-violet-800",
    badgeWrap: "bg-violet-50 dark:bg-violet-950/60",
    badgeTone: "text-violet-700 dark:text-violet-300",
  },
  open_dispatched: {
    accent: "bg-teal-600",
    labelTone: "text-teal-600 dark:text-teal-400",
    iconWrap: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
    iconTone: "text-teal-600 dark:text-teal-400",
    borderHover: "hover:border-teal-300 dark:hover:border-teal-800",
    badgeWrap: "bg-teal-50 dark:bg-teal-950/60",
    badgeTone: "text-teal-700 dark:text-teal-300",
  },
  transport_pending: {
    accent: "bg-teal-600",
    labelTone: "text-teal-600 dark:text-teal-400",
    iconWrap: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
    iconTone: "text-teal-600 dark:text-teal-400",
    borderHover: "hover:border-teal-300 dark:hover:border-teal-800",
    badgeWrap: "bg-teal-50 dark:bg-teal-950/60",
    badgeTone: "text-teal-700 dark:text-teal-300",
  },
  in_transit: {
    accent: "bg-sky-600",
    labelTone: "text-sky-600 dark:text-sky-400",
    iconWrap: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
    iconTone: "text-sky-600 dark:text-sky-400",
    borderHover: "hover:border-sky-300 dark:hover:border-sky-800",
    badgeWrap: "bg-sky-50 dark:bg-sky-950/60",
    badgeTone: "text-sky-700 dark:text-sky-300",
  },
  closed_delivered: {
    accent: "bg-emerald-600",
    labelTone: "text-emerald-600 dark:text-emerald-400",
    iconWrap: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    iconTone: "text-emerald-600 dark:text-emerald-400",
    borderHover: "hover:border-emerald-300 dark:hover:border-emerald-800",
    badgeWrap: "bg-emerald-50 dark:bg-emerald-950/60",
    badgeTone: "text-emerald-700 dark:text-emerald-300",
  },
  on_hold: {
    accent: "bg-orange-500",
    labelTone: "text-orange-600 dark:text-orange-400",
    iconWrap: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
    iconTone: "text-orange-600 dark:text-orange-400",
    borderHover: "hover:border-orange-300 dark:hover:border-orange-800",
    badgeWrap: "bg-orange-50 dark:bg-orange-950/60",
    badgeTone: "text-orange-700 dark:text-orange-300",
  },
  cancelled: {
    accent: "bg-rose-600",
    labelTone: "text-rose-600 dark:text-rose-400",
    iconWrap: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    iconTone: "text-rose-600 dark:text-rose-400",
    borderHover: "hover:border-rose-300 dark:hover:border-rose-800",
    badgeWrap: "bg-rose-50 dark:bg-rose-950/60",
    badgeTone: "text-rose-700 dark:text-rose-300",
  },
  rejected: {
    accent: "bg-red-600",
    labelTone: "text-red-600 dark:text-red-400",
    iconWrap: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    iconTone: "text-red-600 dark:text-red-400",
    borderHover: "hover:border-red-300 dark:hover:border-red-800",
    badgeWrap: "bg-red-50 dark:bg-red-950/60",
    badgeTone: "text-red-700 dark:text-red-300",
  },
};

export function getOrderWorkflowTabAccent(tabId: string) {
  return ORDER_WORKFLOW_TAB_ACCENT[tabId] ?? ORDER_WORKFLOW_TAB_ACCENT.all;
}
