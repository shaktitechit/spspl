"use client";

import { use } from "react";
import { QuotationFormPage } from "@/components/quotations/shared/QuotationFormPage";

export default function EditQuotationRoutePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  return (
    <QuotationFormPage
      mode="edit"
      quotationId={resolvedParams.id}
      portalHome="/dashboard"
    />
  );
}
