/**
 * @fileoverview Seed default units + migrate legacy string unit values on Product docs.
 * @module modules/productUnits/productUnit.bootstrap
 */
const mongoose = require('mongoose');
const { getModels } = require('../../data/mongoRegistry');
const { PRODUCT_UNIT_SEED, legacySlugToUnitName } = require('./productUnit.constants');
const { ensureProductUnitsSeeded } = require('./productUnit.service');

async function migrateLegacyProductUnits() {
  const { Product, ProductUnit } = getModels();
  if (!Product || !ProductUnit) return { migrated: 0 };

  const units = await ProductUnit.find({ deletedAt: null }).lean();
  const byName = new Map(units.map((u) => [String(u.name).trim().toLowerCase(), u]));

  const cursor = Product.collection.find({
    deletedAt: null,
    unit: { $type: 'string' },
  });

  let migrated = 0;
  // eslint-disable-next-line no-restricted-syntax
  for await (const doc of cursor) {
    const raw = doc.unit;
    if (!raw || typeof raw !== 'string') continue;
    if (/^[0-9a-fA-F]{24}$/.test(raw.trim())) continue;

    const displayName = legacySlugToUnitName(raw);
    if (!displayName) continue;

    let unitDoc = byName.get(displayName.toLowerCase());
    if (!unitDoc) {
      const created = await ProductUnit.create({ name: displayName, is_active: true });
      unitDoc = created.toObject();
      byName.set(displayName.toLowerCase(), unitDoc);
    }

    await Product.collection.updateOne(
      { _id: doc._id },
      { $set: { unit: new mongoose.Types.ObjectId(String(unitDoc._id)) } },
    );
    migrated += 1;
  }

  if (migrated > 0) {
    console.log(`[product-service] Migrated ${migrated} product unit field(s) to ProductUnit refs`);
  }
  return { migrated };
}

async function bootstrapProductUnits() {
  await ensureProductUnitsSeeded();
  await migrateLegacyProductUnits();
}

module.exports = {
  bootstrapProductUnits,
  migrateLegacyProductUnits,
  ensureProductUnitsSeeded,
};
