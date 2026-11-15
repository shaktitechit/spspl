"use client";

import { useLeadManagerRole } from "@/hooks/useLeadManagerRole";
import { OrganisationLeadReportsPage } from "@/components/leads/organisation";
import { ManagerLeadReportsPage } from "@/components/leads/team/manager";
import { CoordinatorLeadReportsPage } from "@/components/leads/team/coordinator";
import { MyLeadReportsPage } from "@/components/leads/my";

export default function LeadReportsPage() {
  const { isAdmin, isManager, isCoordinator } = useLeadManagerRole();

  if (isAdmin) return <OrganisationLeadReportsPage portalHome="/dashboard" />;
  if (isManager) return <ManagerLeadReportsPage portalHome="/dashboard" />;
  if (isCoordinator) return <CoordinatorLeadReportsPage portalHome="/dashboard" />;
  return <MyLeadReportsPage portalHome="/dashboard" />;
}
