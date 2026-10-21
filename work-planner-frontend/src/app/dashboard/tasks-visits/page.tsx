"use client";

import React, { Suspense } from "react";
import TasksVisitsPage from "@/components/workPlanner/TasksVisitsPage";

export default function DashboardTasksVisitsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center text-xs font-semibold text-muted">
          Loading Tasks &amp; Visits Management…
        </div>
      }
    >
      <TasksVisitsPage />
    </Suspense>
  );
}
