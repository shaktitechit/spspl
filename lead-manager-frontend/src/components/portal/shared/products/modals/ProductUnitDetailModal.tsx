"use client";

import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import {
  type ProductUnitRecord,
  useCreateProductUnitMutation,
  useGetProductUnitQuery,
  usePatchProductUnitMutation,
} from "@/store/api";
import { LargeModalPortal } from "@/components/portal/shared/LargeModalPortal";
import { X, Scale } from "lucide-react";

export type ProductUnitDetailModalProps = {
  unitId?: string | null;
  create?: boolean;
  initialName?: string;
  onClose: () => void;
  onSuccess?: (unit: ProductUnitRecord) => void;
};

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-500/25 dark:border-white/15 dark:bg-slate-950 dark:text-slate-50";
const labelClass = "text-xs font-semibold text-slate-700 dark:text-slate-300";
const btnSecondaryClass =
  "rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer";
const btnPrimaryClass =
  "rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 cursor-pointer";

export default function ProductUnitDetailModal({
  unitId,
  create = false,
  initialName = "",
  onClose,
  onSuccess,
}: ProductUnitDetailModalProps) {
  const isEdit = !create && !!unitId;

  const { data: unitData, isLoading } = useGetProductUnitQuery(unitId || "", {
    skip: !isEdit,
  });

  const [createProductUnit] = useCreateProductUnitMutation();
  const [patchProductUnit] = usePatchProductUnitMutation();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isEdit && unitData) {
      setName(unitData.name || "");
      setDescription(unitData.description || "");
      setIsActive(unitData.is_active !== false);
      setIsFeatured(Boolean(unitData.is_featured));
      setIsDefault(Boolean(unitData.is_default));
    } else if (create) {
      setName(initialName || "");
      setDescription("");
      setIsActive(true);
      setIsFeatured(false);
      setIsDefault(false);
    }
  }, [isEdit, create, unitData, initialName]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Unit name is required");
      return;
    }

    setIsSaving(true);
    try {
      const body: Partial<ProductUnitRecord> = {
        name: name.trim(),
        description: description.trim(),
        is_active: isActive,
        is_featured: isFeatured,
        is_default: isDefault,
      };

      let savedUnit: ProductUnitRecord;
      if (isEdit && unitId) {
        savedUnit = await patchProductUnit({ id: unitId, patch: body }).unwrap();
        toast.success("Product Unit updated");
      } else {
        savedUnit = await createProductUnit(body).unwrap();
        toast.success("Product Unit created");
      }
      onSuccess?.(savedUnit);
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to save product unit");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <LargeModalPortal>
      <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01]">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                <Scale className="size-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isEdit ? "Edit Product Unit" : "Create Product Unit"}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>

          <form onSubmit={handleSave} className="p-4 space-y-4">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-slate-500">Loading…</div>
            ) : (
              <>
                <div className="space-y-1">
                  <label className={labelClass}>Unit Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Pcs, Box, Kg, Bottle"
                    className={inputClass}
                    disabled={isSaving}
                    autoFocus
                  />
                  <p className="text-2xs text-slate-500 dark:text-slate-400">
                    Standard abbreviation or name used for stock and packaging.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional notes or details about this unit..."
                    rows={3}
                    className={`${inputClass} resize-none`}
                    disabled={isSaving}
                  />
                </div>

                <div className="flex flex-wrap gap-4 pt-1">
                  <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      disabled={isSaving}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Active</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isDefault}
                      onChange={(e) => setIsDefault(e.target.checked)}
                      disabled={isSaving}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Default Unit</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isFeatured}
                      onChange={(e) => setIsFeatured(e.target.checked)}
                      disabled={isSaving}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Featured</span>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSaving}
                    className={btnSecondaryClass}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className={btnPrimaryClass}
                  >
                    {isSaving ? "Saving…" : isEdit ? "Update Unit" : "Create Unit"}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      </div>
    </LargeModalPortal>
  );
}

