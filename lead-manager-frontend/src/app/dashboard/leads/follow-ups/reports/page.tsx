"use client";

import React from "react";
import Link from "next/link";
import { useLeadManagerRole } from "@/hooks/useLeadManagerRole";
import { FollowUpReportsDashboard } from "@/components/leads/FollowUpReportsDashboard";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export default function FollowUpReportsPage() {
  const { isAdmin, isManager, isCoordinator, isExecutive, loading } = useLeadManagerRole();

  if (loading) {
    return null;
  }

  if (!isAdmin && !isManager && !isCoordinator && !isExecutive) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 mb-4 border border-amber-500/20">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Access Required</h2>
        <p className="mt-2 text-xs text-muted max-w-md">
          Follow-Up Intelligence & Reports are available to Lead Admins, Managers, Coordinators, and Executives. Please contact your administrator if you need access.
        </p>
        <Link
          href="/dashboard/leads/follow-ups"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-primary-hover transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Follow-ups
        </Link>
      </div>
    );
  }

  return <FollowUpReportsDashboard portalHome="/dashboard" />;
}
