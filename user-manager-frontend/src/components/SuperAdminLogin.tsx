"use client";

import { useState, useEffect } from "react";
import { Crown, ShieldAlert, Loader2, LogIn, Sun, Moon } from "lucide-react";
import type { UserSession } from "@/types/userManager";
import { API_BASE } from "@/utils/apiHelpers";
import { AUTH_API } from "@session-auth/authApiPaths";
import {
  applySessionAfterAuth,
  hasSuperAdminAccess,
  saveSessionToStorage,
} from "@/utils/authStorage";
import { useTheme } from "@/hooks/useTheme";

function resolveAssetUrl(path: string): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path) || path.startsWith("data:")) return path;
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (clean.startsWith("/uploads") || clean.startsWith("/api/uploads")) {
    return `${API_BASE}${clean}`;
  }
  return clean;
}

export function SuperAdminLogin({
  onLoginSuccess,
}: {
  onLoginSuccess: (session: UserSession) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { isDark, toggleIsDark, setThemeColor, setCustomPrimary } = useTheme();
  const [companyInfo, setCompanyInfo] = useState<any>(null);

  useEffect(() => {
    async function loadCompanyBranding() {
      try {
        // Same-origin proxy → auth-service (works in Docker without browser→auth CORS/host issues)
        const res = await fetch("/api/company-info");
        if (res.ok) {
          const data = await res.json();
          const info = data?.data || data?.company;
          if (info) {
            setCompanyInfo(info);
            const validColors = ["violet", "indigo", "blue", "emerald", "rose", "amber"];
            if (info.theme_palette && validColors.includes(info.theme_palette)) {
              setThemeColor(info.theme_palette);
            }
            if (info.primary_color) {
              setCustomPrimary(info.primary_color);
            }
            const logoOrFavicon = info.favicon_url || info.logo_url;
            if (logoOrFavicon && typeof document !== "undefined") {
              let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
              if (!link) {
                link = document.createElement("link");
                link.rel = "shortcut icon";
                document.getElementsByTagName("head")[0]?.appendChild(link);
              }
              link.href = resolveAssetUrl(logoOrFavicon);
            }
            const companyName = info.trade_name || info.legal_name;
            if (companyName && typeof document !== "undefined") {
              document.title = `${companyName} - Super Admin Sign In`;
            }
          }
        }
      } catch {
        // Fallback
      }
    }
    loadCompanyBranding();
  }, [setThemeColor, setCustomPrimary]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(AUTH_API.login, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || data?.message || "Invalid login credentials.");
      }

      const token = data?.token || data?.data?.token;
      const refreshExpiresIn = data?.refreshExpiresIn || data?.data?.refreshExpiresIn;
      const user = data?.user || data?.data?.user;

      if (!token || !user) {
        throw new Error("Authentication failed: Missing session token.");
      }

      if (!hasSuperAdminAccess(user)) {
        throw new Error(
          "Access Denied: Only Super Admin accounts are authorized to sign into the User Management Dashboard.",
        );
      }

      applySessionAfterAuth();
      const session: UserSession = {
        token,
        refreshExpiresAt: refreshExpiresIn ? Date.now() + refreshExpiresIn * 1000 : undefined,
        user,
      };
      saveSessionToStorage(session);
      onLoginSuccess(session);
    } catch (err: any) {
      setError(err?.message ?? "Login failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const companyTitle = companyInfo?.trade_name || companyInfo?.legal_name || "Super Admin Portal";
  const logoUrl = companyInfo?.logo_url
    ? resolveAssetUrl(companyInfo.logo_url)
    : companyInfo?.favicon_url
      ? resolveAssetUrl(companyInfo.favicon_url)
      : "";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4 transition-colors duration-200 relative">
      {/* Top right theme mode toggle */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleIsDark}
          className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-sm transition hover:bg-surface-muted cursor-pointer"
          title="Toggle Light / Dark mode"
        >
          {isDark ? (
            <>
              <Sun className="h-4 w-4 text-amber-400" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 text-slate-700" />
              <span>Dark Mode</span>
            </>
          )}
        </button>
      </div>

      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary shadow-inner mb-2 overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt="Company Logo" className="h-10 w-10 object-contain" />
            ) : (
              <Crown className="h-8 w-8 text-primary" />
            )}
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            {companyTitle}
          </h1>
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">
            User Management System Authentication
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-2xl backdrop-blur-xl">
          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3.5 text-xs text-rose-600 dark:text-rose-400">
              <ShieldAlert className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Super Admin Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="superadmin@company.com"
                className="w-full rounded-xl border border-border bg-surface-muted px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-border bg-surface-muted px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-lg hover:bg-primary-hover disabled:opacity-60 transition active:scale-[0.99] cursor-pointer"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              Authorize & Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
