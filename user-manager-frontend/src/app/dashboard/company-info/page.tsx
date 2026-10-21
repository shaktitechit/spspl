"use client";

import { useState, useEffect, useCallback } from "react";
import { readSessionFromStorage } from "@/utils/authStorage";
import { CompanyInfoView } from "@/components/companyInfo/CompanyInfoView";

export default function CompanyInfoPage() {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    setSession(readSessionFromStorage());
  }, []);

  const applyCompanyInfoTheme = useCallback((info: any) => {
    if (!info) return;

    const validColors = ["violet", "indigo", "blue", "emerald", "rose", "amber"];
    if (info.theme_palette && validColors.includes(info.theme_palette)) {
      document.documentElement.setAttribute("data-theme-color", info.theme_palette);
      localStorage.setItem("theme_color", info.theme_palette);
    }
    if (info.primary_color) {
      document.documentElement.style.setProperty("--primary", info.primary_color);
      document.documentElement.style.setProperty("--primary-hover", info.primary_color);
      localStorage.setItem("custom_primary", info.primary_color);
    }

    // Dynamic favicon
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

    // Dynamic document title
    const companyName = info.trade_name || info.legal_name;
    if (companyName && typeof document !== "undefined") {
      document.title = `${companyName} - Company Information`;
    }
  }, []);

  if (!session?.token) return null;

  return (
    <CompanyInfoView
      token={session.token}
      onCompanyInfoUpdated={applyCompanyInfoTheme}
    />
  );
}
