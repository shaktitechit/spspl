"use client";

import React from "react";
import { ListLeadsPage } from "../../shared/ListLeadsPage";

export function CoordinatorLeadsPage({ portalHome = "/dashboard" }: { portalHome?: string }) {
  return <ListLeadsPage portalHome={portalHome} scope="coordinator" />;
}
