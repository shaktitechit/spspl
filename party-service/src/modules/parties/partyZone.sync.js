/**
 * @fileoverview Keep Party.zone_id in sync with Zone.parties membership.
 */
const { getModels } = require('../../data/mongoRegistry');
const { ApiError } = require('../../utils/ApiError');

async function assertZoneExists(zoneId) {
  if (!zoneId) return null;
  const { Zone } = getModels();
  const zone = await Zone.findOne({ _id: zoneId, deletedAt: null }).lean();
  if (!zone) throw new ApiError(400, 'Invalid zone_id');
  return zone;
}

async function syncPartyZoneMembership(partyId, zoneId) {
  const { Zone } = getModels();
  const pid = partyId;

  await Zone.updateMany(
    { parties: pid, deletedAt: null },
    { $pull: { parties: pid } }
  );

  if (zoneId) {
    await Zone.updateOne(
      { _id: zoneId, deletedAt: null },
      { $addToSet: { parties: pid } }
    );
  }
}

async function resolveZoneIdFromName(name) {
  const trimmed = name != null ? String(name).trim() : '';
  if (!trimmed) return null;
  const { Zone } = getModels();
  const zone = await Zone.findOne({
    name: { $regex: `^${trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    deletedAt: null,
  }).lean();
  return zone ? String(zone._id) : null;
}

async function inferZoneIdForParty(partyId) {
  const { Zone } = getModels();
  const zone = await Zone.findOne({ parties: partyId, deletedAt: null }).select('_id').lean();
  return zone ? String(zone._id) : null;
}

/**
 * After Zone.parties is updated, keep Party.zone_id and zone membership arrays aligned.
 */
async function syncPartyZoneIdsForZoneAssignment(zoneId, nextPartyIds, prevPartyIds = []) {
  const { Party } = getModels();
  const prevSet = new Set((prevPartyIds || []).map(String));
  const nextSet = new Set((nextPartyIds || []).map(String));

  for (const pid of nextSet) {
    await Party.updateOne({ _id: pid, deletedAt: null }, { $set: { zone_id: zoneId } });
    await syncPartyZoneMembership(pid, zoneId);
  }

  for (const pid of prevSet) {
    if (nextSet.has(String(pid))) continue;
    await Party.updateOne(
      { _id: pid, deletedAt: null, zone_id: zoneId },
      { $set: { zone_id: null } }
    );
    await syncPartyZoneMembership(pid, null);
  }
}

/** Fill missing zone_id on list rows from Zone.parties (legacy / zone UI only). */
async function hydratePartyZoneIdsFromMembership(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const missingIds = rows.filter((r) => !r.zone_id).map((r) => r._id);
  if (missingIds.length === 0) return rows;

  const { Zone } = getModels();
  const zones = await Zone.find({ deletedAt: null, parties: { $in: missingIds } })
    .select('parties')
    .lean();

  const zoneIdByParty = new Map();
  for (const zone of zones) {
    for (const pid of zone.parties || []) {
      const key = String(pid);
      if (!zoneIdByParty.has(key)) zoneIdByParty.set(key, String(zone._id));
    }
  }

  return rows.map((row) => {
    if (row.zone_id) return row;
    const inferred = zoneIdByParty.get(String(row._id));
    return inferred ? { ...row, zone_id: inferred } : row;
  });
}

module.exports = {
  assertZoneExists,
  syncPartyZoneMembership,
  resolveZoneIdFromName,
  inferZoneIdForParty,
  syncPartyZoneIdsForZoneAssignment,
  hydratePartyZoneIdsFromMembership,
};
