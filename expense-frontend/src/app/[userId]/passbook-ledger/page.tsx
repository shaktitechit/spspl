"use client";

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";

export default function RootPassbookLedgerRedirect({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();

  useEffect(() => {
    if (resolvedParams?.userId) {
      router.replace(`/dashboard/ledgers/${encodeURIComponent(resolvedParams.userId)}/passbook-ledger`);
    }
  }, [resolvedParams, router]);

  return (
    <div className="flex h-screen items-center justify-center font-sans text-sm text-muted">
      Redirecting to Employee Passbook &amp; Ledger...
    </div>
  );
}

