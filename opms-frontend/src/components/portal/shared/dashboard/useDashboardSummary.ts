"use client";

import { useEffect, useMemo, useState } from "react";

import { useGetDashboardOrdersSummaryQuery } from "@/store/api";

import {
  buildDashboardSummaryParams,
  usePeriodFilter,
} from "./usePeriodFilter";

const EMPTY_ORDERS: never[] = [];

/** Period controls plus the aggregated dashboard payload for that period. */
export function useDashboardSummary() {
  const [yearSource, setYearSource] = useState<number[] | undefined>(undefined);
  const period = usePeriodFilter(EMPTY_ORDERS, yearSource);
  const {
    dataType,
    dateFilter,
    customDateFrom,
    customDateTo,
    selectedYears,
    selectedMonths,
  } = period;

  const params = useMemo(
    () =>
      buildDashboardSummaryParams({
        dataType,
        dateFilter,
        customDateFrom,
        customDateTo,
        selectedYears,
        selectedMonths,
      }),
    [
      customDateFrom,
      customDateTo,
      dataType,
      dateFilter,
      selectedMonths,
      selectedYears,
    ],
  );

  const query = useGetDashboardOrdersSummaryQuery(params);

  useEffect(() => {
    const years = query.data?.availableYears;
    if (!years?.length) return;
    setYearSource((prev) =>
      prev && prev.join(",") === years.join(",") ? prev : years,
    );
  }, [query.data?.availableYears]);

  return {
    ...period,
    summary: query.data,
    isFetching: query.isFetching,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
