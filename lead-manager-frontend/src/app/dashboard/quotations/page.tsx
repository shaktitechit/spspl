"use client";

import { useLeadManagerRole } from "@/hooks/useLeadManagerRole";
import { OrganisationQuotationsPage } from "@/components/quotations/organisation";
import { ManagerQuotationsPage } from "@/components/quotations/team/manager";
import { CoordinatorQuotationsPage } from "@/components/quotations/team/coordinator";
import { MyQuotationsPage } from "@/components/quotations/my";

export default function QuotationsListPage() {
  const { isAdmin, isManager, isCoordinator } = useLeadManagerRole();

  if (isAdmin) return <OrganisationQuotationsPage portalHome="/dashboard" />;
  if (isManager) return <ManagerQuotationsPage portalHome="/dashboard" />;
  if (isCoordinator) return <CoordinatorQuotationsPage portalHome="/dashboard" />;
  return <MyQuotationsPage portalHome="/dashboard" />;
}
