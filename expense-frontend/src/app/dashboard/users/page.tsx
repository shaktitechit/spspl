"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WorkPlannerUsersRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/ledgers");
  }, [router]);

  return (
    <div className="flex h-64 items-center justify-center font-sans text-sm text-muted">
      Redirecting to Staff Running Balances...
    </div>
  );
}
