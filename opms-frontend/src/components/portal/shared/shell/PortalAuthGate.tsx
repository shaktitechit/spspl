"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { hasOpmsAccess } from "@/lib/opmsAuth";
import {
  isRefreshExpired,
  logoutOpmsSession,
  persistSessionMarksFromAuth,
} from "@/lib/sessionCookie";
import { usePushSubscription } from "@/lib/usePushSubscription";
import { logout, medicaApi, useAppDispatch, useAppSelector } from "@/store";

type PortalAuthGateProps = { children: ReactNode };

export function PortalAuthGate({ children }: PortalAuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const token = useAppSelector((s) => s.auth.token);
  const refreshToken = useAppSelector((s) => s.auth.refreshToken);
  const refreshExpiresAt = useAppSelector((s) => s.auth.refreshExpiresAt);
  const user = useAppSelector((s) => s.auth.user);
  const [mounted, setMounted] = useState(false);

  usePushSubscription(token);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (refreshExpiresAt != null && isRefreshExpired(refreshExpiresAt)) {
      dispatch(medicaApi.util.resetApiState());
      dispatch(logout());
      void logoutOpmsSession("/login");
      return;
    }
    if (!token) {
      const q = pathname ? `?from=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${q}`);
      return;
    }
    if (!hasOpmsAccess(user)) {
      dispatch(medicaApi.util.resetApiState());
      dispatch(logout());
      void logoutOpmsSession(
        pathname ? `/login?from=${encodeURIComponent(pathname)}` : "/login",
      );
      return;
    }
    persistSessionMarksFromAuth({ token, refreshToken, refreshExpiresAt, user });
  }, [token, refreshToken, refreshExpiresAt, user, pathname, router, mounted, dispatch]);

  if (!mounted) {
    return null;
  }

  if (!token || !hasOpmsAccess(user)) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-slate-100 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-400">
        <p>Redirecting to sign in…</p>
        <Link
          href="/login"
          className="text-blue-600 underline dark:text-blue-400"
        >
          Go to login
        </Link>
      </div>
    );
  }

  return children;
}

type PortalSectionPlaceholderProps = { portal: string; title: string };

export function PortalSectionPlaceholder({
  portal,
  title,
}: PortalSectionPlaceholderProps) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          {title}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Scaffold for{" "}
          <code className="rounded bg-slate-200/85 px-1 text-xs dark:bg-slate-800">
            /{portal}
          </code>{" "}
          — attach tables, filters, and actions to your APIs.
        </p>
      </div>
    </div>
  );
}
