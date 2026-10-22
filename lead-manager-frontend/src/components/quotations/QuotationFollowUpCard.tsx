/**
 * @fileoverview Follow-Up Timeline & Management Card for Quotations.
 * Wraps FollowUpChatPanel in "quotation" context.
 * @module components/quotations/QuotationFollowUpCard
 */
"use client";

import React from "react";
import type { LeadQuotationRecord } from "@/store/api";
import { FollowUpChatPanel } from "@/components/shared/followups/FollowUpChatPanel";

type Props = {
  quotation?: LeadQuotationRecord | null;
};

export function QuotationFollowUpCard({ quotation }: Props) {
  if (!quotation) return null;

  return (
    <FollowUpChatPanel
      context="quotation"
      quotation={quotation}
      disabled={quotation.status === "converted"}
    />
  );
}
