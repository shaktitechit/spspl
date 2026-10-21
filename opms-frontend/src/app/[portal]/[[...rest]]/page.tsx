"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  PortalOverview,
  PortalSectionPlaceholder,
  ListTransportPlansPage,
  TransportPlanFormPage,
  TransportPlanDetailPage,
  TransportPlanCalendarPage,
  ListPartiesPage,
  ListProductsPage,
  PartyDetailPage,
  ProductDetailPage,
  AdminCreateOrderPage,
  FinanceCreateOrderPage,
  AccountCreateOrderPage,
  ListDriversPage,
  ListVehiclesPage,
  DriverDetailPage,
  VehicleDetailPage,
  ListTransportAgentsPage,
  TransportAgentDetailPage,
  SuperAdminOrderDetail,
  SuperAdminCreateOrderPage,
  ProfilePage,
} from "@/components/portal";
import CreateOrderPage from "@/components/portal/sales/CreateOrderPage";
import PortalOrdersRoute from "@/components/portal/shared/orders/list/PortalOrdersRoute";
import {
  type PortalKey,
  isPortalKey,
  resolvePortalPageTitle,
} from "@/constants/portalNav";
import { useAppSelector } from "@/store/hooks";
import { buildSsoLaunchUrl } from "@/lib/ssoHandoff";

function UserManagerEmbed({
  openSso,
  authToken,
}: {
  openSso: (baseUrl: string) => Promise<void>;
  authToken: string;
}) {
  const baseUserManagerUrl =
    process.env.NEXT_PUBLIC_USER_MANAGER_URL || "http://localhost:7004";
  const [iframeSrc, setIframeSrc] = useState(baseUserManagerUrl);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!authToken) {
        setIframeSrc(baseUserManagerUrl);
        return;
      }
      const url = await buildSsoLaunchUrl(baseUserManagerUrl, authToken);
      if (!cancelled) setIframeSrc(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [authToken, baseUserManagerUrl]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div>
          <h2 className="font-bold text-slate-900 dark:text-slate-100">User Management Micro-Frontend</h2>
          <p className="text-xs text-slate-500">
            Decoupled user-manager-frontend app active at{" "}
            <button
              type="button"
              onClick={() => void openSso(baseUserManagerUrl)}
              className="text-violet-600 underline"
            >
              {baseUserManagerUrl}
            </button>
          </p>
        </div>
        <button
          type="button"
          onClick={() => void openSso(baseUserManagerUrl)}
          className="rounded-lg bg-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-violet-700 transition"
        >
          Open Standalone Window ↗
        </button>
      </div>
      <iframe
        src={iframeSrc}
        title="User Manager Frontend"
        className="w-full h-[750px] rounded-2xl border border-slate-200 shadow-sm dark:border-white/10 bg-white dark:bg-slate-900"
      />
    </div>
  );
}

export default function PortalCatchAllPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const authToken = useAppSelector((state) => state.auth.token);

  const openSso = useCallback(
    async (baseUrl: string) => {
      if (!authToken) {
        window.open(baseUrl, "_blank");
        return;
      }
      const url = await buildSsoLaunchUrl(baseUrl, String(authToken));
      window.open(url, "_blank");
    },
    [authToken],
  );

  const raw =
    typeof params.portal === "string"
      ? params.portal
      : Array.isArray(params.portal)
        ? params.portal[0]
        : "";
  const portal: PortalKey = isPortalKey(raw) ? raw : "admin";

  const restRaw = params.rest;
  const restArr: string[] = Array.isArray(restRaw)
    ? restRaw
    : typeof restRaw === "string"
      ? [restRaw]
      : [];

  const title = resolvePortalPageTitle(portal, restArr);
  const workPlannerView = searchParams.get("view") || "plans";

  if (restArr.length === 0) {
    return <PortalOverview portal={portal} />;
  }

  // ── LEADS & QUOTATIONS (REDIRECT TO LEAD MANAGER MICRO-FRONTEND) ───────
  if (restArr[0] === "quotations" || restArr[0] === "leads") {
    const baseLeadManagerUrl = process.env.NEXT_PUBLIC_LEAD_MANAGER_URL || "http://localhost:7010";
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Lead Manager Micro-Frontend</h2>
            <p className="text-xs text-slate-500">
              Leads & Quotations are now managed in the decoupled Lead Manager Portal at{" "}
              <button
                type="button"
                onClick={() => void openSso(baseLeadManagerUrl)}
                className="text-orange-600 underline"
              >
                {baseLeadManagerUrl}
              </button>
            </p>
          </div>
          <button
            type="button"
            onClick={() => void openSso(baseLeadManagerUrl)}
            className="rounded-lg bg-orange-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-orange-700 transition"
          >
            Open Lead Manager Portal ↗
          </button>
        </div>
      </div>
    );
  }

  // ── ADMIN ────────────────────────────────────────────────────────────────
  if (portal === "admin" && restArr[0] === "orders" && restArr.length <= 2) {
    return <PortalOrdersRoute portalHome="/admin" stage={restArr[1]} />;
  }
  if (portal === "admin" && restArr.length === 1 && restArr[0] === "create-order") {
    return <AdminCreateOrderPage />;
  }

  if (portal === "admin" && restArr.length === 1 && restArr[0] === "parties") {
    return <ListPartiesPage portalHome="/admin" />;
  }
  if (portal === "admin" && restArr.length === 1 && restArr[0] === "products") {
    return <ListProductsPage portalHome="/admin" />;
  }
  if (portal === "admin" && restArr.length === 1 && restArr[0] === "transport-agents") {
    return <ListTransportAgentsPage portalHome="/admin" />;
  }
  if (portal === "admin" && restArr.length === 1 && restArr[0] === "transport-planner") {
    return <ListTransportPlansPage portalHome="/admin" />;
  }
  if (portal === "admin" && restArr.length === 2 && restArr[0] === "transport-planner" && restArr[1] === "calendar") {
    return <TransportPlanCalendarPage portalHome="/admin" />;
  }
  if (portal === "admin" && restArr.length === 2 && restArr[0] === "transport-planner" && restArr[1] === "new") {
    return <TransportPlanFormPage mode="create" portalHome="/admin" />;
  }
  if (
    portal === "admin" &&
    restArr.length === 3 &&
    restArr[0] === "transport-planner" &&
    restArr[2] === "edit"
  ) {
    return <TransportPlanFormPage mode="edit" planId={restArr[1]} portalHome="/admin" />;
  }
  if (portal === "admin" && restArr.length === 2 && restArr[0] === "transport-planner") {
    return <TransportPlanDetailPage planId={restArr[1]} portalHome="/admin" />;
  }

  // ── SALES ────────────────────────────────────────────────────────────────
  if (portal === "sales" && restArr.length === 1 && restArr[0] === "create-order") {
    return <CreateOrderPage />;
  }
  if (portal === "sales" && restArr[0] === "orders" && restArr.length <= 2) {
    return <PortalOrdersRoute portalHome="/sales" stage={restArr[1]} />;
  }


  // ── FINANCE ──────────────────────────────────────────────────────────────
  if (portal === "finance" && restArr[0] === "orders" && restArr.length <= 2) {
    return <PortalOrdersRoute portalHome="/finance" stage={restArr[1]} />;
  }
  if (portal === "finance" && restArr.length === 1 && restArr[0] === "create-order") {
    return <FinanceCreateOrderPage />;
  }

  if (portal === "finance" && restArr.length === 1 && restArr[0] === "parties") {
    return <ListPartiesPage portalHome="/finance" />;
  }
  if (portal === "finance" && restArr.length === 1 && restArr[0] === "products") {
    return <ListProductsPage portalHome="/finance" />;
  }
  if (portal === "finance" && restArr.length === 1 && restArr[0] === "transport-agents") {
    return <ListTransportAgentsPage portalHome="/finance" />;
  }
  if (portal === "finance" && restArr.length === 1 && restArr[0] === "transport-planner") {
    return <ListTransportPlansPage portalHome="/finance" />;
  }
  if (portal === "finance" && restArr.length === 2 && restArr[0] === "transport-planner" && restArr[1] === "calendar") {
    return <TransportPlanCalendarPage portalHome="/finance" />;
  }
  if (portal === "finance" && restArr.length === 2 && restArr[0] === "transport-planner" && restArr[1] === "new") {
    return <TransportPlanFormPage mode="create" portalHome="/finance" />;
  }
  if (
    portal === "finance" &&
    restArr.length === 3 &&
    restArr[0] === "transport-planner" &&
    restArr[2] === "edit"
  ) {
    return <TransportPlanFormPage mode="edit" planId={restArr[1]} portalHome="/finance" />;
  }
  if (portal === "finance" && restArr.length === 2 && restArr[0] === "transport-planner") {
    return <TransportPlanDetailPage planId={restArr[1]} portalHome="/finance" />;
  }

  // ── ACCOUNT ──────────────────────────────────────────────────────────────
  if (portal === "account" && restArr[0] === "orders" && restArr.length <= 2) {
    return <PortalOrdersRoute portalHome="/account" stage={restArr[1]} />;
  }
  if (portal === "account" && restArr.length === 1 && restArr[0] === "create-order") {
    return <AccountCreateOrderPage />;
  }
  if (portal === "account" && restArr.length === 1 && restArr[0] === "parties") {
    return <ListPartiesPage portalHome="/account" />;
  }
  if (portal === "account" && restArr.length === 1 && restArr[0] === "products") {
    return <ListProductsPage portalHome="/account" />;
  }
  if (portal === "account" && restArr.length === 1 && restArr[0] === "transport-agents") {
    return <ListTransportAgentsPage portalHome="/account" />;
  }
  if (portal === "account" && restArr.length === 1 && restArr[0] === "transport-planner") {
    return <ListTransportPlansPage portalHome="/account" />;
  }
  if (portal === "account" && restArr.length === 2 && restArr[0] === "transport-planner" && restArr[1] === "calendar") {
    return <TransportPlanCalendarPage portalHome="/account" />;
  }
  if (portal === "account" && restArr.length === 2 && restArr[0] === "transport-planner" && restArr[1] === "new") {
    return <TransportPlanFormPage mode="create" portalHome="/account" />;
  }
  if (
    portal === "account" &&
    restArr.length === 3 &&
    restArr[0] === "transport-planner" &&
    restArr[2] === "edit"
  ) {
    return <TransportPlanFormPage mode="edit" planId={restArr[1]} portalHome="/account" />;
  }
  if (portal === "account" && restArr.length === 2 && restArr[0] === "transport-planner") {
    return <TransportPlanDetailPage planId={restArr[1]} portalHome="/account" />;
  }

  // ── DISPATCH ─────────────────────────────────────────────────────────────
  if (portal === "dispatch" && restArr[0] === "orders" && restArr.length <= 2) {
    return <PortalOrdersRoute portalHome="/dispatch" stage={restArr[1]} />;
  }
  if (portal === "dispatch" && restArr.length === 1 && restArr[0] === "drivers") {
    return <ListDriversPage />;
  }
  if (portal === "dispatch" && restArr.length === 1 && restArr[0] === "vehicles") {
    return <ListVehiclesPage />;
  }
  if (portal === "dispatch" && restArr.length === 1 && restArr[0] === "transport-agents") {
    return <ListTransportAgentsPage />;
  }
  if (portal === "dispatch" && restArr.length === 1 && restArr[0] === "transport-planner") {
    return <ListTransportPlansPage portalHome="/dispatch" />;
  }
  if (portal === "dispatch" && restArr.length === 2 && restArr[0] === "transport-planner" && restArr[1] === "calendar") {
    return <TransportPlanCalendarPage portalHome="/dispatch" />;
  }
  if (portal === "dispatch" && restArr.length === 2 && restArr[0] === "transport-planner") {
    return <TransportPlanDetailPage planId={restArr[1]} portalHome="/dispatch" />;
  }
  if (portal === "dispatch" && restArr.length === 2 && restArr[0] === "vehicles") {
    return <VehicleDetailPage id={restArr[1]} />;
  }
  if (portal === "dispatch" && restArr.length === 2 && restArr[0] === "drivers") {
    return <DriverDetailPage id={restArr[1]} />;
  }
  if (portal === "dispatch" && restArr.length === 2 && restArr[0] === "transport-agents") {
    return <TransportAgentDetailPage id={restArr[1]} />;
  }

  // ── SUPER ADMIN ──────────────────────────────────────────────────────────
  if (portal === "super_admin" && restArr[0] === "orders" && restArr.length <= 2) {
    return <PortalOrdersRoute portalHome="/super_admin" stage={restArr[1]} />;
  }
  if (portal === "super_admin" && restArr.length === 1 && restArr[0] === "create-order") {
    return <SuperAdminCreateOrderPage />;
  }

  if (portal === "super_admin" && restArr.length === 2 && restArr[0] === "order") {
    return <SuperAdminOrderDetail orderId={restArr[1]} />;
  }
  if (portal === "super_admin" && restArr.length === 1 && restArr[0] === "users") {
    return <UserManagerEmbed openSso={openSso} authToken={authToken ? String(authToken) : ""} />;
  }
  if (portal === "super_admin" && restArr.length === 1 && restArr[0] === "parties") {
    return <ListPartiesPage portalHome="/super_admin" />;
  }
  if (portal === "super_admin" && restArr.length === 1 && restArr[0] === "products") {
    return <ListProductsPage portalHome="/super_admin" />;
  }
  if (portal === "super_admin" && restArr.length === 1 && restArr[0] === "transport-agents") {
    return <ListTransportAgentsPage portalHome="/super_admin" />;
  }
  if (portal === "super_admin" && restArr.length === 1 && restArr[0] === "transport-planner") {
    return <ListTransportPlansPage portalHome="/super_admin" />;
  }
  if (portal === "super_admin" && restArr.length === 2 && restArr[0] === "transport-planner" && restArr[1] === "calendar") {
    return <TransportPlanCalendarPage portalHome="/super_admin" />;
  }
  if (portal === "super_admin" && restArr.length === 2 && restArr[0] === "transport-planner" && restArr[1] === "new") {
    return <TransportPlanFormPage mode="create" portalHome="/super_admin" />;
  }
  if (
    portal === "super_admin" &&
    restArr.length === 3 &&
    restArr[0] === "transport-planner" &&
    restArr[2] === "edit"
  ) {
    return <TransportPlanFormPage mode="edit" planId={restArr[1]} portalHome="/super_admin" />;
  }
  if (portal === "super_admin" && restArr.length === 2 && restArr[0] === "transport-planner") {
    return <TransportPlanDetailPage planId={restArr[1]} portalHome="/super_admin" />;
  }
  if (portal === "super_admin" && restArr.length === 2 && restArr[0] === "parties") {
    return <PartyDetailPage id={restArr[1]} portalHome="/super_admin" />;
  }
  if (portal === "super_admin" && restArr.length === 2 && restArr[0] === "products") {
    return <ProductDetailPage id={restArr[1]} portalHome="/super_admin" />;
  }

  // ── SHARED DETAIL PAGES ──────────────────────────────────────────────────
  if (
    (portal === "admin" || portal === "finance" || portal === "account" || portal === "super_admin") &&
    restArr.length === 2 && restArr[0] === "parties"
  ) {
    return <PartyDetailPage id={restArr[1]} portalHome={`/${portal}`} />;
  }
  if (
    (portal === "admin" || portal === "finance" || portal === "account" || portal === "super_admin") &&
    restArr.length === 2 && restArr[0] === "products"
  ) {
    return <ProductDetailPage id={restArr[1]} portalHome={`/${portal}`} />;
  }
  if (
    (portal === "admin" || portal === "finance" || portal === "account" || portal === "super_admin") &&
    restArr.length === 2 && restArr[0] === "transport-agents"
  ) {
    return <TransportAgentDetailPage id={restArr[1]} portalHome={`/${portal}`} />;
  }

  if (restArr.length === 1 && restArr[0] === "profile") {
    return <ProfilePage />;
  }

  return <PortalSectionPlaceholder portal={portal} title={title} />;
}
