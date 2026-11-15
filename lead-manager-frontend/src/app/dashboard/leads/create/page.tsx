"use client";

import React, { Suspense } from "react";
import { LeadFormPage } from "@/components/leads/shared/LeadFormPage";

export default function CreateLeadPage() {
  return (
    <Suspense fallback={null}>
      <LeadFormPage mode="create" portalHome="/dashboard" />
    </Suspense>
  );
}
