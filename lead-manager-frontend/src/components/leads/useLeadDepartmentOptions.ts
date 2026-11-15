"use client";

import { useMemo } from "react";
import { useListLeadDepartmentsQuery } from "@/store/api";
import { LEAD_DEPARTMENT_OPTIONS } from "./leadUtils";

export type DepartmentOption = {
  value: string;
  label: string;
};

/**
 * Loads active Lead/Quotation departments from the backend LeadDepartment master,
 * falling back to the 6 default options while loading or if empty, and preserving
 * any extra department names already attached to an edited record.
 */
export function useLeadDepartmentOptions(extraSelected: string[] = []): {
  departmentOptions: DepartmentOption[];
  isLoading: boolean;
} {
  const { data, isLoading } = useListLeadDepartmentsQuery();

  const departmentOptions = useMemo(() => {
    const base: DepartmentOption[] =
      Array.isArray(data) && data.length > 0
        ? data
            .filter((d) => d.is_active !== false && Boolean(d.name?.trim()))
            .map((d) => ({ value: d.name.trim(), label: d.name.trim() }))
        : LEAD_DEPARTMENT_OPTIONS;

    const seen = new Set(base.map((o) => o.value.toLowerCase()));
    const merged = [...base];

    for (const raw of extraSelected) {
      const val = String(raw || "").trim();
      if (val && !seen.has(val.toLowerCase())) {
        seen.add(val.toLowerCase());
        merged.push({ value: val, label: val });
      }
    }

    return merged;
  }, [data, extraSelected]);

  return { departmentOptions, isLoading };
}
