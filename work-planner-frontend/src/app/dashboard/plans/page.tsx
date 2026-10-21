"use client";

import { Suspense } from "react";
import { WorkPlansPage } from "@/components/workPlanner/WorkPlansPage";

export default function PlansPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400 font-sans">Loading plans…</div>}>
      <WorkPlansPage />
    </Suspense>
  );
}
