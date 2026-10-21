const mongoose = require('mongoose');
const Role = require('../../models/Role');
const { ApiError } = require('../../utils/ApiError');

function coerceRoleIds(raw) {
  let list = [];
  if (raw == null || raw === '') list = [];
  else if (Array.isArray(raw)) list = raw;
  else if (typeof raw === 'string') {
    const t = raw.trim();
    if (t.startsWith('[')) {
      try {
        const parsed = JSON.parse(t);
        list = Array.isArray(parsed) ? parsed : [];
      } catch {
        list = [];
      }
    } else {
      list = t.split(',').map((s) => s.trim()).filter(Boolean);
    }
  } else if (typeof raw === 'object') {
    const keys = Object.keys(raw)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b));
    if (keys.length) list = keys.map((k) => raw[k]).filter(Boolean);
  }

  const seen = new Set();
  const out = [];
  for (const item of list) {
    let s;
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const o = item;
      s = String(o._id ?? o.id ?? '').trim();
    } else {
      s = String(item).trim();
    }
    if (!s || seen.has(s)) continue;
    seen.add(s);
    if (!mongoose.Types.ObjectId.isValid(s)) {
      throw new ApiError(400, `Invalid role id: ${s}`);
    }
    try {
      out.push(new mongoose.Types.ObjectId(s));
    } catch {
      throw new ApiError(400, `Invalid role id: ${s}`);
    }
  }
  return out;
}

async function findActiveRoleIdByCode(code) {
  const c = String(code || '').toLowerCase().trim();
  if (!c) return null;
  const row = await Role.findOne({ code: c, is_active: { $ne: false } }).select('_id').lean();
  return row?._id ?? null;
}

async function resolveDefaultRoleIdsForDepartment(department) {
  const dept = String(department || '').toLowerCase().trim();
  if (!dept) return [];

  // Check for explicitly assigned default role for the department
  const defaultRoleDoc = await Role.findOne({
    department: dept,
    is_default_role: true,
    is_active: { $ne: false },
  }).select('_id').lean();
  if (defaultRoleDoc) return [defaultRoleDoc._id];

  const byCode = await findActiveRoleIdByCode(dept);
  if (byCode) return [byCode];

  const row = await Role.findOne({ department: dept, is_active: { $ne: false } })
    .sort({ is_default_role: -1, is_system_role: -1, code: 1 })
    .select('_id')
    .lean();
  return row?._id ? [row._id] : [];
}

async function resolveRoleIdsForUser(body) {
  let roleIds = coerceRoleIds(body?.roles);

  if (!roleIds.length && body?.department) {
    const id = await findActiveRoleIdByCode(body.department);
    if (id) roleIds = [id];
  }

  if (!roleIds.length && body?.roleCode) {
    const id = await findActiveRoleIdByCode(body.roleCode);
    if (id) roleIds = [id];
    else throw new ApiError(400, `Unknown or inactive role code: ${body.roleCode}`);
  }

  if (!roleIds.length && body?.role) {
    const id = await findActiveRoleIdByCode(body.role);
    if (id) roleIds = [id];
    else throw new ApiError(400, `Unknown or inactive role code: ${body.role}`);
  }

  if (!roleIds.length && body?.department) {
    roleIds = await resolveDefaultRoleIdsForDepartment(body.department);
    if (!roleIds.length) {
      throw new ApiError(
        400,
        `No active role found for department "${body.department}".`
      );
    }
  }

  return roleIds;
}

async function assertRolesExist(roleObjectIds) {
  if (!roleObjectIds.length) return;
  const existing = await Role.find({
    _id: { $in: roleObjectIds },
    is_active: { $ne: false },
  })
    .select('_id')
    .lean();

  const have = new Set(existing.map((r) => String(r._id)));
  const missing = roleObjectIds.filter((id) => !have.has(String(id)));
  if (missing.length) {
    throw new ApiError(
      400,
      `Unknown or inactive role id(s): ${missing.map(String).join(', ')}`
    );
  }
}

module.exports = {
  coerceRoleIds,
  resolveRoleIdsForUser,
  resolveDefaultRoleIdsForDepartment,
  assertRolesExist,
};
