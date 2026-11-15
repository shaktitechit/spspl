"use client";

import React from "react";
import { ListLeadsPage } from "../shared/ListLeadsPage";

export function MyLeadsPage({ portalHome = "/dashboard" }: { portalHome?: string }) {
  return <ListLeadsPage portalHome={portalHome} scope="my" />;
}
