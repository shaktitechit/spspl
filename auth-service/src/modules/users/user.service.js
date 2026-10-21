const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const Role = require('../../models/Role');
const Portal = require('../../models/Portal');
const Department = require('../../models/Department');
const { toPlain } = require('../../utils/mongoJson');
const { ApiError } = require('../../utils/ApiError');
const { sanitizeUser } = require('../../utils/sanitize');
const { APP_LOGIN_URL, JWT_SECRET } = require('../../config/env');
const emailHelper = require('../messages/helpers/email.helper');
const {
  resolveRoleIdsForUser,
  resolveDefaultRoleIdsForDepartment,
  assertRolesExist,
} = require('./userRoles.util');

const TEMPLATE_WELCOME = 'welcome';
const TEMPLATE_PORTAL_ASSIGNED = 'portal_assigned';

async function sendWelcomeEmail({ name, email, password }) {
  try {
    await emailHelper.sendTemplateEmail(email, TEMPLATE_WELCOME, {
      subject: 'Welcome — your account credentials',
      recipientName: name || 'there',
      email,
      password,
      loginUrl: APP_LOGIN_URL,
    });
  } catch (err) {
    console.error(`[User Service] welcome email failed for ${email}: ${err.message}`);
  }
}

async function sendPortalAssignedEmail({ name, email, portals, actorName }) {
  if (!Array.isArray(portals) || portals.length === 0) return;
  try {
    const portalListStr = portals
      .map((p) => {
        const pName = p.portal?.name || p.portal_name || p.portal_code || p.portal;
        const roles = Array.isArray(p.access_roles) && p.access_roles.length > 0 ? p.access_roles.join(', ') : '';
        return roles ? `${pName} [${roles}]` : pName;
      })
      .filter(Boolean)
      .join('; ');

    await emailHelper.sendTemplateEmail(email, TEMPLATE_PORTAL_ASSIGNED, {
      subject: 'Portal Access Assigned',
      recipientName: name || 'there',
      email,
      portals,
      portalListSummary: portalListStr,
      actorName: actorName || 'Administrator',
      loginUrl: APP_LOGIN_URL,
    });
  } catch (err) {
    console.error(`[User Service] portal assigned email failed for ${email}: ${err.message}`);
  }
}

async function sendPortalAssignedInAppNotification({ userId, portals }) {
  if (!Array.isArray(portals) || portals.length === 0) return;
  try {
    const notificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:7012';
    const portalListStr = portals
      .map((p) => p.portal?.name || p.portal_name || p.portal_code || p.portal)
      .filter(Boolean)
      .join(', ');

    const serviceToken = jwt.sign(
      { sub: 'auth-service', name: 'Auth Service' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    await fetch(`${notificationServiceUrl.replace(/\/$/, '')}/api/notifications/internal/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceToken}`,
      },
      body: JSON.stringify({
        userId,
        payload: {
          title: 'Portal Access Updated',
          message: `You have been assigned access to portal(s): ${portalListStr}`,
          type: 'portal_assigned',
          link: '/portals',
        },
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error(`[User Service] in-app notification failed for user ${userId}: ${err.message}`);
  }
}

async function assertDepartmentExists(departmentCode) {
  const code = String(departmentCode || '').toLowerCase().trim();
  if (!code) throw new ApiError(400, 'department is required');
  const dept = await Department.findOne({ code, is_active: { $ne: false } }).select('_id code').lean();
  if (!dept) {
    throw new ApiError(
      400,
      `Unknown or inactive department "${code}". Create it under Departments first.`
    );
  }
  return code;
}

async function resolvePortalsForUser(portalsArray) {
  if (!Array.isArray(portalsArray)) return [];
  const resolved = [];
  for (const item of portalsArray) {
    if (!item) continue;
    let portalDoc = null;
    const pId = item.portal_id || item.portal;
    if (pId && typeof pId === 'string' && pId.match(/^[0-9a-fA-F]{24}$/)) {
      portalDoc = await Portal.findById(pId).lean();
    }
    if (!portalDoc && item.portal_code) {
      portalDoc = await Portal.findOne({ code: String(item.portal_code).toLowerCase().trim() }).lean();
    }
    if (!portalDoc && item.code) {
      portalDoc = await Portal.findOne({ code: String(item.code).toLowerCase().trim() }).lean();
    }

    if (portalDoc) {
      const rawRoles = Array.isArray(item.access_roles)
        ? item.access_roles
        : (item.access_role ? [item.access_role] : []);
      const normalizedRoles = rawRoles
        .map((r) => String(r || '').trim().toLowerCase())
        .filter(Boolean);
      const singleRole = normalizedRoles.length > 0 ? [normalizedRoles[0]] : [];

      resolved.push({
        portal: portalDoc._id,
        portal_code: portalDoc.code,
        access_roles: singleRole,
      });
    }
  }
  return resolved;
}

async function list(query = {}) {
  const filter = { is_active: { $ne: false } };
  if (query.department) {
    filter.department = query.department;
  }
  const rows = await User.find(filter)
    .populate('roles')
    .populate('portals.portal')
    .sort({ createdAt: -1 })
    .lean();
  return rows.map((u) => sanitizeUser(toPlain(u)));
}

async function get(id) {
  const row = await User.findById(id)
    .populate('roles')
    .populate('portals.portal')
    .lean();
  if (!row) throw new ApiError(404, 'User not found');
  return sanitizeUser(toPlain(row));
}

async function listRoles() {
  const rows = await Role.find({ is_active: { $ne: false } }).lean();
  return rows.map(toPlain);
}

async function create(body, actor) {
  const email = String(body.email).toLowerCase().trim();

  const isCreatingActive = body.is_active !== false;
  if (isCreatingActive) {
    const dup = await User.findOne({ email, is_active: { $ne: false } }).lean();
    if (dup) throw new ApiError(409, 'Email already registered to an active user');
  }

  const department = await assertDepartmentExists(body.department);

  const plainPassword = body.password || '';
  const hash = await bcrypt.hash(plainPassword, 10);

  const roleIds = await resolveRoleIdsForUser({ ...body, department });
  if (!roleIds.length) {
    throw new ApiError(
      400,
      'At least one role is required.'
    );
  }
  await assertRolesExist(roleIds);

  const portals = await resolvePortalsForUser(body.portals);

  const doc = await User.create({
    name: body.name,
    email,
    phone: body.phone || '',
    password: hash,
    department,
    roles: roleIds,
    portals,
    is_active: body.is_active !== false,
  });

  await sendWelcomeEmail({
    name: body.name,
    email,
    password: plainPassword,
  });

  const createdUser = await User.findById(doc._id)
    .populate('roles')
    .populate('portals.portal')
    .lean();

  if (createdUser.portals && createdUser.portals.length > 0) {
    await sendPortalAssignedEmail({
      name: body.name,
      email,
      portals: createdUser.portals,
      actorName: actor?.name,
    });
    await sendPortalAssignedInAppNotification({
      userId: doc._id,
      portals: createdUser.portals,
    });
  }

  return sanitizeUser(toPlain(createdUser));
}

async function update(id, body, actor) {
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, 'User not found');

  const willBeActive =
    body.is_active !== undefined ? Boolean(body.is_active) : user.is_active !== false;
  const targetEmail =
    body.email !== undefined ? String(body.email).toLowerCase().trim() : user.email;

  if (
    willBeActive &&
    (body.email !== undefined || (body.is_active === true && user.is_active === false))
  ) {
    const dup = await User.findOne({
      email: targetEmail,
      _id: { $ne: id },
      is_active: { $ne: false },
    })
      .select('_id')
      .lean();
    if (dup) throw new ApiError(409, 'Email already registered to another active user');
  }

  if (body.email !== undefined) {
    user.email = targetEmail;
  }
  if (body.name !== undefined) user.name = body.name;
  if (body.phone !== undefined) user.phone = body.phone;

  const previousDepartment = String(user.department || '');
  if (body.department !== undefined) {
    user.department = await assertDepartmentExists(body.department);
  }
  if (body.is_active !== undefined) user.is_active = body.is_active;

  const rolePayloadTouched =
    body.roles !== undefined || body.roleCode !== undefined || body.role !== undefined;
  const departmentChanged =
    body.department !== undefined && String(user.department) !== previousDepartment;

  if (rolePayloadTouched) {
    const roleIds = await resolveRoleIdsForUser({ ...body, department: user.department });
    await assertRolesExist(roleIds);
    user.roles = roleIds;
  } else if (departmentChanged) {
    const roleIds = await resolveDefaultRoleIdsForDepartment(user.department);
    if (!roleIds.length) {
      throw new ApiError(
        400,
        `No active role found for department "${user.department}". Assign a role or create a default role for that department.`
      );
    }
    await assertRolesExist(roleIds);
    user.roles = roleIds;
  }

  if (body.portals !== undefined) {
    user.portals = await resolvePortalsForUser(body.portals);
  }

  if (body.password !== undefined && String(body.password).length > 0) {
    user.password = await bcrypt.hash(body.password, 10);
  }

  await user.save();

  const updatedUser = await User.findById(id)
    .populate('roles')
    .populate('portals.portal')
    .lean();

  if (body.portals !== undefined && updatedUser.portals && updatedUser.portals.length > 0) {
    await sendPortalAssignedEmail({
      name: updatedUser.name,
      email: updatedUser.email,
      portals: updatedUser.portals,
      actorName: actor?.name,
    });
    await sendPortalAssignedInAppNotification({
      userId: id,
      portals: updatedUser.portals,
    });
  }

  return sanitizeUser(toPlain(updatedUser));
}

async function remove(id, actor) {
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, 'User not found');

  if (actor && actor._id && actor._id.toString() === id.toString()) {
    throw new ApiError(400, 'Cannot delete your own account');
  }

  await User.findByIdAndDelete(id);
  return { success: true, message: 'User deleted successfully' };
}

async function listRoles(query = {}) {
  const filter = { is_active: { $ne: false } };
  if (query.include_inactive === 'true') {
    delete filter.is_active;
  }
  if (query.department) {
    filter.department = String(query.department).toLowerCase().trim();
  }
  const rows = await Role.find(filter).sort({ department: 1, name: 1 }).lean();
  return rows.map(toPlain);
}

async function createRole(data) {
  if (!data.name || !data.code || !data.department) {
    throw new ApiError(400, 'name, code, and department are required for role');
  }
  const code = String(data.code).toLowerCase().trim();
  const department = await assertDepartmentExists(data.department);

  const dup = await Role.findOne({ code }).lean();
  if (dup) throw new ApiError(409, `Role with code '${code}' already exists`);

  if (data.is_default_role) {
    await Role.updateMany({ department }, { is_default_role: false });
  }

  const doc = await Role.create({
    name: data.name.trim(),
    code,
    department,
    is_system_role: data.is_system_role === true,
    is_default_role: data.is_default_role === true,
    is_active: data.is_active !== false,
  });

  return toPlain(await Role.findById(doc._id).lean());
}

async function updateRole(id, data) {
  const role = await Role.findById(id);
  if (!role) throw new ApiError(404, 'Role not found');

  if (data.name !== undefined) role.name = data.name.trim();
  if (data.department !== undefined) {
    role.department = await assertDepartmentExists(data.department);
  }
  if (data.is_active !== undefined) role.is_active = data.is_active;
  if (data.is_system_role !== undefined) role.is_system_role = data.is_system_role;

  if (data.code !== undefined && data.code.toLowerCase().trim() !== role.code) {
    const newCode = data.code.toLowerCase().trim();
    const dup = await Role.findOne({ code: newCode, _id: { $ne: id } }).lean();
    if (dup) throw new ApiError(409, `Role with code '${newCode}' already exists`);
    role.code = newCode;
  }

  if (data.is_default_role === true) {
    await Role.updateMany({ department: role.department, _id: { $ne: id } }, { is_default_role: false });
    role.is_default_role = true;
  } else if (data.is_default_role === false) {
    role.is_default_role = false;
  }

  await role.save();
  return toPlain(await Role.findById(id).lean());
}

async function deleteRole(id) {
  const role = await Role.findById(id);
  if (!role) throw new ApiError(404, 'Role not found');

  await Role.findByIdAndDelete(id);
  return { success: true, message: 'Role deleted successfully' };
}

async function seedDefaultRoles() {
  const DEFAULT_ROLES = [
    { name: 'Super Admin', code: 'super_admin', department: 'super_admin', is_system_role: true, is_default_role: true },
    { name: 'Admin', code: 'admin', department: 'admin', is_system_role: true, is_default_role: true },
    { name: 'Sales Executive', code: 'sales_executive', department: 'sales', is_system_role: false, is_default_role: true },
    { name: 'Sales Manager', code: 'sales_manager', department: 'sales', is_system_role: false, is_default_role: false },
    { name: 'Finance Manager', code: 'finance_manager', department: 'finance', is_system_role: false, is_default_role: true },
    { name: 'Account Executive', code: 'account_executive', department: 'account', is_system_role: false, is_default_role: true },
    { name: 'Dispatch Officer', code: 'dispatch_officer', department: 'dispatch', is_system_role: false, is_default_role: true },
  ];

  const results = [];
  for (const item of DEFAULT_ROLES) {
    let doc = await Role.findOne({ code: item.code });
    if (!doc) {
      doc = await Role.create(item);
      results.push({ code: item.code, status: 'created' });
    } else {
      let updated = false;
      if (doc.is_default_role !== item.is_default_role) {
        doc.is_default_role = item.is_default_role;
        updated = true;
      }
      if (updated) await doc.save();
      results.push({ code: item.code, status: updated ? 'updated' : 'exists' });
    }
  }
  return results;
}

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  seedDefaultRoles,
};
