"use client";

import OrderDetailsPage from "@/components/portal/shared/orders/detail/OrderDetailsPage";
import { FINANCE_ORDER_DETAILS_CONFIG } from "@/components/portal/shared/orders/detail/orderDetailsPageConfig";

export default function FinanceOrderDetail({ orderId }: { orderId: string }) {
  return (
    <OrderDetailsPage orderId={orderId} config={FINANCE_ORDER_DETAILS_CONFIG} />
  );
}
