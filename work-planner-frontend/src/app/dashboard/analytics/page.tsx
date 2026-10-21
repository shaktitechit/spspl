import React from "react";
import { WorkPlanAnalyticsPage } from "@/components/workPlanner/WorkPlanAnalyticsPage";

export const metadata = {
  title: "360° Work Plan Analytics & Caliber Assessment | OPMS",
  description: "Comprehensive 360° AI-powered work plan analysis, dedicated visits and tasks reports, and manager coaching directives.",
};

export default function AnalyticsRoutePage() {
  return <WorkPlanAnalyticsPage />;
}
