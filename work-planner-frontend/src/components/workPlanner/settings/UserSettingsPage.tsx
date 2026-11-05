"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  UserCheck,
  Mail,
  Plus,
  Trash2,
  Clock,
  Building2,
  ShieldCheck,
  FileText,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Edit2,
  Check,
  X,
  Settings,
  Compass,
  Calendar,
  Home,
  Briefcase,
  Layers,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { useGetUsersQuery } from "@/store/api/authApiSlice";
import {
  useGetUserSettingsQuery,
  useUpdateUserSettingsMutation,
  useGetMyTeamQuery,
} from "@/store/api/workPlannerApiSlice";
import {
  isManager,
  isWpAdmin,
  isWpManager,
  isWpCoordinator,
  isWpElevated,
  hasWorkPlannerPortalAccess,
  getWpAccessRoles,
  readSessionFromStorage,
} from "@/utils/authStorage";
import { resolveRoleLabels } from "@/utils/resolveRoleLabels";
import {
  getUserWorkPlannerSettings,
  saveUserWorkPlannerSettings,
  type CustomWorkTaskTemplate,
  type PlanTypeSetting,
  type UserWorkPlannerSettings,
} from "@/utils/userWorkPlannerSettings";

function getUserDepartmentName(u: any): string {
  if (!u || !u.department) return "";
  if (typeof u.department === "object") {
    return String(u.department.name || u.department.code || u.department.title || "");
  }
  return String(u.department);
}

interface UserSettingsPageProps {
  userId: string;
  hideBreadcrumb?: boolean;
  readOnly?: boolean;
}

const WORK_PLAN_TYPES = [
  { id: "Visits", label: "Visits (Field Visits)", description: "Field and client visit plans", icon: Compass, color: "blue" },
  { id: "Tasks & Visits", label: "Tasks & Visits", description: "Combined tasks and field visits plan", icon: Layers, color: "indigo" },
  { id: "Leave", label: "Leave", description: "Leave and out-of-office plans", icon: Calendar, color: "amber" },
  { id: "Work From Home", label: "Work From Home (WFH)", description: "Remote work task plans", icon: Home, color: "purple" },
  { id: "Work From Office", label: "Work From Office (WFO)", description: "In-office task plans", icon: Briefcase, color: "emerald" },
];

export function UserSettingsPage({ userId, hideBreadcrumb = false, readOnly = false }: UserSettingsPageProps) {
  const router = useRouter();
  const sessionUser = useMemo(() => readSessionFromStorage()?.user, []);
  const managerAccess = isManager(sessionUser);
  const adminAccess = isWpAdmin(sessionUser);
  const isElevatedNonAdmin = isWpElevated(sessionUser) && !adminAccess;
  const isSelf = Boolean(sessionUser) && String(sessionUser?._id || (sessionUser as any)?.id || "") === String(userId);
  const canAccess = managerAccess || isSelf;
  const teamDirectoryHref = adminAccess ? "/dashboard/assigned-teams" : "/dashboard/my-team";

  const { data: usersData, isLoading: loadingUsers } = useGetUsersQuery(undefined, { skip: !adminAccess });
  const { data: myTeamData, isLoading: loadingMyTeam } = useGetMyTeamQuery(undefined, { skip: !isElevatedNonAdmin });

  const rawUsers = useMemo<any[]>(() => {
    if (adminAccess) return Array.isArray(usersData) ? (usersData as any[]).filter(hasWorkPlannerPortalAccess) : [];
    const list: any[] = [];
    const seen = new Set<string>();

    const addUser = (u: any) => {
      if (!u) return;
      const id = String(u._id || u.id || "");
      if (id && !seen.has(id)) {
        seen.add(id);
        list.push(u);
      }
    };

    if (sessionUser) addUser(sessionUser);
    if (Array.isArray(myTeamData?.members)) {
      myTeamData.members.forEach(addUser);
    }
    if (Array.isArray(myTeamData?.edges)) {
      myTeamData.edges.forEach((e: any) => {
        if (e.manager) addUser(e.manager);
        if (e.user) addUser(e.user);
      });
    }
    return list;
  }, [adminAccess, usersData, sessionUser, myTeamData]);

  // Backend RTK Query Hooks
  const { data: dbSettings, isLoading: loadingDbSettings } = useGetUserSettingsQuery(userId, { skip: !userId });
  const [updateSettingsMut, { isLoading: savingSettings }] = useUpdateUserSettingsMutation();

  // Target User object
  const targetUser = useMemo(() => {
    return rawUsers.find((u: any) => String(u._id || u.id || "") === String(userId));
  }, [rawUsers, userId]);

  // Available Managers list - strictly users assigned to work_planner portal with coordinator, manager or admin role
  const availableManagers = useMemo(() => {
    return rawUsers.filter((u: any) => {
      const roles = getWpAccessRoles(u);
      return roles.includes("coordinator") || roles.includes("manager") || roles.includes("admin");
    });
  }, [rawUsers]);

  // Top-Level Main Navigation Tab State
  const [mainTab, setMainTab] = useState<"plan_types" | "global_defaults" | "custom_tasks">("plan_types");

  // Global Settings State
  const [assignedManagerId, setAssignedManagerId] = useState("");
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [newCcInput, setNewCcInput] = useState("");
  const [customWorkTemplates, setCustomWorkTemplates] = useState<CustomWorkTaskTemplate[]>([]);

  // Per Work Plan Type Settings State
  const [planTypeSettings, setPlanTypeSettings] = useState<Record<string, PlanTypeSetting>>({
    Visits: { plan_type: "Visits", assignedManagerId: "", ccEmails: [] },
    "Tasks & Visits": { plan_type: "Tasks & Visits", assignedManagerId: "", ccEmails: [] },
    Leave: { plan_type: "Leave", assignedManagerId: "", ccEmails: [] },
    "Work From Home": { plan_type: "Work From Home", assignedManagerId: "", ccEmails: [] },
    "Work From Office": { plan_type: "Work From Office", assignedManagerId: "", ccEmails: [] },
  });

  // Active Plan Type Tab for configuration
  const [activePlanTypeTab, setActivePlanTypeTab] = useState<string>("Visits");

  // Inputs for adding CC per plan type
  const [newPlanTypeCcInputs, setNewPlanTypeCcInputs] = useState<Record<string, string>>({
    Visits: "",
    "Tasks & Visits": "",
    Leave: "",
    "Work From Home": "",
    "Work From Office": "",
  });

  // Modal / Form state for adding/editing a custom task template
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskStartTime, setTaskStartTime] = useState("09:00");
  const [taskEndTime, setTaskEndTime] = useState("10:00");
  const [taskWorkType, setTaskWorkType] = useState<"default" | "optional">("default");

  // Sync settings from Database or fallback
  useEffect(() => {
    if (dbSettings) {
      if (dbSettings.assignedManagerId !== undefined) setAssignedManagerId(dbSettings.assignedManagerId || "");
      if (Array.isArray(dbSettings.ccEmails)) setCcEmails(dbSettings.ccEmails);
      if (Array.isArray(dbSettings.customWorkTemplates)) setCustomWorkTemplates(dbSettings.customWorkTemplates);

      if (dbSettings.planTypeSettings && typeof dbSettings.planTypeSettings === "object") {
        setPlanTypeSettings((prev) => {
          const updated = { ...prev };
          Object.entries(dbSettings.planTypeSettings).forEach(([pType, val]: [string, any]) => {
            if (val) {
              updated[pType] = {
                plan_type: pType,
                assignedManagerId: val.assignedManagerId || "",
                assignedManagerName: val.assignedManagerName || "",
                assignedManagerEmail: val.assignedManagerEmail || "",
                ccEmails: Array.isArray(val.ccEmails) ? val.ccEmails : [],
              };
            }
          });
          return updated;
        });
      }
    } else if (userId) {
      const s = getUserWorkPlannerSettings(userId);
      setAssignedManagerId(s.assignedManagerId || "");
      setCcEmails(s.ccEmails || []);
      setCustomWorkTemplates(s.customWorkTemplates || []);

      if (s.planTypeSettings && typeof s.planTypeSettings === "object") {
        setPlanTypeSettings((prev) => {
          const updated = { ...prev };
          Object.entries(s.planTypeSettings!).forEach(([pType, val]) => {
            if (val) {
              updated[pType] = {
                plan_type: pType,
                assignedManagerId: val.assignedManagerId || "",
                assignedManagerName: val.assignedManagerName || "",
                assignedManagerEmail: val.assignedManagerEmail || "",
                ccEmails: Array.isArray(val.ccEmails) ? val.ccEmails : [],
              };
            }
          });
          return updated;
        });
      }
    }
  }, [dbSettings, userId]);

  // Handle assigned manager selection change for Global
  function handleGlobalManagerSelect(mId: string) {
    setAssignedManagerId(mId);
  }

  // Handle Add Global CC Email
  function handleAddGlobalCcEmail() {
    const trimmed = newCcInput.trim().toLowerCase();
    if (!trimmed) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (ccEmails.includes(trimmed)) {
      toast.error("This email is already in the global CC list");
      return;
    }
    setCcEmails([...ccEmails, trimmed]);
    setNewCcInput("");
    toast.success(`Added ${trimmed} to global CC list`);
  }

  // Remove Global CC Email
  function handleRemoveGlobalCcEmail(emailToRemove: string) {
    setCcEmails(ccEmails.filter((e) => e !== emailToRemove));
  }

  // Add global assigned manager's email to CC list
  function handleAddGlobalManagerEmailToCc() {
    const selectedManager = availableManagers.find(
      (m: any) => String(m._id || m.id || "") === String(assignedManagerId)
    );
    if (!selectedManager?.email) {
      toast.error("Please select a global assigned manager first");
      return;
    }
    const mgrEmail = selectedManager.email.toLowerCase();
    if (ccEmails.includes(mgrEmail)) {
      toast.info("Manager email is already in the global CC list");
      return;
    }
    setCcEmails([...ccEmails, mgrEmail]);
    toast.success(`Added manager email (${mgrEmail}) to global CC list`);
  }

  // Handle per-plan-type manager selection
  function handlePlanTypeManagerSelect(pType: string, mId: string) {
    const selectedManager = availableManagers.find(
      (m: any) => String(m._id || m.id || "") === String(mId)
    );
    setPlanTypeSettings((prev) => ({
      ...prev,
      [pType]: {
        ...prev[pType],
        plan_type: pType,
        assignedManagerId: mId,
        assignedManagerName: selectedManager ? selectedManager.name || selectedManager.email : "",
        assignedManagerEmail: selectedManager ? selectedManager.email : "",
      },
    }));
  }

  // Handle Add Plan Type CC Email
  function handleAddPlanTypeCcEmail(pType: string) {
    const inputVal = newPlanTypeCcInputs[pType] || "";
    const trimmed = inputVal.trim().toLowerCase();
    if (!trimmed) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Please enter a valid email address");
      return;
    }
    const currentCc = planTypeSettings[pType]?.ccEmails || [];
    if (currentCc.includes(trimmed)) {
      toast.error(`This email is already in the ${pType} CC list`);
      return;
    }
    setPlanTypeSettings((prev) => ({
      ...prev,
      [pType]: {
        ...prev[pType],
        plan_type: pType,
        ccEmails: [...currentCc, trimmed],
      },
    }));
    setNewPlanTypeCcInputs((prev) => ({ ...prev, [pType]: "" }));
    toast.success(`Added ${trimmed} to ${pType} CC list`);
  }

  // Remove Plan Type CC Email
  function handleRemovePlanTypeCcEmail(pType: string, emailToRemove: string) {
    const currentCc = planTypeSettings[pType]?.ccEmails || [];
    setPlanTypeSettings((prev) => ({
      ...prev,
      [pType]: {
        ...prev[pType],
        ccEmails: currentCc.filter((e) => e !== emailToRemove),
      },
    }));
  }

  // Add plan type manager's email to plan type CC list
  function handleAddPlanTypeManagerEmailToCc(pType: string) {
    const mgrId = planTypeSettings[pType]?.assignedManagerId || assignedManagerId;
    const selectedManager = availableManagers.find(
      (m: any) => String(m._id || m.id || "") === String(mgrId)
    );
    if (!selectedManager?.email) {
      toast.error(`Please select an assigned manager for ${pType} first`);
      return;
    }
    const mgrEmail = selectedManager.email.toLowerCase();
    const currentCc = planTypeSettings[pType]?.ccEmails || [];
    if (currentCc.includes(mgrEmail)) {
      toast.info(`Manager email is already in the ${pType} CC list`);
      return;
    }
    setPlanTypeSettings((prev) => ({
      ...prev,
      [pType]: {
        ...prev[pType],
        ccEmails: [...currentCc, mgrEmail],
      },
    }));
    toast.success(`Added manager email (${mgrEmail}) to ${pType} CC list`);
  }

  // Open Task Template Modal
  function handleOpenTaskModal(template?: CustomWorkTaskTemplate) {
    if (template) {
      setEditingTaskId(template.id);
      setTaskTitle(template.title);
      setTaskDesc(template.description || "");
      setTaskStartTime(template.planned_start_time || "09:00");
      setTaskEndTime(template.planned_end_time || "10:00");
      setTaskWorkType(template.work_type || "default");
    } else {
      setEditingTaskId(null);
      setTaskTitle("");
      setTaskDesc("");
      setTaskStartTime("09:00");
      setTaskEndTime("10:00");
      setTaskWorkType("default");
    }
    setTaskModalOpen(true);
  }

  // Save Task Template
  function handleSaveTaskTemplate(e: React.FormEvent) {
    e.preventDefault();
    const title = taskTitle.trim();
    if (!title) {
      toast.error("Task title is required");
      return;
    }

    if (editingTaskId) {
      // Edit
      setCustomWorkTemplates(
        customWorkTemplates.map((t) =>
          t.id === editingTaskId
            ? {
                ...t,
                title,
                description: taskDesc.trim(),
                planned_start_time: taskStartTime,
                planned_end_time: taskEndTime,
                work_type: taskWorkType,
              }
            : t
        )
      );
      toast.success("Custom task template updated");
    } else {
      // Add
      const newTemp: CustomWorkTaskTemplate = {
        id: "task_temp_" + Date.now(),
        title,
        description: taskDesc.trim(),
        planned_start_time: taskStartTime,
        planned_end_time: taskEndTime,
        work_type: taskWorkType,
      };
      setCustomWorkTemplates([...customWorkTemplates, newTemp]);
      toast.success("Custom task template added");
    }

    setTaskModalOpen(false);
  }

  // Remove Task Template
  function handleRemoveTaskTemplate(idToRemove: string) {
    setCustomWorkTemplates(customWorkTemplates.filter((t) => t.id !== idToRemove));
    toast.success("Task template removed");
  }

  // Save All Settings
  async function handleSaveAllSettings() {
    const selectedGlobalManager = availableManagers.find(
      (m: any) => String(m._id || m.id || "") === String(assignedManagerId)
    );

    const payload = {
      assignedManagerId,
      assignedManagerName: selectedGlobalManager ? selectedGlobalManager.name || selectedGlobalManager.email : "",
      assignedManagerEmail: selectedGlobalManager ? selectedGlobalManager.email : "",
      ccEmails,
      planTypeSettings,
      customWorkTemplates,
    };

    saveUserWorkPlannerSettings(userId, payload);

    try {
      await updateSettingsMut({ userId, body: payload }).unwrap();
      toast.success("User Work Planner Settings saved to database!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update settings in database";
      toast.info("Saved settings locally");
    }
  }

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 mb-4 border border-amber-500/20 shadow-lg">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Access Restricted</h2>
        <p className="mt-2 text-sm text-muted max-w-md">
          Configuring assigned user settings is restricted to managers, administrators, or the account owner.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition shadow-sm"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  if (loadingUsers || loadingDbSettings) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="animate-spin text-primary h-8 w-8 mb-3" />
        <p className="text-xs font-semibold text-muted">Loading user profile and settings...</p>
      </div>
    );
  }

  const targetName = targetUser
    ? typeof targetUser.name === "string"
      ? targetUser.name
      : targetUser.email
    : "Assigned User";
  const targetEmail = targetUser?.email || "";
  const targetDept = getUserDepartmentName(targetUser);
  const targetRoles = resolveRoleLabels(targetUser as any);

  const activeTabConfig = WORK_PLAN_TYPES.find((t) => t.id === activePlanTypeTab) || WORK_PLAN_TYPES[0];
  const activePlanSetting = planTypeSettings[activePlanTypeTab] || {
    plan_type: activePlanTypeTab,
    assignedManagerId: "",
    ccEmails: [],
  };

  return (
    <div className="space-y-6 font-sans max-w-5xl mx-auto pb-12">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col gap-3 border-b border-border/60 pb-5">
        {!hideBreadcrumb && (
          <Link
            href={teamDirectoryHref}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-primary transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {adminAccess ? "Assigned Teams" : "My Team"}
          </Link>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-1">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30 text-primary font-black text-xl shadow-2xs">
              {targetName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
                User Settings: {targetName}
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                  <Settings className="h-3 w-3" />
                  Work Planner Config
                </span>
              </h1>
              <p className="text-xs text-muted mt-0.5">
                Assigned manager is set via Team Manager. Configure CC emails and custom work tasks here.
              </p>
            </div>
          </div>

          {!readOnly ? (
            <button
              type="button"
              onClick={handleSaveAllSettings}
              disabled={savingSettings}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-extrabold text-primary-foreground hover:opacity-90 transition shadow-md disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {savingSettings ? "Saving..." : "Save User Settings"}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <ShieldCheck className="h-3.5 w-3.5" />
              Read-Only View
            </span>
          )}
        </div>
      </div>

      {readOnly && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-500 font-semibold flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>Read-Only View — Work Planner Settings are configured by your assigned Manager or Administrator.</span>
        </div>
      )}

      {/* Target User Info Summary Banner */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Mail className="h-4 w-4 text-muted shrink-0" />
          <span className="text-xs font-semibold text-foreground">{targetEmail}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {targetDept && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-surface-muted text-foreground border border-border">
              <Building2 className="h-3 w-3 text-muted" />
              {targetDept}
            </span>
          )}
          {targetRoles.map((r: string) => (
            <span
              key={r}
              className="inline-flex items-center text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20"
            >
              {r}
            </span>
          ))}
        </div>
      </div>

      {/* TOP-LEVEL MAIN NAVIGATION TABS */}
      <div className="flex border border-border bg-card rounded-2xl p-1.5 shadow-2xs gap-1.5 overflow-x-auto">
        <button
          type="button"
          onClick={() => setMainTab("plan_types")}
          className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            mainTab === "plan_types"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted hover:text-foreground hover:bg-surface-muted"
          }`}
        >
          <Layers className="h-4 w-4" />
          Work Plan Type Settings
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              mainTab === "plan_types" ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
            }`}
          >
            4 Types
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab("global_defaults")}
          className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            mainTab === "global_defaults"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted hover:text-foreground hover:bg-surface-muted"
          }`}
        >
          <Globe className="h-4 w-4" />
          Global Defaults & CC
          {assignedManagerId && (
            <span className="h-2 w-2 rounded-full bg-emerald-400" title="Global manager configured" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setMainTab("custom_tasks")}
          className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            mainTab === "custom_tasks"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted hover:text-foreground hover:bg-surface-muted"
          }`}
        >
          <FileText className="h-4 w-4" />
          Custom Work Tasks
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              mainTab === "custom_tasks" ? "bg-white/20 text-white" : "bg-emerald-500/10 text-emerald-500"
            }`}
          >
            {customWorkTemplates.length}
          </span>
        </button>
      </div>

      {/* MAIN TAB 1: PER WORK PLAN TYPE MANAGER & CC ASSIGNMENTS */}
      {mainTab === "plan_types" && (
        <div className="rounded-3xl border border-border bg-card p-6 shadow-2xs space-y-5 animate-in fade-in duration-150">
          <div className="flex items-center gap-3 border-b border-border/60 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Work Plan Type Manager & CC Assignments</h2>
              <p className="text-xs text-muted">
                Assigned manager is managed in Team Manager (same for all plan types). Edit CC emails per type below.
              </p>
            </div>
          </div>

          {/* Plan Type Selection Sub-Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {WORK_PLAN_TYPES.map((wpt) => {
              const IconComponent = wpt.icon;
              const isActive = activePlanTypeTab === wpt.id;
              const customManagerSet = Boolean(planTypeSettings[wpt.id]?.assignedManagerId);
              const ccCount = planTypeSettings[wpt.id]?.ccEmails?.length || 0;

              return (
                <button
                  key={wpt.id}
                  type="button"
                  onClick={() => setActivePlanTypeTab(wpt.id)}
                  className={`flex flex-col items-start gap-1.5 p-3.5 rounded-2xl border text-left transition-all ${
                    isActive
                      ? "border-primary bg-primary/5 shadow-xs"
                      : "border-border bg-background hover:bg-surface-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                        isActive ? "bg-primary text-primary-foreground" : "bg-surface-muted text-muted"
                      }`}
                    >
                      <IconComponent className="h-4 w-4" />
                    </div>
                    {customManagerSet && (
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
                        Mgr Set
                      </span>
                    )}
                  </div>

                  <div>
                    <div className={`text-xs font-bold ${isActive ? "text-primary" : "text-foreground"}`}>
                      {wpt.id}
                    </div>
                    <div className="text-[10px] text-muted line-clamp-1">{wpt.description}</div>
                  </div>

                  {ccCount > 0 && (
                    <div className="text-[10px] font-semibold text-muted flex items-center gap-1 mt-0.5">
                      <Mail className="h-3 w-3 text-purple-400" />
                      {ccCount} CC {ccCount === 1 ? "email" : "emails"}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Plan Type Configuration Box */}
          <div className="rounded-2xl border border-border bg-background p-5 space-y-6">
            <div className="flex items-center gap-3 border-b border-border/60 pb-3.5">
              <activeTabConfig.icon className="h-5 w-5 text-primary" />
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Settings for Work Plan Type: <span className="text-primary">{activeTabConfig.label}</span>
                </h3>
                <p className="text-[11px] text-muted">{activeTabConfig.description}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Assigned Manager for Plan Type */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Assigned Manager ({activeTabConfig.id})</span>
                  {activePlanSetting.assignedManagerId && (
                    <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Dedicated Manager Configured
                    </span>
                  )}
                </label>

                <select
                  value={activePlanSetting.assignedManagerId || ""}
                  onChange={(e) => handlePlanTypeManagerSelect(activePlanTypeTab, e.target.value)}
                  disabled
                  className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="">-- Use Default Manager ({assignedManagerId ? "Global Manager Selected" : "None"}) --</option>
                  {availableManagers.map((m: any) => {
                    const mId = String(m._id || m.id || "");
                    const mName = typeof m.name === "string" ? m.name : m.email;
                    return (
                      <option key={mId} value={mId}>
                        {mName} ({m.email})
                      </option>
                    );
                  })}
                </select>

                {activePlanSetting.assignedManagerId ? (
                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-500 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Dedicated Manager Assigned for {activePlanTypeTab}
                    </div>
                    <p className="text-[11px] text-muted">
                      Set automatically from Team Manager reporting. Change it there to update all plan types.
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted italic">
                    No manager mapped yet. Assign reporting in Team Manager to set this for all plan types.
                  </p>
                )}
              </div>

              {/* CC Emails for Plan Type */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-foreground">
                  CC Emails for {activeTabConfig.id}
                </label>

                {!readOnly && (
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      value={newPlanTypeCcInputs[activePlanTypeTab] || ""}
                      onChange={(e) =>
                        setNewPlanTypeCcInputs((prev) => ({ ...prev, [activePlanTypeTab]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddPlanTypeCcEmail(activePlanTypeTab);
                        }
                      }}
                      placeholder={`Enter CC email for ${activePlanTypeTab}...`}
                      className="flex-1 rounded-xl border border-border bg-card px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddPlanTypeCcEmail(activePlanTypeTab)}
                      className="inline-flex items-center gap-1 rounded-xl bg-primary/10 border border-primary/20 px-3.5 py-2 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground transition shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add CC
                    </button>
                  </div>
                )}

                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleAddPlanTypeManagerEmailToCc(activePlanTypeTab)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary hover:underline mt-0.5"
                  >
                    + Add {activePlanTypeTab}&apos;s Manager Email to CC
                  </button>
                )}

                {activePlanSetting.ccEmails && activePlanSetting.ccEmails.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {activePlanSetting.ccEmails.map((email) => (
                      <span
                        key={email}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-card border border-border px-3 py-1 text-xs font-semibold text-foreground shadow-2xs"
                      >
                        <span>{email}</span>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => handleRemovePlanTypeCcEmail(activePlanTypeTab, email)}
                            className="text-muted hover:text-rose-500 transition"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted italic pt-1">
                    No specific CC emails for &quot;{activePlanTypeTab}&quot; set yet. (Global CC emails will apply).
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN TAB 2: GLOBAL DEFAULT MANAGER & CC RECIPIENTS */}
      {mainTab === "global_defaults" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-150">
          {/* GLOBAL DEFAULT MANAGER */}
          <div className="rounded-3xl border border-border bg-card p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-border/60 pb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Global Fallback Manager</h2>
                <p className="text-[11px] text-muted">Set via Team Manager (read-only here)</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-foreground">Assigned Manager (from Team Manager)</label>
              <select
                value={assignedManagerId}
                onChange={(e) => handleGlobalManagerSelect(e.target.value)}
                disabled
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">-- No Global Manager Assigned --</option>
                {availableManagers.map((m: any) => {
                  const mId = String(m._id || m.id || "");
                  const mName = typeof m.name === "string" ? m.name : m.email;
                  return (
                    <option key={mId} value={mId}>
                      {mName} ({m.email})
                    </option>
                  );
                })}
              </select>

              {assignedManagerId ? (
                <div className="rounded-2xl bg-blue-500/10 border border-blue-500/20 p-3.5 text-xs text-blue-400 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-blue-500" />
                    Global Default Manager Selected
                  </div>
                  <p className="text-[11px] text-muted">
                    Synced from Team Manager reporting. Change the mapping there to update all plan types.
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-muted italic">
                  No manager mapped yet. Use Team Manager to assign who this user reports to.
                </p>
              )}
            </div>
          </div>

          {/* GLOBAL DEFAULT CC EMAILS */}
          <div className="rounded-3xl border border-border bg-card p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-border/60 pb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Global CC Email Recipients</h2>
                <p className="text-[11px] text-muted">Default CC emails applied across all plan types</p>
              </div>
            </div>

            <div className="space-y-3">
              {!readOnly && (
                <>
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      value={newCcInput}
                      onChange={(e) => setNewCcInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddGlobalCcEmail();
                        }
                      }}
                      placeholder="Enter global CC email address..."
                      className="flex-1 rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddGlobalCcEmail}
                      className="inline-flex items-center gap-1 rounded-xl bg-primary/10 border border-primary/20 px-3.5 py-2 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground transition"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add CC
                    </button>
                  </div>

                  {assignedManagerId && (
                    <button
                      type="button"
                      onClick={handleAddGlobalManagerEmailToCc}
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary hover:underline mt-1"
                    >
                      + Add Global Manager&apos;s email to CC list
                    </button>
                  )}
                </>
              )}

              {ccEmails.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  {ccEmails.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-surface-muted border border-border px-3 py-1 text-xs font-semibold text-foreground"
                    >
                      <span>{email}</span>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => handleRemoveGlobalCcEmail(email)}
                          className="text-muted hover:text-rose-500 transition"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-muted italic pt-1">No global CC emails configured yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MAIN TAB 3: CUSTOM TASKS / WORKS PLAN TEMPLATES */}
      {mainTab === "custom_tasks" && (
        <div className="rounded-3xl border border-border bg-card p-6 shadow-2xs space-y-4 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Custom Work Tasks / Templates</h2>
                <p className="text-[11px] text-muted">
                  Pre-configured task templates automatically suggested for this user&apos;s daily work plans
                </p>
              </div>
            </div>

            {!readOnly && (
              <button
                type="button"
                onClick={() => handleOpenTaskModal()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-4 py-2 text-xs font-bold text-emerald-500 hover:bg-emerald-500 hover:text-white transition"
              >
                <Plus className="h-4 w-4" />
                Add Custom Work Task
              </button>
            )}
          </div>

          {customWorkTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface-muted/30 p-8 text-center">
              <FileText className="h-8 w-8 text-muted mb-2" />
              <h4 className="text-xs font-bold text-foreground">No Custom Work Tasks Configured</h4>
              <p className="text-[11px] text-muted max-w-sm mt-1">
                Add custom recurring tasks or work templates (e.g. &quot;Daily Morning Sync&quot;, &quot;Field Visit Prep&quot;, &quot;Day End Report Submission&quot;).
              </p>
              <button
                type="button"
                onClick={() => handleOpenTaskModal()}
                className="mt-3 rounded-xl border border-border bg-background px-3.5 py-1.5 text-xs font-semibold text-primary hover:bg-surface-muted transition"
              >
                + Create First Template
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {customWorkTemplates.map((task) => (
                <div
                  key={task.id}
                  className="relative flex flex-col justify-between rounded-2xl border border-border bg-background p-4 shadow-2xs hover:border-primary/40 transition"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-foreground">{task.title}</h4>
                      {!readOnly && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenTaskModal(task)}
                            className="p-1 text-muted hover:text-primary transition"
                            title="Edit Task Template"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveTaskTemplate(task.id)}
                            className="p-1 text-muted hover:text-rose-500 transition"
                            title="Delete Task Template"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {task.description && (
                      <p className="text-[11px] text-muted mt-1.5 line-clamp-2">{task.description}</p>
                    )}
                  </div>

                  <div className="mt-3 border-t border-border/60 pt-2.5 flex items-center justify-between text-[10px] text-muted font-semibold">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-emerald-500" />
                      {task.planned_start_time || "--:--"} - {task.planned_end_time || "--:--"}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                        task.work_type === "optional"
                          ? "bg-amber-500/15 text-amber-500 border border-amber-500/20"
                          : "bg-primary/15 text-primary border border-primary/20"
                      }`}
                    >
                      {task.work_type === "optional" ? "Optional" : "Default"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom Save Action Bar */}
      {!readOnly && (
        <div className="flex items-center justify-between border-t border-border/60 pt-4">
          <Link
            href={teamDirectoryHref}
            className="rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
          >
            Cancel
          </Link>

          <button
            type="button"
            onClick={handleSaveAllSettings}
            disabled={savingSettings}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-extrabold text-primary-foreground hover:opacity-90 transition shadow-md disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {savingSettings ? "Saving Settings..." : "Save User Settings"}
          </button>
        </div>
      )}

      {/* TASK TEMPLATE FORM MODAL */}
      {taskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-3xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="text-sm font-bold text-foreground">
                {editingTaskId ? "Edit Custom Work Task" : "Add Custom Work Task Template"}
              </h3>
              <button
                type="button"
                onClick={() => setTaskModalOpen(false)}
                className="text-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTaskTemplate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Task Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g. Morning Team Catchup"
                  required
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Description / Notes</label>
                <textarea
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="Optional details or guidelines for this task..."
                  rows={2}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Planned Start Time</label>
                  <input
                    type="time"
                    value={taskStartTime}
                    onChange={(e) => setTaskStartTime(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Planned End Time</label>
                  <input
                    type="time"
                    value={taskEndTime}
                    onChange={(e) => setTaskEndTime(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  Work Type <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTaskWorkType("default")}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition ${
                      taskWorkType === "default"
                        ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                        : "bg-background text-foreground border-border hover:bg-surface-muted"
                    }`}
                  >
                    Default Task
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskWorkType("optional")}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition ${
                      taskWorkType === "optional"
                        ? "bg-amber-500 text-white border-amber-500 shadow-2xs"
                        : "bg-background text-foreground border-border hover:bg-surface-muted"
                    }`}
                  >
                    Optional Task
                  </button>
                </div>
                <p className="text-[10px] text-muted mt-1">
                  {taskWorkType === "default"
                    ? "Default tasks are standard/pre-selected items for daily work plans."
                    : "Optional tasks can be chosen on demand when building daily plans."}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
                <button
                  type="button"
                  onClick={() => setTaskModalOpen(false)}
                  className="rounded-xl border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition shadow-xs"
                >
                  <Check className="h-4 w-4" />
                  {editingTaskId ? "Update Task" : "Add Task Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
