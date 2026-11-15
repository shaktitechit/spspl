"use client";

import React from "react";
import { ListQuotationsPage } from "../shared/ListQuotationsPage";

export function OrganisationQuotationsPage({ portalHome = "/dashboard" }: { portalHome?: string }) {
  return <ListQuotationsPage portalHome={portalHome} scope="organisation" />;
}
