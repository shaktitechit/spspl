"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, Search } from "lucide-react";

export function getFieldText(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    const candidate =
      obj.name ??
      obj.product_name ??
      obj.brand_name ??
      obj.group_name ??
      obj.title ??
      obj.label ??
      obj.code ??
      obj._id;
    if (candidate !== undefined && candidate !== null && typeof candidate !== "object") {
      return String(candidate);
    }
  }
  return "";
}

export type CatalogProduct = {
  _id: string;
  product_name: unknown;
  sku?: unknown;
  brand?: unknown;
  base_price?: number;
  unit?: unknown;
  product_group?: unknown;
};

interface ProductSearchAutocompleteProps {
  products: CatalogProduct[];
  selectedId: string;
  onChange: (id: string, product?: CatalogProduct) => void;
  placeholder?: string;
  className?: string;
  showPrice?: boolean;
  onQuickAdd?: (searchName: string) => void;
}

/** Searchable autocomplete over catalog products for lead requirement rows. */
export function ProductSearchAutocomplete({
  products,
  selectedId,
  onChange,
  placeholder = "Search catalog product...",
  className = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white",
  showPrice = false,
  onQuickAdd,
}: ProductSearchAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedProduct = useMemo(() => {
    return products.find((p) => String(p._id) === String(selectedId));
  }, [products, selectedId]);

  useEffect(() => {
    if (selectedProduct) {
      const name = getFieldText(selectedProduct.product_name);
      const skuStr = getFieldText(selectedProduct.sku);
      const sku = skuStr ? ` (${skuStr})` : "";
      setSearch(`${name}${sku}`);
    } else {
      setSearch("");
    }
  }, [selectedProduct]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products.slice(0, 50);
    return products
      .filter((p) => {
        const name = getFieldText(p.product_name).toLowerCase();
        const sku = getFieldText(p.sku).toLowerCase();
        const brand = getFieldText(p.brand).toLowerCase();
        const group = getFieldText(p.product_group).toLowerCase();
        return name.includes(q) || sku.includes(q) || brand.includes(q) || group.includes(q);
      })
      .slice(0, 50);
  }, [products, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        if (selectedProduct) {
          const name = getFieldText(selectedProduct.product_name);
          const skuStr = getFieldText(selectedProduct.sku);
          const sku = skuStr ? ` (${skuStr})` : "";
          setSearch(`${name}${sku}`);
        } else {
          setSearch("");
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedProduct]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
            }
          }}
          placeholder={placeholder}
          className={`${className} pr-7`}
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-slate-400 dark:text-slate-500">
          <Search className="h-3.5 w-3.5" />
        </div>
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-white/10 dark:bg-slate-900">
          {filtered.length === 0 ? (
            <div className="space-y-1.5 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
              <p>No matching products in catalog</p>
              {onQuickAdd && (
                <button
                  type="button"
                  onClick={() => {
                    const nameToUse = search.trim();
                    setIsOpen(false);
                    onQuickAdd(nameToUse);
                  }}
                  className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-400 dark:hover:bg-blue-900/50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Quick Add Product {search.trim() ? `"${search.trim()}"` : ""}</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {filtered.map((p) => {
                const id = String(p._id);
                const name = getFieldText(p.product_name);
                const skuStr = getFieldText(p.sku);
                const brandStr = getFieldText(p.brand);
                const sku = skuStr ? ` (${skuStr})` : "";
                const brand = brandStr ? ` • ${brandStr}` : "";
                const price = showPrice && p.base_price ? ` • ₹${p.base_price}` : "";
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      onChange(id, p);
                      setIsOpen(false);
                    }}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-blue-50 dark:hover:bg-blue-950/40"
                  >
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {name}
                      <span className="font-normal text-slate-500 dark:text-slate-400">
                        {sku}
                        {brand}
                        {price}
                      </span>
                    </div>
                    {String(selectedId) === id && (
                      <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    )}
                  </button>
                );
              })}
              {onQuickAdd && (
                <div className="border-t border-slate-100 p-1 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      const nameToUse = search.trim();
                      setIsOpen(false);
                      onQuickAdd(nameToUse);
                    }}
                    className="flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Quick Add Product {search.trim() ? `"${search.trim()}"` : ""}</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
