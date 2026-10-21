"use client";

import OrderDetailsPage from "@/components/portal/shared/orders/detail/OrderDetailsPage";
import { DISPATCH_ORDER_DETAILS_CONFIG } from "@/components/portal/shared/orders/detail/orderDetailsPageConfig";

export default function DispatchOrderDetail({ orderId }: { orderId: string }) {
  return (
    <OrderDetailsPage orderId={orderId} config={DISPATCH_ORDER_DETAILS_CONFIG} />
  );
}
