"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Settings,
  Sliders,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  SlidersHorizontal,
  ShieldAlert,
  Users,
} from "lucide-react";
import {
  useGetPortalSettingsQuery,
  useUpdatePortalSettingsMutation,
  type PortalSettingsData,
  type SystemSettingsData,
  type WorkflowSettingsData,
  type RoleAccessSettingsData,
} from "@/store/api";
import { SystemSettingsTab } from "./SystemSettingsTab";
import { WorkflowManagementTab } from "./WorkflowManagementTab";
import { AccessRoleControlTab } from "./AccessRoleControlTab";
import { toast } from "@/lib/toast";

type TabId = "system" | "workflow" | "access_control";

const DEFAULT_SYSTEM_SETTINGS: SystemSettingsData = {
  platform_name: "Medica OPMS",
  support_email: "support@medicaspl.com",
  currency: "INR",
  currency_symbol: "₹",
  timezone: "Asia/Kolkata",
  order_prefix: "ORD-",
  fiscal_year_suffix: true,
  maintenance_mode: false,
  maintenance_message: "System is currently undergoing scheduled maintenance.",
  session_timeout_minutes: 480,
  email_alerts_enabled: true,
  in_app_notifications_enabled: true,
};

const DEFAULT_WORKFLOW_SETTINGS: WorkflowSettingsData = {
  performa_invoice_enabled: true,
  cost_sheet_enabled: true,
  kyc_verification_enabled: true,
  purchase_order_enabled: true,
  buy_back_enabled: false,
  buy_back_config: {
    require_inspection: true,
    auto_credit_ledger: false,
    default_valuation_rate: 30,
    terms: "Buy Back is subject to technical inspection and serial verification.",
  },
};

const DEFAULT_ROLE_ACCESS_SETTINGS: RoleAccessSettingsData = {
  sales_mapping: {
    can_see_and_map_quantity: true,
    can_see_and_map_volume: false,
    can_see_and_map_price: false,
  },
};

export default function SuperAdminSettingsPage() {
  const { data: serverSettings, isLoading, isFetching, refetch } =
    useGetPortalSettingsQuery();
  const [updateSettings, { isLoading: isSaving }] =
    useUpdatePortalSettingsMutation();

  const [activeTab, setActiveTab] = useState<TabId>("workflow");
  const [systemState, setSystemState] = useState<SystemSettingsData>(
    DEFAULT_SYSTEM_SETTINGS
  );
  const [workflowState, setWorkflowState] = useState<WorkflowSettingsData>(
    DEFAULT_WORKFLOW_SETTINGS
  );
  const [roleAccessState, setRoleAccessState] =
    useState<RoleAccessSettingsData>(DEFAULT_ROLE_ACCESS_SETTINGS);

  // Sync state when server data is loaded
  useEffect(() => {
    if (serverSettings) {
      if (serverSettings.system_settings) {
        setSystemState({
          ...DEFAULT_SYSTEM_SETTINGS,
          ...serverSettings.system_settings,
        });
      }
      if (serverSettings.workflow_settings) {
        setWorkflowState({
          ...DEFAULT_WORKFLOW_SETTINGS,
          ...serverSettings.workflow_settings,
          buy_back_config: {
            ...DEFAULT_WORKFLOW_SETTINGS.buy_back_config!,
            ...(serverSettings.workflow_settings.buy_back_config || {}),
          },
        });
      }
      if (serverSettings.role_access_settings) {
        setRoleAccessState({
          ...DEFAULT_ROLE_ACCESS_SETTINGS,
          ...serverSettings.role_access_settings,
          sales_mapping: {
            ...DEFAULT_ROLE_ACCESS_SETTINGS.sales_mapping,
            ...(serverSettings.role_access_settings.sales_mapping || {}),
          },
        });
      }
    }
  }, [serverSettings]);

  // Compute dirty / unsaved changes state
  const isDirty = useMemo(() => {
    if (!serverSettings) return false;
    const initialSys = {
      ...DEFAULT_SYSTEM_SETTINGS,
      ...(serverSettings.system_settings || {}),
    };
    const initialWf = {
      ...DEFAULT_WORKFLOW_SETTINGS,
      ...(serverSettings.workflow_settings || {}),
      buy_back_config: {
        ...DEFAULT_WORKFLOW_SETTINGS.buy_back_config!,
        ...(serverSettings.workflow_settings?.buy_back_config || {}),
      },
    };
    const initialRa = {
      ...DEFAULT_ROLE_ACCESS_SETTINGS,
      ...(serverSettings.role_access_settings || {}),
      sales_mapping: {
        ...DEFAULT_ROLE_ACCESS_SETTINGS.sales_mapping,
        ...(serverSettings.role_access_settings?.sales_mapping || {}),
      },
    };

    return (
      JSON.stringify(systemState) !== JSON.stringify(initialSys) ||
      JSON.stringify(workflowState) !== JSON.stringify(initialWf) ||
      JSON.stringify(roleAccessState) !== JSON.stringify(initialRa)
    );
  }, [serverSettings, systemState, workflowState, roleAccessState]);

  const handleDiscard = () => {
    if (serverSettings) {
      setSystemState({
        ...DEFAULT_SYSTEM_SETTINGS,
        ...(serverSettings.system_settings || {}),
      });
      setWorkflowState({
        ...DEFAULT_WORKFLOW_SETTINGS,
        ...(serverSettings.workflow_settings || {}),
        buy_back_config: {
          ...DEFAULT_WORKFLOW_SETTINGS.buy_back_config!,
          ...(serverSettings.workflow_settings?.buy_back_config || {}),
        },
      });
      setRoleAccessState({
        ...DEFAULT_ROLE_ACCESS_SETTINGS,
        ...(serverSettings.role_access_settings || {}),
        sales_mapping: {
          ...DEFAULT_ROLE_ACCESS_SETTINGS.sales_mapping,
          ...(serverSettings.role_access_settings?.sales_mapping || {}),
        },
      });
      toast("Changes discarded", { icon: "↩️" });
    }
  };

  const handleResetDefaults = () => {
    if (
      window.confirm(
        "Are you sure you want to reset all portal & workflow settings to factory defaults?"
      )
    ) {
      setSystemState(DEFAULT_SYSTEM_SETTINGS);
      setWorkflowState(DEFAULT_WORKFLOW_SETTINGS);
      setRoleAccessState(DEFAULT_ROLE_ACCESS_SETTINGS);
      toast("Reset to defaults. Click 'Save Changes' to commit.", {
        icon: "🔄",
      });
    }
  };

  const handleSave = async () => {
    try {
      await updateSettings({
        system_settings: systemState,
        workflow_settings: workflowState,
        role_access_settings: roleAccessState,
      }).unwrap();
      toast.success("Portal settings saved successfully!");
    } catch (err: any) {
      toast.error(
        err?.data?.message || err?.error || "Failed to update portal settings"
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
          Loading Super Admin portal settings...
        </p>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-140px)] pb-24">
      {/* Top Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Link
              href="/super_admin"
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Super Admin Console
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/20">
              <Settings className="h-5 w-5" />
            </div>
            Super Admin Portal Settings
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Configure system-wide parameters and toggle core order verification & workflow stages.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-slate-500 dark:text-slate-400 ${
                isFetching ? "animate-spin" : ""
              }`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="mb-6 flex border-b border-slate-200 dark:border-white/10">
        <button
          type="button"
          onClick={() => setActiveTab("workflow")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition cursor-pointer ${
            activeTab === "workflow"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Workflow Management
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-2xs font-extrabold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            5 Modules
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("access_control")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition cursor-pointer ${
            activeTab === "access_control"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Users className="h-4 w-4" />
          Access Role Control
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-2xs font-extrabold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
            Sales Policy
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("system")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition cursor-pointer ${
            activeTab === "system"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Settings className="h-4 w-4" />
          System Settings
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "workflow" ? (
        <WorkflowManagementTab
          data={workflowState}
          onChange={setWorkflowState}
        />
      ) : activeTab === "access_control" ? (
        <AccessRoleControlTab
          data={roleAccessState}
          onChange={setRoleAccessState}
        />
      ) : (
        <SystemSettingsTab
          data={systemState}
          onChange={setSystemState}
        />
      )}

      {/* Floating Sticky Save / Action Bar */}
      <div
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white/95 px-5 py-3 shadow-xl backdrop-blur-md transition-all duration-300 dark:border-white/10 dark:bg-slate-900/95 w-[92%] max-w-3xl ${
          isDirty ? "translate-y-0 opacity-100" : "translate-y-2 opacity-90"
        }`}
      >
        <div className="flex items-center gap-2">
          {isDirty ? (
            <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
              Unsaved changes detected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> All settings synchronized
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Reset Defaults
          </button>

          {isDirty && (
            <button
              type="button"
              onClick={handleDiscard}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Discard
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!isDirty || isSaving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
