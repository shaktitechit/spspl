"use client";

import { useEffect, useState } from "react";
import { PartyGeoFields, type PartyGeoFieldsValue } from "./PartyGeoFields";

const drawerInputClass =
  "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 px-3 py-1.5 text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500 text-xs transition";
const drawerLabelClass = "block text-slate-600 dark:text-slate-400 mb-1 font-medium text-xs";

export type PartyGeoDrawerSectionProps = {
  partyId: string;
  initial: PartyGeoFieldsValue;
  disabled?: boolean;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
};

export function PartyGeoDrawerSection({ partyId, initial, disabled, onSave }: PartyGeoDrawerSectionProps) {
  const [geo, setGeo] = useState<PartyGeoFieldsValue>(initial);
  const [billingNames, setBillingNames] = useState<{ country?: string; state?: string; city?: string }>({});

  useEffect(() => {
    setGeo(initial);
  }, [partyId, initial.country_id, initial.state_id, initial.city_id, initial.state, initial.district]);

  const persist = async (next: PartyGeoFieldsValue, names: { country?: string; state?: string; city?: string }) => {
    setGeo(next);
    const patch: Record<string, unknown> = {
      country_id: next.country_id || null,
      state_id: next.state_id || null,
      city_id: next.city_id || null,
      state: next.state || "",
      district: next.district || "",
    };
    if (names.country || names.state || names.city) {
      patch.billing_address = {
        country: names.country,
        state: names.state,
        city: names.city,
      };
    }
    await onSave(patch);
  };

  return (
    <div className="space-y-3.5 bg-slate-50/50 dark:bg-slate-850/30 border border-slate-200 dark:border-slate-850/50 rounded-xl p-4.5">
      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-2">
        📍 Geography (Country / State / City)
      </h4>
      <div className="grid grid-cols-1 gap-3.5">
        <PartyGeoFields
          value={geo}
          onChange={(next) => setGeo(next)}
          inputClass={drawerInputClass}
          labelClass={drawerLabelClass}
          disabled={disabled}
          onSyncAddressNames={(names) => setBillingNames(names)}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => persist(geo, billingNames)}
          className="self-start rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Save geography
        </button>
      </div>
    </div>
  );
}
