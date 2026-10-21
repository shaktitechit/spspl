"use client";

import React, { Suspense } from "react";
import { LeadFormPage } from "@/components/leads/LeadFormPage";

export default function NewLeadPage() {
  return (
    <Suspense fallback={null}>
      <LeadFormPage mode="create" portalHome="/dashboard" />
    </Suspense>
  );
}
