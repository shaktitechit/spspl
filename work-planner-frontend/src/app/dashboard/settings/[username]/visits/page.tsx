"use client";

import React from "react";
import { useParams } from "next/navigation";
import { UserVisitsConfigPage } from "@/components/workPlanner/UserVisitsConfigPage";

export default function UserVisitsRoutePage() {
  const params = useParams();
  const rawParam = params?.username ? String(params.username) : "";

  return <UserVisitsConfigPage userParam={rawParam} />;
}
