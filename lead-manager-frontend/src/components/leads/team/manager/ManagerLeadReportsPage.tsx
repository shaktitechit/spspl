"use client";

import React from "react";
import { LeadReportsDashboard } from "../../shared/LeadReportsDashboard";

export function ManagerLeadReportsPage({ portalHome = "/dashboard" }: { portalHome?: string }) {
  return <LeadReportsDashboard portalHome={portalHome} scope="manager" />;
}
