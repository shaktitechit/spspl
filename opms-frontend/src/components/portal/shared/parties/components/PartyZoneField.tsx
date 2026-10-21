"use client";

import { usePartyZonesCatalog } from "./usePartyZonesCatalog";

export type PartyZoneFieldProps = {
  zoneId: string;
  onChange: (zoneId: string) => void;
  inputClass: string;
  labelClass: string;
  disabled?: boolean;
  enabled?: boolean;
};

export function PartyZoneField({
  zoneId,
  onChange,
  inputClass,
  labelClass,
  disabled = false,
  enabled = true,
}: PartyZoneFieldProps) {
  const { zones, isLoading } = usePartyZonesCatalog(enabled);

  return (
    <div className="space-y-1">
      <label className={labelClass}>Operational Zone</label>
      <select
        className={inputClass}
        value={zoneId}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || isLoading}
      >
        <option value="">No zone (optional)</option>
        {zones.map((z) => (
          <option key={z._id} value={z._id}>
            {z.name}
          </option>
        ))}
      </select>
    </div>
  );
}
