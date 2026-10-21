"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isWpAdmin, isWpElevated, readSessionFromStorage } from "@/utils/authStorage";

export default function AssignedUsersRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const user = readSessionFromStorage()?.user;
    if (isWpAdmin(user)) {
      router.replace("/dashboard/assigned-teams");
    } else if (isWpElevated(user)) {
      router.replace("/dashboard/my-team");
    } else {
      router.replace("/dashboard");
    }
  }, [router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted">
      Redirecting…
    </div>
  );
}
