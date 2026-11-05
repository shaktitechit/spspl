/**
 * @fileoverview Service for managing global Work Planner Portal Settings & Governance Policies.
 * Handles fetching, updating, resetting policies, and provides cached access for validation routines.
 * @module modules/workPlanner/portalSettings.service
 */
const { getModels } = require('../../data/mongoModels');
const logger = require('../../utils/logger');

let _cachedSettings = null;
let _cacheExpiresAt = 0;
const CACHE_TTL_MS = 30000; // 30 seconds cache

/**
 * Returns active portal settings, creating the default document if none exists.
 */
async function getSettings(companyId = null) {
  const { WorkPlannerPortalSettings } = getModels();

  const query = { is_default: true };
  if (companyId) {
    query.company_id = companyId;
  }

  let doc = await WorkPlannerPortalSettings.findOne(query).lean();
  if (!doc) {
    // Check without company_id
    doc = await WorkPlannerPortalSettings.findOne({ is_default: true }).lean();
  }

  if (!doc) {
    // Create initial default document
    const created = await WorkPlannerPortalSettings.create({
      is_default: true,
      company_id: companyId || undefined,
    });
    doc = created.toObject();
  }

  return doc;
}

/**
 * High-performance cached accessor for server-side rule enforcement.
 */
async function getEffectiveSettings() {
  const now = Date.now();
  if (_cachedSettings && now < _cacheExpiresAt) {
    return _cachedSettings;
  }
  try {
    const settings = await getSettings();
    _cachedSettings = settings;
    _cacheExpiresAt = now + CACHE_TTL_MS;
    return settings;
  } catch (err) {
    logger.warn(`[PortalSettings] Failed to fetch settings from DB, using defaults: ${err.message}`);
    return {
      planSubmissionCutoffTime: '09:00',
      maxAdvancePlanningDays: 14,
      allowBackdatedPlans: false,
      maxAllowedBackdatedDays: 2,
      morningPlanningReminderTime: '08:30',
      dayEndCutoffTime: '22:00',
      eveningDayEndReminderTime: '20:00',
      blockNextDayPlanIfDayEndPending: true,
      blockPlanningIfSeniorObjectionsUnresolved: true,
      fuelRateTwoWheelerPerKm: 4.5,
      expenseSubmissionWindowDays: 7,
      receiptRequiredThresholdAmount: 200,
      blockExpenseWithoutApprovedPlan: true,
    };
  }
}

/**
 * Updates portal governance policies.
 */
async function updateSettings(body, user) {
  const { WorkPlannerPortalSettings } = getModels();
  const userId = user ? user._id || user.id : null;
  const userName = user ? user.name || user.username || 'Portal Admin' : 'Portal Admin';

  let settings = await WorkPlannerPortalSettings.findOne({ is_default: true });
  if (!settings) {
    settings = new WorkPlannerPortalSettings({ is_default: true });
  }

  // 1. Work Planning and Submission Rules
  if (body.planSubmissionCutoffTime !== undefined) settings.planSubmissionCutoffTime = String(body.planSubmissionCutoffTime).trim();
  if (body.maxAdvancePlanningDays !== undefined) settings.maxAdvancePlanningDays = Number(body.maxAdvancePlanningDays);
  if (body.allowBackdatedPlans !== undefined) settings.allowBackdatedPlans = Boolean(body.allowBackdatedPlans);
  if (body.maxAllowedBackdatedDays !== undefined) settings.maxAllowedBackdatedDays = Number(body.maxAllowedBackdatedDays);
  if (body.morningPlanningReminderTime !== undefined) settings.morningPlanningReminderTime = String(body.morningPlanningReminderTime).trim();
  if (body.requireManagerPreApproval !== undefined) settings.requireManagerPreApproval = Boolean(body.requireManagerPreApproval);
  if (body.autoLockApprovedPlans !== undefined) settings.autoLockApprovedPlans = Boolean(body.autoLockApprovedPlans);
  if (body.defaultPlanType !== undefined) settings.defaultPlanType = String(body.defaultPlanType).trim();
  if (Array.isArray(body.planTypes)) settings.planTypes = body.planTypes;

  // 2. Day End Reporting & Notifications
  if (body.dayEndCutoffTime !== undefined) settings.dayEndCutoffTime = String(body.dayEndCutoffTime).trim();
  if (body.eveningDayEndReminderTime !== undefined) settings.eveningDayEndReminderTime = String(body.eveningDayEndReminderTime).trim();
  if (body.blockNextDayPlanIfDayEndPending !== undefined) settings.blockNextDayPlanIfDayEndPending = Boolean(body.blockNextDayPlanIfDayEndPending);
  if (Array.isArray(body.defaultDayEndCcEmails)) settings.defaultDayEndCcEmails = body.defaultDayEndCcEmails;
  if (body.enableAiSummaryAnalysis !== undefined) settings.enableAiSummaryAnalysis = Boolean(body.enableAiSummaryAnalysis);
  if (body.directiveEscalationHours !== undefined) settings.directiveEscalationHours = Number(body.directiveEscalationHours);

  // 3. Other Restrictions
  if (body.blockPlanningIfSeniorObjectionsUnresolved !== undefined) {
    settings.blockPlanningIfSeniorObjectionsUnresolved = Boolean(body.blockPlanningIfSeniorObjectionsUnresolved);
  }

  // 4. Expense Claims & Allowance Limits
  if (body.dailyOutstationAllowanceLimit !== undefined) settings.dailyOutstationAllowanceLimit = Number(body.dailyOutstationAllowanceLimit);
  if (body.fuelRateTwoWheelerPerKm !== undefined) settings.fuelRateTwoWheelerPerKm = Number(body.fuelRateTwoWheelerPerKm);
  if (body.fuelRateFourWheelerPerKm !== undefined) settings.fuelRateFourWheelerPerKm = Number(body.fuelRateFourWheelerPerKm);
  if (body.receiptRequiredThresholdAmount !== undefined) settings.receiptRequiredThresholdAmount = Number(body.receiptRequiredThresholdAmount);
  if (body.expenseSubmissionWindowDays !== undefined) settings.expenseSubmissionWindowDays = Number(body.expenseSubmissionWindowDays);
  if (body.twoLevelApprovalRequired !== undefined) settings.twoLevelApprovalRequired = Boolean(body.twoLevelApprovalRequired);
  if (body.blockExpenseWithoutApprovedPlan !== undefined) settings.blockExpenseWithoutApprovedPlan = Boolean(body.blockExpenseWithoutApprovedPlan);

  // 5. Field Visits & GPS Geofencing Policies
  if (body.mandatoryGpsCheckIn !== undefined) settings.mandatoryGpsCheckIn = Boolean(body.mandatoryGpsCheckIn);
  if (body.geofenceToleranceMeters !== undefined) settings.geofenceToleranceMeters = Number(body.geofenceToleranceMeters);
  if (body.mandatoryVisitPhoto !== undefined) settings.mandatoryVisitPhoto = Boolean(body.mandatoryVisitPhoto);
  if (body.minVisitDurationMinutes !== undefined) settings.minVisitDurationMinutes = Number(body.minVisitDurationMinutes);
  if (body.allowOfflineVisitLogging !== undefined) settings.allowOfflineVisitLogging = Boolean(body.allowOfflineVisitLogging);

  // Metadata
  if (body.portalName !== undefined) settings.portalName = String(body.portalName).trim();
  if (body.portalDescription !== undefined) settings.portalDescription = String(body.portalDescription).trim();
  if (body.timezone !== undefined) settings.timezone = String(body.timezone).trim();

  settings.updated_by = userId;
  settings.updatedByName = userName;
  await settings.save();

  // Invalidate in-memory cache
  _cachedSettings = settings.toObject();
  _cacheExpiresAt = Date.now() + CACHE_TTL_MS;

  logger.info(`[PortalSettings] Governance rules updated by ${userName} (${userId})`);
  return _cachedSettings;
}

/**
 * Resets portal settings to system defaults.
 */
async function resetSettings(user) {
  const { WorkPlannerPortalSettings } = getModels();
  const userId = user ? user._id || user.id : null;
  const userName = user ? user.name || user.username || 'Portal Admin' : 'Portal Admin';

  await WorkPlannerPortalSettings.deleteMany({ is_default: true });
  const created = await WorkPlannerPortalSettings.create({
    is_default: true,
    updated_by: userId,
    updatedByName: `${userName} (Reset to Defaults)`,
  });

  _cachedSettings = created.toObject();
  _cacheExpiresAt = Date.now() + CACHE_TTL_MS;

  logger.info(`[PortalSettings] Policies reset to system defaults by ${userName}`);
  return _cachedSettings;
}

module.exports = {
  getSettings,
  getEffectiveSettings,
  updateSettings,
  resetSettings,
};

