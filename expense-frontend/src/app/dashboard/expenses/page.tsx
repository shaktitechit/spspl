"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function ExpensesLegacyRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams?.get("tab");

  useEffect(() => {
    if (tab === "advances") {
      router.replace("/dashboard/advances");
    } else if (tab === "balances") {
      router.replace("/dashboard/ledgers");
    } else if (tab === "settlements") {
      router.replace("/dashboard/settlements");
    } else {
      router.replace("/dashboard/claims");
    }
  }, [router, tab]);

  return (
    <div className="flex h-64 w-full items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-xs text-muted font-medium">Navigating to independent portal page…</p>
      </div>
    </div>
  );
}
