/**
 * @fileoverview PartyStates: business rules and persistence.
 */
const { getModels } = require('../../data/mongoRegistry');
const { toPlain } = require('../../utils/mongoJson');
const { ApiError } = require('../../utils/ApiError');
const activityService = require('../activity/activity.service');

function buildListFilter(query = {}) {
  const filter = { deletedAt: null };

  if (query.country_id) {
    filter.country = query.country_id;
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
  const { PartyState } = getModels();
  const filter = buildListFilter(query);

  const limit = parseInt(query.limit, 10) || 100;
  const page = parseInt(query.page, 10) || 1;
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    PartyState.countDocuments(filter),
    PartyState.find(filter)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .populate('country')
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
  const { PartyState } = getModels();
  const record = await PartyState.findOne({ _id: id, deletedAt: null }).populate('country').lean();
  if (!record) throw new ApiError(404, 'State not found');
  return toPlain(record);
}

async function assertCountryExists(countryId) {
  const { PartyCountry } = getModels();
  const country = await PartyCountry.findOne({ _id: countryId, deletedAt: null }).lean();
  if (!country) throw new ApiError(400, 'Invalid country');
  return country;
}

async function create(body, user) {
  const { PartyState } = getModels();
  const name = String(body.name || '').trim();
  const countryId = String(body.country || '').trim();

  await assertCountryExists(countryId);

  const dup = await PartyState.findOne({ name, country: countryId, deletedAt: null }).lean();
  if (dup) throw new ApiError(409, `State named "${name}" already exists in this country`);

  const doc = new PartyState({
    name,
    country: countryId,
    description: body.description,
    is_active: body.is_active !== false,
    created_by: user?._id,
  });

  await doc.save();
  const populated = await PartyState.findById(doc._id).populate('country').lean();

  await activityService.create({
    actor: user?._id,
    entity_type: 'party',
    entity_id: doc._id,
    action: 'created',
    message: `Created party state: ${name}`,
  });

  return toPlain(populated);
}

async function update(id, body, user) {
  const { PartyState } = getModels();
  const record = await PartyState.findOne({ _id: id, deletedAt: null });
  if (!record) throw new ApiError(404, 'State not found');

  let countryId = record.country;

  if (body.country !== undefined) {
    countryId = String(body.country || '').trim();
    if (!countryId) throw new ApiError(400, 'country is required');
    await assertCountryExists(countryId);
    record.country = countryId;
  }

  if (body.name !== undefined) {
    const name = String(body.name || '').trim();
    if (!name) throw new ApiError(400, 'name is required');
    const dup = await PartyState.findOne({
      name,
      country: countryId,
      _id: { $ne: id },
      deletedAt: null,
    }).lean();
    if (dup) throw new ApiError(409, `State named "${name}" already exists in this country`);
    record.name = name;
  }

  if (body.description !== undefined) record.description = body.description;
  if (body.is_active !== undefined) {
    record.is_active = body.is_active === true || body.is_active === 'true';
  }

  record.updated_by = user?._id;
  await record.save();

  const populated = await PartyState.findById(record._id).populate('country').lean();

  await activityService.create({
    actor: user?._id,
    entity_type: 'party',
    entity_id: id,
    action: 'updated',
    message: `Updated party state: ${record.name}`,
  });

  return toPlain(populated);
}

async function softDelete(id, user) {
  const { PartyState, PartyCity, Party } = getModels();
  const record = await PartyState.findOne({ _id: id, deletedAt: null });
  if (!record) throw new ApiError(404, 'State not found');

  const childCities = await PartyCity.countDocuments({ state: id, deletedAt: null });
  if (childCities > 0) {
    throw new ApiError(409, 'Cannot delete state while cities exist under it');
  }

  const partyRefs = await Party.countDocuments({ state_id: id, deletedAt: null });
  if (partyRefs > 0) {
    throw new ApiError(409, 'Cannot delete state while parties reference it');
  }

  record.deletedAt = new Date();
  record.updated_by = user?._id;
  await record.save();

  await activityService.create({
    actor: user?._id,
    entity_type: 'party',
    entity_id: id,
    action: 'deleted',
    message: `Deleted party state: ${record.name}`,
  });

  return { success: true };
}

module.exports = { list, get, create, update, softDelete };
