"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { WorkPlanFormPage } from "@/components/workPlanner/WorkPlanFormPage";

function NewPlanPageContent() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit") || undefined;
  const copyId = searchParams.get("copy") || undefined;
  const targetDate = searchParams.get("date") || undefined;
  return <WorkPlanFormPage planId={editId} copyId={copyId} initialDate={targetDate} />;
}

export default function NewPlanPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400 font-sans">Loading form…</div>}>
      <NewPlanPageContent />
    </Suspense>
  );
}
