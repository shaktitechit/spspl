/**
 * @fileoverview Schema for Work Planner Portal Global Settings & Policies.
 * Controls planning rules, cutoff times, backdating, day-end reporting, objections, and expense allowances.
 * @module models/WorkPlannerPortalSettings
 */
const mongoose = require('mongoose');

const planTypeOptionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    requiresCheckIn: { type: Boolean, default: true },
    requiresCheckOut: { type: Boolean, default: false },
    allowExpenses: { type: Boolean, default: true },
    description: { type: String, default: '' },
  },
  { _id: false }
);

const DEFAULT_PLAN_TYPES = [
  {
    id: 'Visits',
    label: 'Visits (Field Visits)',
    enabled: true,
    requiresCheckIn: true,
    requiresCheckOut: true,
    allowExpenses: true,
    description: 'Doctor, clinic, dealer and hospital visits in field',
  },
  {
    id: 'Tasks & Visits',
    label: 'Tasks & Visits (Hybrid)',
    enabled: true,
    requiresCheckIn: true,
    requiresCheckOut: false,
    allowExpenses: true,
    description: 'Combined desk tasks and planned client visits',
  },
  {
    id: 'Leave',
    label: 'Leave / Out of Office',
    enabled: true,
    requiresCheckIn: false,
    requiresCheckOut: false,
    allowExpenses: false,
    description: 'Planned leaves, medical leaves or approved absences',
  },
  {
    id: 'Work From Home',
    label: 'Work From Home (WFH)',
    enabled: true,
    requiresCheckIn: false,
    requiresCheckOut: false,
    allowExpenses: false,
    description: 'Remote home desk assignments and reporting',
  },
  {
    id: 'Work From Office',
    label: 'Work From Office (WFO)',
    enabled: true,
    requiresCheckIn: false,
    requiresCheckOut: false,
    allowExpenses: false,
    description: 'Headquarters or branch office scheduled desk work',
  },
];

const workPlannerPortalSettingsSchema = new mongoose.Schema(
  {
    company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CompanyInfo', index: true },
    is_default: { type: Boolean, default: true, index: true },

    // 1. Work Planning and Submission Rules
    planSubmissionCutoffTime: { type: String, default: '09:00', trim: true },
    maxAdvancePlanningDays: { type: Number, default: 14, min: 1, max: 60 },
    allowBackdatedPlans: { type: Boolean, default: false },
    maxAllowedBackdatedDays: { type: Number, default: 2, min: 0, max: 30 },
    morningPlanningReminderTime: { type: String, default: '08:30', trim: true },
    requireManagerPreApproval: { type: Boolean, default: false },
    autoLockApprovedPlans: { type: Boolean, default: true },
    defaultPlanType: { type: String, default: 'Visits', trim: true },
    planTypes: { type: [planTypeOptionSchema], default: DEFAULT_PLAN_TYPES },

    // 2. Day End Reporting & Notifications
    dayEndCutoffTime: { type: String, default: '22:00', trim: true },
    eveningDayEndReminderTime: { type: String, default: '20:00', trim: true },
    blockNextDayPlanIfDayEndPending: { type: Boolean, default: true },
    defaultDayEndCcEmails: [{ type: String, trim: true, lowercase: true }],
    enableAiSummaryAnalysis: { type: Boolean, default: true },
    directiveEscalationHours: { type: Number, default: 48 },

    // 3. Other Restrictions
    blockPlanningIfSeniorObjectionsUnresolved: { type: Boolean, default: true },

    // 4. Expense Claims & Allowance Limits
    dailyOutstationAllowanceLimit: { type: Number, default: 800 },
    fuelRateTwoWheelerPerKm: { type: Number, default: 4.5 },
    fuelRateFourWheelerPerKm: { type: Number, default: 9.0 },
    receiptRequiredThresholdAmount: { type: Number, default: 200 },
    expenseSubmissionWindowDays: { type: Number, default: 7 },
    twoLevelApprovalRequired: { type: Boolean, default: true },
    blockExpenseWithoutApprovedPlan: { type: Boolean, default: true },

    // 5. Field Visits & GPS Geofencing Policies
    mandatoryGpsCheckIn: { type: Boolean, default: true },
    geofenceToleranceMeters: { type: Number, default: 500 },
    mandatoryVisitPhoto: { type: Boolean, default: false },
    minVisitDurationMinutes: { type: Number, default: 15 },
    allowOfflineVisitLogging: { type: Boolean, default: true },

    // Portal Identity & General Settings
    portalName: { type: String, default: 'Work Planner Portal', trim: true },
    portalDescription: { type: String, default: '', trim: true },
    timezone: { type: String, default: 'Asia/Kolkata', trim: true },
    workingDays: [{ type: String, trim: true }],

    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedByName: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = workPlannerPortalSettingsSchema;

