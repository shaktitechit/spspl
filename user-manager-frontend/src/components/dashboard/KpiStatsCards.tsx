import { Users, UserCheck, UserX, Crown } from "lucide-react";

interface Stats {
  total: number;
  active: number;
  inactive: number;
  superAdmins: number;
}

export function KpiStatsCards({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between text-muted text-xs mb-1 font-semibold">
          <span>Total Directory Users</span>
          <Users className="h-4 w-4 text-primary" />
        </div>
        <p className="text-2xl font-extrabold text-foreground">{stats.total}</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between text-muted text-xs mb-1 font-semibold">
          <span>Active Logins</span>
          <UserCheck className="h-4 w-4 text-emerald-500" />
        </div>
        <p className="text-2xl font-extrabold text-emerald-500">{stats.active}</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between text-muted text-xs mb-1 font-semibold">
          <span>Inactive Accounts</span>
          <UserX className="h-4 w-4 text-amber-500" />
        </div>
        <p className="text-2xl font-extrabold text-amber-500">{stats.inactive}</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between text-muted text-xs mb-1 font-semibold">
          <span>Super Admins</span>
          <Crown className="h-4 w-4 text-primary" />
        </div>
        <p className="text-2xl font-extrabold text-primary">{stats.superAdmins}</p>
      </div>
    </div>
  );
}
