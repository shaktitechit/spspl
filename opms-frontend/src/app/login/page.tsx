"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useId,
  useState,
} from "react";

import {
  isProtectedPortalPath,
  normalizeDeepLinkPath,
  resolveHomeFromUser,
  userAllowsPortalPath,
} from "@/constants/dashboardAccess";
import { MedicaLogo } from "@/components/MedicaLogo";
import { mutationRejectedMessage } from "@/lib/mutationMessages";
import { hasOpmsAccess } from "@/lib/opmsAuth";
import {
  applySessionAfterAuth,
  clearSessionMarks,
  persistSessionMarksFromAuth,
} from "@/lib/sessionCookie";
import { toast } from "@/lib/toast";
import {
  logout,
  medicaApi,
  useAppDispatch,
  useAppSelector,
  useLoginMutation,
} from "@/store";
import { useGetCompanyInfoQuery } from "@/store/api";

/**
 * Role workspace home when `from` is missing/outside portals; preserves ?query on `from`.
 */
function loginDestination(opts: {
  from: string | null | undefined;
  user: unknown | null;
}): string {
  const defaultHome = resolveHomeFromUser(opts.user) ?? "/admin";

  const rawFrom = opts.from?.trim();
  if (!rawFrom || !rawFrom.startsWith("/") || rawFrom.startsWith("//"))
    return defaultHome;

  const [pathPart, ...queryParts] = rawFrom.split("?");
  const queryRest = queryParts.length ? `?${queryParts.join("?")}` : "";
  const pathOnly = normalizeDeepLinkPath(pathPart ?? "");

  if (!pathOnly || !isProtectedPortalPath(pathOnly)) return defaultHome;

  if (userAllowsPortalPath({ pathname: pathOnly, user: opts.user })) {
    return `${pathOnly}${queryRest}`;
  }

  return defaultHome;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const token = useAppSelector((s) => s.auth.token);
  const refreshToken = useAppSelector((s) => s.auth.refreshToken);
  const refreshExpiresAt = useAppSelector((s) => s.auth.refreshExpiresAt);
  const user = useAppSelector((s) => s.auth.user);
  const from = searchParams.get("from");

  const emailId = useId();
  const passwordId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [login, { isLoading, reset }] = useLoginMutation();
  const { data: companyInfo } = useGetCompanyInfoQuery();

  const brandName =
    companyInfo?.trade_name?.trim() ||
    companyInfo?.legal_name?.trim() ||
    process.env.NEXT_PUBLIC_COMPANY_NAME?.trim() ||
    "Sign in";

  useEffect(() => {
    if (!token) return;
    if (!hasOpmsAccess(user)) {
      clearSessionMarks();
      dispatch(medicaApi.util.resetApiState());
      dispatch(logout());
      toast.error("No OPMS portal access assigned. Contact an administrator.");
      return;
    }
    persistSessionMarksFromAuth({ token, refreshToken, user, refreshExpiresAt });
    const dest = loginDestination({ from, user });
    if (typeof window !== "undefined") {
      window.location.href = dest;
    } else {
      router.replace(dest);
    }
  }, [token, refreshToken, refreshExpiresAt, user, from, router, dispatch]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      reset();
      const trimmed = email.trim();
      if (!trimmed || !password) {
        toast.error("Enter email and password.");
        return;
      }
      try {
        const data = await login({ email: trimmed, password }).unwrap();
        if (!hasOpmsAccess(data?.user)) {
          dispatch(medicaApi.util.resetApiState());
          dispatch(logout());
          clearSessionMarks();
          toast.error(
            "No OPMS portal access assigned. Contact an administrator.",
          );
          return;
        }
        applySessionAfterAuth();
        persistSessionMarksFromAuth({
          token: data?.token,
          refreshToken: data?.refreshToken,
          refreshExpiresAt: data?.refreshExpiresIn
            ? Date.now() + data.refreshExpiresIn * 1000
            : undefined,
          user: data?.user,
        });
        toast.success("Signed in");
        const dest = loginDestination({ from, user: data?.user });
        if (typeof window !== "undefined") {
          window.location.href = dest;
        } else {
          router.replace(dest);
        }
      } catch (rejected: unknown) {
        toast.error(mutationRejectedMessage(rejected));
      }
    },
    [email, password, from, login, reset, router, dispatch],
  );

  const onLogout = useCallback(() => {
    dispatch(medicaApi.util.resetApiState());
    dispatch(logout());
    clearSessionMarks();
    reset();
    toast.success("Session cleared");
  }, [dispatch, reset]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-100 px-4 py-12 dark:bg-slate-950">
      <div className="mb-10 flex flex-col items-center text-center">
        <Link
          href="/"
          className="inline-flex rounded-md ring-offset-4 ring-offset-slate-100 transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/55 dark:ring-offset-slate-950"
          aria-label={`${brandName} — home`}
        >
          <MedicaLogo priority className="justify-center" imgClassName="mx-auto max-h-12 max-w-[14rem]" />
        </Link>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          Sign in
        </h1>
      </div>

      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 rounded-xl border border-slate-200/90 bg-white p-6 shadow-md dark:border-white/10 dark:bg-slate-900"
      >
        <div className="space-y-1.5">
          <label
            htmlFor={emailId}
            className="text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            Email
          </label>
          <input
            id={emailId}
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-blue-600 focus:ring-2 focus:ring-blue-500/25 dark:border-white/15 dark:bg-slate-950 dark:text-slate-50"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor={passwordId}
            className="text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            Password
          </label>
          <input
            id={passwordId}
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-500/25 dark:border-white/15 dark:bg-slate-950 dark:text-slate-50"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-500 dark:shadow-none dark:hover:bg-blue-400"
        >
          {isLoading ? "Signing in…" : "Sign in"}
        </button>

        
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-slate-100 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-400">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
