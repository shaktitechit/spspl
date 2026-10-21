"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ListOrdersTabId } from "./listOrdersPageConfig";
import { normalizeWorkflowTabFromUrl } from "./orderWorkflowTabs";

type UseOrderListUrlStateOptions = {
  defaultTab: ListOrdersTabId;
  /** When true, `draft` is a valid URL tab (sales). */
  includeDraftTab?: boolean;
  normalizeTab?: (
    value: string | null,
    defaultTab: ListOrdersTabId,
  ) => ListOrdersTabId;
  /** Process queue from the URL path — `tab` / `by` are not synced to the query string. */
  processStageFromPath?: ListOrdersTabId;
};

function buildOrdersQueryString(params: {
  q: string;
  priority: string;
}): string {
  const next = new URLSearchParams();
  const q = params.q.trim();
  if (q) next.set("q", q);
  if (params.priority !== "all") next.set("priority", params.priority);
  const s = next.toString();
  return s ? `?${s}` : "";
}

function defaultNormalizeTab(
  value: string | null,
  defaultTab: ListOrdersTabId,
  includeDraftTab: boolean,
): ListOrdersTabId {
  if (includeDraftTab && value === "draft") return "draft";
  if (includeDraftTab && !value) return defaultTab;
  return normalizeWorkflowTabFromUrl(
    value,
    defaultTab === "draft" ? "all" : defaultTab,
  );
}

export function useOrderListUrlState({
  defaultTab,
  includeDraftTab = false,
  normalizeTab,
  processStageFromPath,
}: UseOrderListUrlStateOptions) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabFromUrl = searchParams.get("tab");
  const qFromUrl = searchParams.get("q") ?? "";
  const priorityFromUrl = searchParams.get("priority") ?? "all";

  const normalizeTabRef = useRef(normalizeTab);
  normalizeTabRef.current = normalizeTab;

  const resolveTab = useCallback(
    (value: string | null, fallback: ListOrdersTabId): ListOrdersTabId => {
      const custom = normalizeTabRef.current;
      if (custom) return custom(value, fallback);
      return defaultNormalizeTab(value, fallback, includeDraftTab);
    },
    [includeDraftTab],
  );

  const resolvedDefaultTab: ListOrdersTabId = defaultTab;

  const [activeTab, setActiveTabState] = useState<ListOrdersTabId>(() =>
    processStageFromPath ??
      resolveTab(tabFromUrl, resolvedDefaultTab),
  );
  const [searchQuery, setSearchQueryState] = useState(qFromUrl);
  const [priorityFilter, setPriorityFilterState] = useState(() =>
    priorityFromUrl === "all" ||
    priorityFromUrl === "low" ||
    priorityFromUrl === "normal" ||
    priorityFromUrl === "high" ||
    priorityFromUrl === "urgent"
      ? priorityFromUrl
      : "all",
  );
  const [dateFilter, setDateFilter] = useState("all");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const effectiveTab = processStageFromPath ?? activeTab;

  const replaceUrl = useCallback(
    (next: { q: string; priority: string }) => {
      const qs = buildOrdersQueryString(next);
      router.replace(`${pathname}${qs}`, { scroll: false });
    },
    [pathname, router],
  );

  useEffect(() => {
    if (processStageFromPath) return;
    const nextTab = resolveTab(tabFromUrl, resolvedDefaultTab);
    setActiveTabState((prev) => (prev === nextTab ? prev : nextTab));
  }, [processStageFromPath, tabFromUrl, resolvedDefaultTab, resolveTab]);

  const tabResetKey = processStageFromPath ?? `${tabFromUrl ?? ""}|${resolvedDefaultTab}`;
  const prevTabResetKeyRef = useRef(tabResetKey);
  useEffect(() => {
    if (prevTabResetKeyRef.current === tabResetKey) return;
    prevTabResetKeyRef.current = tabResetKey;
    setPriorityFilterState("all");
    setCurrentPage(1);
  }, [tabResetKey]);

  const prevQFromUrlRef = useRef(qFromUrl);
  useEffect(() => {
    setSearchQueryState((prev) => (prev === qFromUrl ? prev : qFromUrl));
    if (prevQFromUrlRef.current === qFromUrl) return;
    prevQFromUrlRef.current = qFromUrl;
    if (qFromUrl) setCurrentPage(1);
  }, [qFromUrl]);

  useEffect(() => {
    const fromUrl = searchParams.get("priority") ?? "all";
    if (
      fromUrl === "all" ||
      fromUrl === "low" ||
      fromUrl === "normal" ||
      fromUrl === "high" ||
      fromUrl === "urgent"
    ) {
      setPriorityFilterState((prev) => (prev === fromUrl ? prev : fromUrl));
    }
  }, [searchParams]);

  const setActiveTab = useCallback(
    (tab: ListOrdersTabId) => {
      if (processStageFromPath) return;
      setActiveTabState(tab);
      setCurrentPage(1);
      replaceUrl({ q: searchQuery, priority: priorityFilter });
    },
    [processStageFromPath, priorityFilter, replaceUrl, searchQuery],
  );

  const setSearchQuery = useCallback((val: string) => {
    setSearchQueryState(val);
    setCurrentPage(1);
  }, []);

  useEffect(() => {
    if (searchQuery === qFromUrl) return;
    const timer = window.setTimeout(() => {
      replaceUrl({ q: searchQuery, priority: priorityFilter });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [priorityFilter, qFromUrl, replaceUrl, searchQuery]);

  const setPriorityFilter = useCallback(
    (val: string) => {
      setPriorityFilterState(val);
      setCurrentPage(1);
      replaceUrl({ q: searchQuery, priority: val });
    },
    [replaceUrl, searchQuery],
  );

  const handleDateFilterChange = useCallback((val: string) => {
    setDateFilter(val);
    setCurrentPage(1);
  }, []);

  const handleCustomDateFromChange = useCallback((val: string) => {
    setCustomDateFrom(val);
    setCurrentPage(1);
  }, []);

  const handleCustomDateToChange = useCallback((val: string) => {
    setCustomDateTo(val);
    setCurrentPage(1);
  }, []);

  const handleResetFilters = useCallback(() => {
    setSearchQueryState("");
    if (!processStageFromPath) {
      setActiveTabState(resolvedDefaultTab);
    }
    setPriorityFilterState("all");
    setDateFilter("all");
    setCustomDateFrom("");
    setCustomDateTo("");
    setCurrentPage(1);
    replaceUrl({ q: "", priority: "all" });
  }, [processStageFromPath, replaceUrl, resolvedDefaultTab]);

  const showReset = useMemo(
    () =>
      !!searchQuery ||
      (!processStageFromPath && activeTab !== resolvedDefaultTab) ||
      priorityFilter !== "all" ||
      dateFilter !== "all",
    [
      activeTab,
      dateFilter,
      priorityFilter,
      processStageFromPath,
      resolvedDefaultTab,
      searchQuery,
    ],
  );

  return {
    activeTab: effectiveTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    priorityFilter,
    setPriorityFilter,
    dateFilter,
    handleDateFilterChange,
    customDateFrom,
    handleCustomDateFromChange,
    customDateTo,
    handleCustomDateToChange,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    handleResetFilters,
    showReset,
    resolvedDefaultTab,
  };
}
