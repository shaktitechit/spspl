"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { WorkPlansPage } from "@/components/workPlanner/plans/WorkPlansPage";
import { TeamPlansPage } from "@/components/workPlanner/plans/TeamPlansPage";

function PlansContent() {
  const searchParams = useSearchParams();
  const scope = searchParams.get("scope");
  if (scope === "team") {
    return <TeamPlansPage />;
  }
  return <WorkPlansPage forcedScope="mine" />;
}

export default function PlansPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400 font-sans">Loading plans…</div>}>
      <PlansContent />
    </Suspense>
  );
}

