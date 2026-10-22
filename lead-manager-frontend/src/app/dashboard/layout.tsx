"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { UserSession } from "@/types/leadManager";
import { logoutAndRedirect, readSessionFromStorage } from "@/utils/authStorage";
import { useTheme } from "@/hooks/useTheme";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { UrgentFollowUpBanner } from "@/components/leads/UrgentFollowUpBanner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [companyInfo, setCompanyInfo] = useState<any>(null);

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const { isDark, toggleIsDark, themeColor, setThemeColor, setCustomPrimary } = useTheme();

  const token = session?.token;

  const applyCompanyInfoTheme = useCallback(
    (info: any) => {
      if (!info) return;
      setCompanyInfo(info);

      const validColors = ["violet", "indigo", "blue", "emerald", "rose", "amber"];
      if (info.theme_palette && validColors.includes(info.theme_palette)) {
        setThemeColor(info.theme_palette as any);
      }
      if (info.primary_color) {
        setCustomPrimary(info.primary_color);
      } else {
        setCustomPrimary(null);
      }

      // Dynamic browser favicon
      const faviconUrl = info.favicon_url || info.logo_url;
      if (faviconUrl && typeof document !== "undefined") {
        let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
        if (!link) {
          link = document.createElement("link");
          link.rel = "shortcut icon";
          document.getElementsByTagName("head")[0]?.appendChild(link);
        }
        link.href = faviconUrl;
      }

      // Dynamic browser title
      const companyName = info.trade_name || info.legal_name;
      if (companyName && typeof document !== "undefined") {
        document.title = `${companyName} - Lead Manager`;
      }
    },
    [setThemeColor, setCustomPrimary],
  );

  const fetchCompanyInfo = useCallback(async () => {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      // Use a same-origin proxy route so the browser never calls the Docker-internal hostname directly.
      const res = await fetch("/api/company-info", { headers });
      if (res.ok) {
        const data = await res.json();
        if (data?.data) {
          applyCompanyInfoTheme(data.data);
        }
      }
    } catch (e) {
      console.warn("Could not fetch company info:", e);
    }
  }, [token, applyCompanyInfoTheme]);

  useEffect(() => {
    const s = readSessionFromStorage();
    if (!s?.token) {
      router.push("/");
    } else {
      setSession(s);
    }
    setIsInitializing(false);
  }, [router]);

  useEffect(() => {
    if (session) {
      fetchCompanyInfo();
    }
  }, [session, fetchCompanyInfo]);

  const handleLogout = () => {
    void logoutAndRedirect("/");
  };

  if (isInitializing) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs font-semibold text-muted">Loading Lead Manager Shell…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar
        mobileNavOpen={mobileNavOpen}
        setMobileNavOpen={setMobileNavOpen}
        desktopCollapsed={desktopCollapsed}
        setDesktopCollapsed={setDesktopCollapsed}
        companyInfo={companyInfo}
      />

      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar
          companyInfo={companyInfo}
          session={session}
          isDark={isDark}
          onToggleDark={toggleIsDark}
          themeColor={themeColor}
          onSelectThemeColor={setThemeColor}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onLogout={handleLogout}
        />

        <UrgentFollowUpBanner portalHome="/dashboard" />

        <main className="flex-1 overflow-y-auto scroll-smooth">
          <div className="mx-auto w-full max-w-[1720px] p-4 sm:p-6 lg:p-8 space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
