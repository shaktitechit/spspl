"use client";

import { useLeadManagerRole } from "@/hooks/useLeadManagerRole";
import { OrganisationQuotationsPage } from "@/components/quotations/organisation";
import { ManagerQuotationsPage } from "@/components/quotations/team/manager";
import { CoordinatorQuotationsPage } from "@/components/quotations/team/coordinator";
import { MyQuotationsPage } from "@/components/quotations/my";

export default function QuotationsListPage() {
  const { isAdmin, isManager, isCoordinator, loading } = useLeadManagerRole();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAdmin) return <OrganisationQuotationsPage portalHome="/dashboard" />;
  if (isManager) return <ManagerQuotationsPage portalHome="/dashboard" />;
  if (isCoordinator) return <CoordinatorQuotationsPage portalHome="/dashboard" />;
  return <MyQuotationsPage portalHome="/dashboard" />;
}
