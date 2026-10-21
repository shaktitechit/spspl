"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { UserSession } from "@/types/userManager";
import { readSessionFromStorage, saveSessionToStorage } from "@/utils/authStorage";
import { SuperAdminLogin } from "@/components/SuperAdminLogin";

export default function RootPage() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const s = readSessionFromStorage();
    setSession(s);
    setIsInitializing(false);
    if (s?.token) {
      if (typeof window !== "undefined") {
        window.location.href = "/dashboard";
      } else {
        router.replace("/dashboard");
      }
    }
  }, [router]);

  const handleLoginSuccess = (newSession: UserSession) => {
    saveSessionToStorage(newSession);
    setSession(newSession);
    if (typeof window !== "undefined") {
      window.location.href = "/dashboard";
    } else {
      router.push("/dashboard");
    }
  };

  if (isInitializing) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs font-semibold text-muted">Checking authentication status…</p>
        </div>
      </div>
    );
  }

  if (session?.token) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs font-semibold text-muted">Redirecting to Dashboard…</p>
        </div>
      </div>
    );
  }

  return <SuperAdminLogin onLoginSuccess={handleLoginSuccess} />;
}
