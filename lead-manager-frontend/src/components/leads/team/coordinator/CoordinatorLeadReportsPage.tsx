"use client";

import React from "react";
import { LeadReportsDashboard } from "../../shared/LeadReportsDashboard";

export function CoordinatorLeadReportsPage({ portalHome = "/dashboard" }: { portalHome?: string }) {
  return <LeadReportsDashboard portalHome={portalHome} scope="coordinator" />;
}
