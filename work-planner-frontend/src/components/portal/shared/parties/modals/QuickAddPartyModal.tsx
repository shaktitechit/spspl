"use client";

import { PartyDetailModal } from "./PartyDetailModal";

export interface QuickAddPartyModalProps {
  open: boolean;
  initialName?: string;
  defaultPartyType?: "customer" | "supplier" | "both" | "leads" | "quotation" | "visits";
  portalHome?: string;
  onClose: () => void;
  onSuccess: (party: Record<string, unknown>) => void;
}

/**
 * Unified Quick Add Party Modal — delegates directly to PartyDetailModal
 * ensuring a single unified form across the entire application with
 * nested Quick Add for Country, State, and City.
 */
export function QuickAddPartyModal({
  open,
  initialName = "",
  defaultPartyType = "visits",
  portalHome,
  onClose,
  onSuccess,
}: QuickAddPartyModalProps) {
  if (!open) return null;

  return (
    <PartyDetailModal
      open={open}
      create={true}
      partyId={null}
      initialName={initialName}
      defaultPartyType={defaultPartyType}
      portalHome={portalHome}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}

export default QuickAddPartyModal;

