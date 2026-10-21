"use client";

import React from "react";
import { useParams } from "next/navigation";
import { UserTemplatesConfigPage } from "@/components/workPlanner/UserTemplatesConfigPage";

export default function UserConfigRoutePage() {
  const params = useParams();
  const rawParam = params?.username ? String(params.username) : "";

  return <UserTemplatesConfigPage userParam={rawParam} initialTab="tasks" />;
}
