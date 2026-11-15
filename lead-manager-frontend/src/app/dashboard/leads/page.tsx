"use client";

import { useLeadManagerRole } from "@/hooks/useLeadManagerRole";
import { OrganisationLeadsPage } from "@/components/leads/organisation";
import { ManagerLeadsPage } from "@/components/leads/team/manager";
import { CoordinatorLeadsPage } from "@/components/leads/team/coordinator";
import { MyLeadsPage } from "@/components/leads/my";

export default function LeadsListingPage() {
  const { isAdmin, isManager, isCoordinator } = useLeadManagerRole();

  if (isAdmin) return <OrganisationLeadsPage portalHome="/dashboard" />;
  if (isManager) return <ManagerLeadsPage portalHome="/dashboard" />;
  if (isCoordinator) return <CoordinatorLeadsPage portalHome="/dashboard" />;
  return <MyLeadsPage portalHome="/dashboard" />;
}
