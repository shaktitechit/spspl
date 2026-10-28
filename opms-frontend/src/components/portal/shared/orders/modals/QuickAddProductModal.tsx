"use client";

import { ProductDetailModal } from "@/components/portal/shared/products/modals/ProductDetailModal";

export interface QuickAddProductModalProps {
  open: boolean;
  initialName?: string;
  onClose: () => void;
  onSuccess: (product: Record<string, unknown>) => void;
  onOpenFullModal?: () => void;
}

/**
 * Unified Quick Add Product Modal — delegates directly to ProductDetailModal
 * ensuring a single unified form across the entire application with
 * nested Quick Add for Unit of Measurement.
 */
export function QuickAddProductModal({
  open,
  initialName = "",
  onClose,
  onSuccess,
}: QuickAddProductModalProps) {
  if (!open) return null;

  return (
    <ProductDetailModal
      open={open}
      create={true}
      productId={null}
      initialName={initialName}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}

export default QuickAddProductModal;
