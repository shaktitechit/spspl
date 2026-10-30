"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  mutationRejectedMessage,
  mutationSuccessCopy,
} from "@/lib/mutationMessages";
import { toast } from "@/lib/toast";
import {
  useCreateProductMutation,
  useGetProductQuery,
  usePatchProductMutation,
  useGetProductMetaOptionsQuery,
} from "@/store/api";
import { productRefLabel } from "@/lib/productRefLabel";
import { LargeModalPortal } from "@/components/portal/shared/LargeModalPortal";
import { Plus } from "lucide-react";
import ProductGroupDetailModal from "./ProductGroupDetailModal";
import ProductSubgroupDetailModal from "./ProductSubgroupDetailModal";
import ProductBrandDetailModal from "./ProductBrandDetailModal";
import ProductManufacturerDetailModal from "./ProductManufacturerDetailModal";
import ProductUnitDetailModal from "./ProductUnitDetailModal";

export type ProductDetailModalProps = {
  productId: string | null;
  create?: boolean;
  open?: boolean;
  initialName?: string;
  /** When creating, load this product's fields into the form (new record on save). */
  duplicateFromId?: string | null;
  onSuccess?: (product: Record<string, unknown>) => void;
  onClose: () => void;
};

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-500/25 dark:border-white/15 dark:bg-slate-950 dark:text-slate-50";
const labelClass = "text-xs font-medium text-slate-700 dark:text-slate-300";
const btnSecondaryClass =
  "rounded-lg border border-slate-200/95 px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:text-slate-100 dark:hover:bg-white/5";

const PRODUCT_TYPE_OPTIONS = ["individual", "kit"] as const;

function stringField(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function numField(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "";
}

function valsEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (
    (a === null || a === undefined || a === "") &&
    (b === null || b === undefined || b === "")
  )
    return true;
  return false;
}

type ProductState = {
  product_name: string;
  product_type: "individual" | "kit";
  generic_name: string;
  sku: string;
  product_group: string;
  product_subgroup: string;
  brand: string;
  manufacturer: string;
  unit: string;
  base_price: string;
  minimum_sale_rate: string;
  mrp: string;
  gst_percent: string;
  warranty_months: string;
  unit_weight_kg: string;
  units_per_box: string;
  description: string;
  aliases: string; // Comma separated
  tags: string; // Comma separated
  is_active: boolean;
  is_featured: boolean;
};

const defaultProductState = (): ProductState => ({
  product_name: "",
  product_type: "individual",
  generic_name: "",
  sku: "",
  product_group: "",
  product_subgroup: "",
  brand: "",
  manufacturer: "",
  unit: "Pcs",
  base_price: "",
  minimum_sale_rate: "",
  mrp: "",
  gst_percent: "18",
  warranty_months: "0",
  unit_weight_kg: "",
  units_per_box: "",
  description: "",
  aliases: "",
  tags: "",
  is_active: true,
  is_featured: false,
});

function productToFormState(
  p: Record<string, unknown>,
  opts?: { asCopy?: boolean },
): ProductState {
  const als = Array.isArray(p.aliases) ? (p.aliases as string[]).join(", ") : "";
  const tgs = Array.isArray(p.tags) ? (p.tags as string[]).join(", ") : "";
  const baseName = stringField(p.product_name);
  return {
    product_name: opts?.asCopy && baseName ? `${baseName} (Copy)` : baseName,
    product_type: PRODUCT_TYPE_OPTIONS.includes(
      p.product_type as (typeof PRODUCT_TYPE_OPTIONS)[number],
    )
      ? (p.product_type as ProductState["product_type"])
      : "individual",
    generic_name: stringField(p.generic_name),
    // Clear SKU on duplicate so the new product can get a unique code
    sku: opts?.asCopy ? "" : stringField(p.sku),
    product_group: productRefLabel(p.product_group),
    product_subgroup: productRefLabel(p.product_subgroup),
    brand: productRefLabel(p.brand),
    manufacturer: productRefLabel(p.manufacturer),
    unit: productRefLabel(p.unit) || "Pcs",
    base_price: numField(p.base_price),
    minimum_sale_rate: numField(p.minimum_sale_rate),
    mrp: numField(p.mrp),
    gst_percent: numField(p.gst_percent ?? 18),
    warranty_months: numField(p.warranty_months ?? 0),
    unit_weight_kg: numField(p.unit_weight_kg),
    units_per_box: numField(p.units_per_box),
    description: stringField(p.description),
    aliases: als,
    tags: tgs,
    is_active: p.is_active !== false,
    is_featured: p.is_featured === true,
  };
}

export function ProductDetailModal({
  productId,
  create = false,
  open,
  initialName,
  duplicateFromId = null,
  onSuccess,
  onClose,
}: ProductDetailModalProps) {
  const isEditing = !create && productId != null && productId !== "";
  const isDuplicating = create && !!duplicateFromId;
  const show = (open ?? true) && (create || isEditing);
  const sourceProductId = isEditing
    ? (productId ?? "")
    : isDuplicating
      ? (duplicateFromId ?? "")
      : "";

  // Query details — edit loads productId; duplicate create loads the source product
  const { data: rawProduct, isFetching } = useGetProductQuery(sourceProductId, {
    skip: !sourceProductId,
  });

  const [createProduct, { isLoading: isCreating }] = useCreateProductMutation();
  const [patchProduct, { isLoading: isPatching }] = usePatchProductMutation();
  const { data: metaOptions } = useGetProductMetaOptionsQuery(undefined, { skip: !show });
  const isSaving = isCreating || isPatching;

  // Local Form state
  const [form, setForm] = useState<ProductState>(defaultProductState());
  const [activeTab, setActiveTab] = useState<"basic" | "commercial">("basic");
  const [quickGroupOpen, setQuickGroupOpen] = useState(false);
  const [quickSubgroupOpen, setQuickSubgroupOpen] = useState(false);
  const [quickBrandOpen, setQuickBrandOpen] = useState(false);
  const [quickManufacturerOpen, setQuickManufacturerOpen] = useState(false);
  const [quickUnitOpen, setQuickUnitOpen] = useState(false);

  const selectedGroupId = useMemo(() => {
    const name = form.product_group.trim().toLowerCase();
    if (!name || !metaOptions?.groups?.length) return "";
    const match = metaOptions.groups.find(
      (g) => g.name.trim().toLowerCase() === name,
    );
    return match?._id ?? "";
  }, [form.product_group, metaOptions?.groups]);

  const subgroupOptions = useMemo(() => {
    const list = metaOptions?.subgroups ?? [];
    if (!selectedGroupId) return list;
    return list.filter((sg) => {
      const g = sg.group;
      const gid =
        typeof g === "string"
          ? g
          : g && typeof g === "object" && "_id" in (g as object)
            ? String((g as { _id: unknown })._id)
            : String(g ?? "");
      return gid === selectedGroupId;
    });
  }, [metaOptions?.subgroups, selectedGroupId]);

  // Sync details to form state (edit or duplicate-create)
  useEffect(() => {
    if (rawProduct && typeof rawProduct === "object" && sourceProductId) {
      setForm(
        productToFormState(rawProduct as Record<string, unknown>, {
          asCopy: isDuplicating,
        }),
      );
    } else if (create && !isDuplicating) {
      setForm({
        ...defaultProductState(),
        ...(initialName ? { product_name: initialName } : {}),
      });
    }
  }, [rawProduct, create, isDuplicating, sourceProductId, initialName]);

  // Clean form when modal closes or prefill initialName on open
  useEffect(() => {
    if (!show) {
      setForm(defaultProductState());
      setActiveTab("basic");
    } else {
      if (create && !isDuplicating && initialName) {
        setForm((prev) => ({
          ...prev,
          product_name: prev.product_name || initialName,
        }));
      }
    }
  }, [show, create, isDuplicating, initialName]);

  // Keyboard shortcut escape
  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [show, isSaving, onClose]);

  // Submit Handler
  const handleSave = useCallback(async () => {
    if (!form.product_name.trim()) {
      toast.error("Product name is required");
      return;
    }
    const bp = Number(form.base_price);
    if (form.base_price === "" || isNaN(bp) || bp < 0) {
      toast.error("Valid base price is required");
      return;
    }
    const msr = Number(form.minimum_sale_rate);
    if (form.minimum_sale_rate === "" || isNaN(msr) || msr < 0) {
      toast.error("Valid minimum sale rate is required");
      return;
    }

    const aliasesArr = form.aliases
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const tagsArr = form.tags
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const groupName = form.product_group.trim();
    const subgroupName = form.product_subgroup.trim();
    if (subgroupName && !groupName) {
      toast.error("Select or enter a commercial group before setting a subgroup");
      setActiveTab("basic");
      return;
    }

    const payload: Record<string, any> = {
      product_name: form.product_name.trim(),
      product_type: form.product_type,
      generic_name: form.generic_name.trim() || undefined,
      sku: form.sku.trim() || undefined,
      product_group: groupName || undefined,
      product_subgroup: subgroupName || undefined,
      brand: form.brand.trim() || undefined,
      manufacturer: form.manufacturer.trim() || undefined,
      unit: form.unit,
      base_price: bp,
      minimum_sale_rate: msr,
      mrp: form.mrp ? Number(form.mrp) : undefined,
      gst_percent: Number(form.gst_percent),
      warranty_months: Number(form.warranty_months),
      description: form.description.trim() || undefined,
      aliases: aliasesArr,
      tags: tagsArr,
      is_active: form.is_active,
      is_featured: form.is_featured,
    };

    if (form.unit_weight_kg.trim() !== "") {
      const uw = Number(form.unit_weight_kg);
      if (!Number.isFinite(uw) || uw < 0) {
        toast.error("Unit weight must be a non-negative number");
        return;
      }
      payload.unit_weight_kg = uw;
    }
    if (form.units_per_box.trim() !== "") {
      const upb = Number(form.units_per_box);
      if (!Number.isFinite(upb) || upb < 1 || Math.floor(upb) !== upb) {
        toast.error("Units per box must be a whole number of at least 1");
        return;
      }
      payload.units_per_box = upb;
    }

    try {
      if (create) {
        const createdRes = (await createProduct(payload).unwrap()) as Record<string, unknown>;
        toast.success(mutationSuccessCopy("createProduct"));
        onSuccess?.(createdRes);
        onClose();
      } else if (productId) {
        // Minimal Diff payload calculation
        const pObj = rawProduct as any;
        const patch: Record<string, any> = {};

        const oldGroup = productRefLabel(pObj.product_group);
        const oldSubgroup = productRefLabel(pObj.product_subgroup);
        const oldBrand = productRefLabel(pObj.brand);
        const oldManufacturer = productRefLabel(pObj.manufacturer);

        if (!valsEqual(form.product_name.trim(), pObj.product_name)) patch.product_name = form.product_name.trim();
        const oldType =
          PRODUCT_TYPE_OPTIONS.includes(pObj.product_type as (typeof PRODUCT_TYPE_OPTIONS)[number])
            ? pObj.product_type
            : "individual";
        if (form.product_type !== oldType) patch.product_type = form.product_type;
        if (!valsEqual(form.generic_name.trim(), pObj.generic_name)) patch.generic_name = form.generic_name.trim() || null;
        if (!valsEqual(form.sku.trim(), pObj.sku)) patch.sku = form.sku.trim() || null;

        const groupChanged = !valsEqual(groupName, oldGroup);
        const subgroupChanged = !valsEqual(subgroupName, oldSubgroup);
        if (groupChanged || subgroupChanged) {
          // Always send both so new names can be created and linked under the right group.
          patch.product_group = groupName || null;
          patch.product_subgroup = subgroupName || null;
        }

        if (!valsEqual(form.brand.trim(), oldBrand)) patch.brand = form.brand.trim() || null;
        if (!valsEqual(form.manufacturer.trim(), oldManufacturer)) patch.manufacturer = form.manufacturer.trim() || null;
        const oldUnit = productRefLabel(pObj.unit);
        if (!valsEqual(form.unit.trim(), oldUnit)) patch.unit = form.unit.trim() || null;
        if (bp !== pObj.base_price) patch.base_price = bp;
        if (msr !== pObj.minimum_sale_rate) patch.minimum_sale_rate = msr;
        
        const oldMrp = pObj.mrp == null ? "" : String(pObj.mrp);
        if (form.mrp !== oldMrp) patch.mrp = form.mrp ? Number(form.mrp) : null;

        if (Number(form.gst_percent) !== pObj.gst_percent) patch.gst_percent = Number(form.gst_percent);
        if (Number(form.warranty_months) !== pObj.warranty_months) patch.warranty_months = Number(form.warranty_months);
        if (!valsEqual(form.description.trim(), pObj.description)) patch.description = form.description.trim() || "";

        // Compare string arrays
        const oldAliases = Array.isArray(pObj.aliases) ? pObj.aliases : [];
        if (JSON.stringify(aliasesArr) !== JSON.stringify(oldAliases)) {
          patch.aliases = aliasesArr;
        }

        const oldTags = Array.isArray(pObj.tags) ? pObj.tags : [];
        if (JSON.stringify(tagsArr) !== JSON.stringify(oldTags)) {
          patch.tags = tagsArr;
        }

        if (form.is_active !== (pObj.is_active !== false)) patch.is_active = form.is_active;
        if (form.is_featured !== (pObj.is_featured === true)) patch.is_featured = form.is_featured;

        const oldUnitWeight =
          pObj.unit_weight_kg == null || pObj.unit_weight_kg === ""
            ? ""
            : String(pObj.unit_weight_kg);
        if (form.unit_weight_kg !== oldUnitWeight) {
          patch.unit_weight_kg = form.unit_weight_kg.trim()
            ? Number(form.unit_weight_kg)
            : null;
        }
        const oldUnitsPerBox =
          pObj.units_per_box == null || pObj.units_per_box === ""
            ? ""
            : String(pObj.units_per_box);
        if (form.units_per_box !== oldUnitsPerBox) {
          patch.units_per_box = form.units_per_box.trim()
            ? Number(form.units_per_box)
            : null;
        }

        if (Object.keys(patch).length === 0) {
          toast.info("No modifications detected");
          onClose();
          return;
        }

        await patchProduct({ id: productId, patch }).unwrap();
        toast.success(mutationSuccessCopy("patchProduct"));
        onClose();
      }
    } catch (err) {
      toast.error(mutationRejectedMessage(err));
    }
  }, [form, create, productId, rawProduct, createProduct, patchProduct, onClose, onSuccess]);

  if (!show) return null;

  return (
    <LargeModalPortal>
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]"
      role="presentation"
      onClick={() => !isSaving && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[min(90dvh,750px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200/90 px-5 py-4 dark:border-white/10">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              {create
                ? isDuplicating
                  ? isFetching
                    ? "Loading…"
                    : "Duplicate Product"
                  : "Add Product"
                : isFetching
                  ? "Loading Product Details..."
                  : form.product_name || "Product Detail"}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {create
                ? isDuplicating
                  ? "Review the copied details, then save as a new product"
                  : "Create catalog product profile"
                : "View or edit catalog specifications and pricing"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200/90 px-5 dark:border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab("basic")}
            className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === "basic"
                ? "border-b-blue-600 text-blue-600 dark:border-b-blue-500 dark:text-blue-500"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            Basic Specs
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("commercial")}
            className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === "commercial"
                ? "border-b-blue-600 text-blue-600 dark:border-b-blue-500 dark:text-blue-500"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            Commercial & Compliance
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 min-h-0">
          {isFetching && !create ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading catalog files...</p>
          ) : activeTab === "basic" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1 md:col-span-2">
                <label className={labelClass}>Product Name *</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="e.g. Paracetamol 500mg IP"
                  value={form.product_name}
                  onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))}
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-1">
                <label className={labelClass}>Product Type</label>
                <select
                  className={inputClass}
                  value={form.product_type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      product_type: e.target.value as ProductState["product_type"],
                    }))
                  }
                  disabled={isSaving}
                >
                  {PRODUCT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === "individual" ? "Individual" : "Kit"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className={labelClass}>Generic Name</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="e.g. Acetaminophen"
                  value={form.generic_name}
                  onChange={(e) => setForm((f) => ({ ...f, generic_name: e.target.value }))}
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-1">
                <label className={labelClass}>SKU / Catalog No</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="e.g. PAR-500"
                  value={form.sku}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value.toUpperCase() }))}
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className={labelClass}>Commercial Group</label>
                  {!isSaving && (
                    <button
                      type="button"
                      onClick={() => setQuickGroupOpen(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors cursor-pointer"
                      title="Quick add a new commercial group"
                    >
                      <Plus className="size-3" />
                      <span>Add Group</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  list="group-options"
                  className={inputClass}
                  placeholder="e.g. Tablets"
                  value={form.product_group}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      product_group: e.target.value,
                    }))
                  }
                  disabled={isSaving}
                />
                <datalist id="group-options">
                  {metaOptions?.groups?.map((g, i) => (
                    <option key={`group:${String(g._id ?? g.name)}:${i}`} value={g.name} />
                  ))}
                  {form.product_group && !metaOptions?.groups?.some((g) => g.name === form.product_group) && (
                    <option value={form.product_group} />
                  )}
                </datalist>
                <p className="text-2xs text-slate-500 dark:text-slate-400">
                  Pick an existing group, click &ldquo;Add Group&rdquo;, or type a new name to create it on save.
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className={labelClass}>Subgroup</label>
                  {!isSaving && (
                    <button
                      type="button"
                      onClick={() => setQuickSubgroupOpen(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors cursor-pointer"
                      title="Quick add a new subgroup"
                    >
                      <Plus className="size-3" />
                      <span>Add Subgroup</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  list="subgroup-options"
                  className={inputClass}
                  placeholder="e.g. Analgesics"
                  value={form.product_subgroup}
                  onChange={(e) => setForm((f) => ({ ...f, product_subgroup: e.target.value }))}
                  disabled={isSaving}
                />
                <datalist id="subgroup-options">
                  {subgroupOptions.map((sg, i) => (
                    <option key={`subgroup:${String(sg._id ?? sg.name)}:${i}`} value={sg.name} />
                  ))}
                  {form.product_subgroup && !subgroupOptions.some((sg) => sg.name === form.product_subgroup) && (
                    <option value={form.product_subgroup} />
                  )}
                </datalist>
                <p className="text-2xs text-slate-500 dark:text-slate-400">
                  Pick an existing subgroup, click &ldquo;Add Subgroup&rdquo;, or type a new name to create it under this group.
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className={labelClass}>Brand</label>
                  {!isSaving && (
                    <button
                      type="button"
                      onClick={() => setQuickBrandOpen(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors cursor-pointer"
                      title="Quick add a new brand"
                    >
                      <Plus className="size-3" />
                      <span>Add Brand</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  list="brand-options"
                  className={inputClass}
                  placeholder="e.g. Crocin"
                  value={form.brand}
                  onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                  disabled={isSaving}
                />
                <datalist id="brand-options">
                  {metaOptions?.brands?.map((b, i) => (
                    <option key={`brand:${String(b._id ?? b.name)}:${i}`} value={b.name} />
                  ))}
                  {form.brand && !metaOptions?.brands?.some((b) => b.name === form.brand) && (
                    <option value={form.brand} />
                  )}
                </datalist>
                <p className="text-2xs text-slate-500 dark:text-slate-400">
                  Pick an existing brand, click &ldquo;Add Brand&rdquo;, or type a new name to create it on save.
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className={labelClass}>Manufacturer</label>
                  {!isSaving && (
                    <button
                      type="button"
                      onClick={() => setQuickManufacturerOpen(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors cursor-pointer"
                      title="Quick add a new manufacturer"
                    >
                      <Plus className="size-3" />
                      <span>Add Manufacturer</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  list="manufacturer-options"
                  className={inputClass}
                  placeholder="e.g. GSK Ltd"
                  value={form.manufacturer}
                  onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))}
                  disabled={isSaving}
                />
                <datalist id="manufacturer-options">
                  {metaOptions?.manufacturers?.map((m, i) => (
                    <option key={`mfr:${String(m._id ?? m.name)}:${i}`} value={m.name} />
                  ))}
                  {form.manufacturer && !metaOptions?.manufacturers?.some((m) => m.name === form.manufacturer) && (
                    <option value={form.manufacturer} />
                  )}
                </datalist>
                <p className="text-2xs text-slate-500 dark:text-slate-400">
                  Pick an existing manufacturer, click &ldquo;Add Manufacturer&rdquo;, or type a new name to create it on save.
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className={labelClass}>Unit of Measurement</label>
                  {!isSaving && (
                    <button
                      type="button"
                      onClick={() => setQuickUnitOpen(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors cursor-pointer"
                      title="Quick add a new unit of measurement"
                    >
                      <Plus className="size-3" />
                      <span>Add Unit</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  list="unit-options"
                  className={inputClass}
                  placeholder="e.g. Pcs, Kg, Ltr"
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  disabled={isSaving}
                />
                <datalist id="unit-options">
                  {metaOptions?.units?.map((u, i) => (
                    <option key={`unit:${String(u._id ?? u.name)}:${i}`} value={u.name} />
                  ))}
                  {form.unit && !metaOptions?.units?.some((u) => u.name === form.unit) && (
                    <option value={form.unit} />
                  )}
                </datalist>
                <p className="text-2xs text-slate-500 dark:text-slate-400">
                  Pick a catalog unit, click &ldquo;Add Unit&rdquo;, or type a new name to create it on save.
                </p>
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className={labelClass}>Description</label>
                <textarea
                  className={`${inputClass} min-h-[80px]`}
                  placeholder="Product description..."
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  disabled={isSaving}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelClass}>Base Price *</label>
                <input
                  type="number"
                  className={inputClass}
                  placeholder="0.00"
                  value={form.base_price}
                  onChange={(e) => setForm((f) => ({ ...f, base_price: e.target.value }))}
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-1">
                <label className={labelClass}>Minimum Sale Rate *</label>
                <input
                  type="number"
                  className={inputClass}
                  placeholder="0.00"
                  value={form.minimum_sale_rate}
                  onChange={(e) => setForm((f) => ({ ...f, minimum_sale_rate: e.target.value }))}
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-1">
                <label className={labelClass}>MRP</label>
                <input
                  type="number"
                  className={inputClass}
                  placeholder="0.00"
                  value={form.mrp}
                  onChange={(e) => setForm((f) => ({ ...f, mrp: e.target.value }))}
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-1">
                <label className={labelClass}>GST %</label>
                <input
                  type="number"
                  className={inputClass}
                  placeholder="18"
                  value={form.gst_percent}
                  onChange={(e) => setForm((f) => ({ ...f, gst_percent: e.target.value }))}
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-1">
                <label className={labelClass}>Warranty (months)</label>
                <input
                  type="number"
                  className={inputClass}
                  placeholder="0"
                  value={form.warranty_months}
                  onChange={(e) => setForm((f) => ({ ...f, warranty_months: e.target.value }))}
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-1 md:col-span-2 border-t border-slate-200/80 pt-4 dark:border-white/10">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Transport packing
                </p>
                <p className="text-2xs text-slate-500 dark:text-slate-400">
                  Auto-calculates weight and boxes when orders are added to a transport plan.
                </p>
              </div>

              <div className="space-y-1">
                <label className={labelClass}>Unit weight (kg)</label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  className={inputClass}
                  placeholder="e.g. 0.25"
                  value={form.unit_weight_kg}
                  onChange={(e) => setForm((f) => ({ ...f, unit_weight_kg: e.target.value }))}
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-1">
                <label className={labelClass}>Units per box</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  className={inputClass}
                  placeholder="e.g. 12"
                  value={form.units_per_box}
                  onChange={(e) => setForm((f) => ({ ...f, units_per_box: e.target.value }))}
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-1">
                <label className={labelClass}>Aliases (comma-separated)</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="pcm, acetaminophen"
                  value={form.aliases}
                  onChange={(e) => setForm((f) => ({ ...f, aliases: e.target.value }))}
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-1">
                <label className={labelClass}>Tags (comma-separated)</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="tablet, analgesics"
                  value={form.tags}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  disabled={isSaving}
                />
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-7">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="pm-active"
                    className="h-4 w-4 rounded border-slate-300 bg-white text-blue-600 focus:ring-blue-500 dark:border-white/10 dark:bg-slate-950"
                    checked={form.is_active}
                    onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                    disabled={isSaving}
                  />
                  <label htmlFor="pm-active" className="text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                    Is Catalog Active
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="pm-featured"
                    className="h-4 w-4 rounded border-slate-300 bg-white text-blue-600 focus:ring-blue-500 dark:border-white/10 dark:bg-slate-950"
                    checked={form.is_featured}
                    onChange={(e) => setForm((f) => ({ ...f, is_featured: e.target.checked }))}
                    disabled={isSaving}
                  />
                  <label htmlFor="pm-featured" className="text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                    Featured Product
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-2 border-t border-slate-200/90 px-5 py-3.5 dark:border-white/10">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className={btnSecondaryClass}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving || (isDuplicating && isFetching)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            {isSaving
              ? "Saving..."
              : create
                ? isDuplicating
                  ? "Create Duplicate"
                  : "Add Product"
                : "Save Changes"}
          </button>
        </div>
      </div>
    </div>

    {quickGroupOpen && (
      <ProductGroupDetailModal
        create={true}
        initialName=""
        onClose={() => setQuickGroupOpen(false)}
        onSuccess={(createdGroup) => {
          if (createdGroup?.name) {
            setForm((f) => ({ ...f, product_group: createdGroup.name }));
          }
        }}
      />
    )}

    {quickSubgroupOpen && (
      <ProductSubgroupDetailModal
        create={true}
        initialName=""
        defaultGroupId={selectedGroupId || undefined}
        defaultGroupName={form.product_group || undefined}
        onClose={() => setQuickSubgroupOpen(false)}
        onSuccess={(createdSubgroup) => {
          if (createdSubgroup?.name) {
            const grp =
              createdSubgroup.group && typeof createdSubgroup.group === "object"
                ? createdSubgroup.group.name
                : form.product_group;
            setForm((f) => ({
              ...f,
              product_subgroup: createdSubgroup.name,
              ...(grp && !f.product_group ? { product_group: grp } : {}),
            }));
          }
        }}
      />
    )}

    {quickBrandOpen && (
      <ProductBrandDetailModal
        create={true}
        initialName=""
        onClose={() => setQuickBrandOpen(false)}
        onSuccess={(createdBrand) => {
          if (createdBrand?.name) {
            setForm((f) => ({ ...f, brand: createdBrand.name }));
          }
        }}
      />
    )}

    {quickManufacturerOpen && (
      <ProductManufacturerDetailModal
        create={true}
        initialName=""
        onClose={() => setQuickManufacturerOpen(false)}
        onSuccess={(createdManufacturer) => {
          if (createdManufacturer?.name) {
            setForm((f) => ({ ...f, manufacturer: createdManufacturer.name }));
          }
        }}
      />
    )}

    {quickUnitOpen && (
      <ProductUnitDetailModal
        create={true}
        initialName=""
        onClose={() => setQuickUnitOpen(false)}
        onSuccess={(createdUnit) => {
          if (createdUnit?.name) {
            setForm((f) => ({ ...f, unit: createdUnit.name }));
          }
        }}
      />
    )}
    </LargeModalPortal>
  );
}

