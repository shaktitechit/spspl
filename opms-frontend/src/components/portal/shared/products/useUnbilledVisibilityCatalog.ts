"use client";

import { useMemo } from "react";
import {
  useListProductGroupsQuery,
  useListProductSubgroupsQuery,
  useListProductsQuery,
} from "@/store/api";
import {
  buildUnbilledVisibilityCatalog,
  type UnbilledVisibilityCatalog,
} from "./productUnbilledVisibility";

function pickRows(data: unknown): unknown[] {
  if (!data || typeof data !== "object") return [];
  const o = data as Record<string, unknown>;
  if (Array.isArray(o.data)) return o.data;
  if (Array.isArray(o.items)) return o.items;
  return [];
}

/** Catalog maps for Unbilled Order product visibility (groups, subgroups, products). */
export function useUnbilledVisibilityCatalog(enabled = true): {
  catalog: UnbilledVisibilityCatalog;
  isLoading: boolean;
} {
  const { data: groupsData, isLoading: lg } = useListProductGroupsQuery(
    { limit: 5000 },
    { skip: !enabled },
  );
  const { data: subgroupsData, isLoading: ls } = useListProductSubgroupsQuery(
    { limit: 5000 },
    { skip: !enabled },
  );
  const { data: productsData, isLoading: lp } = useListProductsQuery(
    { limit: "5000", paginate: "false" },
    { skip: !enabled },
  );

  const catalog = useMemo(() => {
    let products: unknown[] = [];
    if (Array.isArray(productsData)) {
      products = productsData;
    } else {
      products = pickRows(productsData);
    }
    return buildUnbilledVisibilityCatalog({
      groups: pickRows(groupsData),
      subgroups: pickRows(subgroupsData),
      products,
    });
  }, [groupsData, subgroupsData, productsData]);

  return {
    catalog,
    isLoading: enabled && (lg || ls || lp),
  };
}
