"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Lock, Mail, ShieldCheck, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useLoginMutation } from "@/store/api/authApiSlice";
import {
  applySessionAfterAuth,
  hasAppAccess,
  readSessionFromStorage,
} from "@/utils/authStorage";
import { resolveHomeFromUser } from "@/constants/dashboardAccess";
import { useTheme } from "@/hooks/useTheme";
import { resolvePublicAssetUrl } from "@/lib/env";
import type { ThemeColor } from "@/types/leadManager";

const THEME_PALETTE = ["violet", "indigo", "blue", "emerald", "rose", "amber"] as const;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginMut, { isLoading: loading }] = useLoginMutation();
  const { setThemeColor, setCustomPrimary } = useTheme();
  const [companyInfo, setCompanyInfo] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    const existing = readSessionFromStorage();
    if (existing?.token) {
      const home = resolveHomeFromUser(existing.user) || "/dashboard";
      if (typeof window !== "undefined") {
        window.location.href = home;
      } else {
        router.replace(home);
      }
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/company-info");
        if (!res.ok) return;
        const data = await res.json();
        const info = data?.data || data?.company;
        if (!info || cancelled) return;

        setCompanyInfo(info);

        if (
          info.theme_palette &&
          THEME_PALETTE.includes(info.theme_palette)
        ) {
          setThemeColor(info.theme_palette as ThemeColor);
        }
        if (info.primary_color) {
          setCustomPrimary(info.primary_color);
        }

        const faviconUrl = info.favicon_url || info.logo_url;
        if (faviconUrl && typeof document !== "undefined") {
          let link: HTMLLinkElement | null =
            document.querySelector("link[rel*='icon']");
          if (!link) {
            link = document.createElement("link");
            link.rel = "shortcut icon";
            document.getElementsByTagName("head")[0]?.appendChild(link);
          }
          link.href = resolvePublicAssetUrl(faviconUrl);
        }

        const companyName = info.trade_name || info.legal_name;
        if (companyName) {
          document.title = `${companyName} - Portal Sign In`;
        }
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setThemeColor, setCustomPrimary]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }

    try {
      const session = await loginMut({ email, password }).unwrap();

      if (!hasAppAccess(session.user)) {
        throw new Error(
          "Access denied: Your account needs an assigned department and role.",
        );
      }

      const home = resolveHomeFromUser(session.user);
      if (!home) {
        throw new Error(
          "Access denied: No dashboard is configured for your department.",
        );
      }

      applySessionAfterAuth();

      toast.success(
        `Welcome back, ${session.user.name || session.user.email}`,
      );
      if (typeof window !== "undefined") {
        window.location.href = home;
      } else {
        router.push(home);
      }
    } catch (err: unknown) {
      const msg =
        (err as any)?.data?.message ||
        (err instanceof Error ? err.message : "Authentication failed");
      toast.error(msg);
    }
  }

  const companyTitle =
    companyInfo?.trade_name || companyInfo?.legal_name || "Portal";
  const logoUrl = companyInfo?.logo_url
    ? resolvePublicAssetUrl(companyInfo.logo_url)
    : "";

  return (
    <div className="flex min-h-screen flex-col justify-center py-12 sm:px-6 lg:px-8 bg-background font-sans text-foreground">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30 overflow-hidden">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={companyTitle}
              className="h-full w-full object-contain p-1.5"
            />
          ) : (
            <Users className="h-7 w-7" />
          )}
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          {companyTitle}
        </h2>
        <p className="text-xs text-muted">
          Sign in with your department credentials
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-2.5 h-4 w-4 text-muted" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full rounded-xl border border-border bg-surface-muted pl-10 pr-4 py-2 text-xs text-foreground placeholder-muted outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-2.5 h-4 w-4 text-muted" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-border bg-surface-muted pl-10 pr-4 py-2 text-xs text-foreground placeholder-muted outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-[11px] text-primary flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
              <span>Access is granted by your parent department and role.</span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50 transition shadow-lg shadow-primary/25"
            >
              {loading ? (
                "Authenticating…"
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
