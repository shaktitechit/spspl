/** Client-side party geography helpers (match party-service normalization). */

export type PartyGeoCountry = { _id: string; name: string };
export type PartyGeoState = {
  _id: string;
  name: string;
  country?: string | { _id?: string };
};
export type PartyGeoCity = {
  _id: string;
  name: string;
  state?: string | { _id?: string };
};

export type PartyGeoCatalog = {
  countries: PartyGeoCountry[];
  states: PartyGeoState[];
  cities: PartyGeoCity[];
};

export type PartyGeoTextInput = {
  country?: string;
  state?: string;
  city?: string;
  district?: string;
};

export type PartyGeoIds = {
  country_id?: string | null;
  state_id?: string | null;
  city_id?: string | null;
  state?: string;
};

const STATE_ALIASES: Record<string, string> = {
  orissa: "Odisha",
  uttaranchal: "Uttarakhand",
  tamilnadu: "Tamil Nadu",
  "nct of delhi": "Delhi",
  "new delhi": "Delhi",
  up: "Uttar Pradesh",
  "u.p.": "Uttar Pradesh",
  wb: "West Bengal",
  "w bengal": "West Bengal",
  mp: "Madhya Pradesh",
  "m.p.": "Madhya Pradesh",
  chattisgarh: "Chhattisgarh",
  pondicherry: "Puducherry",
};

const CITY_ALIASES: Record<string, string> = {
  bangalore: "Bengaluru",
  bombay: "Mumbai",
  calcutta: "Kolkata",
  madras: "Chennai",
  gurgaon: "Gurugram",
};

export function normalizeGeoName(value: unknown): string {
  if (value == null) return "";
  return String(value).trim().replace(/\s+/g, " ").replace(/\.$/, "").toLowerCase();
}

function resolveStateDisplayName(raw: string): string {
  const norm = normalizeGeoName(raw);
  if (!norm) return "";
  return STATE_ALIASES[norm] || String(raw).trim().replace(/\s+/g, " ");
}

function resolveCityDisplayName(raw: string): string {
  const norm = normalizeGeoName(raw);
  if (!norm) return "";
  return CITY_ALIASES[norm] || String(raw).trim().replace(/\s+/g, " ");
}

function stateCountryId(state: PartyGeoState): string {
  const c = state.country;
  if (!c) return "";
  if (typeof c === "object" && c._id) return String(c._id);
  return String(c);
}

function cityStateId(city: PartyGeoCity): string {
  const s = city.state;
  if (!s) return "";
  if (typeof s === "object" && s._id) return String(s._id);
  return String(s);
}

export function buildPartyGeoResolver(catalog: PartyGeoCatalog) {
  const countryByNorm = new Map<string, PartyGeoCountry>();
  for (const c of catalog.countries) {
    countryByNorm.set(normalizeGeoName(c.name), c);
  }

  const statesByNorm = new Map<string, PartyGeoState>();
  for (const s of catalog.states) {
    statesByNorm.set(normalizeGeoName(s.name), s);
  }

  const citiesByStateNorm = new Map<string, Map<string, PartyGeoCity>>();
  for (const city of catalog.cities) {
    const sid = cityStateId(city);
    if (!sid) continue;
    if (!citiesByStateNorm.has(sid)) citiesByStateNorm.set(sid, new Map());
    citiesByStateNorm.get(sid)!.set(normalizeGeoName(city.name), city);
  }

  function findCountry(raw?: string): PartyGeoCountry | null {
    const text = raw?.trim();
    if (!text) {
      return countryByNorm.get("india") || catalog.countries[0] || null;
    }
    return countryByNorm.get(normalizeGeoName(text)) || null;
  }

  function findState(raw?: string, countryId?: string): PartyGeoState | null {
    const display = resolveStateDisplayName(raw || "");
    if (!display) return null;
    const hit = statesByNorm.get(normalizeGeoName(display));
    if (!hit) return null;
    if (countryId && stateCountryId(hit) !== countryId) return null;
    return hit;
  }

  function findCity(raw: string | undefined, stateId: string): PartyGeoCity | null {
    const display = resolveCityDisplayName(raw || "");
    if (!display || !stateId) return null;
    const map = citiesByStateNorm.get(stateId);
    if (!map) return null;
    return map.get(normalizeGeoName(display)) || null;
  }

  function resolveFromText(input: PartyGeoTextInput): PartyGeoIds {
    const country = findCountry(input.country);
    const country_id = country?._id || null;

    const stateSource = input.state || "";
    const stateRow = findState(stateSource, country_id || undefined);
    const state_id = stateRow?._id || null;

    const citySource = input.city || input.district || "";
    const cityRow = state_id ? findCity(citySource, state_id) : null;
    const city_id = cityRow?._id || null;

    return {
      country_id,
      state_id,
      city_id,
      state: stateRow?.name || (stateSource ? resolveStateDisplayName(stateSource) : undefined),
    };
  }

  function stateOptionsForCountry(countryId: string): PartyGeoState[] {
    if (!countryId) return [];
    return catalog.states.filter((s) => stateCountryId(s) === countryId);
  }

  function cityOptionsForState(stateId: string): PartyGeoCity[] {
    if (!stateId) return [];
    return catalog.cities.filter((c) => cityStateId(c) === stateId);
  }

  function labelForStateId(stateId: string): string {
    return catalog.states.find((s) => s._id === stateId)?.name || "";
  }

  function labelForCityId(cityId: string): string {
    return catalog.cities.find((c) => c._id === cityId)?.name || "";
  }

  function labelForCountryId(countryId: string): string {
    return catalog.countries.find((c) => c._id === countryId)?.name || "";
  }

  return {
    resolveFromText,
    findState,
    findCity,
    findCountry,
    stateOptionsForCountry,
    cityOptionsForState,
    labelForStateId,
    labelForCityId,
    labelForCountryId,
    allStateNames: catalog.states.map((s) => s.name).sort(),
    allCityNames: catalog.cities.map((c) => c.name).sort(),
  };
}

export function partyCityDisplay(party: Record<string, unknown>, resolver?: ReturnType<typeof buildPartyGeoResolver>): string {
  const cityId = party.city_id != null ? String(party.city_id) : "";
  if (cityId && resolver) {
    const n = resolver.labelForCityId(cityId);
    if (n) return n;
  }
  const b = (party.billing_address || {}) as Record<string, unknown>;
  if (b.city) return String(b.city);
  if (party.district) return String(party.district);
  return "";
}
