"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import TasksVisitsPage from "@/components/workPlanner/tasks-visits/TasksVisitsPage";
import TeamTasksVisitsPage from "@/components/workPlanner/tasks-visits/TeamTasksVisitsPage";

function TasksVisitsContent() {
  const searchParams = useSearchParams();
  const scope = searchParams.get("scope");
  if (scope === "team") {
    return <TeamTasksVisitsPage />;
  }
  return <TasksVisitsPage forcedScope="mine" />;
}

export default function DashboardTasksVisitsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center text-xs font-semibold text-muted">
          Loading Tasks &amp; Visits Management…
        </div>
      }
    >
      <TasksVisitsContent />
    </Suspense>
  );
}
