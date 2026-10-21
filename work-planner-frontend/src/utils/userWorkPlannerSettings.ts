export type CustomWorkTaskTemplate = {
  id: string;
  title: string;
  description?: string;
  planned_start_time?: string;
  planned_end_time?: string;
  work_type?: "default" | "optional";
};

export type PlanTypeSetting = {
  plan_type: string;
  assignedManagerId?: string;
  assignedManagerName?: string;
  assignedManagerEmail?: string;
  ccEmails: string[];
};

export type UserWorkPlannerSettings = {
  userId: string;
  assignedManagerId?: string;
  assignedManagerName?: string;
  assignedManagerEmail?: string;
  ccEmails: string[];
  planTypeSettings?: Record<string, PlanTypeSetting>;
  customWorkTemplates: CustomWorkTaskTemplate[];
  updatedAt?: string;
};

const SETTINGS_PREFIX = "shakti.work_planner.user_settings.";

export function getUserWorkPlannerSettings(userId: string): UserWorkPlannerSettings {
  if (typeof window === "undefined" || !userId) {
    return { userId: userId || "", ccEmails: [], customWorkTemplates: [], planTypeSettings: {} };
  }
  try {
    const raw = window.localStorage.getItem(`${SETTINGS_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        userId,
        assignedManagerId: parsed.assignedManagerId || "",
        assignedManagerName: parsed.assignedManagerName || "",
        assignedManagerEmail: parsed.assignedManagerEmail || "",
        ccEmails: Array.isArray(parsed.ccEmails) ? parsed.ccEmails : [],
        planTypeSettings: parsed.planTypeSettings && typeof parsed.planTypeSettings === "object" ? parsed.planTypeSettings : {},
        customWorkTemplates: Array.isArray(parsed.customWorkTemplates) ? parsed.customWorkTemplates : [],
        updatedAt: parsed.updatedAt || "",
      };
    }
  } catch (e) {
    console.warn("Failed to read user work planner settings", e);
  }
  return { userId, ccEmails: [], customWorkTemplates: [], planTypeSettings: {} };
}

export function saveUserWorkPlannerSettings(
  userId: string,
  settings: Partial<UserWorkPlannerSettings>
): UserWorkPlannerSettings {
  const current = getUserWorkPlannerSettings(userId);
  const updated: UserWorkPlannerSettings = {
    ...current,
    ...settings,
    userId,
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined" && userId) {
    try {
      window.localStorage.setItem(`${SETTINGS_PREFIX}${userId}`, JSON.stringify(updated));
    } catch (e) {
      console.warn("Failed to save user work planner settings", e);
    }
  }
  return updated;
}

