"use client";

import React from "react";
import { LeadFollowUpsPage } from "../../shared/LeadFollowUpsPage";

export function CoordinatorFollowUpsPage({ portalHome = "/dashboard" }: { portalHome?: string }) {
  return <LeadFollowUpsPage portalHome={portalHome} scope="coordinator" />;
}
