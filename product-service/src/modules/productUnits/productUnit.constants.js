/**
 * @fileoverview Seed catalog + legacy slug → display name (pre–ProductUnit migration).
 * @module modules/productUnits/productUnit.constants
 */
const PRODUCT_UNIT_SEED = Object.freeze([
  { name: 'Pcs', is_default: true },
  { name: 'Bag' },
  { name: 'Kg' },
  { name: 'Kgs.' },
  { name: 'Ltr' },
  { name: 'Metre' },
  { name: 'NA' },
  { name: 'Pack' },
  { name: 'Set' },
  { name: 'Unit' },
  { name: 'Units' },
  { name: 'WATT' },
  { name: 'Box' },
  { name: 'Kit' },
  { name: 'Bottle' },
]);

const LEGACY_UNIT_SLUG_TO_NAME = Object.freeze({
  pcs: 'Pcs',
  bag: 'Bag',
  pack: 'Pack',
  kg: 'Kg',
  kgs: 'Kgs.',
  ltr: 'Ltr',
  meter: 'Metre',
  metre: 'Metre',
  set: 'Set',
  unit: 'Unit',
  units: 'Units',
  na: 'NA',
  watt: 'WATT',
  box: 'Box',
  kit: 'Kit',
  bottle: 'Bottle',
});

function legacySlugToUnitName(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const s = String(raw).trim();
  const lower = s.toLowerCase().replace(/\.$/, '');
  if (LEGACY_UNIT_SLUG_TO_NAME[lower]) return LEGACY_UNIT_SLUG_TO_NAME[lower];
  if (LEGACY_UNIT_SLUG_TO_NAME[s.toLowerCase()]) return LEGACY_UNIT_SLUG_TO_NAME[s.toLowerCase()];
  return s;
}

module.exports = {
  PRODUCT_UNIT_SEED,
  LEGACY_UNIT_SLUG_TO_NAME,
  legacySlugToUnitName,
};
