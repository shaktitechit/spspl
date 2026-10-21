"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function RolesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/departments?tab=roles");
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center p-16 text-muted gap-3">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <span className="text-xs font-semibold">Redirecting to Departments & Roles Manager…</span>
    </div>
  );
}
