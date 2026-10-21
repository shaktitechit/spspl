"use client";

import OrderDetailsPage from "@/components/portal/shared/orders/detail/OrderDetailsPage";
import { SUPER_ADMIN_ORDER_DETAILS_CONFIG } from "@/components/portal/shared/orders/detail/orderDetailsPageConfig";

export default function SuperAdminOrderDetail({ orderId }: { orderId: string }) {
  return (
    <OrderDetailsPage
      orderId={orderId}
      config={SUPER_ADMIN_ORDER_DETAILS_CONFIG}
    />
  );
}
