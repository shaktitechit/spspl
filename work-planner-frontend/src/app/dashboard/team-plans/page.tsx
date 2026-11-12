"use client";

import { Suspense } from "react";
import TeamPlansPage from "@/components/workPlanner/plans/TeamPlansPage";

export default function AliasTeamPlansPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400 font-sans">Loading team plans…</div>}>
      <TeamPlansPage />
    </Suspense>
  );
}

