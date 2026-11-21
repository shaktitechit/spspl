"use client";

import React from "react";
import { useLeadManagerRole } from "@/hooks/useLeadManagerRole";
import { ListLeadsPage } from "@/components/leads/shared/ListLeadsPage";

/**
 * Dedicated listing page for IndiaMART leads.
 * Preserves the exact same organizational, manager, coordinator, and executive access controls,
 * with the source locked specifically to "IndiaMART".
 */
export default function IndiaMartLeadsListingPage() {
  const { isAdmin, isManager, isCoordinator } = useLeadManagerRole();

  // Applies identical role-based scope
  const scope = isAdmin
    ? "organisation"
    : isManager
    ? "manager"
    : isCoordinator
    ? "coordinator"
    : "my";

  return (
    <ListLeadsPage
      portalHome="/dashboard"
      scope={scope}
      fixedSource="IndiaMART"
    />
  );
}
