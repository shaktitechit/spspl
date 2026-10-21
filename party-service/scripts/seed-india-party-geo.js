/**
 * Seed India party geography: country, states/UTs, major + discovered cities.
 *
 * Usage (from party-service/):
 *   node scripts/seed-india-party-geo.js
 *   DRY_RUN=1 node scripts/seed-india-party-geo.js
 *   DISCOVER_CITIES=0 node scripts/seed-india-party-geo.js
 *
 * Docker:
 *   docker compose exec party-service node scripts/seed-india-party-geo.js
 */
const fs = require('fs');
const path = require('path');
const { connectMongo } = require('./lib/connectMongo');
const {
  loadIndiaAliases,
  buildStateLookup,
  resolveCityDisplayName,
} = require('./lib/geoLookup');
const { normalizeGeoName } = require('../src/modules/parties/partyGeo.resolve');

const dryRun = String(process.env.DRY_RUN || '') === '1';
const discoverCities = String(process.env.DISCOVER_CITIES || '1') !== '0';
const reportDir = process.env.REPORT_DIR || path.join(__dirname, '../reports');

const stateNames = require('../src/data/indiaStatesAndUts.json');
const majorCitiesByState = require('../src/data/indiaMajorCities.json');

async function upsertCountry(PartyCountry) {
  let doc = await PartyCountry.findOne({
    name: /^india$/i,
    deletedAt: null,
  }).lean();
  if (doc) {
    if (!dryRun && !doc.iso_code) {
      await PartyCountry.updateOne({ _id: doc._id }, { $set: { iso_code: 'IN', is_active: true } });
    }
    return { id: String(doc._id), created: false };
  }
  if (dryRun) return { id: 'dry-run-india-id', created: true };
  const created = await PartyCountry.create({
    name: 'India',
    iso_code: 'IN',
    is_active: true,
  });
  return { id: String(created._id), created: true };
}

async function upsertState(PartyState, countryId, name) {
  const trimmed = String(name).trim();
  let doc = await PartyState.findOne({
    country: countryId,
    name: trimmed,
    deletedAt: null,
  }).lean();
  if (doc) return { id: String(doc._id), created: false, name: trimmed };
  if (dryRun) return { id: `dry-state-${normalizeGeoName(trimmed)}`, created: true, name: trimmed };
  try {
    const created = await PartyState.create({
      name: trimmed,
      country: countryId,
      is_active: true,
    });
    return { id: String(created._id), created: true, name: trimmed };
  } catch (err) {
    doc = await PartyState.findOne({ country: countryId, name: trimmed, deletedAt: null }).lean();
    if (doc) return { id: String(doc._id), created: false, name: trimmed };
    throw err;
  }
}

async function upsertCity(PartyCity, stateId, cityName) {
  const trimmed = String(cityName).trim();
  if (!trimmed) return { created: false, skipped: true };
  let doc = await PartyCity.findOne({
    state: stateId,
    name: trimmed,
    deletedAt: null,
  }).lean();
  if (doc) return { created: false, skipped: true };
  if (dryRun) return { created: true, skipped: false };
  try {
    await PartyCity.create({ name: trimmed, state: stateId, is_active: true });
    return { created: true, skipped: false };
  } catch (err) {
    doc = await PartyCity.findOne({ state: stateId, name: trimmed, deletedAt: null }).lean();
    if (doc) return { created: false, skipped: true };
    throw err;
  }
}

function collectPartyCityPairs(party) {
  const pairs = [];
  const push = (stateText, cityText) => {
    if (!cityText || !String(cityText).trim()) return;
    pairs.push({ stateText, cityText: String(cityText).trim() });
  };

  const b = party.billing_address || {};
  const s = party.shipping_address || {};
  push(b.state, b.city);
  push(s.state, s.city);
  if (!b.city && !s.city && party.district) {
    push(party.state || b.state || s.state, party.district);
  }
  return pairs;
}

async function main() {
  const mongoose = await connectMongo();
  const { PartyCountry, PartyState, PartyCity, Party } = require('../src/data/mongoRegistry').getModels();
  const { states: stateAliases, cities: cityAliases } = loadIndiaAliases();

  console.log(`[seed-india-geo] DRY_RUN=${dryRun} DISCOVER_CITIES=${discoverCities}`);

  const country = await upsertCountry(PartyCountry);
  console.log(`[seed-india-geo] Country India: ${country.created ? 'created' : 'exists'} id=${country.id}`);

  let statesCreated = 0;
  let statesSkipped = 0;
  /** @type {Map<string, string>} canonical state name -> state id */
  const stateIdByName = new Map();

  for (const name of stateNames) {
    const res = await upsertState(PartyState, country.id, name);
    stateIdByName.set(res.name, res.id);
    if (res.created) statesCreated += 1;
    else statesSkipped += 1;
  }
  console.log(`[seed-india-geo] States: created=${statesCreated} skipped=${statesSkipped}`);

  let citiesCreated = 0;
  let citiesSkipped = 0;

  for (const [stateName, cities] of Object.entries(majorCitiesByState)) {
    const stateId = stateIdByName.get(stateName);
    if (!stateId) {
      console.warn(`[seed-india-geo] Major cities: unknown state "${stateName}" — skip`);
      continue;
    }
    for (const city of cities) {
      const res = await upsertCity(PartyCity, stateId, city);
      if (res.skipped) citiesSkipped += 1;
      else if (res.created) citiesCreated += 1;
      else citiesSkipped += 1;
    }
  }

  const unmatched = [];

  if (discoverCities) {
    const stateRows = await PartyState.find({ country: country.id, deletedAt: null }).lean();
    const stateLookup = buildStateLookup(stateRows, stateAliases);

    const parties = await Party.find({ deletedAt: null })
      .select('state district billing_address shipping_address')
      .lean();

    for (const party of parties) {
      for (const { stateText, cityText } of collectPartyCityPairs(party)) {
        const stateHit = stateLookup.resolveStateText(stateText);
        if (!stateHit) {
          unmatched.push({ stateText, cityText, reason: 'state_unmatched' });
          continue;
        }
        const displayCity = resolveCityDisplayName(cityText, cityAliases);
        const res = await upsertCity(PartyCity, stateHit._id, displayCity);
        if (res.skipped) citiesSkipped += 1;
        else if (res.created) citiesCreated += 1;
      }
    }
  }

  console.log(`[seed-india-geo] Cities: created=${citiesCreated} skipped=${citiesSkipped}`);

  if (unmatched.length > 0) {
    fs.mkdirSync(reportDir, { recursive: true });
    const outPath = path.join(reportDir, 'seed-india-unmatched-city-pairs.json');
    if (!dryRun) {
      fs.writeFileSync(outPath, JSON.stringify(unmatched.slice(0, 5000), null, 2));
    }
    console.log(`[seed-india-geo] Unmatched city pairs: ${unmatched.length} (sample report: ${outPath})`);
  }

  if (String(process.env.SELF_TEST || '') === '1') {
    const stateCount = await PartyState.countDocuments({ country: country.id, deletedAt: null });
    if (stateCount < 36) {
      throw new Error(`SELF_TEST failed: expected >= 36 states, got ${stateCount}`);
    }
    console.log('[seed-india-geo] SELF_TEST passed');
  }

  await mongoose.disconnect();
  console.log('[seed-india-geo] Done.');
}

main().catch((err) => {
  console.error('[seed-india-geo]', err);
  process.exit(1);
});
