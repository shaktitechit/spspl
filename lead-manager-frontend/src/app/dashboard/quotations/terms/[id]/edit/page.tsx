"use client";

import { use } from "react";
import { TermsFormPage } from "@/components/quotations/TermsFormPage";

export default function EditTermsRoutePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  return (
    <TermsFormPage
      mode="edit"
      termsId={resolvedParams.id}
      portalHome="/dashboard"
    />
  );
}
