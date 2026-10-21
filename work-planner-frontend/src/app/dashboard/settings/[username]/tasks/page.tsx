"use client";

import React from "react";
import { useParams } from "next/navigation";
import { UserTasksConfigPage } from "@/components/workPlanner/UserTasksConfigPage";

export default function UserTasksRoutePage() {
  const params = useParams();
  const rawParam = params?.username ? String(params.username) : "";

  return <UserTasksConfigPage userParam={rawParam} />;
}
