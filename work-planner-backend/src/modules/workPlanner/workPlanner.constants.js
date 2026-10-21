/**
 * @fileoverview Work Planner status enums and helpers with portal role support.
 * @module modules/workPlanner/workPlanner.constants
 */

const PLAN_STATUSES = Object.freeze([
  'planned',
  'completed',
  'draft',
  'submitted',
  'approved',
  'rejected',
]);

const VISIT_STATUSES = Object.freeze([
  'created',
  'pending',
  'in_progress',
  'checked_in',
  'checked_out',
  'completed',
  'cancelled',
  'skipped',
  'rescheduled',
]);

const WORK_STATUSES = Object.freeze([
  'created',
  'pending',
  'in_progress',
  'completed',
  'cancelled',
  'skipped',
  'rescheduled',
]);

const TERMINAL_VISIT_STATUSES = Object.freeze(['completed', 'cancelled', 'skipped']);

const EDITABLE_PLAN_STATUSES = Object.freeze(['planned', 'draft', 'rejected']);

const VISIT_PARTY_TYPES = Object.freeze([
  'existing',
  'new_party',
  'new_lead',
  'existing_lead',
  'facility',
  'enquiry',
]);

const EXPENSE_STATUSES = Object.freeze(['draft', 'submitted', 'approved', 'rejected']);

const EDITABLE_EXPENSE_STATUSES = Object.freeze(['draft', 'rejected']);

const EXPENSE_CATEGORIES = Object.freeze([
  'Travel',
  'Accommodation',
  'Food',
  'Communication',
  'Client Entertainment',
  'Marketing',
  'Office',
  'Miscellaneous',
]);

const TRAVEL_SUB_CATEGORIES = Object.freeze([
  'Cab',
  'Auto',
  'Bus',
  'Bike Ride',
  'Private Bike',
  'Train',
  'Parking',
]);

const EXPENSE_PAYMENT_MODES = Object.freeze([
  'Cash',
  'UPI',
  'Card',
  'Bank Transfer',
  'Company Card',
]);

function startOfDay(dateInput) {
  const d = new Date(dateInput);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfDay(dateInput) {
  const d = new Date(dateInput);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/** Sales / Executive may add expenses only on plan day through plan day + 2 (3 calendar days). */
const EXPENSE_ADD_WINDOW_DAYS = 3;

/** Sales / Executive must attach image/PDF receipt when amount is greater than this. */
const EXPENSE_RECEIPT_REQUIRED_ABOVE = 200;

function isExpenseAddWindowOpen(planDate, now = new Date()) {
  if (!planDate) return false;
  const pDate = new Date(planDate);
  if (Number.isNaN(pDate.getTime())) return false;

  const pYear = pDate.getUTCFullYear();
  const pMonth = pDate.getUTCMonth();
  const pDay = pDate.getUTCDate();

  const nowIST = new Date(new Date(now).getTime() + 5.5 * 60 * 60 * 1000);
  const nYear = nowIST.getUTCFullYear();
  const nMonth = nowIST.getUTCMonth();
  const nDay = nowIST.getUTCDate();

  const end = new Date(Date.UTC(pYear, pMonth, pDay + (EXPENSE_ADD_WINDOW_DAYS - 1), 23, 59, 59, 999));
  const current = new Date(Date.UTC(nYear, nMonth, nDay, 12, 0, 0, 0));

  return current.getTime() <= end.getTime();
}

function isExpenseAddWindowEnded(planDate, now = new Date()) {
  if (!planDate) return false;
  const pDate = new Date(planDate);
  if (Number.isNaN(pDate.getTime())) return false;

  const pYear = pDate.getUTCFullYear();
  const pMonth = pDate.getUTCMonth();
  const pDay = pDate.getUTCDate();

  const nowIST = new Date(new Date(now).getTime() + 5.5 * 60 * 60 * 1000);
  const nYear = nowIST.getUTCFullYear();
  const nMonth = nowIST.getUTCMonth();
  const nDay = nowIST.getUTCDate();

  const end = new Date(
    Date.UTC(pYear, pMonth, pDay + (EXPENSE_ADD_WINDOW_DAYS - 1), 23, 59, 59, 999),
  );
  const current = new Date(Date.UTC(nYear, nMonth, nDay, 12, 0, 0, 0));

  return current.getTime() > end.getTime();
}

function isExpenseReceiptRequired(amount) {
  return Number(amount) > EXPENSE_RECEIPT_REQUIRED_ABOVE;
}

const WORK_PLANNER_ROLES = Object.freeze(['executive', 'coordinator', 'manager', 'admin']);

function normalizeRole(r) {
  return String(r || '')
    .trim()
    .toLowerCase();
}

/** Portal access_roles on work_planner only (strictly executive, coordinator, manager, admin). */
function getWorkPlannerAccessRoles(user) {
  if (!user) return [];
  const portalAccess = Array.isArray(user.portals)
    ? user.portals.find((p) => p && normalizeRole(p.portal_code || p.portal) === 'work_planner')
    : null;
  if (!portalAccess || !Array.isArray(portalAccess.access_roles)) return [];
  return portalAccess.access_roles
    .map(normalizeRole)
    .filter((r) => WORK_PLANNER_ROLES.includes(r));
}

/** Work Planner admin: portal role `admin` only. */
function isWpAdmin(user) {
  if (!user) return false;
  return getWorkPlannerAccessRoles(user).includes('admin');
}

/** Work Planner manager: portal role `manager` only. */
function isWpManager(user) {
  if (!user) return false;
  if (isWpAdmin(user)) return false;
  return getWorkPlannerAccessRoles(user).includes('manager');
}

/** Work Planner coordinator: portal role `coordinator` only. */
function isWpCoordinator(user) {
  if (!user) return false;
  if (isWpAdmin(user) || isWpManager(user)) return false;
  return getWorkPlannerAccessRoles(user).includes('coordinator');
}

function isSuperAdminBypass(user) {
  if (!user) return false;
  if (user.is_super_admin || user.isSuperAdmin || user.is_admin) return true;
  const role = String(user.role || '').toLowerCase();
  if (role === 'super_admin' || role === 'admin' || role === 'superadmin') return true;
  if (Array.isArray(user.role_codes) && user.role_codes.some((r) => ['super_admin', 'superadmin'].includes(String(r).toLowerCase()))) return true;
  if (Array.isArray(user.roles) && user.roles.some((r) => ['super_admin', 'superadmin'].includes(String(r.code || r.name || r).toLowerCase()))) return true;
  return false;
}

/** Admin, manager, or coordinator — elevated actions. */
function isWpElevated(user) {
  return isSuperAdminBypass(user) || isWpAdmin(user) || isWpManager(user) || isWpCoordinator(user);
}

/** Work Planner executive: portal role `executive` only. */
function isExecutive(user) {
  if (!user) return false;
  if (isWpElevated(user)) return false;
  return getWorkPlannerAccessRoles(user).includes('executive');
}

function hasWorkPlannerAccess(user) {
  return isSuperAdminBypass(user) || getWorkPlannerAccessRoles(user).length > 0;
}

module.exports = {
  PLAN_STATUSES,
  VISIT_STATUSES,
  WORK_STATUSES,
  TERMINAL_VISIT_STATUSES,
  EDITABLE_PLAN_STATUSES,
  VISIT_PARTY_TYPES,
  EXPENSE_STATUSES,
  EDITABLE_EXPENSE_STATUSES,
  EXPENSE_CATEGORIES,
  TRAVEL_SUB_CATEGORIES,
  EXPENSE_PAYMENT_MODES,
  WORK_PLANNER_ROLES,
  startOfDay,
  endOfDay,
  EXPENSE_ADD_WINDOW_DAYS,
  EXPENSE_RECEIPT_REQUIRED_ABOVE,
  isExpenseAddWindowOpen,
  isExpenseAddWindowEnded,
  isExpenseReceiptRequired,
  getWorkPlannerAccessRoles,
  hasWorkPlannerAccess,
  isSuperAdminBypass,
  isWpAdmin,
  isAdminDept: isWpAdmin,
  isWpManager,
  isWpCoordinator,
  isWpElevated,
  isExecutive,
};
