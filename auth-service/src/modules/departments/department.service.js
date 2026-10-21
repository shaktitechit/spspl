const Department = require('../../models/Department');
const { ApiError } = require('../../utils/ApiError');
const { toPlain } = require('../../utils/mongoJson');

const DEFAULT_DEPARTMENTS = [
  { name: 'Super Admin', code: 'super_admin', description: 'System super administrators' },
  { name: 'Admin', code: 'admin', description: 'Administrative staff' },
  { name: 'Sales', code: 'sales', description: 'Sales and CRM operations' },
  { name: 'Finance', code: 'finance', description: 'Financial management and accounting' },
  { name: 'Account', code: 'account', description: 'Accounts and billing' },
  { name: 'Dispatch', code: 'dispatch', description: 'Dispatch and logistics operations' },
];

async function listDepartments(query = {}) {
  const filter = { is_active: { $ne: false } };
  if (query.include_inactive === 'true') {
    delete filter.is_active;
  }
  const rows = await Department.find(filter).sort({ name: 1 }).lean();
  return rows.map(toPlain);
}

async function getDepartmentById(id) {
  const doc = await Department.findById(id).lean();
  if (!doc) throw new ApiError(404, 'Department not found');
  return toPlain(doc);
}

async function getDepartmentByCode(code) {
  const doc = await Department.findOne({ code: String(code).toLowerCase().trim() }).lean();
  return doc ? toPlain(doc) : null;
}

async function createDepartment(data) {
  const code = String(data.code).toLowerCase().trim();
  const existing = await Department.findOne({ code }).lean();
  if (existing) {
    throw new ApiError(409, `Department with code '${code}' already exists`);
  }

  const doc = await Department.create({
    name: data.name,
    code,
    description: data.description || '',
    is_active: data.is_active !== false,
  });

  return toPlain(await Department.findById(doc._id).lean());
}

async function updateDepartment(id, data) {
  const dept = await Department.findById(id);
  if (!dept) throw new ApiError(404, 'Department not found');

  if (data.name !== undefined) dept.name = data.name;
  if (data.description !== undefined) dept.description = data.description;
  if (data.is_active !== undefined) dept.is_active = data.is_active;

  if (data.code !== undefined && data.code.toLowerCase().trim() !== dept.code) {
    const newCode = data.code.toLowerCase().trim();
    const dup = await Department.findOne({ code: newCode, _id: { $ne: id } }).lean();
    if (dup) throw new ApiError(409, `Department with code '${newCode}' already exists`);
    dept.code = newCode;
  }

  await dept.save();
  return toPlain(await Department.findById(id).lean());
}

async function deleteDepartment(id) {
  const dept = await Department.findById(id);
  if (!dept) throw new ApiError(404, 'Department not found');

  await Department.findByIdAndDelete(id);
  return { success: true, message: 'Department deleted successfully' };
}

async function seedDefaultDepartments() {
  const results = [];
  for (const item of DEFAULT_DEPARTMENTS) {
    let doc = await Department.findOne({ code: item.code });
    if (!doc) {
      doc = await Department.create(item);
      results.push({ code: item.code, status: 'created' });
    } else {
      results.push({ code: item.code, status: 'exists' });
    }
  }
  return results;
}

module.exports = {
  listDepartments,
  getDepartmentById,
  getDepartmentByCode,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  seedDefaultDepartments,
};
