"use client";

import { useParams } from "next/navigation";
import { WorkPlanDetailPage } from "@/components/workPlanner/WorkPlanDetailPage";

export default function PlanDetailRoutePage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id || "";

  if (!id) return null;
  return <WorkPlanDetailPage planId={id} />;
}
