/**
 * Set Party.zone_id from Zone.parties membership when zone_id is missing.
 *
 * Usage:
 *   node scripts/backfill-party-zone-id.js
 *   DRY_RUN=1 node scripts/backfill-party-zone-id.js
 */
const { connectMongo } = require('./lib/connectMongo');

const dryRun = String(process.env.DRY_RUN || '') === '1';

async function main() {
  const mongoose = await connectMongo();
  const { Party, Zone } = require('../src/data/mongoRegistry').getModels();

  const zones = await Zone.find({ deletedAt: null, parties: { $exists: true, $ne: [] } })
    .select('_id name parties')
    .lean();

  let updated = 0;
  let skipped = 0;

  for (const zone of zones) {
    const partyIds = Array.isArray(zone.parties) ? zone.parties : [];
    for (const pid of partyIds) {
      const party = await Party.findOne({ _id: pid, deletedAt: null }).select('_id zone_id party_name').lean();
      if (!party) continue;
      if (party.zone_id && String(party.zone_id) === String(zone._id)) {
        skipped += 1;
        continue;
      }
      if (party.zone_id && String(party.zone_id) !== String(zone._id)) {
        console.warn(
          `Party ${party._id} (${party.party_name}) has zone_id ${party.zone_id} but is listed on zone ${zone._id} (${zone.name})`
        );
        continue;
      }
      if (dryRun) {
        console.log(`Would set party ${party._id} zone_id -> ${zone._id} (${zone.name})`);
      } else {
        await Party.updateOne({ _id: party._id }, { $set: { zone_id: zone._id } });
      }
      updated += 1;
    }
  }

  console.log(`Done. updated=${updated} skipped=${skipped} dryRun=${dryRun}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
