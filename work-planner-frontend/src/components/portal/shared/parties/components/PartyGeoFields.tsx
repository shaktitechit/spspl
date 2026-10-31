"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { usePartyGeoCascading } from "./usePartyGeoCatalog";
import PartyCountryDetailModal from "../modals/PartyCountryDetailModal";
import PartyStateDetailModal from "../modals/PartyStateDetailModal";
import PartyCityDetailModal from "../modals/PartyCityDetailModal";

export type PartyGeoFieldsValue = {
  country_id: string;
  state_id: string;
  city_id: string;
  state: string;
  district?: string;
};

export type PartyGeoFieldsProps = {
  value: PartyGeoFieldsValue;
  onChange: (next: PartyGeoFieldsValue) => void;
  inputClass: string;
  labelClass: string;
  disabled?: boolean;
  showDistrict?: boolean;
  /** Sync billing_address country/state/city names when masters change */
  onSyncAddressNames?: (names: { country?: string; state?: string; city?: string }) => void;
};

export function PartyGeoFields({
  value,
  onChange,
  inputClass,
  labelClass,
  disabled = false,
  showDistrict = true,
  onSyncAddressNames,
}: PartyGeoFieldsProps) {
  const { countries, states, cities, resolver } = usePartyGeoCascading(value.country_id, value.state_id);

  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [stateModalOpen, setStateModalOpen] = useState(false);
  const [cityModalOpen, setCityModalOpen] = useState(false);

  const patch = (
    partial: Partial<PartyGeoFieldsValue>,
    address?: { country?: string; state?: string; city?: string }
  ) => {
    onChange({ ...value, ...partial });
    if (address && onSyncAddressNames) onSyncAddressNames(address);
  };

  const handleCountryCreated = (created: any) => {
    const id = String(created?._id ?? created?.id ?? "");
    const name = String(created?.name ?? "");
    if (id) {
      patch(
        { country_id: id, state_id: "", city_id: "", state: "" },
        { country: name || undefined, state: "", city: "" }
      );
    }
  };

  const handleStateCreated = (created: any) => {
    const id = String(created?._id ?? created?.id ?? "");
    const name = String(created?.name ?? "");
    const cId =
      created?.country && typeof created.country === "object"
        ? created.country._id
        : created?.country;
    if (id) {
      patch(
        {
          ...(cId && !value.country_id ? { country_id: String(cId) } : {}),
          state_id: id,
          city_id: "",
          state: name,
        },
        { state: name || undefined, city: "" }
      );
    }
  };

  const handleCityCreated = (created: any) => {
    const id = String(created?._id ?? created?.id ?? "");
    const name = String(created?.name ?? "");
    const st = created?.state && typeof created.state === "object" ? created.state : null;
    const sid = st ? st._id : created?.state;
    const cid = st?.country && typeof st.country === "object" ? st.country._id : st?.country;
    if (id) {
      patch(
        {
          ...(cid && !value.country_id ? { country_id: String(cid) } : {}),
          ...(sid && !value.state_id
            ? { state_id: String(sid), state: st?.name || value.state }
            : {}),
          city_id: id,
        },
        { city: name || undefined }
      );
    }
  };

  return (
    <>
      {showDistrict && (
        <div className="space-y-1">
          <label className={labelClass}>District</label>
          <input
            type="text"
            className={inputClass}
            placeholder="e.g. Central Delhi"
            value={value.district || ""}
            onChange={(e) => patch({ district: e.target.value })}
            disabled={disabled}
          />
        </div>
      )}

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className={labelClass}>Country</label>
          {!disabled && (
            <button
              type="button"
              onClick={() => setCountryModalOpen(true)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors cursor-pointer"
              title="Add new country"
            >
              <Plus className="size-3" />
              <span>Add Country</span>
            </button>
          )}
        </div>
        <select
          className={inputClass}
          value={value.country_id}
          onChange={(e) => {
            const country_id = e.target.value;
            const countryName = resolver.labelForCountryId(country_id);
            patch(
              { country_id, state_id: "", city_id: "", state: "" },
              { country: countryName || undefined, state: "", city: "" }
            );
          }}
          disabled={disabled}
        >
          <option value="">Select country (optional)</option>
          {countries.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
          {value.country_id && !countries.some((c) => c._id === value.country_id) && (
            <option value={value.country_id}>Selected Country</option>
          )}
        </select>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className={labelClass}>State</label>
          {!disabled && (
            <button
              type="button"
              onClick={() => setStateModalOpen(true)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors cursor-pointer"
              title="Add new state"
            >
              <Plus className="size-3" />
              <span>Add State</span>
            </button>
          )}
        </div>
        <select
          className={inputClass}
          value={value.state_id}
          onChange={(e) => {
            const state_id = e.target.value;
            const stateName = resolver.labelForStateId(state_id);
            patch(
              { state_id, city_id: "", state: stateName },
              { state: stateName || undefined, city: "" }
            );
          }}
          disabled={disabled || !value.country_id}
        >
          <option value="">Select state (optional)</option>
          {states.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
          {value.state_id && !states.some((s) => s._id === value.state_id) && (
            <option value={value.state_id}>{value.state || "Selected State"}</option>
          )}
        </select>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className={labelClass}>City</label>
          {!disabled && (
            <button
              type="button"
              onClick={() => setCityModalOpen(true)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors cursor-pointer"
              title="Add new city"
            >
              <Plus className="size-3" />
              <span>Add City</span>
            </button>
          )}
        </div>
        <select
          className={inputClass}
          value={value.city_id}
          onChange={(e) => {
            const city_id = e.target.value;
            const cityName = resolver.labelForCityId(city_id);
            patch({ city_id }, { city: cityName || undefined });
          }}
          disabled={disabled || !value.state_id}
        >
          <option value="">Select city (optional)</option>
          {cities.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
          {value.city_id && !cities.some((c) => c._id === value.city_id) && (
            <option value={value.city_id}>Selected City</option>
          )}
        </select>
      </div>

      {countryModalOpen && (
        <PartyCountryDetailModal
          countryId={null}
          create={true}
          onClose={() => setCountryModalOpen(false)}
          onSuccess={handleCountryCreated}
        />
      )}

      {stateModalOpen && (
        <PartyStateDetailModal
          stateId={null}
          create={true}
          defaultCountryId={value.country_id || undefined}
          onClose={() => setStateModalOpen(false)}
          onSuccess={handleStateCreated}
        />
      )}

      {cityModalOpen && (
        <PartyCityDetailModal
          cityId={null}
          create={true}
          defaultCountryId={value.country_id || undefined}
          defaultStateId={value.state_id || undefined}
          onClose={() => setCityModalOpen(false)}
          onSuccess={handleCityCreated}
        />
      )}
    </>
  );
}

