"use client";

import React, { Suspense } from "react";
import TeamTasksVisitsPage from "@/components/workPlanner/tasks-visits/TeamTasksVisitsPage";

export default function AliasTeamTasksVisitsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center text-xs font-semibold text-muted">
          Loading Team Tasks &amp; Visits Management…
        </div>
      }
    >
      <TeamTasksVisitsPage />
    </Suspense>
  );
}

