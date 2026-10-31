"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/lib/toast";
import {
  type ProductBrandRecord,
  useListProductBrandsQuery,
  useGetProductBrandProductsQuery,
  useAssociateProductBrandProductsMutation,
  useListProductsQuery,
} from "@/store/api";
import { PortalBusyOverlay } from "@/components/portal/shared/shell/PortalBusyOverlay";
import { ArrowLeft, Search, Plus, Trash2, Check, Package } from "lucide-react";

function extractId(val: any): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object" && (val._id || val.id)) return String(val._id || val.id);
  return String(val);
}

export type BrandProductsPageProps = {
  portalHome?: string;
};

export default function BrandProductsPage({
  portalHome = "/admin",
}: BrandProductsPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const brandId = searchParams.get("brandId") || "";
  const brandName = searchParams.get("brandName") || "Brand";

  // Fetch all brands to resolve other brand mappings
  const { data: allBrandsData } = useListProductBrandsQuery({ limit: 1000 });
  const allBrands = useMemo(() => {
    return Array.isArray(allBrandsData?.data) ? (allBrandsData.data as ProductBrandRecord[]) : [];
  }, [allBrandsData]);

  const brandIdToNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of allBrands) {
      if (b?._id && b?.name) {
        map.set(String(b._id), b.name);
      }
    }
    return map;
  }, [allBrands]);

  const getProductOtherBrand = useCallback(
    (p: any): { _id?: string; name: string } | null => {
      if (!p) return null;
      const rawBrand = p.brand;
      if (!rawBrand) return null;

      let bId = "";
      let bName = "";

      if (typeof rawBrand === "object") {
        bId = extractId(rawBrand._id || rawBrand.id);
        bName = rawBrand.name || "";
      } else if (typeof rawBrand === "string") {
        const trimmed = rawBrand.trim();
        if (brandIdToNameMap.has(trimmed)) {
          bId = trimmed;
          bName = brandIdToNameMap.get(trimmed)!;
        } else {
          const found = allBrands.find(
            (b) => b.name.toLowerCase() === trimmed.toLowerCase() || String(b._id) === trimmed
          );
          if (found) {
            bId = String(found._id);
            bName = found.name;
          } else {
            bName = trimmed;
          }
        }
      }

      if (bId && !bName && brandIdToNameMap.has(bId)) {
        bName = brandIdToNameMap.get(bId)!;
      }

      if (!bName && !bId) return null;

      const isCurrent =
        (bId && bId === String(brandId)) ||
        (bName && bName.toLowerCase() === brandName.toLowerCase());
      if (isCurrent) return null;

      return { _id: bId, name: bName || "Other Brand" };
    },
    [allBrands, brandIdToNameMap, brandId, brandName]
  );

  // Fetch currently associated products
  const { data: currentProducts = [], isLoading: isLoadingCurrent } = useGetProductBrandProductsQuery(brandId, {
    skip: !brandId,
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

  const [associateProducts, { isLoading: isSaving }] = useAssociateProductBrandProductsMutation();

  const handleAddProduct = async (productId: string, otherBrand?: { name: string } | null) => {
    const existingIds = currentProducts.map((p: any) => p._id);
    if (existingIds.includes(productId)) return;

    try {
      await associateProducts({
        id: brandId,
        productIds: [...existingIds, productId],
      }).unwrap();
      if (otherBrand?.name) {
        toast.success(`Product transferred from "${otherBrand.name}" to "${brandName}"`);
      } else {
        toast.success("Product added to brand");
      }
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to add product");
    }
  };

  const handleRemoveProduct = async (productId: string) => {
    const existingIds = currentProducts.map((p: any) => p._id);
    try {
      await associateProducts({
        id: brandId,
        productIds: existingIds.filter((id: string) => id !== productId),
      }).unwrap();
      toast.success("Product removed from brand");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to remove product");
    }
  };

  const handleGoBack = () => {
    router.push(`${portalHome}/products?view=brands`);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleGoBack}
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 shadow-sm transition hover:bg-slate-55 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/5 cursor-pointer"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Products under: <span className="text-blue-600 dark:text-blue-400">{brandName}</span>
          </h1>
          <p className="text-xs text-slate-505 dark:text-slate-400">
            View associated products or search the catalog to add items to this brand
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
                <div className="p-8 text-center text-xs text-slate-500">No products are currently associated with this brand.</div>
              ) : (
                currentProducts.map((p: any) => {
                  const otherBrand = getProductOtherBrand(p);
                  return (
                    <div key={p._id} className="flex items-center justify-between p-3.5 hover:bg-slate-50/50 dark:hover:bg-white/[0.01]">
                      <div className="min-w-0 pr-4">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{p.product_name}</p>
                        <p className="text-2xs text-slate-400 truncate">
                          {p.sku ? `SKU: ${p.sku} | ` : ""}
                          Base Price: ₹{p.base_price || "0.00"}
                        </p>
                        {otherBrand && (
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <span className="text-3xs font-medium text-amber-600 dark:text-amber-400">
                              Also mapped to:
                            </span>
                            <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-3xs font-medium text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
                              <Package className="size-2.5" />
                              {otherBrand.name}
                            </span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveProduct(p._id)}
                        className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 shadow-sm transition hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20 cursor-pointer"
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
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Add Products to Brand</h2>
            </div>

            <div className="p-4 border-b border-slate-100 dark:border-white/5">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search catalog products to add..."
                  className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 py-2 text-xs text-slate-800 outline-none focus:border-blue-550 dark:border-white/10 dark:bg-slate-955 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-[50vh] overflow-y-auto">
              {isLoadingCatalog ? (
                <div className="p-8 text-center text-xs text-slate-505">Searching catalog...</div>
              ) : catalogProducts.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-505">No matching products found.</div>
              ) : (
                catalogProducts.map((p: any) => {
                  const isAssociated = currentIds.has(p._id);
                  const otherBrand = getProductOtherBrand(p);
                  return (
                    <div key={p._id} className="flex items-center justify-between p-3 hover:bg-slate-50/50 dark:hover:bg-white/[0.01]">
                      <div className="min-w-0 pr-4">
                        <p className="text-xs font-medium text-slate-900 dark:text-white truncate">{p.product_name}</p>
                        <p className="text-2xs text-slate-400 truncate">
                          {p.sku ? `SKU: ${p.sku} | ` : ""}
                          Base Price: ₹{p.base_price || "0.00"}
                        </p>
                        {otherBrand && (
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <span className="text-3xs font-medium text-amber-600 dark:text-amber-400">
                              Mapped to:
                            </span>
                            <span
                              className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-3xs font-medium text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
                              title={`Currently under brand "${otherBrand.name}"`}
                            >
                              <Package className="size-2.5" />
                              {otherBrand.name}
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
                          onClick={() => handleAddProduct(p._id, otherBrand)}
                          title={
                            otherBrand
                              ? `Transfer product from "${otherBrand.name}" to "${brandName}"`
                              : "Add product to brand"
                          }
                          className="inline-flex items-center gap-1 rounded border border-blue-200 bg-white px-2 py-1 text-xs text-blue-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-blue-400 dark:hover:bg-white/5 cursor-pointer shrink-0"
                        >
                          <Plus className="size-3" />
                          {otherBrand ? "Transfer" : "Add"}
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
