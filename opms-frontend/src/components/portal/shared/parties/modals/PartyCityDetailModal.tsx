"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "@/lib/toast";
import {
  useCreatePartyCityMutation,
  useGetPartyCityQuery,
  useListPartyCountriesQuery,
  useListPartyStatesQuery,
  usePatchPartyCityMutation,
} from "@/store/api";
import { LargeModalPortal } from "@/components/portal/shared/ui/modals/LargeModalPortal";
import { X } from "lucide-react";

export type PartyCityDetailModalProps = {
  cityId: string | null;
  create?: boolean;
  defaultStateId?: string;
  defaultCountryId?: string;
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

export default function PartyCityDetailModal({
  cityId,
  create = false,
  defaultStateId = "",
  defaultCountryId = "",
  onClose,
  onSuccess,
}: PartyCityDetailModalProps) {
  const isEdit = !create && !!cityId;

  const { data: cityData, isLoading } = useGetPartyCityQuery(cityId || "", { skip: !isEdit });
  const { data: countriesData } = useListPartyCountriesQuery({ limit: 1000, status: "active" });
  const countries = useMemo(
    () => (Array.isArray(countriesData?.data) ? countriesData.data : []),
    [countriesData]
  );

  const [countryId, setCountryId] = useState(defaultCountryId);
  const { data: statesData } = useListPartyStatesQuery(
    countryId ? { limit: 1000, country_id: countryId, status: "active" } : { limit: 0 },
    { skip: !countryId }
  );
  const states = useMemo(() => (Array.isArray(statesData?.data) ? statesData.data : []), [statesData]);

  const [createCity] = useCreatePartyCityMutation();
  const [patchCity] = usePatchPartyCityMutation();

  const [name, setName] = useState("");
  const [stateId, setStateId] = useState(defaultStateId);
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isEdit && cityData) {
      setName(cityData.name || "");
      const st =
        cityData.state && typeof cityData.state === "object" ? cityData.state : null;
      const sid = st ? st._id : cityData.state;
      setStateId(String(sid || ""));
      const c =
        st?.country && typeof st.country === "object"
          ? st.country._id
          : st?.country;
      if (c) setCountryId(String(c));
      setDescription(cityData.description || "");
      setIsActive(cityData.is_active !== false);
    } else if (create) {
      setName("");
      setCountryId(defaultCountryId || countries[0]?._id || "");
      setStateId(defaultStateId || "");
      setDescription("");
      setIsActive(true);
    }
  }, [isEdit, create, cityData, defaultCountryId, defaultStateId, countries]);

  useEffect(() => {
    if (!stateId && states.length > 0 && create) {
      setStateId(states[0]._id);
    }
  }, [states, stateId, create]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("City name is required");
      return;
    }
    if (!stateId) {
      toast.error("State is required");
      return;
    }

    setIsSaving(true);
    try {
      const body = {
        name: name.trim(),
        state: stateId,
        description: description.trim(),
        is_active: isActive,
      };
      if (isEdit && cityId) {
        await patchCity({ id: cityId, patch: body }).unwrap();
        toast.success("City updated");
      } else {
        await createCity(body).unwrap();
        toast.success("City created");
      }
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to save city");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <LargeModalPortal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {isEdit ? "Edit City" : "Create City"}
            </h3>
            <button onClick={onClose} className="rounded-lg p-1 text-slate-400 cursor-pointer">
              <X className="size-4" />
            </button>
          </div>

          <form onSubmit={handleSave} className="p-4 space-y-4">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-slate-500">Loading…</div>
            ) : (
              <>
                <div className="space-y-1">
                  <label className={labelClass}>Country *</label>
                  <select
                    value={countryId}
                    onChange={(e) => {
                      setCountryId(e.target.value);
                      setStateId("");
                    }}
                    className={inputClass}
                    required
                  >
                    <option value="">Select country</option>
                    {countries.map((c: any) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>State *</label>
                  <select
                    value={stateId}
                    onChange={(e) => setStateId(e.target.value)}
                    className={inputClass}
                    required
                    disabled={!countryId}
                  >
                    <option value="">Select state</option>
                    {states.map((s: any) => (
                      <option key={s._id} value={s._id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>City Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
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
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
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
