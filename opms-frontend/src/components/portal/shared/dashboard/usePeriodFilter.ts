"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collectAvailableYears,
  type DashboardDataType,
} from "./periodFilterUtils";
import type { QtyBasis } from "./leaderboardUtils";
import {
  dateFilterToRange,
  orderMatchesDateFilter,
} from "../orders/list/orderListDateFilter";

function getCurrentPeriodDefaults() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth(),
  };
}

function sameNumbers(left: number[], right: number[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function usePeriodFilter<T = unknown>(
  orders: T[] = [],
  yearSource?: number[],
) {
  const [dataType, setDataType] = useState<DashboardDataType>("approved");
  const qtyBasis: QtyBasis = dataType === "billed" ? "dispatched" : "approved";

  const derivedYears = useMemo(
    () => collectAvailableYears(orders as unknown[], dataType),
    [orders, dataType],
  );
  const availableYears = yearSource?.length ? yearSource : derivedYears;
  const defaults = useMemo(() => getCurrentPeriodDefaults(), []);
  const [selectedYears, setSelectedYears] = useState<number[]>([defaults.year]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([defaults.month]);

  const [dateFilter, setDateFilter] = useState<string>("today");
  const [customDateFrom, setCustomDateFrom] = useState<string>("");
  const [customDateTo, setCustomDateTo] = useState<string>("");

  useEffect(() => {
    if (availableYears.length === 0) return;
    setSelectedYears((prev) => {
      const fallback = availableYears.includes(defaults.year)
        ? [defaults.year]
        : [availableYears[0]];
      if (prev.length === 0) return sameNumbers(prev, fallback) ? prev : fallback;
      const next = prev.filter((y) => availableYears.includes(y));
      const resolved = next.length > 0 ? next : fallback;
      return sameNumbers(prev, resolved) ? prev : resolved;
    });
  }, [availableYears, defaults.year]);

  const filteredOrders = useMemo(() => {
    return (orders as any[]).filter((o) => {
      const orderDateVal = o.order_date ?? o.created_at ?? o.createdAt;
      const billingDateVal = o.billing_date ?? o.dispatched_at ?? o.dispatch_date;

      if (dataType === "billed") {
        if (!billingDateVal) return false;
        if (dateFilter !== "all") {
          return orderMatchesDateFilter(
            { ...o, order_date: billingDateVal },
            dateFilter,
            customDateFrom,
            customDateTo,
          );
        }
        const yearSet = new Set(selectedYears);
        const monthSet = new Set(selectedMonths);
        const d = new Date(billingDateVal);
        if (Number.isNaN(d.getTime())) return false;
        return yearSet.has(d.getFullYear()) && monthSet.has(d.getMonth());
      }

      if (dateFilter !== "all") {
        return orderMatchesDateFilter(
          o,
          dateFilter,
          customDateFrom,
          customDateTo,
        );
      }
      const yearSet = new Set(selectedYears);
      const monthSet = new Set(selectedMonths);
      if (!orderDateVal) return false;
      const d = new Date(orderDateVal);
      if (Number.isNaN(d.getTime())) return false;
      return yearSet.has(d.getFullYear()) && monthSet.has(d.getMonth());
    });
  }, [orders, dateFilter, customDateFrom, customDateTo, selectedYears, selectedMonths, dataType]);

  return {
    dataType,
    setDataType,
    qtyBasis,
    availableYears,
    selectedYears,
    setSelectedYears,
    selectedMonths,
    setSelectedMonths,
    dateFilter,
    setDateFilter,
    customDateFrom,
    setCustomDateFrom,
    customDateTo,
    setCustomDateTo,
    filteredOrders,
  };
}

export function buildDashboardSummaryParams(input: {
  dataType: string;
  dateFilter: string;
  customDateFrom: string;
  customDateTo: string;
  selectedYears: number[];
  selectedMonths: number[];
}): Record<string, string> {
  const params: Record<string, string> = {
    dataType: input.dataType,
    dateFilter: input.dateFilter || "all",
    years: input.selectedYears.join(","),
    months: input.selectedMonths.join(","),
  };
  if (input.dateFilter && input.dateFilter !== "all") {
    const range = dateFilterToRange(
      input.dateFilter,
      input.customDateFrom,
      input.customDateTo,
    );
    if (range.dateFrom) params.dateFrom = range.dateFrom;
    if (range.dateTo) params.dateTo = range.dateTo;
  }
  return params;
}
