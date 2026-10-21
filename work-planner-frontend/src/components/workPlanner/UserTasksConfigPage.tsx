"use client";

import React from "react";
import { UserTemplatesConfigPage } from "./UserTemplatesConfigPage";

export interface UserTasksConfigPageProps {
  userParam: string;
}

export function UserTasksConfigPage({ userParam }: UserTasksConfigPageProps) {
  return <UserTemplatesConfigPage userParam={userParam} initialTab="tasks" />;
}
