"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  normalizeCode,
  resolveHomeFromUser,
  userAllowsDepartmentPath,
} from "@/constants/dashboardAccess";
import { useAuthProfile } from "@/hooks/useAuthProfile";
import { PortalsSection } from "@/components/shell/PortalsSection";

export default function DepartmentDashboardPage() {
  const params = useParams<{ department: string; role?: string }>();
  const router = useRouter();
  const { user, loading } = useAuthProfile();

  const segment = normalizeCode(
    typeof params.department === "string"
      ? decodeURIComponent(params.department)
      : "",
  );
  const roleSegment = normalizeCode(
    typeof params.role === "string" ? decodeURIComponent(params.role) : "",
  );

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    const path = roleSegment
      ? `/dashboard/${segment}/${roleSegment}`
      : `/dashboard/${segment}`;
    const allowed = userAllowsDepartmentPath({ user, pathname: path });
    if (!allowed) {
      router.replace(resolveHomeFromUser(user) || "/");
    }
  }, [loading, user, segment, roleSegment, router]);

  if (loading || !user) {
    return null;
  }

  return <PortalsSection />;
}
