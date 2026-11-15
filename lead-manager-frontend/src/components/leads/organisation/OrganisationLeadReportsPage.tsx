"use client";

import React from "react";
import { LeadReportsDashboard } from "../shared/LeadReportsDashboard";

export function OrganisationLeadReportsPage({ portalHome = "/dashboard" }: { portalHome?: string }) {
  return <LeadReportsDashboard portalHome={portalHome} scope="organisation" />;
}
