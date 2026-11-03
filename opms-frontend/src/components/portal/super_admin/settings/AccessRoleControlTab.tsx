"use client";

import {
  Users,
  ShieldCheck,
  Check,
  Info,
  Package,
  BarChart3,
  Tag,
  Lock,
  Unlock,
  SlidersHorizontal,
  Layers,
  HelpCircle,
  Eye,
  Edit3,
} from "lucide-react";
import type { RoleAccessSettingsData } from "@/store/api";

export type AccessRoleControlTabProps = {
  data: RoleAccessSettingsData;
  onChange: (updated: RoleAccessSettingsData) => void;
};

export function AccessRoleControlTab({
  data,
  onChange,
}: AccessRoleControlTabProps) {
  const salesMapping = data.sales_mapping || {
    can_see_and_map_quantity: true,
    can_see_and_map_volume: false,
    can_see_and_map_price: false,
  };

  const toggleSalesPermission = (
    key: keyof typeof salesMapping
  ) => {
    onChange({
      ...data,
      sales_mapping: {
        ...salesMapping,
        [key]: !salesMapping[key],
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Context Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Role-Based Mapping & Visibility Access Control
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Configure field-level visibility and product mapping capabilities granted to the Sales role.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-2xs font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
            <Info className="h-3.5 w-3.5" /> Sales Role Policy
          </span>
        </div>

        {/* Roles Scope Summary Pills */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-blue-200/80 bg-blue-50/50 p-3 dark:border-blue-900/30 dark:bg-blue-950/20">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Target Role
              </span>
              <span className="rounded-md bg-blue-600 px-1.5 py-0.5 text-3xs font-extrabold text-white">
                Active
              </span>
            </div>
            <div className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
              Sales Rep
            </div>
            <div className="text-2xs text-slate-500 dark:text-slate-400">
              Customizable below
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/70 bg-slate-50/50 p-3 dark:border-white/5 dark:bg-slate-800/30">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">
                System Role
              </span>
              <span className="rounded-md bg-slate-200 px-1.5 py-0.5 text-3xs font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                Locked
              </span>
            </div>
            <div className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
              Coordinator
            </div>
            <div className="text-2xs text-slate-500 dark:text-slate-400">
              Full Operations Access
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/70 bg-slate-50/50 p-3 dark:border-white/5 dark:bg-slate-800/30">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">
                System Role
              </span>
              <span className="rounded-md bg-slate-200 px-1.5 py-0.5 text-3xs font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                Locked
              </span>
            </div>
            <div className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
              Admin
            </div>
            <div className="text-2xs text-slate-500 dark:text-slate-400">
              Full Mapping & Rates
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/70 bg-slate-50/50 p-3 dark:border-white/5 dark:bg-slate-800/30">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">
                System Role
              </span>
              <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-3xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                Root
              </span>
            </div>
            <div className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
              Super Admin
            </div>
            <div className="text-2xs text-slate-500 dark:text-slate-400">
              Unrestricted Authority
            </div>
          </div>
        </div>
      </div>

      {/* Main Controls Section: What Sales can see and map */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-slate-900">
        <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 dark:border-white/5">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Sales Role Visibility & Product Mapping Permissions
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Select which dimensions the Sales team is authorized to view and map on order line items and party mappings:
            </p>
          </div>
          <span className="text-2xs text-slate-400 dark:text-slate-500">
            3 Permissions Configured
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* 1. Quantity (Default: Enabled) */}
          <div
            onClick={() => toggleSalesPermission("can_see_and_map_quantity")}
            className={`relative flex flex-col justify-between rounded-xl border p-5 transition cursor-pointer select-none ${
              salesMapping.can_see_and_map_quantity
                ? "border-blue-500/80 bg-blue-50/30 shadow-xs dark:border-blue-500/40 dark:bg-blue-950/20"
                : "border-slate-200/90 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-slate-900/60 dark:hover:border-white/20"
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                    salesMapping.can_see_and_map_quantity
                      ? "bg-blue-600 text-white shadow-xs shadow-blue-600/30"
                      : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                  }`}
                >
                  <Package className="h-5 w-5" />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-3xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    Default
                  </span>
                  <div
                    className={`h-5 w-9 rounded-full transition-colors relative p-0.5 ${
                      salesMapping.can_see_and_map_quantity
                        ? "bg-blue-600"
                        : "bg-slate-200 dark:bg-slate-700"
                    }`}
                  >
                    <div
                      className={`h-4 w-4 rounded-full bg-white transition-transform ${
                        salesMapping.can_see_and_map_quantity
                          ? "translate-x-4"
                          : "translate-x-0"
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  1. Quantity
                </h4>
              </div>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Sales can see and map order item quantities, min/max limits, and Expected Order Quantity (EOQ).
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
              <span className="flex items-center gap-1 text-2xs text-slate-400 dark:text-slate-500">
                <Eye className="h-3 w-3" /> View & Map
              </span>
              <span
                className={`text-2xs font-extrabold ${
                  salesMapping.can_see_and_map_quantity
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {salesMapping.can_see_and_map_quantity
                  ? "Allowed (Default)"
                  : "Disabled"}
              </span>
            </div>
          </div>

          {/* 2. Volume */}
          <div
            onClick={() => toggleSalesPermission("can_see_and_map_volume")}
            className={`relative flex flex-col justify-between rounded-xl border p-5 transition cursor-pointer select-none ${
              salesMapping.can_see_and_map_volume
                ? "border-blue-500/80 bg-blue-50/30 shadow-xs dark:border-blue-500/40 dark:bg-blue-950/20"
                : "border-slate-200/90 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-slate-900/60 dark:hover:border-white/20"
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                    salesMapping.can_see_and_map_volume
                      ? "bg-blue-600 text-white shadow-xs shadow-blue-600/30"
                      : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                  }`}
                >
                  <BarChart3 className="h-5 w-5" />
                </div>

                <div className="flex items-center gap-1.5">
                  <div
                    className={`h-5 w-9 rounded-full transition-colors relative p-0.5 ${
                      salesMapping.can_see_and_map_volume
                        ? "bg-blue-600"
                        : "bg-slate-200 dark:bg-slate-700"
                    }`}
                  >
                    <div
                      className={`h-4 w-4 rounded-full bg-white transition-transform ${
                        salesMapping.can_see_and_map_volume
                          ? "translate-x-4"
                          : "translate-x-0"
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  2. Volume
                </h4>
              </div>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Sales can see commercial volume metrics and map volume tier thresholds across customer order lines.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
              <span className="flex items-center gap-1 text-2xs text-slate-400 dark:text-slate-500">
                <Layers className="h-3 w-3" /> Volume Tiers
              </span>
              <span
                className={`text-2xs font-extrabold ${
                  salesMapping.can_see_and_map_volume
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {salesMapping.can_see_and_map_volume
                  ? "Allowed"
                  : "Restricted (Admin Only)"}
              </span>
            </div>
          </div>

          {/* 3. Mapping Price */}
          <div
            onClick={() => toggleSalesPermission("can_see_and_map_price")}
            className={`relative flex flex-col justify-between rounded-xl border p-5 transition cursor-pointer select-none ${
              salesMapping.can_see_and_map_price
                ? "border-blue-500/80 bg-blue-50/30 shadow-xs dark:border-blue-500/40 dark:bg-blue-950/20"
                : "border-slate-200/90 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-slate-900/60 dark:hover:border-white/20"
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                    salesMapping.can_see_and_map_price
                      ? "bg-blue-600 text-white shadow-xs shadow-blue-600/30"
                      : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                  }`}
                >
                  <Tag className="h-5 w-5" />
                </div>

                <div className="flex items-center gap-1.5">
                  <div
                    className={`h-5 w-9 rounded-full transition-colors relative p-0.5 ${
                      salesMapping.can_see_and_map_price
                        ? "bg-blue-600"
                        : "bg-slate-200 dark:bg-slate-700"
                    }`}
                  >
                    <div
                      className={`h-4 w-4 rounded-full bg-white transition-transform ${
                        salesMapping.can_see_and_map_price
                          ? "translate-x-4"
                          : "translate-x-0"
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  3. Rate & Price Mapping
                </h4>
              </div>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Sales can see baseline price cards and map negotiated rates / prices directly via product price mapping modals.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
              <span className="flex items-center gap-1 text-2xs text-slate-400 dark:text-slate-500">
                <Edit3 className="h-3 w-3" /> Rate Card Mapping
              </span>
              <span
                className={`text-2xs font-extrabold ${
                  salesMapping.can_see_and_map_price
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {salesMapping.can_see_and_map_price
                  ? "Allowed"
                  : "Restricted (Admin Only)"}
              </span>
            </div>
          </div>
        </div>

        {/* Live Matrix Summary */}
        <div className="mt-6 rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-white/10 dark:bg-slate-800/40">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Active Sales Permission Status Matrix
          </h4>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400">
                  <th className="pb-2 font-semibold">Permission Target</th>
                  <th className="pb-2 font-semibold">Sales Can See</th>
                  <th className="pb-2 font-semibold">Sales Can Map</th>
                  <th className="pb-2 font-semibold">Access Policy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                <tr>
                  <td className="py-2.5 font-medium text-slate-900 dark:text-slate-100">
                    1. Quantity
                  </td>
                  <td className="py-2.5">
                    {salesMapping.can_see_and_map_quantity ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <Check className="h-3 w-3" /> Yes
                      </span>
                    ) : (
                      <span className="text-slate-400">Hidden</span>
                    )}
                  </td>
                  <td className="py-2.5">
                    {salesMapping.can_see_and_map_quantity ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <Check className="h-3 w-3" /> Yes (Default)
                      </span>
                    ) : (
                      <span className="text-slate-400">No</span>
                    )}
                  </td>
                  <td className="py-2.5">
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 text-2xs font-semibold ${
                        salesMapping.can_see_and_map_quantity
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                      }`}
                    >
                      {salesMapping.can_see_and_map_quantity
                        ? "Active (Standard)"
                        : "Restricted"}
                    </span>
                  </td>
                </tr>

                <tr>
                  <td className="py-2.5 font-medium text-slate-900 dark:text-slate-100">
                    2. Volume
                  </td>
                  <td className="py-2.5">
                    {salesMapping.can_see_and_map_volume ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <Check className="h-3 w-3" /> Yes
                      </span>
                    ) : (
                      <span className="text-slate-400">Hidden</span>
                    )}
                  </td>
                  <td className="py-2.5">
                    {salesMapping.can_see_and_map_volume ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <Check className="h-3 w-3" /> Yes
                      </span>
                    ) : (
                      <span className="text-slate-400">No</span>
                    )}
                  </td>
                  <td className="py-2.5">
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 text-2xs font-semibold ${
                        salesMapping.can_see_and_map_volume
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {salesMapping.can_see_and_map_volume
                        ? "Active"
                        : "Admin Only"}
                    </span>
                  </td>
                </tr>

                <tr>
                  <td className="py-2.5 font-medium text-slate-900 dark:text-slate-100">
                    3. Rate & Price Mapping
                  </td>
                  <td className="py-2.5">
                    {salesMapping.can_see_and_map_price ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <Check className="h-3 w-3" /> Yes
                      </span>
                    ) : (
                      <span className="text-slate-400">Hidden</span>
                    )}
                  </td>
                  <td className="py-2.5">
                    {salesMapping.can_see_and_map_price ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <Check className="h-3 w-3" /> Yes
                      </span>
                    ) : (
                      <span className="text-slate-400">No</span>
                    )}
                  </td>
                  <td className="py-2.5">
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 text-2xs font-semibold ${
                        salesMapping.can_see_and_map_price
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {salesMapping.can_see_and_map_price
                        ? "Active"
                        : "Admin Only"}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

