"use client";

import { useLeadManagerRole } from "@/hooks/useLeadManagerRole";
import { OrganisationQuotationReportsPage } from "@/components/quotations/organisation";
import { ManagerQuotationReportsPage } from "@/components/quotations/team/manager";
import { CoordinatorQuotationReportsPage } from "@/components/quotations/team/coordinator";
import { MyQuotationReportsPage } from "@/components/quotations/my";

export default function QuotationReportsPage() {
  const { isAdmin, isManager, isCoordinator } = useLeadManagerRole();

  if (isAdmin) return <OrganisationQuotationReportsPage portalHome="/dashboard" />;
  if (isManager) return <ManagerQuotationReportsPage portalHome="/dashboard" />;
  if (isCoordinator) return <CoordinatorQuotationReportsPage portalHome="/dashboard" />;
  return <MyQuotationReportsPage portalHome="/dashboard" />;
}
