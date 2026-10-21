/**
 * @fileoverview PartyCountries: business rules and persistence.
 */
const { getModels } = require('../../data/mongoRegistry');
const { toPlain } = require('../../utils/mongoJson');
const { ApiError } = require('../../utils/ApiError');
const activityService = require('../activity/activity.service');

function buildListFilter(query = {}) {
  const filter = { deletedAt: null };

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
  const { PartyCountry } = getModels();
  const filter = buildListFilter(query);

  const limit = parseInt(query.limit, 10) || 100;
  const page = parseInt(query.page, 10) || 1;
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    PartyCountry.countDocuments(filter),
    PartyCountry.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
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
  const { PartyCountry } = getModels();
  const record = await PartyCountry.findOne({ _id: id, deletedAt: null }).lean();
  if (!record) throw new ApiError(404, 'Country not found');
  return toPlain(record);
}

async function create(body, user) {
  const { PartyCountry } = getModels();
  const name = String(body.name || '').trim();

  const dup = await PartyCountry.findOne({ name, deletedAt: null }).lean();
  if (dup) throw new ApiError(409, `Country named "${name}" already exists`);

  const doc = new PartyCountry({
    name,
    iso_code: body.iso_code != null ? String(body.iso_code).trim().toUpperCase() : undefined,
    description: body.description,
    is_active: body.is_active !== false,
    created_by: user?._id,
  });

  await doc.save();

  await activityService.create({
    actor: user?._id,
    entity_type: 'party',
    entity_id: doc._id,
    action: 'created',
    message: `Created party country: ${name}`,
  });

  return toPlain(doc.toObject());
}

async function update(id, body, user) {
  const { PartyCountry } = getModels();
  const record = await PartyCountry.findOne({ _id: id, deletedAt: null });
  if (!record) throw new ApiError(404, 'Country not found');

  if (body.name !== undefined) {
    const name = String(body.name || '').trim();
    if (!name) throw new ApiError(400, 'name is required');
    const dup = await PartyCountry.findOne({ name, _id: { $ne: id }, deletedAt: null }).lean();
    if (dup) throw new ApiError(409, `Country named "${name}" already exists`);
    record.name = name;
  }

  if (body.iso_code !== undefined) {
    record.iso_code = body.iso_code != null ? String(body.iso_code).trim().toUpperCase() : '';
  }
  if (body.description !== undefined) record.description = body.description;
  if (body.is_active !== undefined) {
    record.is_active = body.is_active === true || body.is_active === 'true';
  }

  record.updated_by = user?._id;
  await record.save();

  await activityService.create({
    actor: user?._id,
    entity_type: 'party',
    entity_id: id,
    action: 'updated',
    message: `Updated party country: ${record.name}`,
  });

  return toPlain(record.toObject());
}

async function softDelete(id, user) {
  const { PartyCountry, PartyState, Party } = getModels();
  const record = await PartyCountry.findOne({ _id: id, deletedAt: null });
  if (!record) throw new ApiError(404, 'Country not found');

  const childStates = await PartyState.countDocuments({ country: id, deletedAt: null });
  if (childStates > 0) {
    throw new ApiError(409, 'Cannot delete country while states exist under it');
  }

  const partyRefs = await Party.countDocuments({ country_id: id, deletedAt: null });
  if (partyRefs > 0) {
    throw new ApiError(409, 'Cannot delete country while parties reference it');
  }

  record.deletedAt = new Date();
  record.updated_by = user?._id;
  await record.save();

  await activityService.create({
    actor: user?._id,
    entity_type: 'party',
    entity_id: id,
    action: 'deleted',
    message: `Deleted party country: ${record.name}`,
  });

  return { success: true };
}

module.exports = { list, get, create, update, softDelete };
