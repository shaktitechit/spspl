"use client";

import OrderDetailsPage from "@/components/portal/shared/orders/detail/OrderDetailsPage";
import { ADMIN_ORDER_DETAILS_CONFIG } from "@/components/portal/shared/orders/detail/orderDetailsPageConfig";

export default function AdminOrderDetail({ orderId }: { orderId: string }) {
  return (
    <OrderDetailsPage orderId={orderId} config={ADMIN_ORDER_DETAILS_CONFIG} />
  );
}
