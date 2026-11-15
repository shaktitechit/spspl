"use client";

import React from "react";
import { ListLeadsPage } from "../shared/ListLeadsPage";

export function OrganisationLeadsPage({ portalHome = "/dashboard" }: { portalHome?: string }) {
  return <ListLeadsPage portalHome={portalHome} scope="organisation" />;
}
