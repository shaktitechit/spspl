/**
 * @fileoverview PartyCities: business rules and persistence.
 */
const { getModels } = require('../../data/mongoRegistry');
const { toPlain } = require('../../utils/mongoJson');
const { ApiError } = require('../../utils/ApiError');
const activityService = require('../activity/activity.service');

function buildListFilter(query = {}) {
  const filter = { deletedAt: null };

  if (query.state_id) {
    filter.state = query.state_id;
  }

  if (query.country_id) {
    // filter via state ids belonging to country
    // handled in list() when country_id present
  }

  if (query.search) {
    filter.name = { $regex: String(query.search).trim(), $options: 'i' };
  }

  if (query.is_active !== undefined && query.is_active !== '') {
    filter.is_active = query.is_active === 'true' || query.is_active === true;
  } else if (query.status && query.status !== 'all') {
    if (query.status === 'active') filter.is_active = { $ne: false };
    else if (query.status === 'inactive') filter.is_active = false;
  }

  return filter;
}

async function list(query = {}) {
  const { PartyCity, PartyState } = getModels();
  const filter = buildListFilter(query);

  if (!query.state_id && query.country_id) {
    const stateIds = await PartyState.find({
      country: query.country_id,
      deletedAt: null,
    })
      .distinct('_id');
    filter.state = { $in: stateIds };
  }

  const limit = parseInt(query.limit, 10) || 100;
  const page = parseInt(query.page, 10) || 1;
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    PartyCity.countDocuments(filter),
    PartyCity.find(filter)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: 'state', populate: { path: 'country' } })
      .lean(),
  ]);

  return {
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
    data: rows.map(toPlain),
  };
}

async function get(id) {
  const { PartyCity } = getModels();
  const record = await PartyCity.findOne({ _id: id, deletedAt: null })
    .populate({ path: 'state', populate: { path: 'country' } })
    .lean();
  if (!record) throw new ApiError(404, 'City not found');
  return toPlain(record);
}

async function assertStateExists(stateId) {
  const { PartyState } = getModels();
  const state = await PartyState.findOne({ _id: stateId, deletedAt: null }).lean();
  if (!state) throw new ApiError(400, 'Invalid state');
  return state;
}

async function create(body, user) {
  const { PartyCity } = getModels();
  const name = String(body.name || '').trim();
  const stateId = String(body.state || '').trim();

  await assertStateExists(stateId);

  const dup = await PartyCity.findOne({ name, state: stateId, deletedAt: null }).lean();
  if (dup) throw new ApiError(409, `City named "${name}" already exists in this state`);

  const doc = new PartyCity({
    name,
    state: stateId,
    description: body.description,
    is_active: body.is_active !== false,
    created_by: user?._id,
  });

  await doc.save();
  const populated = await PartyCity.findById(doc._id)
    .populate({ path: 'state', populate: { path: 'country' } })
    .lean();

  await activityService.create({
    actor: user?._id,
    entity_type: 'party',
    entity_id: doc._id,
    action: 'created',
    message: `Created party city: ${name}`,
  });

  return toPlain(populated);
}

async function update(id, body, user) {
  const { PartyCity } = getModels();
  const record = await PartyCity.findOne({ _id: id, deletedAt: null });
  if (!record) throw new ApiError(404, 'City not found');

  let stateId = record.state;

  if (body.state !== undefined) {
    stateId = String(body.state || '').trim();
    if (!stateId) throw new ApiError(400, 'state is required');
    await assertStateExists(stateId);
    record.state = stateId;
  }

  if (body.name !== undefined) {
    const name = String(body.name || '').trim();
    if (!name) throw new ApiError(400, 'name is required');
    const dup = await PartyCity.findOne({
      name,
      state: stateId,
      _id: { $ne: id },
      deletedAt: null,
    }).lean();
    if (dup) throw new ApiError(409, `City named "${name}" already exists in this state`);
    record.name = name;
  }

  if (body.description !== undefined) record.description = body.description;
  if (body.is_active !== undefined) {
    record.is_active = body.is_active === true || body.is_active === 'true';
  }

  record.updated_by = user?._id;
  await record.save();

  const populated = await PartyCity.findById(record._id)
    .populate({ path: 'state', populate: { path: 'country' } })
    .lean();

  await activityService.create({
    actor: user?._id,
    entity_type: 'party',
    entity_id: id,
    action: 'updated',
    message: `Updated party city: ${record.name}`,
  });

  return toPlain(populated);
}

async function softDelete(id, user) {
  const { PartyCity, Party } = getModels();
  const record = await PartyCity.findOne({ _id: id, deletedAt: null });
  if (!record) throw new ApiError(404, 'City not found');

  const partyRefs = await Party.countDocuments({ city_id: id, deletedAt: null });
  if (partyRefs > 0) {
    throw new ApiError(409, 'Cannot delete city while parties reference it');
  }

  record.deletedAt = new Date();
  record.updated_by = user?._id;
  await record.save();

  await activityService.create({
    actor: user?._id,
    entity_type: 'party',
    entity_id: id,
    action: 'deleted',
    message: `Deleted party city: ${record.name}`,
  });

  return { success: true };
}

module.exports = { list, get, create, update, softDelete };
