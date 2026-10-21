"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { QuotationFormPage } from "@/components/quotations/QuotationFormPage";

function CreateQuotationContent() {
  const searchParams = useSearchParams();
  const leadId = searchParams.get("leadId") || undefined;
  const copyFromId = searchParams.get("copy_from") || searchParams.get("clone") || undefined;
  return (
    <QuotationFormPage
      mode="create"
      leadId={leadId}
      copyFromId={copyFromId}
      portalHome="/dashboard"
    />
  );
}

export default function CreateQuotationRoutePage() {
  return (
    <Suspense fallback={null}>
      <CreateQuotationContent />
    </Suspense>
  );
}

