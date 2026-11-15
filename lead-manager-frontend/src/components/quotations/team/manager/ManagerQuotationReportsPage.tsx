"use client";

import React from "react";
import { QuotationReportsDashboard } from "../../shared/QuotationReportsDashboard";

export function ManagerQuotationReportsPage({ portalHome = "/dashboard" }: { portalHome?: string }) {
  return <QuotationReportsDashboard portalHome={portalHome} scope="manager" />;
}
