"use client";

import { use } from "react";
import { LeadFormPage } from "@/components/leads/LeadFormPage";

export default function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  return <LeadFormPage mode="edit" leadId={resolvedParams.id} portalHome="/dashboard" />;
}
