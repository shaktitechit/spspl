"use client";

import { Suspense, use } from "react";
import UserSpecificDetailsPage from "@/components/workPlanner/plans/UserSpecificDetailsPage";

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default function AliasMemberPlansDetailPage({ params }: PageProps) {
  const { userId } = use(params);
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center text-xs font-semibold text-muted">
          Loading Member Profile &amp; Plans…
        </div>
      }
    >
      <UserSpecificDetailsPage userId={userId} initialTab="plans" backHref="/dashboard/team-plans" />
    </Suspense>
  );
}

