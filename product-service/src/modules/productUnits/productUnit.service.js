/**
 * @fileoverview ProductUnits: business rules and mongoose persistence helpers.
 * @module modules/productUnits/productUnit.service
 */
const { getModels } = require('../../data/mongoRegistry');
const { toPlain } = require('../../utils/mongoJson');
const { ApiError } = require('../../utils/ApiError');
const activityService = require('../activity/activity.service');
const { PRODUCT_UNIT_SEED } = require('./productUnit.constants');

async function ensureProductUnitsSeeded() {
  const { ProductUnit } = getModels();
  const count = await ProductUnit.countDocuments({ deletedAt: null });
  if (count > 0) return { seeded: false, count };

  for (const row of PRODUCT_UNIT_SEED) {
    // eslint-disable-next-line no-await-in-loop
    await ProductUnit.create({
      name: row.name,
      is_default: !!row.is_default,
      is_active: true,
    });
  }
  console.log(`[product-service] Seeded ${PRODUCT_UNIT_SEED.length} ProductUnit records`);
  return { seeded: true, count: PRODUCT_UNIT_SEED.length };
}

async function getDefaultProductUnit() {
  const { ProductUnit } = getModels();
  let doc = await ProductUnit.findOne({ is_default: true, deletedAt: null, is_active: { $ne: false } }).lean();
  if (!doc) {
    doc = await ProductUnit.findOne({ name: /^Pcs$/i, deletedAt: null }).lean();
  }
  if (!doc) {
    doc = await ProductUnit.findOne({ deletedAt: null }).sort({ name: 1 }).lean();
  }
  return doc;
}

async function list(query = {}) {
  await ensureProductUnitsSeeded();
  const { ProductUnit } = getModels();
  const filter = { deletedAt: null };

  if (query.search) {
    filter.name = { $regex: String(query.search).trim(), $options: 'i' };
  }
  if (query.is_active !== undefined && query.is_active !== '') {
    filter.is_active = query.is_active === 'true' || query.is_active === true;
  }

  const limit = parseInt(query.limit, 10) || 100;
  const page = parseInt(query.page, 10) || 1;
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    ProductUnit.countDocuments(filter),
    ProductUnit.find(filter)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
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
  const { ProductUnit } = getModels();
  const row = await ProductUnit.findOne({ _id: id, deletedAt: null }).lean();
  if (!row) throw new ApiError(404, 'Product Unit not found');
  return toPlain(row);
}

async function clearOtherDefaults(exceptId) {
  const { ProductUnit } = getModels();
  await ProductUnit.updateMany(
    { _id: { $ne: exceptId }, is_default: true, deletedAt: null },
    { $set: { is_default: false } },
  );
}

async function create(body, user) {
  const { ProductUnit } = getModels();
  const name = String(body.name).trim();

  const existing = await ProductUnit.findOne({
    name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    deletedAt: null,
  });
  if (existing) throw new ApiError(400, `Product Unit with name "${name}" already exists`);

  const isDefault = !!body.is_default;
  const doc = await ProductUnit.create({
    name,
    description: body.description ? String(body.description).trim() : undefined,
    is_active: body.is_active !== false,
    is_featured: !!body.is_featured,
    is_default: isDefault,
    created_by: user?._id,
  });

  if (isDefault) {
    await clearOtherDefaults(doc._id);
  }

  await activityService.create({
    actor: user?._id,
    entity_type: 'product_unit',
    entity_id: doc._id,
    action: 'created',
    message: `Product Unit "${name}" created.`,
  });

  return toPlain(doc.toObject());
}

async function update(id, body, user) {
  const { ProductUnit } = getModels();
  const doc = await ProductUnit.findOne({ _id: id, deletedAt: null });
  if (!doc) throw new ApiError(404, 'Product Unit not found');

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) throw new ApiError(400, 'name cannot be empty');

    const existing = await ProductUnit.findOne({
      _id: { $ne: id },
      name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      deletedAt: null,
    });
    if (existing) throw new ApiError(400, `Product Unit with name "${name}" already exists`);

    doc.name = name;
  }

  if (body.description !== undefined) {
    doc.description = body.description ? String(body.description).trim() : null;
  }
  if (body.is_active !== undefined) {
    doc.is_active = !!body.is_active;
  }
  if (body.is_featured !== undefined) {
    doc.is_featured = !!body.is_featured;
  }
  if (body.is_default !== undefined) {
    doc.is_default = !!body.is_default;
  }
  doc.updated_by = user?._id;

  await doc.save();

  if (doc.is_default) {
    await clearOtherDefaults(doc._id);
  }

  await activityService.create({
    actor: user?._id,
    entity_type: 'product_unit',
    entity_id: doc._id,
    action: 'updated',
    message: `Product Unit "${doc.name}" updated.`,
  });

  return toPlain(doc.toObject());
}

async function softDelete(id, user) {
  const { ProductUnit, Product } = getModels();
  const doc = await ProductUnit.findOne({ _id: id, deletedAt: null });
  if (!doc) throw new ApiError(404, 'Product Unit not found');

  const inUse = await Product.countDocuments({ unit: id, deletedAt: null });
  if (inUse > 0) {
    throw new ApiError(400, `Cannot delete unit "${doc.name}" — ${inUse} product(s) still use it`);
  }

  doc.deletedAt = new Date();
  doc.is_default = false;
  doc.updated_by = user?._id;
  await doc.save();

  await activityService.create({
    actor: user?._id,
    entity_type: 'product_unit',
    entity_id: doc._id,
    action: 'deleted',
    message: `Product Unit "${doc.name}" soft deleted.`,
  });

  return { success: true };
}

async function bulkCreate(bodies, user) {
  if (!Array.isArray(bodies)) throw new ApiError(400, 'Array of objects required');
  const results = [];
  for (const body of bodies) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await create(body, user);
      results.push({ success: true, data: res });
    } catch (err) {
      results.push({ success: false, error: err.message, input: body });
    }
  }
  return results;
}

async function bulkDelete(ids, user) {
  if (!Array.isArray(ids)) throw new ApiError(400, 'Array of IDs required');
  const results = [];
  for (const id of ids) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await softDelete(id, user);
      results.push({ success: true, id });
    } catch (err) {
      results.push({ success: false, error: err.message, id });
    }
  }
  return results;
}

async function getProducts(id) {
  const { findProductsLean } = require('../products/productRefs');
  const rows = await findProductsLean({ unit: id, deletedAt: null });
  return rows.map(toPlain);
}

async function associateProducts(id, productIds, user) {
  if (!Array.isArray(productIds)) throw new ApiError(400, 'productIds must be an array of strings');
  const { Product } = getModels();

  await Product.updateMany(
    { _id: { $in: productIds } },
    { $set: { unit: id, updated_by: user?._id } },
  );

  return { success: true, count: productIds.length };
}

module.exports = {
  list,
  get,
  create,
  update,
  softDelete,
  bulkCreate,
  bulkDelete,
  getProducts,
  associateProducts,
  ensureProductUnitsSeeded,
  getDefaultProductUnit,
};
