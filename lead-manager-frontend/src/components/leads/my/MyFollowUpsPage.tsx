"use client";

import React from "react";
import { LeadFollowUpsPage } from "../shared/LeadFollowUpsPage";

export function MyFollowUpsPage({ portalHome = "/dashboard" }: { portalHome?: string }) {
  return <LeadFollowUpsPage portalHome={portalHome} scope="my" />;
}
