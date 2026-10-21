"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthProfile } from "@/hooks/useAuthProfile";
import { resolveHomeFromUser } from "@/constants/dashboardAccess";

/** Hub: redirect to the caller's department dashboard. */
export default function DashboardIndexPage() {
  const router = useRouter();
  const { user, loading } = useAuthProfile();

  useEffect(() => {
    if (loading) return;
    const home = resolveHomeFromUser(user);
    router.replace(home || "/");
  }, [loading, user, router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <p className="text-xs font-semibold text-muted">Opening your dashboard…</p>
      </div>
    </div>
  );
}
