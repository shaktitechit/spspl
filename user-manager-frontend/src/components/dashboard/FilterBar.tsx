import { Search, X } from "lucide-react";
import { DEPARTMENTS } from "@/types/userManager";

export function FilterBar({
  search,
  setSearch,
  deptFilter,
  setDeptFilter,
  deptCounts,
}: {
  search: string;
  setSearch: (q: string) => void;
  deptFilter: string;
  setDeptFilter: (dept: string) => void;
  deptCounts: Record<string, number>;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted" />
        <input
          type="text"
          placeholder="Search by name or email address…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-inner"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-3 text-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {["all", ...DEPARTMENTS].map((d) => (
          <button
            key={d}
            onClick={() => setDeptFilter(d)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              deptFilter === d
                ? "bg-primary text-white shadow-md"
                : "border border-border bg-card text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            {d === "all" ? "All Depts" : d.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
            {deptCounts[d] !== undefined && (
              <span className="ml-1.5 tabular-nums opacity-75">({deptCounts[d]})</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
