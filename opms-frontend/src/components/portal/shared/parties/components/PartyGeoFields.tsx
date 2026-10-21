"use client";

import { usePartyGeoCascading } from "./usePartyGeoCatalog";

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

  const patch = (partial: Partial<PartyGeoFieldsValue>, address?: { country?: string; state?: string; city?: string }) => {
    onChange({ ...value, ...partial });
    if (address && onSyncAddressNames) onSyncAddressNames(address);
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
        <label className={labelClass}>Country</label>
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
        </select>
      </div>

      <div className="space-y-1">
        <label className={labelClass}>State</label>
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
        </select>
      </div>

      <div className="space-y-1">
        <label className={labelClass}>City</label>
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
        </select>
      </div>
    </>
  );
}
