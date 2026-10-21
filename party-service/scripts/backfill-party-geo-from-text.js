/**
 * Backfill Party.country_id / state_id / city_id from free-text location fields (India).
 *
 * Usage:
 *   node scripts/backfill-party-geo-from-text.js
 *   DRY_RUN=1 node scripts/backfill-party-geo-from-text.js
 *   LIMIT=100 ONLY_MISSING_IDS=1 node scripts/backfill-party-geo-from-text.js
 *   FORCE=1 node scripts/backfill-party-geo-from-text.js
 *
 * Docker:
 *   docker compose exec -e DRY_RUN=1 party-service node scripts/backfill-party-geo-from-text.js
 */
const fs = require('fs');
const path = require('path');
const { connectMongo } = require('./lib/connectMongo');
const {
  loadIndiaAliases,
  buildStateLookup,
  buildCityLookup,
  resolveCityDisplayName,
} = require('./lib/geoLookup');
const {
  isIndiaCountryText,
  resolvePartyGeoFields,
} = require('../src/modules/parties/partyGeo.resolve');

const dryRun = String(process.env.DRY_RUN || '') === '1';
const onlyMissing = String(process.env.ONLY_MISSING_IDS || '1') !== '0';
const force = String(process.env.FORCE || '') === '1';
const limit = Math.max(0, parseInt(process.env.LIMIT || '0', 10) || 0);
const batchSize = Math.max(50, parseInt(process.env.BATCH_SIZE || '500', 10) || 500);
const reportDir = process.env.REPORT_DIR || path.join(__dirname, '../reports');

function pickStateText(party) {
  if (party.state && String(party.state).trim()) return String(party.state).trim();
  const b = party.billing_address || {};
  const s = party.shipping_address || {};
  if (b.state && String(b.state).trim()) return String(b.state).trim();
  if (s.state && String(s.state).trim()) return String(s.state).trim();
  return '';
}

function pickCityText(party) {
  const b = party.billing_address || {};
  const s = party.shipping_address || {};
  if (b.city && String(b.city).trim()) return String(b.city).trim();
  if (s.city && String(s.city).trim()) return String(s.city).trim();
  if (party.district && String(party.district).trim()) return String(party.district).trim();
  return '';
}

function partyCountryTexts(party) {
  const b = party.billing_address || {};
  const s = party.shipping_address || {};
  return [b.country, s.country].filter(Boolean);
}

function isIndiaParty(party) {
  const texts = partyCountryTexts(party);
  if (texts.length === 0) return true;
  return texts.every((t) => isIndiaCountryText(t));
}

function hasMissingIds(party) {
  return !party.country_id || !party.state_id;
}

function bump(map, key) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
}

async function main() {
  const mongoose = await connectMongo();
  const { PartyCountry, PartyState, PartyCity, Party } = require('../src/data/mongoRegistry').getModels();
  const { states: stateAliases, cities: cityAliases } = loadIndiaAliases();

  console.log(
    `[backfill-party-geo] DRY_RUN=${dryRun} ONLY_MISSING_IDS=${onlyMissing} FORCE=${force} LIMIT=${limit || 'all'}`
  );

  const india = await PartyCountry.findOne({ name: /^india$/i, deletedAt: null }).lean();
  if (!india) {
    throw new Error('India country not found — run scripts/seed-india-party-geo.js first');
  }
  const indiaId = String(india._id);

  const stateRows = await PartyState.find({ country: indiaId, deletedAt: null }).lean();
  const cityRows = await PartyCity.find({ deletedAt: null })
    .populate({ path: 'state', select: 'country' })
    .lean();
  const citiesInIndia = cityRows.filter(
    (c) => c.state && String(c.state.country || c.state) === indiaId
  );

  const stateLookup = buildStateLookup(stateRows, stateAliases);
  const cityLookup = buildCityLookup(
    citiesInIndia.map((c) => ({ _id: c._id, name: c.name, state: c.state._id || c.state }))
  );

  const filter = { deletedAt: null };
  if (onlyMissing && !force) {
    filter.$or = [
      { country_id: null },
      { country_id: { $exists: false } },
      { state_id: null },
      { state_id: { $exists: false } },
      { city_id: null },
      { city_id: { $exists: false } },
    ];
  }

  let cursor = Party.find(filter).lean();
  if (limit > 0) cursor = cursor.limit(limit);

  const parties = await cursor;

  const stats = {
    scanned: 0,
    skipped_non_india: 0,
    skipped_already_complete: 0,
    skipped_no_state_text: 0,
    updated: 0,
    state_only: 0,
    full_geo: 0,
  };

  const unmatchedStates = new Map();
  const unmatchedCities = new Map();
  /** @type {import('mongodb').AnyBulkWriteOperation[]} */
  const bulkOps = [];

  for (const party of parties) {
    stats.scanned += 1;

    if (!isIndiaParty(party)) {
      stats.skipped_non_india += 1;
      continue;
    }

    if (!force && party.country_id && party.state_id) {
      const cityText = pickCityText(party);
      if (party.city_id || !cityText) {
        stats.skipped_already_complete += 1;
        continue;
      }
    }

    const stateText = pickStateText(party);
    if (!stateText) {
      stats.skipped_no_state_text += 1;
      continue;
    }

    const stateHit = stateLookup.resolveStateText(stateText);
    if (!stateHit) {
      bump(unmatchedStates, stateText);
      continue;
    }

    let cityId = party.city_id ? String(party.city_id) : null;
    const cityText = pickCityText(party);
    if (cityText) {
      const displayCity = resolveCityDisplayName(cityText, cityAliases);
      const cityHit = cityLookup.resolveCityText(stateHit._id, displayCity, cityAliases);
      if (cityHit) cityId = cityHit._id;
      else bump(unmatchedCities, `${stateText}|${cityText}`);
    }

    const body = {
      country_id: indiaId,
      state_id: stateHit._id,
      city_id: cityId || undefined,
      state: stateHit.name,
      billing_address:
        party.billing_address && typeof party.billing_address === 'object'
          ? { ...party.billing_address }
          : {},
      shipping_address:
        party.shipping_address && typeof party.shipping_address === 'object'
          ? { ...party.shipping_address }
          : {},
    };

    await resolvePartyGeoFields(body);

    const $set = {
      country_id: body.country_id || null,
      state_id: body.state_id || null,
      city_id: body.city_id || null,
      state: body.state || party.state,
    };
    if (body.billing_address) $set.billing_address = body.billing_address;
    if (body.shipping_address) $set.shipping_address = body.shipping_address;

    if (cityId) stats.full_geo += 1;
    else stats.state_only += 1;

    if (dryRun) {
      if (stats.updated < 5) {
        console.log('[backfill-party-geo] sample patch', party._id, party.party_name, $set);
      }
      stats.updated += 1;
      continue;
    }

    bulkOps.push({
      updateOne: {
        filter: { _id: party._id },
        update: { $set },
      },
    });

    if (bulkOps.length >= batchSize) {
      const res = await Party.bulkWrite(bulkOps, { ordered: false });
      stats.updated += res.modifiedCount || 0;
      bulkOps.length = 0;
    }
  }

  if (!dryRun && bulkOps.length > 0) {
    const res = await Party.bulkWrite(bulkOps, { ordered: false });
    stats.updated += res.modifiedCount || 0;
  } else if (dryRun) {
    // updated already counted in loop
  }

  fs.mkdirSync(reportDir, { recursive: true });
  const summaryPath = path.join(reportDir, 'backfill-party-geo-summary.json');
  const topUnmatchedStates = [...unmatchedStates.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([text, count]) => ({ text, count }));
  const topUnmatchedCities = [...unmatchedCities.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([text, count]) => ({ text, count }));

  const summary = { ...stats, topUnmatchedStates, topUnmatchedCities, dryRun };
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  if (unmatchedStates.size > 0) {
    const csv = ['state_text,count\n', ...topUnmatchedStates.map((r) => `"${r.text.replace(/"/g, '""')}",${r.count}\n`)];
    fs.writeFileSync(path.join(reportDir, 'unmatched-states.csv'), csv.join(''));
  }
  if (unmatchedCities.size > 0) {
    const csv = ['state_text|city_text,count\n', ...topUnmatchedCities.map((r) => `"${r.text.replace(/"/g, '""')}",${r.count}\n`)];
    fs.writeFileSync(path.join(reportDir, 'unmatched-cities.csv'), csv.join(''));
  }

  console.log('[backfill-party-geo] Summary:', stats);
  console.log(`[backfill-party-geo] Report: ${summaryPath}`);

  await mongoose.disconnect();
  console.log('[backfill-party-geo] Done.');
}

main().catch((err) => {
  console.error('[backfill-party-geo]', err);
  process.exit(1);
});
