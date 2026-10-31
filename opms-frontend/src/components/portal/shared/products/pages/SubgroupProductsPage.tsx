"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/lib/toast";
import {
  type ProductSubgroupRecord,
  useListProductSubgroupsQuery,
  useGetProductSubgroupProductsQuery,
  useAssociateProductSubgroupProductsMutation,
  useListProductsQuery,
  usePatchProductMutation,
} from "@/store/api";
import { useUnbilledVisibilityCatalog } from "@/components/portal/shared/products/useUnbilledVisibilityCatalog";
import { productRowShowInUnbilledList } from "@/components/portal/shared/products/productUnbilledVisibility";
import { PortalBusyOverlay } from "@/components/portal/shared/shell/PortalBusyOverlay";
import { ArrowLeft, Search, Plus, Trash2, Check, Package } from "lucide-react";

function extractId(val: any): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object" && (val._id || val.id)) return String(val._id || val.id);
  return String(val);
}

export type SubgroupProductsPageProps = {
  portalHome?: string;
};

export default function SubgroupProductsPage({
  portalHome = "/admin",
}: SubgroupProductsPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subgroupId = searchParams.get("subgroupId") || "";
  const subgroupName = searchParams.get("subgroupName") || "Subgroup";

  // Fetch all subgroups to resolve other subgroup mappings
  const { data: allSubgroupsData } = useListProductSubgroupsQuery({ limit: 1000 });
  const allSubgroups = useMemo(() => {
    return Array.isArray(allSubgroupsData?.data) ? (allSubgroupsData.data as ProductSubgroupRecord[]) : [];
  }, [allSubgroupsData]);

  const subgroupIdToNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of allSubgroups) {
      if (s?._id && s?.name) {
        map.set(String(s._id), s.name);
      }
    }
    return map;
  }, [allSubgroups]);

  const getProductOtherSubgroup = useCallback(
    (p: any): { _id?: string; name: string } | null => {
      if (!p) return null;
      const rawSubgroup = p.product_subgroup;
      if (!rawSubgroup) return null;

      let sId = "";
      let sName = "";

      if (typeof rawSubgroup === "object") {
        sId = extractId(rawSubgroup._id || rawSubgroup.id);
        sName = rawSubgroup.name || "";
      } else if (typeof rawSubgroup === "string") {
        const trimmed = rawSubgroup.trim();
        if (subgroupIdToNameMap.has(trimmed)) {
          sId = trimmed;
          sName = subgroupIdToNameMap.get(trimmed)!;
        } else {
          const found = allSubgroups.find(
            (s) => s.name.toLowerCase() === trimmed.toLowerCase() || String(s._id) === trimmed
          );
          if (found) {
            sId = String(found._id);
            sName = found.name;
          } else {
            sName = trimmed;
          }
        }
      }

      if (sId && !sName && subgroupIdToNameMap.has(sId)) {
        sName = subgroupIdToNameMap.get(sId)!;
      }

      if (!sName && !sId) return null;

      const isCurrent =
        (sId && sId === String(subgroupId)) ||
        (sName && sName.toLowerCase() === subgroupName.toLowerCase());
      if (isCurrent) return null;

      return { _id: sId, name: sName || "Other Subgroup" };
    },
    [allSubgroups, subgroupIdToNameMap, subgroupId, subgroupName]
  );

  // Fetch currently associated products
  const { data: currentProducts = [], isLoading: isLoadingCurrent, refetch } =
    useGetProductSubgroupProductsQuery(subgroupId, {
    skip: !subgroupId,
  });

  const currentIds = useMemo(() => {
    return new Set(currentProducts.map((p: any) => p._id));
  }, [currentProducts]);

  // Catalog search state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const { data: catalogData, isLoading: isLoadingCatalog } = useListProductsQuery({
    search: debouncedSearch,
    limit: "15",
  });

  const catalogProducts = useMemo(() => {
    if (!catalogData) return [];
    if (Array.isArray(catalogData)) return catalogData;
    if (catalogData && typeof catalogData === "object") {
      const o = catalogData as any;
      if (Array.isArray(o.items)) return o.items;
      if (Array.isArray(o.data)) return o.data;
    }
    return [];
  }, [catalogData]);

  const [associateProducts, { isLoading: isSavingAssociate }] =
    useAssociateProductSubgroupProductsMutation();
  const [patchProduct, { isLoading: isSavingPatch }] = usePatchProductMutation();
  const { catalog: visibilityCatalog } = useUnbilledVisibilityCatalog(Boolean(subgroupId));
  const isSaving = isSavingAssociate || isSavingPatch;

  const handleToggleUnbilled = async (productId: string, next: boolean) => {
    try {
      await patchProduct({
        id: productId,
        patch: { show_in_unbilled_order_list: next },
      }).unwrap();
      toast.success(next ? "Product included in Unbilled list" : "Product excluded from Unbilled list");
      refetch();
    } catch (err: unknown) {
      const e = err as { data?: { message?: string } };
      toast.error(e?.data?.message || "Failed to update product");
    }
  };

  const handleAddProduct = async (productId: string, otherSubgroup?: { name: string } | null) => {
    const existingIds = currentProducts.map((p: any) => p._id);
    if (existingIds.includes(productId)) return;

    try {
      await associateProducts({
        id: subgroupId,
        productIds: [...existingIds, productId],
      }).unwrap();
      if (otherSubgroup?.name) {
        toast.success(`Product transferred from "${otherSubgroup.name}" to "${subgroupName}"`);
      } else {
        toast.success("Product added to subgroup");
      }
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to add product");
    }
  };

  const handleRemoveProduct = async (productId: string) => {
    const existingIds = currentProducts.map((p: any) => p._id);
    try {
      await associateProducts({
        id: subgroupId,
        productIds: existingIds.filter((id: string) => id !== productId),
      }).unwrap();
      toast.success("Product removed from subgroup");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to remove product");
    }
  };

  const handleGoBack = () => {
    router.push(`${portalHome}/products?view=subgroups`);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleGoBack}
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/5 cursor-pointer"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Products under: <span className="text-blue-600 dark:text-blue-400">{subgroupName}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            View associated products or search the catalog to add items to this subgroup
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Side: Current Associations */}
        <div className="lg:col-span-7 space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900 overflow-hidden">
            <div className="border-b border-slate-100 p-4 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Package className="size-4 text-slate-400" />
                Associated Products ({currentProducts.length})
              </h2>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-[60vh] overflow-y-auto min-h-[300px]">
              {isLoadingCurrent ? (
                <div className="p-8 text-center text-xs text-slate-500">Loading associated products...</div>
              ) : currentProducts.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No products are currently associated with this subgroup.</div>
              ) : (
                currentProducts.map((p: Record<string, unknown>) => {
                  const id = String(p._id ?? "");
                  const showInUnbilled = productRowShowInUnbilledList(p, visibilityCatalog);
                  const otherSubgroup = getProductOtherSubgroup(p);
                  return (
                  <div key={id} className="flex items-center justify-between gap-2 p-3.5 hover:bg-slate-50/50 dark:hover:bg-white/[0.01]">
                    <div className="min-w-0 pr-2 flex-1">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{String(p.product_name ?? "")}</p>
                      <p className="text-2xs text-slate-400 truncate">
                        {p.sku ? `SKU: ${String(p.sku)} | ` : ""}
                        Base Price: ₹{String(p.base_price ?? "0.00")}
                      </p>
                      {otherSubgroup && (
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <span className="text-3xs font-medium text-amber-600 dark:text-amber-400">
                            Also mapped to:
                          </span>
                          <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-3xs font-medium text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
                            <Package className="size-2.5" />
                            {otherSubgroup.name}
                          </span>
                        </div>
                      )}
                    </div>
                    <label className="inline-flex shrink-0 items-center gap-1.5 text-2xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showInUnbilled}
                        disabled={isSaving}
                        onChange={(e) => handleToggleUnbilled(id, e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                      />
                      Unbilled list
                    </label>
                    <button
                      onClick={() => handleRemoveProduct(id)}
                      className="inline-flex shrink-0 items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 shadow-sm transition hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20 cursor-pointer"
                    >
                      <Trash2 className="size-3" />
                      Remove
                    </button>
                  </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Catalog Search and Add */}
        <div className="lg:col-span-5 space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900 overflow-hidden">
            <div className="border-b border-slate-100 p-4 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Add Products to Subgroup</h2>
            </div>

            <div className="p-4 border-b border-slate-100 dark:border-white/5">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search catalog products to add..."
                  className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 py-2 text-xs text-slate-800 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-955 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-[50vh] overflow-y-auto">
              {isLoadingCatalog ? (
                <div className="p-8 text-center text-xs text-slate-500">Searching catalog...</div>
              ) : catalogProducts.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No matching products found.</div>
              ) : (
                catalogProducts.map((p: any) => {
                  const isAssociated = currentIds.has(p._id);
                  const otherSubgroup = getProductOtherSubgroup(p);
                  return (
                    <div key={p._id} className="flex items-center justify-between p-3 hover:bg-slate-50/50 dark:hover:bg-white/[0.01]">
                      <div className="min-w-0 pr-4">
                        <p className="text-xs font-medium text-slate-900 dark:text-white truncate">{p.product_name}</p>
                        <p className="text-2xs text-slate-400 truncate">
                          {p.sku ? `SKU: ${p.sku} | ` : ""}
                          Base Price: ₹{String(p.base_price ?? "0.00")}
                        </p>
                        {otherSubgroup && (
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <span className="text-3xs font-medium text-amber-600 dark:text-amber-400">
                              Mapped to:
                            </span>
                            <span
                              className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-3xs font-medium text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
                              title={`Currently in subgroup "${otherSubgroup.name}"`}
                            >
                              <Package className="size-2.5" />
                              {otherSubgroup.name}
                            </span>
                          </div>
                        )}
                      </div>
                      {isAssociated ? (
                        <span className="inline-flex items-center gap-1 rounded bg-green-50 px-2 py-1 text-2xs font-semibold text-green-700 dark:bg-green-500/10 dark:text-green-400 shrink-0">
                          <Check className="size-2.5" />
                          Added
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAddProduct(p._id, otherSubgroup)}
                          title={
                            otherSubgroup
                              ? `Transfer product from "${otherSubgroup.name}" to "${subgroupName}"`
                              : "Add product to subgroup"
                          }
                          className="inline-flex items-center gap-1 rounded border border-blue-200 bg-white px-2 py-1 text-xs text-blue-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-blue-400 dark:hover:bg-white/5 cursor-pointer shrink-0"
                        >
                          <Plus className="size-3" />
                          {otherSubgroup ? "Transfer" : "Add"}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <PortalBusyOverlay active={isSaving} />
    </div>
  );
}
