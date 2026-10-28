"use client";

import { PartyDetailModal } from "@/components/portal/shared/parties/modals/PartyDetailModal";

export interface QuickAddPartyModalProps {
  open: boolean;
  initialName?: string;
  portalHome?: string;
  onClose: () => void;
  onSuccess: (party: Record<string, unknown>) => void;
  onOpenFullModal?: () => void;
}

/**
 * Unified Quick Add Party Modal — delegates directly to PartyDetailModal
 * ensuring a single unified form across the entire application with
 * nested Quick Add for Country, State, and City.
 */
export function QuickAddPartyModal({
  open,
  initialName = "",
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
      portalHome={portalHome}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}

export default QuickAddPartyModal;
