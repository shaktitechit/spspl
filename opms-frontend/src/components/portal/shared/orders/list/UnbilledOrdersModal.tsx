"use client";

import { ModalOverlay } from "@/components/portal/shared/ui/modals/ModalOverlay";
import {
  UnbilledOrdersPage,
  type UnbilledOrdersPageProps,
} from "./UnbilledOrdersPage";

export type UnbilledOrdersModalProps = UnbilledOrdersPageProps & {
  isOpen: boolean;
  onClose: () => void;
};

export function UnbilledOrdersModal({
  isOpen,
  onClose,
  ...rest
}: UnbilledOrdersModalProps) {
  if (!isOpen) return null;
  return (
    <ModalOverlay
      onClick={onClose}
      className="fixed inset-0 z-[100] flex bg-slate-900/50 backdrop-blur-[1px]"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unbilled-orders-title"
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <UnbilledOrdersPage {...rest} isOpen={isOpen} onClose={onClose} />
      </div>
    </ModalOverlay>
  );
}

export default UnbilledOrdersModal;
