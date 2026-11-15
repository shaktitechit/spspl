"use client";

import { useLeadManagerRole } from "@/hooks/useLeadManagerRole";
import { OrganisationFollowUpsPage } from "@/components/leads/organisation";
import { ManagerFollowUpsPage } from "@/components/leads/team/manager";
import { CoordinatorFollowUpsPage } from "@/components/leads/team/coordinator";
import { MyFollowUpsPage } from "@/components/leads/my";

export default function LeadFollowUpsRoutePage() {
  const { isAdmin, isManager, isCoordinator } = useLeadManagerRole();

  if (isAdmin) return <OrganisationFollowUpsPage portalHome="/dashboard" />;
  if (isManager) return <ManagerFollowUpsPage portalHome="/dashboard" />;
  if (isCoordinator) return <CoordinatorFollowUpsPage portalHome="/dashboard" />;
  return <MyFollowUpsPage portalHome="/dashboard" />;
}
