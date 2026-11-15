/**
 * @fileoverview Lead Manager Control Center Dashboard.
 * Features cleanly separated sections for Leads Management and Quotations Commercial Hub.
 * Tailored by role for Executive, Manager, and Admin.
 * @module app/dashboard/page
 */
"use client";

import React from "react";
import { useLeadManagerRole } from "@/hooks/useLeadManagerRole";
import { OrganisationDashboard } from "@/components/dashboard/organisation";
import { ManagerDashboard } from "@/components/dashboard/team/manager";
import { CoordinatorDashboard } from "@/components/dashboard/team/coordinator";
import { MyDashboard } from "@/components/dashboard/my";

export default function DashboardPage() {
  const { user, isAdmin, isManager, isCoordinator } = useLeadManagerRole();

  return (
    <div className="space-y-3.5 font-sans">
      {isAdmin ? (
        <OrganisationDashboard portalHome="/dashboard" />
      ) : isManager ? (
        <ManagerDashboard portalHome="/dashboard" />
      ) : isCoordinator ? (
        <CoordinatorDashboard portalHome="/dashboard" />
      ) : (
        <MyDashboard
          portalHome="/dashboard"
          assigned_to={user?._id || (user as any)?.id}
        />
      )}
    </div>
  );
}
