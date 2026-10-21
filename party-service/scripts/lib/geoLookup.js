/**
 * In-memory geo lookup helpers for seed/backfill scripts.
 */
const path = require('path');
const {
  normalizeGeoName,
  resolveStateAlias,
} = require('../../src/modules/parties/partyGeo.resolve');

function loadIndiaAliases() {
  const file = path.join(__dirname, '../../src/data/indiaGeoAliases.json');
  // eslint-disable-next-line import/no-dynamic-require, global-require
  const raw = require(file);
  const states = {};
  if (raw.states && typeof raw.states === 'object') {
    for (const [k, v] of Object.entries(raw.states)) {
      states[normalizeGeoName(k)] = v;
    }
  }
  const cities = {};
  if (raw.cities && typeof raw.cities === 'object') {
    for (const [k, v] of Object.entries(raw.cities)) {
      cities[normalizeGeoName(k)] = v;
    }
  }
  return { states, cities };
}

function buildStateLookup(statesRows, stateAliases) {
  /** @type {Map<string, { _id: string, name: string }>} */
  const byNorm = new Map();
  /** @type {Map<string, { _id: string, name: string }>} */
  const byCanonicalNorm = new Map();

  for (const row of statesRows) {
    const entry = { _id: String(row._id), name: row.name };
    byNorm.set(normalizeGeoName(row.name), entry);
    byCanonicalNorm.set(normalizeGeoName(row.name), entry);
  }

  return {
    resolveStateText(rawState) {
      const canonical = resolveStateAlias(rawState, stateAliases);
      if (!canonical) return null;
      const hit =
        byNorm.get(normalizeGeoName(canonical)) ||
        byCanonicalNorm.get(normalizeGeoName(canonical));
      return hit || null;
    },
  };
}

function buildCityLookup(citiesRows) {
  /** @type {Map<string, Map<string, { _id: string, name: string }>>} */
  const byState = new Map();

  for (const row of citiesRows) {
    const stateId = String(row.state);
    if (!byState.has(stateId)) byState.set(stateId, new Map());
    byState.get(stateId).set(normalizeGeoName(row.name), {
      _id: String(row._id),
      name: row.name,
    });
  }

  return {
    resolveCityText(stateId, rawCity, cityAliases) {
      if (!stateId || !rawCity) return null;
      const norm = normalizeGeoName(rawCity);
      if (!norm) return null;
      const map = byState.get(String(stateId));
      if (!map) return null;
      const aliasName = cityAliases[norm];
      const canonical = aliasName || String(rawCity).trim().replace(/\s+/g, ' ');
      return (
        map.get(normalizeGeoName(canonical)) ||
        map.get(norm) ||
        null
      );
    },
  };
}

function resolveCityDisplayName(rawCity, cityAliases) {
  const norm = normalizeGeoName(rawCity);
  if (!norm) return '';
  return cityAliases[norm] || String(rawCity).trim().replace(/\s+/g, ' ');
}

module.exports = {
  loadIndiaAliases,
  buildStateLookup,
  buildCityLookup,
  resolveCityDisplayName,
};
