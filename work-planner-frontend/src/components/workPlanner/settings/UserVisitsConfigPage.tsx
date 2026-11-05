"use client";

import React from "react";
import { UserTemplatesConfigPage } from "./UserTemplatesConfigPage";

export interface UserVisitsConfigPageProps {
  userParam: string;
}

export function UserVisitsConfigPage({ userParam }: UserVisitsConfigPageProps) {
  return <UserTemplatesConfigPage userParam={userParam} initialTab="visits" />;
}
