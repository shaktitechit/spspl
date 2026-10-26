"use client";

export type OrderDetailTabSpec = {
  id: string;
  name: string;
  count?: number;
  /** Explicitly marks whether data exists for this tab. Defaults to count > 0 if not provided. */
  hasData?: boolean;
  /** Use warning styling for badge (e.g. flags) */
  dangerBadge?: boolean;
};

export type OrderDetailTabsNavProps = {
  tabs: OrderDetailTabSpec[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
  className?: string;
  variant?: "default" | "dark";
};

export function OrderDetailTabsNav({
  tabs,
  activeId,
  onChange,
  ariaLabel = "Order sections",
  className = "",
  variant = "default",
}: OrderDetailTabsNavProps) {
  const isDark = variant === "dark";

  return (
    <div
      className={`${
        isDark
          ? "rounded-xl border border-slate-800 bg-slate-900/90 p-1.5 shadow-md"
          : "rounded-xl border border-slate-200/90 bg-slate-50/80 p-1.5 dark:border-white/10 dark:bg-white/[0.04]"
      } ${className}`.trim()}
    >
      <nav
        className="-mx-0.5 flex gap-1 overflow-x-auto scrollbar-none pb-0.5"
        aria-label={ariaLabel}
      >
        {tabs.map((t) => {
          const selected = activeId === t.id;
          const hasData =
            t.hasData !== undefined
              ? t.hasData
              : t.count !== undefined && t.count > 0;
          const count = t.count ?? 0;

          if (isDark) {
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChange(t.id)}
                className={`relative shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer active:scale-[0.98] ${
                  selected
                    ? "bg-slate-800 text-white shadow-sm ring-1 ring-slate-700"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                }`}
              >
                <span>{t.name}</span>

                {/* Green for data have, Gray for data don't have */}
                <span
                  className={`inline-flex items-center justify-center min-w-[1.25rem] h-4.5 rounded-full px-1.5 py-0.2 text-2xs font-bold ring-1 ring-inset ${
                    hasData
                      ? t.dangerBadge
                        ? "bg-rose-500/20 text-rose-400 ring-rose-500/30"
                        : "bg-emerald-500/20 text-emerald-400 ring-emerald-500/40"
                      : "bg-slate-800 text-slate-500 ring-slate-700/60"
                  }`}
                  title={hasData ? `${count} record(s)` : "No records"}
                >
                  {count}
                </span>
              </button>
            );
          }

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={`relative shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm cursor-pointer ${
                selected
                  ? "bg-white text-primary shadow-sm ring-1 ring-slate-200/90 dark:bg-slate-800 dark:text-primary dark:ring-white/10"
                  : "text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.07] dark:hover:text-slate-100"
              }`}
            >
              <span>{t.name}</span>
              <span
                className={`inline-flex min-w-[1.25rem] justify-center rounded-full px-1.5 py-0.5 text-2xs font-bold ring-1 ring-inset ${
                  hasData
                    ? t.dangerBadge
                      ? "bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:ring-rose-800/40"
                      : "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-500/30"
                    : "bg-slate-100 text-slate-400 ring-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:ring-slate-700"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
