/**
 * @fileoverview Quotation Detail Page Route (/dashboard/quotations/[id])
 * @module app/dashboard/quotations/[id]/page
 */
import React from "react";
import QuotationDetailPage from "@/components/quotations/QuotationDetailPage";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function QuotationDetailPageWrapper({ params }: Props) {
  const resolvedParams = await params;
  return <QuotationDetailPage quotationId={resolvedParams.id} />;
}
