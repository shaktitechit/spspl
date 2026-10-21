export interface PlanTypeOption {
  id: string;
  label: string;
  enabled: boolean;
  requiresCheckIn: boolean;
  requiresCheckOut: boolean;
  allowExpenses: boolean;
  description: string;
}

export interface ClientTypeRule {
  id: string;
  name: string;
  enabled: boolean;
  requireGeoLocation: boolean;
  requirePhotoProof: boolean;
  minDurationMinutes: number;
}

export interface PortalAdminSettings {
  // General & Portal Identity
  portalName: string;
  portalDescription: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  workingDays: string[];
  officeStartTime: string;
  officeEndTime: string;
  timezone: string;
  autoLockSessionMinutes: number;

  // Work Planning Rules
  defaultPlanType: string;
  planTypes: PlanTypeOption[];
  planSubmissionCutoffTime: string;
  allowBackdatedPlans: boolean;
  maxAdvancePlanningDays: number;
  requireManagerPreApproval: boolean;
  autoLockApprovedPlans: boolean;

  // Field Visits & GPS Policies
  mandatoryGpsCheckIn: boolean;
  geofenceToleranceMeters: number;
  mandatoryVisitPhoto: boolean;
  minVisitDurationMinutes: number;
  allowOfflineVisitLogging: boolean;
  clientTypes: ClientTypeRule[];

  // Expense Claims & Reimbursement
  dailyOutstationAllowanceLimit: number;
  fuelRateTwoWheelerPerKm: number;
  fuelRateFourWheelerPerKm: number;
  receiptRequiredThresholdAmount: number;
  expenseSubmissionWindowDays: number;
  twoLevelApprovalRequired: boolean;
  blockExpenseWithoutApprovedPlan: boolean;

  // Day End & Reporting
  dayEndCutoffTime: string;
  blockNextDayPlanIfDayEndPending: boolean;
  defaultDayEndCcEmails: string[];
  enableAiSummaryAnalysis: boolean;
  directiveEscalationHours: number;

  // Notifications & Alerts
  notifyManagerOnPlanSubmit: boolean;
  notifyUserOnPlanDecision: boolean;
  morningPlanningReminderTime: string;
  sendMorningReminder: boolean;
  eveningDayEndReminderTime: string;
  sendEveningReminder: boolean;

  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_PLAN_TYPES: PlanTypeOption[] = [
  {
    id: "Visits",
    label: "Visits (Field Visits)",
    enabled: true,
    requiresCheckIn: true,
    requiresCheckOut: true,
    allowExpenses: true,
    description: "Doctor, clinic, dealer and hospital visits in field",
  },
  {
    id: "Tasks & Visits",
    label: "Tasks & Visits (Hybrid)",
    enabled: true,
    requiresCheckIn: true,
    requiresCheckOut: false,
    allowExpenses: true,
    description: "Combined desk tasks and planned client visits",
  },
  {
    id: "Leave",
    label: "Leave / Out of Office",
    enabled: true,
    requiresCheckIn: false,
    requiresCheckOut: false,
    allowExpenses: false,
    description: "Planned leaves, medical leaves or approved absences",
  },
  {
    id: "Work From Home",
    label: "Work From Home (WFH)",
    enabled: true,
    requiresCheckIn: false,
    requiresCheckOut: false,
    allowExpenses: false,
    description: "Remote home desk assignments and reporting",
  },
  {
    id: "Work From Office",
    label: "Work From Office (WFO)",
    enabled: true,
    requiresCheckIn: false,
    requiresCheckOut: false,
    allowExpenses: false,
    description: "Headquarters or branch office scheduled desk work",
  },
];

export const DEFAULT_CLIENT_TYPES: ClientTypeRule[] = [
  { id: "doctor", name: "Doctor / Physician", enabled: true, requireGeoLocation: true, requirePhotoProof: false, minDurationMinutes: 15 },
  { id: "chemist", name: "Chemist / Pharmacy", enabled: true, requireGeoLocation: true, requirePhotoProof: false, minDurationMinutes: 10 },
  { id: "hospital", name: "Hospital / Healthcare Center", enabled: true, requireGeoLocation: true, requirePhotoProof: true, minDurationMinutes: 20 },
  { id: "stockist", name: "Stockist / Distributor", enabled: true, requireGeoLocation: true, requirePhotoProof: false, minDurationMinutes: 15 },
  { id: "dealer", name: "Dealer / Retailer", enabled: true, requireGeoLocation: true, requirePhotoProof: false, minDurationMinutes: 10 },
  { id: "institution", name: "Institutional / Government Client", enabled: true, requireGeoLocation: true, requirePhotoProof: true, minDurationMinutes: 30 },
];

export const DEFAULT_PORTAL_ADMIN_SETTINGS: PortalAdminSettings = {
  portalName: "Work Planner Portal",
  portalDescription: "Enterprise Field Force Execution, Daily Itineraries & Expense Management",
  maintenanceMode: false,
  maintenanceMessage: "The portal is undergoing scheduled administrative maintenance. Please check back shortly.",
  workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  officeStartTime: "09:30",
  officeEndTime: "18:30",
  timezone: "Asia/Kolkata",
  autoLockSessionMinutes: 60,

  defaultPlanType: "Visits",
  planTypes: DEFAULT_PLAN_TYPES,
  planSubmissionCutoffTime: "09:00",
  allowBackdatedPlans: false,
  maxAdvancePlanningDays: 14,
  requireManagerPreApproval: false,
  autoLockApprovedPlans: true,

  mandatoryGpsCheckIn: true,
  geofenceToleranceMeters: 500,
  mandatoryVisitPhoto: false,
  minVisitDurationMinutes: 15,
  allowOfflineVisitLogging: true,
  clientTypes: DEFAULT_CLIENT_TYPES,

  dailyOutstationAllowanceLimit: 800,
  fuelRateTwoWheelerPerKm: 4.5,
  fuelRateFourWheelerPerKm: 9.0,
  receiptRequiredThresholdAmount: 200,
  expenseSubmissionWindowDays: 7,
  twoLevelApprovalRequired: true,
  blockExpenseWithoutApprovedPlan: true,

  dayEndCutoffTime: "22:00",
  blockNextDayPlanIfDayEndPending: true,
  defaultDayEndCcEmails: ["reports@shaktitechit.com"],
  enableAiSummaryAnalysis: true,
  directiveEscalationHours: 48,

  notifyManagerOnPlanSubmit: true,
  notifyUserOnPlanDecision: true,
  morningPlanningReminderTime: "08:30",
  sendMorningReminder: true,
  eveningDayEndReminderTime: "20:00",
  sendEveningReminder: true,
};

const PORTAL_SETTINGS_STORAGE_KEY = "shakti.work_planner.portal_admin_settings";

export function getPortalAdminSettings(): PortalAdminSettings {
  if (typeof window === "undefined") {
    return DEFAULT_PORTAL_ADMIN_SETTINGS;
  }
  try {
    const raw = window.localStorage.getItem(PORTAL_SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_PORTAL_ADMIN_SETTINGS,
        ...parsed,
        planTypes: Array.isArray(parsed.planTypes) && parsed.planTypes.length > 0 ? parsed.planTypes : DEFAULT_PLAN_TYPES,
        clientTypes: Array.isArray(parsed.clientTypes) && parsed.clientTypes.length > 0 ? parsed.clientTypes : DEFAULT_CLIENT_TYPES,
        workingDays: Array.isArray(parsed.workingDays) ? parsed.workingDays : DEFAULT_PORTAL_ADMIN_SETTINGS.workingDays,
        defaultDayEndCcEmails: Array.isArray(parsed.defaultDayEndCcEmails) ? parsed.defaultDayEndCcEmails : DEFAULT_PORTAL_ADMIN_SETTINGS.defaultDayEndCcEmails,
      };
    }
  } catch (err) {
    console.warn("Failed to read portal admin settings from storage", err);
  }
  return DEFAULT_PORTAL_ADMIN_SETTINGS;
}

export function savePortalAdminSettings(
  settings: Partial<PortalAdminSettings>,
  updatedByName?: string
): PortalAdminSettings {
  const current = getPortalAdminSettings();
  const updated: PortalAdminSettings = {
    ...current,
    ...settings,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedByName || current.updatedBy || "Portal Admin",
  };

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(PORTAL_SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn("Failed to write portal admin settings to storage", err);
    }
  }
  return updated;
}

export function resetPortalAdminSettings(updatedByName?: string): PortalAdminSettings {
  const resetSettings: PortalAdminSettings = {
    ...DEFAULT_PORTAL_ADMIN_SETTINGS,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedByName || "Portal Admin (Reset to Defaults)",
  };

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(PORTAL_SETTINGS_STORAGE_KEY, JSON.stringify(resetSettings));
    } catch (err) {
      console.warn("Failed to reset portal admin settings in storage", err);
    }
  }
  return resetSettings;
}

export function exportPortalAdminSettingsJson(): string {
  const current = getPortalAdminSettings();
  return JSON.stringify(current, null, 2);
}

export function importPortalAdminSettingsJson(jsonStr: string, updatedByName?: string): PortalAdminSettings {
  const parsed = JSON.parse(jsonStr);
  return savePortalAdminSettings(parsed, updatedByName);
}
