"use client";

import { use } from "react";
import { LeadDetailPage } from "@/components/leads/shared/LeadDetailPage";

export default function LeadDetailViewPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  return <LeadDetailPage leadId={resolvedParams.id} portalHome="/dashboard" />;
}
