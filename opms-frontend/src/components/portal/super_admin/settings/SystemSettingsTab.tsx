"use client";

import {
  Building2,
  Mail,
  Clock,
  Coins,
  FileDigit,
  AlertTriangle,
  Bell,
  Shield,
  CheckCircle2,
} from "lucide-react";
import type { SystemSettingsData } from "@/store/api";

export type SystemSettingsTabProps = {
  data: SystemSettingsData;
  onChange: (updated: SystemSettingsData) => void;
};

export function SystemSettingsTab({ data, onChange }: SystemSettingsTabProps) {
  const updateField = <K extends keyof SystemSettingsData>(
    key: K,
    val: SystemSettingsData[K]
  ) => {
    onChange({
      ...data,
      [key]: val,
    });
  };

  return (
    <div className="space-y-6">
      {/* Maintenance Mode Alert (when enabled) */}
      {data.maintenance_mode && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4.5 dark:border-amber-900/60 dark:bg-amber-950/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-300">
                System Maintenance Mode is Currently Active
              </h4>
              <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-300/80">
                Standard non-administrative users will see a maintenance notice upon login. Super Admin access remains unrestricted.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Group 1: General Platform Identity */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-1">
          <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          General Platform Identity & Localization
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          Global branding and regional operational parameters.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
              Platform Display Name
            </label>
            <input
              type="text"
              value={data.platform_name || ""}
              onChange={(e) => updateField("platform_name", e.target.value)}
              placeholder="e.g. Medica OPMS"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-slate-400" /> System Support Email
            </label>
            <input
              type="email"
              value={data.support_email || ""}
              onChange={(e) => updateField("support_email", e.target.value)}
              placeholder="support@medicaspl.com"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5 flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5 text-slate-400" /> Operational Currency
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={data.currency_symbol || "₹"}
                onChange={(e) => updateField("currency_symbol", e.target.value)}
                title="Currency Symbol"
                className="w-16 text-center rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <input
                type="text"
                value={data.currency || "INR"}
                onChange={(e) => updateField("currency", e.target.value)}
                placeholder="INR"
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-400" /> Timezone
            </label>
            <input
              type="text"
              value={data.timezone || "Asia/Kolkata"}
              onChange={(e) => updateField("timezone", e.target.value)}
              placeholder="Asia/Kolkata"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      {/* Group 2: Order Numbering & Sequences */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-1">
          <FileDigit className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Order Identifier Formatting
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          Controls the format used when auto-generating new order reference numbers.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
              Order Prefix
            </label>
            <input
              type="text"
              value={data.order_prefix || "ORD-"}
              onChange={(e) => updateField("order_prefix", e.target.value)}
              placeholder="e.g. ORD-, MED-"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <span className="text-2xs text-slate-500 dark:text-slate-400 mt-1 block">
              Sample output: <strong className="font-mono text-blue-600 dark:text-blue-400">{data.order_prefix || "ORD-"}10042{data.fiscal_year_suffix ? "/26-27" : ""}</strong>
            </span>
          </div>

          <div className="flex items-center pt-4">
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3.5 w-full dark:border-white/10 dark:bg-slate-800/40 cursor-pointer">
              <input
                type="checkbox"
                checked={data.fiscal_year_suffix ?? true}
                onChange={(e) => updateField("fiscal_year_suffix", e.target.checked)}
                className="mt-0.5 h-4.5 w-4.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                  Append Fiscal Year Suffix
                </span>
                <span className="text-2xs text-slate-500 dark:text-slate-400">
                  Automatically append financial year segment (e.g. /26-27) at the end of generated order IDs.
                </span>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Group 3: Maintenance & Security */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-1">
          <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Maintenance & Notification Controls
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          Platform-level operational status and dispatch alerts.
        </p>

        <div className="space-y-4">
          {/* Maintenance Mode Switch */}
          <div className="rounded-xl border border-slate-200 p-4 dark:border-white/10 dark:bg-slate-800/30">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100 block">
                  System Maintenance Mode
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Restrict portal write operations and display a maintenance notice for regular users.
                </span>
              </div>
              <button
                type="button"
                onClick={() => updateField("maintenance_mode", !data.maintenance_mode)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  data.maintenance_mode ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    data.maintenance_mode ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {data.maintenance_mode && (
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-white/10">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Custom Maintenance Message
                </label>
                <input
                  type="text"
                  value={data.maintenance_message || ""}
                  onChange={(e) => updateField("maintenance_message", e.target.value)}
                  placeholder="System is currently undergoing scheduled maintenance."
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            )}
          </div>

          {/* Session Timeout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 p-4 dark:border-white/10 dark:bg-slate-800/30">
              <label className="text-xs font-bold text-slate-900 dark:text-slate-100 block mb-1">
                Idle Session Timeout (Minutes)
              </label>
              <input
                type="number"
                min="30"
                max="1440"
                step="30"
                value={data.session_timeout_minutes || 480}
                onChange={(e) => updateField("session_timeout_minutes", Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <span className="text-2xs text-slate-500 dark:text-slate-400 mt-1 block">
                Standard: 480 mins (8 hours). Maximum: 1440 mins (24 hours).
              </span>
            </div>

            {/* Notification Toggles */}
            <div className="rounded-xl border border-slate-200 p-4 dark:border-white/10 dark:bg-slate-800/30 flex flex-col justify-around gap-2">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Bell className="h-3.5 w-3.5 text-blue-500" /> In-App Bell Notifications
                </span>
                <input
                  type="checkbox"
                  checked={data.in_app_notifications_enabled ?? true}
                  onChange={(e) => updateField("in_app_notifications_enabled", e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-emerald-500" /> Email Notifications
                </span>
                <input
                  type="checkbox"
                  checked={data.email_alerts_enabled ?? true}
                  onChange={(e) => updateField("email_alerts_enabled", e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

