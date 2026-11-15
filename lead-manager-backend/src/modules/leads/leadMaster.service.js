/**
 * @fileoverview Lead Masters service: configurable Lead Sources & Lost Reasons CRUD.
 * @module modules/leads/leadMaster.service
 */
const { getModels } = require('../../data/mongoRegistry');
const { toPlain } = require('../../utils/mongoJson');
const { ApiError } = require('../../utils/ApiError');
const {
  softDeleteActiveById,
  restoreSoftDeletedById,
} = require('../../utils/mongoSoftDelete');

/* ----------------------------------------------------
 * LEAD SOURCES
 * -------------------------------------------------- */

async function listSources() {
  const { LeadSource } = getModels();
  const rows = await LeadSource.find({ deletedAt: null }).sort({ is_system: -1, name: 1 }).lean();
  return rows.map(toPlain);
}

async function createSource(body, user) {
  const { LeadSource } = getModels();
  if (!body.name || !String(body.name).trim()) {
    throw new ApiError(400, 'Source name is required');
  }

  const name = String(body.name).trim();
  const exists = await LeadSource.findOne({
    name: { $regex: new RegExp(`^${name}$`, 'i') },
    deletedAt: null,
  });
  if (exists) throw new ApiError(400, `Lead source '${name}' already exists`);

  const doc = await LeadSource.create({
    name,
    code: body.code ? String(body.code).trim().toLowerCase() : name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    description: body.description ? String(body.description).trim() : '',
    is_active: body.is_active !== undefined ? Boolean(body.is_active) : true,
    is_system: false,
    created_by: user._id,
    updated_by: user._id,
  });

  return toPlain(doc.toObject());
}

async function updateSource(id, body, user) {
  const { LeadSource } = getModels();
  const doc = await LeadSource.findOne({ _id: id, deletedAt: null });
  if (!doc) throw new ApiError(404, 'Lead source not found');

  if (body.name) {
    const name = String(body.name).trim();
    const exists = await LeadSource.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      _id: { $ne: id },
      deletedAt: null,
    });
    if (exists) throw new ApiError(400, `Lead source '${name}' already exists`);
    doc.name = name;
  }

  if (body.description !== undefined) doc.description = String(body.description).trim();
  if (body.is_active !== undefined) doc.is_active = Boolean(body.is_active);
  doc.updated_by = user._id;

  await doc.save();
  return toPlain(doc.toObject());
}

async function deleteSource(id, user) {
  const { LeadSource } = getModels();
  const doc = await softDeleteActiveById(LeadSource, id, {
    notFoundMessage: 'Lead source not found',
  });
  return toPlain(doc.toObject());
}

/* ----------------------------------------------------
 * LEAD LOST REASONS
 * -------------------------------------------------- */

async function listLostReasons() {
  const { LeadLostReason } = getModels();
  const rows = await LeadLostReason.find({ deletedAt: null }).sort({ is_system: -1, name: 1 }).lean();
  return rows.map(toPlain);
}

async function createLostReason(body, user) {
  const { LeadLostReason } = getModels();
  if (!body.name || !String(body.name).trim()) {
    throw new ApiError(400, 'Lost reason name is required');
  }

  const name = String(body.name).trim();
  const exists = await LeadLostReason.findOne({
    name: { $regex: new RegExp(`^${name}$`, 'i') },
    deletedAt: null,
  });
  if (exists) throw new ApiError(400, `Lost reason '${name}' already exists`);

  const doc = await LeadLostReason.create({
    name,
    code: body.code ? String(body.code).trim().toLowerCase() : name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    description: body.description ? String(body.description).trim() : '',
    is_active: body.is_active !== undefined ? Boolean(body.is_active) : true,
    is_system: false,
    created_by: user._id,
    updated_by: user._id,
  });

  return toPlain(doc.toObject());
}

async function updateLostReason(id, body, user) {
  const { LeadLostReason } = getModels();
  const doc = await LeadLostReason.findOne({ _id: id, deletedAt: null });
  if (!doc) throw new ApiError(404, 'Lost reason not found');

  if (body.name) {
    const name = String(body.name).trim();
    const exists = await LeadLostReason.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      _id: { $ne: id },
      deletedAt: null,
    });
    if (exists) throw new ApiError(400, `Lost reason '${name}' already exists`);
    doc.name = name;
  }

  if (body.description !== undefined) doc.description = String(body.description).trim();
  if (body.is_active !== undefined) doc.is_active = Boolean(body.is_active);
  doc.updated_by = user._id;

  await doc.save();
  return toPlain(doc.toObject());
}

async function deleteLostReason(id, user) {
  const { LeadLostReason } = getModels();
  const doc = await softDeleteActiveById(LeadLostReason, id, {
    notFoundMessage: 'Lost reason not found',
  });
  return toPlain(doc.toObject());
}

/* ----------------------------------------------------
 * LEAD DEPARTMENTS
 * -------------------------------------------------- */

const DEFAULT_DEPARTMENTS = [
  { name: 'UPS/Batteries', code: 'ups_batteries', sort_order: 1 },
  { name: 'Solar', code: 'solar', sort_order: 2 },
  { name: 'RO', code: 'ro', sort_order: 3 },
  { name: 'Works/Servo', code: 'works_servo', sort_order: 4 },
  { name: 'AMC', code: 'amc', sort_order: 5 },
  { name: 'Audit', code: 'audit', sort_order: 6 },
];

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function ensureDefaultDepartments() {
  const { LeadDepartment } = getModels();
  const existingCount = await LeadDepartment.countDocuments({ deletedAt: null });
  if (existingCount > 0) return;

  for (const dept of DEFAULT_DEPARTMENTS) {
    const existing = await LeadDepartment.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(dept.name)}$`, 'i') },
    });
    if (!existing) {
      await LeadDepartment.create({
        name: dept.name,
        code: dept.code,
        sort_order: dept.sort_order,
        is_active: true,
        is_system: true,
      });
    }
  }
}

async function listDepartments() {
  const { LeadDepartment } = getModels();
  await ensureDefaultDepartments();
  const rows = await LeadDepartment.find({ deletedAt: null })
    .sort({ sort_order: 1, is_system: -1, name: 1 })
    .lean();
  return rows.map(toPlain);
}

async function createDepartment(body, user) {
  const { LeadDepartment } = getModels();
  await ensureDefaultDepartments();

  if (!body.name || !String(body.name).trim()) {
    throw new ApiError(400, 'Department name is required');
  }

  const name = String(body.name).trim();
  const exists = await LeadDepartment.findOne({
    name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
    deletedAt: null,
  });
  if (exists) throw new ApiError(400, `Department '${name}' already exists`);

  const doc = await LeadDepartment.create({
    name,
    code: body.code
      ? String(body.code).trim().toLowerCase()
      : name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    description: body.description ? String(body.description).trim() : '',
    sort_order: Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 100,
    is_active: body.is_active !== undefined ? Boolean(body.is_active) : true,
    is_system: false,
    created_by: user._id,
    updated_by: user._id,
  });

  return toPlain(doc.toObject());
}

async function updateDepartment(id, body, user) {
  const { LeadDepartment } = getModels();
  const doc = await LeadDepartment.findOne({ _id: id, deletedAt: null });
  if (!doc) throw new ApiError(404, 'Department not found');

  if (body.name) {
    const name = String(body.name).trim();
    const exists = await LeadDepartment.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
      _id: { $ne: id },
      deletedAt: null,
    });
    if (exists) throw new ApiError(400, `Department '${name}' already exists`);
    doc.name = name;
  }

  if (body.description !== undefined) doc.description = String(body.description).trim();
  if (body.is_active !== undefined) doc.is_active = Boolean(body.is_active);
  if (body.sort_order !== undefined && Number.isFinite(Number(body.sort_order))) {
    doc.sort_order = Number(body.sort_order);
  }
  doc.updated_by = user._id;

  await doc.save();
  return toPlain(doc.toObject());
}

async function deleteDepartment(id) {
  const { LeadDepartment } = getModels();
  const doc = await softDeleteActiveById(LeadDepartment, id, {
    notFoundMessage: 'Department not found',
  });
  return toPlain(doc.toObject());
}

module.exports = {
  listSources,
  createSource,
  updateSource,
  deleteSource,
  listLostReasons,
  createLostReason,
  updateLostReason,
  deleteLostReason,
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  ensureDefaultDepartments,
};
