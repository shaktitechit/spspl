"use client";

import OrderDetailsPage from "@/components/portal/shared/orders/detail/OrderDetailsPage";
import { ACCOUNT_ORDER_DETAILS_CONFIG } from "@/components/portal/shared/orders/detail/orderDetailsPageConfig";

export default function AccountOrderDetail({ orderId }: { orderId: string }) {
  return (
    <OrderDetailsPage orderId={orderId} config={ACCOUNT_ORDER_DETAILS_CONFIG} />
  );
}
