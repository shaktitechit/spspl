const Portal = require('../../models/Portal');
const { ApiError } = require('../../utils/ApiError');
const { toPlain } = require('../../utils/mongoJson');

const DEFAULT_PORTALS = [
  {
    name: 'OPMS Portal',
    code: 'opms',
    description: 'Order / production management system',
    access_roles: ['super_admin', 'admin', 'sales', 'finance', 'account', 'dispatch'],
  },
  {
    name: 'Work Planner Portal',
    code: 'work_planner',
    description: 'Field visits and daily work planner management',
    access_roles: ['super_admin', 'admin', 'manager', 'coordinator', 'executive'],
  },
  {
    name: 'Lead Manager Portal',
    code: 'lead_manager',
    description: 'Lead generation and CRM pipeline management',
    access_roles: ['super_admin', 'admin', 'manager', 'coordinator', 'executive'],
  },
];

async function listPortals(query = {}) {
  const filter = { is_active: { $ne: false } };
  if (query.include_inactive === 'true') {
    delete filter.is_active;
  }
  const rows = await Portal.find(filter).sort({ name: 1 }).lean();
  return rows.map(toPlain);
}

async function getPortalById(id) {
  const doc = await Portal.findById(id).lean();
  if (!doc) throw new ApiError(404, 'Portal not found');
  return toPlain(doc);
}

async function getPortalByCode(code) {
  const doc = await Portal.findOne({ code: String(code).toLowerCase().trim() }).lean();
  return doc ? toPlain(doc) : null;
}

async function createPortal(data) {
  const code = String(data.code).toLowerCase().trim();
  const existing = await Portal.findOne({ code }).lean();
  if (existing) {
    throw new ApiError(409, `Portal with code '${code}' already exists`);
  }

  const doc = await Portal.create({
    name: data.name,
    code,
    description: data.description || '',
    access_roles: Array.isArray(data.access_roles) ? data.access_roles : ['executive', 'manager'],
    is_active: data.is_active !== false,
  });

  return toPlain(await Portal.findById(doc._id).lean());
}

async function updatePortal(id, data) {
  const portal = await Portal.findById(id);
  if (!portal) throw new ApiError(404, 'Portal not found');

  if (data.name !== undefined) portal.name = data.name;
  if (data.description !== undefined) portal.description = data.description;
  if (data.access_roles !== undefined) {
    portal.access_roles = Array.isArray(data.access_roles) ? data.access_roles : [];
  }
  if (data.is_active !== undefined) portal.is_active = data.is_active;

  if (data.code !== undefined && data.code.toLowerCase().trim() !== portal.code) {
    const newCode = data.code.toLowerCase().trim();
    const dup = await Portal.findOne({ code: newCode, _id: { $ne: id } }).lean();
    if (dup) throw new ApiError(409, `Portal with code '${newCode}' already exists`);
    portal.code = newCode;
  }

  await portal.save();
  return toPlain(await Portal.findById(id).lean());
}

async function deletePortal(id) {
  const portal = await Portal.findById(id);
  if (!portal) throw new ApiError(404, 'Portal not found');

  await Portal.findByIdAndDelete(id);
  return { success: true, message: 'Portal deleted successfully' };
}

async function seedDefaultPortals() {
  const results = [];
  for (const item of DEFAULT_PORTALS) {
    let doc = await Portal.findOne({ code: item.code });
    if (!doc) {
      doc = await Portal.create(item);
      results.push({ code: item.code, status: 'created' });
    } else {
      let updated = false;
      for (const role of item.access_roles) {
        if (!doc.access_roles.includes(role)) {
          doc.access_roles.push(role);
          updated = true;
        }
      }
      if (updated) await doc.save();
      results.push({ code: item.code, status: updated ? 'updated' : 'exists' });
    }
  }
  return results;
}

module.exports = {
  listPortals,
  getPortalById,
  getPortalByCode,
  createPortal,
  updatePortal,
  deletePortal,
  seedDefaultPortals,
};
