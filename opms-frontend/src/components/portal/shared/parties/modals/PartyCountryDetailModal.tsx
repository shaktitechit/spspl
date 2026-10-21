"use client";

import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import {
  useCreatePartyCountryMutation,
  useGetPartyCountryQuery,
  usePatchPartyCountryMutation,
} from "@/store/api";
import { LargeModalPortal } from "@/components/portal/shared/ui/modals/LargeModalPortal";
import { X } from "lucide-react";

export type PartyCountryDetailModalProps = {
  countryId: string | null;
  create?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-500/25 dark:border-white/15 dark:bg-slate-950 dark:text-slate-55";
const labelClass = "text-xs font-semibold text-slate-700 dark:text-slate-300";
const btnSecondaryClass =
  "rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-55 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer";
const btnPrimaryClass =
  "rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 cursor-pointer";

export default function PartyCountryDetailModal({
  countryId,
  create = false,
  onClose,
  onSuccess,
}: PartyCountryDetailModalProps) {
  const isEdit = !create && !!countryId;

  const { data: countryData, isLoading } = useGetPartyCountryQuery(countryId || "", {
    skip: !isEdit,
  });

  const [createCountry] = useCreatePartyCountryMutation();
  const [patchCountry] = usePatchPartyCountryMutation();

  const [name, setName] = useState("");
  const [isoCode, setIsoCode] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isEdit && countryData) {
      setName(countryData.name || "");
      setIsoCode(countryData.iso_code || "");
      setDescription(countryData.description || "");
      setIsActive(countryData.is_active !== false);
    } else if (create) {
      setName("");
      setIsoCode("");
      setDescription("");
      setIsActive(true);
    }
  }, [isEdit, create, countryData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Country name is required");
      return;
    }

    setIsSaving(true);
    try {
      const body = {
        name: name.trim(),
        iso_code: isoCode.trim() || undefined,
        description: description.trim(),
        is_active: isActive,
      };
      if (isEdit && countryId) {
        await patchCountry({ id: countryId, patch: body }).unwrap();
        toast.success("Country updated");
      } else {
        await createCountry(body).unwrap();
        toast.success("Country created");
      }
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to save country");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <LargeModalPortal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01]">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {isEdit ? "Edit Country" : "Create Country"}
            </h3>
            <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-150 cursor-pointer">
              <X className="size-4" />
            </button>
          </div>

          <form onSubmit={handleSave} className="p-4 space-y-4">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-slate-500">Loading…</div>
            ) : (
              <>
                <div className="space-y-1">
                  <label className={labelClass}>Country Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. India"
                  />
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>ISO Code</label>
                  <input
                    type="text"
                    value={isoCode}
                    onChange={(e) => setIsoCode(e.target.value.toUpperCase())}
                    className={inputClass}
                    placeholder="e.g. IN"
                  />
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className={`${inputClass} resize-none`}
                  />
                </div>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded"
                  />
                  Active
                </label>
              </>
            )}
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-white/5">
              <button type="button" onClick={onClose} className={btnSecondaryClass} disabled={isSaving}>
                Cancel
              </button>
              <button type="submit" className={btnPrimaryClass} disabled={isSaving || isLoading}>
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </LargeModalPortal>
  );
}
