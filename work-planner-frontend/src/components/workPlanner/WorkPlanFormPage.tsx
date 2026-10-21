"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Calendar,
  MapPin,
  FileText,
  User as UserIcon,
  Search,
  ChevronDown,
  Check,
  X,
  Plus,
  Trash2,
  Building2,
  CheckSquare,
  Briefcase,
  Clock,
  Edit3,
  MessageSquare,
  Mail,
  AlertTriangle,
  Lock,
  Sparkles,
  RotateCcw,
  Loader2,
  History,
  StickyNote,
} from "lucide-react";
import { toast } from "sonner";
import { useGetUsersQuery } from "@/store/api/authApiSlice";
import {
  useLazyGetPlanQuery,
  useLazyGetPlansQuery,
  useCreatePlanMutation,
  useUpdatePlanMutation,
  useSubmitPlanMutation,
  useAddVisitMutation,
  useUpdateVisitMutation,
  useRemoveVisitMutation,
  useAddWorkMutation,
  useUpdateWorkMutation,
  useRemoveWorkMutation,
  useGetUserSettingsQuery,
  useGetMyTeamQuery,
  useGetEligibleManagersQuery,
  useLazyGetWorkPlanDraftQuery,
  useSaveWorkPlanDraftMutation,
  useDeleteWorkPlanDraftMutation,
  useMarkNotesConvertedMutation,
} from "@/store/api/workPlannerApiSlice";
import {
  useGetPartyCountriesQuery,
  useGetPartyStatesQuery,
  useGetPartyCitiesQuery,
} from "@/store/api/partyApiSlice";
import {
  isWpAdmin,
  isWpManager,
  isWpCoordinator,
  isWpElevated,
  hasWorkPlannerPortalAccess,
  readSessionFromStorage,
} from "@/utils/authStorage";
import { getUserWorkPlannerSettings, type CustomWorkTaskTemplate } from "@/utils/userWorkPlannerSettings";
import type { WorkPlanRecord, WorkPlanVisitRecord, WorkPlanWorkRecord } from "@/types/workPlanner";
import {
  WORK_PLAN_TYPE_TABS,
  isVisitsPlan,
  isWorkTaskPlan,
  isBothTasksAndVisitsPlan,
  isLeavePlan,
  isSunday,
  formatTime,
  renderVisitStatusBadge,
  renderWorkStatusBadge,
} from "./workPlanUtils";
import { VisitFormModal } from "./VisitFormModal";
import { WorkFormModal } from "./WorkFormModal";
import { WorkPlanCreateMailModal, type CreateEmailPayload } from "./WorkPlanCreateMailModal";
import { SelectPreviousPendingItemsModal } from "./SelectPreviousPendingItemsModal";
import { ImportNotesModal } from "./notes/ImportNotesModal";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import {
  saveWorkPlanDraft,
  loadWorkPlanDraft,
  clearWorkPlanDraft,
  isDraftMeaningful,
  formatDraftTime,
  type WorkPlanFormDraft,
} from "./workPlanDraftStorage";

function extractErrorMessage(err: unknown, fallbackMsg: string): string {
  if (!err) return fallbackMsg;
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    const e = err as any;
    if (e.data?.message && typeof e.data.message === "string") return e.data.message;
    if (e.data?.error && typeof e.data.error === "string") return e.data.error;
    if (e.message && typeof e.message === "string") return e.message;
    if (e.error && typeof e.error === "string") return e.error;
  }
  if (err instanceof Error) return err.message;
  return fallbackMsg;
}

interface WorkPlanFormPageProps {
  planId?: string;
  copyId?: string;
  initialDate?: string;
}

interface ExecutiveUser {
  _id: string;
  id?: string;
  name: string;
  email: string;
  department?: string;
  portals?: Array<{
    portal_code?: string;
    portal?: { code?: string };
    code?: string;
    access_roles?: string[];
  }>;
}

function hasWorkPlannerAccess(u: ExecutiveUser | any, sessionUserId?: string): boolean {
  if (!u) return false;
  const uId = String(u._id || u.id || "");
  if (sessionUserId && uId === String(sessionUserId)) return true;
  return hasWorkPlannerPortalAccess(u);
}

function getWorkPlannerUserRole(u: ExecutiveUser): "Admin" | "Manager" | "Coordinator" | null {
  const uAny = u as any;
  if (
    uAny.department === "super_admin" ||
    (Array.isArray(uAny.role_codes) && uAny.role_codes.includes("super_admin")) ||
    (Array.isArray(uAny.roles) && uAny.roles.includes("super_admin"))
  ) {
    return "Admin";
  }
  if (uAny.wp_role === "admin" || uAny.wp_role === "super_admin") return "Admin";
  if (uAny.wp_role === "manager") return "Manager";
  if (uAny.wp_role === "coordinator") return "Coordinator";

  if (!Array.isArray(u.portals) || u.portals.length === 0) {
    return null;
  }

  const wpPortal = u.portals.find((p) => {
    const code = p.portal_code || p.portal?.code || p.code;
    return code === "work_planner";
  });

  if (!wpPortal) return null;

  const roles: string[] = Array.isArray(wpPortal.access_roles)
    ? wpPortal.access_roles
    : (wpPortal as any).access_role
      ? [(wpPortal as any).access_role]
      : [];

  const normalized = roles.map((r) => String(r).toLowerCase().trim());
  if (normalized.includes("admin") || normalized.includes("super_admin")) return "Admin";
  if (normalized.includes("manager")) return "Manager";
  if (normalized.includes("coordinator")) return "Coordinator";
  return null;
}

function getWorkPlannerUserPortalRole(
  u: ExecutiveUser | { portals?: any[] } | null | undefined
): "Admin" | "Manager" | "Coordinator" | "Executive" | null {
  if (u && isWpAdmin(u as any)) return "Admin";
  if (u && isWpManager(u as any)) return "Manager";
  if (u && isWpCoordinator(u as any)) return "Coordinator";
  if (!u) return null;

  if (Array.isArray(u.portals) && u.portals.length > 0) {
    const wpPortal = u.portals.find((p) => {
      const code = p.portal_code || p.portal?.code || p.code || (p as any).portal;
      return code === "work_planner";
    });

    if (wpPortal) {
      const roles: string[] = Array.isArray(wpPortal.access_roles)
        ? wpPortal.access_roles
        : (wpPortal as any).access_role
          ? [(wpPortal as any).access_role]
          : [];

      const normalized = roles.map((r) => String(r).toLowerCase().trim());
      if (normalized.includes("admin") || normalized.includes("super_admin")) return "Admin";
      if (normalized.includes("manager")) return "Manager";
      if (normalized.includes("coordinator")) return "Coordinator";
      return "Executive";
    }
  }

  return null;
}

function mapNotesToVisitsAndWorks(notes: any[]) {
  const visitNotes = notes.filter((n: any) => n.type === "visit");
  const taskNotes = notes.filter(
    (n: any) => n.type === "task" || n.type === "general" || (!n.type && n.type !== "visit")
  );

  const mappedVisits: WorkPlanVisitRecord[] = visitNotes.map((n: any, idx: number) => {
    const contacts =
      Array.isArray(n.contacts) && n.contacts.length > 0
        ? n.contacts
        : n.contact_person || n.contact_number
          ? [{ contact_person: n.contact_person || "", contact_number: n.contact_number || "" }]
          : [];

    return {
      sequence: idx + 1,
      party: typeof n.party === "object" && n.party ? (n.party as any)._id : n.party || undefined,
      party_name: n.party_name || n.title || "Party Visit",
      party_type: (n.party_type as any) || "existing",
      contacts,
      contact_person: n.contact_person || contacts[0]?.contact_person || "",
      contact_number: n.contact_number || contacts[0]?.contact_number || "",
      locality: n.locality || "",
      city: n.city || "",
      purpose: n.purpose || "Sales Discussion",
      planned_start_time: n.planned_time || "",
      notes: n.description || n.content || "",
      remarks: n.description || n.content || "",
      status: "created",
    };
  });

  const mappedWorks: WorkPlanWorkRecord[] = taskNotes.map((n: any, idx: number) => ({
    sequence: idx + 1,
    title: n.title || "Task from Notes",
    description: n.description || n.content || "",
    priority: (n.priority as any) || "medium",
    status: "created",
  }));

  return { mappedVisits, mappedWorks, noteIds: notes.map((n: any) => String(n._id || n.id)) };
}

export function WorkPlanFormPage({ planId, copyId, initialDate }: WorkPlanFormPageProps) {
  const router = useRouter();
  const [existingPlanId, setExistingPlanId] = useState<string | null>(planId || null);
  const [detectedPlan, setDetectedPlan] = useState<WorkPlanRecord | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [planStatus, setPlanStatus] = useState<string | null>(null);

  const activePlanId = existingPlanId || planId;
  const isEditing = Boolean(activePlanId);
  const isCopying = Boolean(copyId) && !isEditing;
  const sessionUser = useMemo(() => readSessionFromStorage()?.user, []);
  const adminRole = useMemo(() => isWpAdmin(sessionUser), [sessionUser]);
  const isElevatedNonAdmin = useMemo(() => isWpElevated(sessionUser) && !adminRole, [sessionUser, adminRole]);
  const elevatedRole = useMemo(() => isWpElevated(sessionUser), [sessionUser]);
  const managerRole = elevatedRole;
  const { data: myTeamData } = useGetMyTeamQuery(undefined, { skip: !isElevatedNonAdmin });
  const prevFetchedKey = useRef<string>("");
  const copiedVisitsRef = useRef<any[]>([]);
  const copiedWorksRef = useRef<any[]>([]);
  const importedNotesRef = useRef<{ targetDate?: string; notes: any[] } | null>(null);

  // Read imported notes from session storage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = sessionStorage.getItem("opms_workplan_import_notes");
      if (stored) {
        sessionStorage.removeItem("opms_workplan_import_notes");
        const parsed = JSON.parse(stored);
        if (parsed && Array.isArray(parsed.notes) && parsed.notes.length > 0) {
          importedNotesRef.current = parsed;
          if (parsed.targetDate && !initialDate) {
            setPlanDate(parsed.targetDate);
          }
        }
      }
    } catch {
      // ignore
    }
  }, [initialDate]);

  const minPlanDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  const [loading, setLoading] = useState(Boolean(planId));
  const [submitting, setSubmitting] = useState(false);

  const [planDate, setPlanDate] = useState(() => initialDate || new Date().toISOString().split("T")[0]);
  const [planType, setPlanType] = useState<string>("");
  const isPlanCompleted =
    planType !== "Leave" &&
    (planStatus === "completed" || detectedPlan?.status === "completed");
  const [location, setLocation] = useState("");
  const [countryId, setCountryId] = useState("");
  const [countryName, setCountryName] = useState("");
  const [stateId, setStateId] = useState("");
  const [stateName, setStateName] = useState("");
  const [cityId, setCityId] = useState("");
  const [cityName, setCityName] = useState("");
  const [selectedCityIds, setSelectedCityIds] = useState<string[]>([]);
  const [selectedCityNames, setSelectedCityNames] = useState<string[]>([]);
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState("");
  const cityDropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close city dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(event.target as Node)) {
        setIsCityDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const [remarks, setRemarks] = useState("");
  const [salesUserId, setSalesUserId] = useState<string>(() => sessionUser?._id || "");

  const requiresGeo = isVisitsPlan(planType) || isBothTasksAndVisitsPlan(planType);

  const { data: countriesData = [], isLoading: isCountriesLoading } = useGetPartyCountriesQuery(
    { limit: 500, status: "active" },
    { skip: !requiresGeo }
  );

  const { data: statesData = [], isLoading: isStatesLoading } = useGetPartyStatesQuery(
    countryId ? { country_id: countryId, limit: 1000, status: "active" } : undefined,
    { skip: !requiresGeo || !countryId }
  );

  const { data: citiesData = [], isLoading: isCitiesLoading } = useGetPartyCitiesQuery(
    stateId ? { state_id: stateId, limit: 5000, status: "active" } : undefined,
    { skip: !requiresGeo || !stateId }
  );

  // Auto-select India by default if no country selected
  useEffect(() => {
    if (requiresGeo && !countryId && countriesData.length > 0) {
      const india = countriesData.find(
        (c) =>
          c.name.trim().toLowerCase() === "india" ||
          c.iso_code?.toUpperCase() === "IN"
      );
      if (india) {
        setCountryId(india._id || india.id || "");
        setCountryName(india.name);
      }
    }
  }, [requiresGeo, countriesData, countryId]);

  // Match state name to state ID if set by text from plan
  useEffect(() => {
    if (stateName && !stateId && statesData.length > 0) {
      const sMatch = statesData.find(
        (s) => s.name.trim().toLowerCase() === stateName.trim().toLowerCase()
      );
      if (sMatch) {
        setStateId(sMatch._id || sMatch.id || "");
      }
    }
  }, [statesData, stateName, stateId]);

  // If stateId is set but does not belong to the currently loaded states for this country, clear it
  useEffect(() => {
    if (stateId && statesData.length > 0 && !isStatesLoading) {
      const exists = statesData.some((s) => s._id === stateId || s.id === stateId);
      if (!exists) {
        setStateId("");
        setStateName("");
        setCityId("");
        setCityName("");
        setSelectedCityIds([]);
        setSelectedCityNames([]);
      }
    }
  }, [statesData, stateId, isStatesLoading]);

  // Match city names to city IDs when citiesData loads
  useEffect(() => {
    if (citiesData.length > 0) {
      if (selectedCityNames.length > 0 && selectedCityIds.length < selectedCityNames.length) {
        const resolvedIds: string[] = [];
        for (const name of selectedCityNames) {
          const match = citiesData.find(
            (ci) => ci.name.trim().toLowerCase() === name.trim().toLowerCase()
          );
          if (match) {
            resolvedIds.push(match._id || match.id || "");
          }
        }
        if (resolvedIds.length > 0) {
          setSelectedCityIds(resolvedIds);
          if (!cityId) setCityId(resolvedIds[0]);
        }
      } else if (cityName && selectedCityNames.length === 0) {
        const names = cityName.split(",").map((s) => s.trim()).filter(Boolean);
        if (names.length > 0) {
          setSelectedCityNames(names);
          const resolvedIds = citiesData
            .filter((ci) => names.some((n) => n.toLowerCase() === ci.name.trim().toLowerCase()))
            .map((ci) => ci._id || ci.id || "")
            .filter(Boolean);
          if (resolvedIds.length > 0) {
            setSelectedCityIds(resolvedIds);
            if (!cityId) setCityId(resolvedIds[0]);
          }
        }
      }
    }
  }, [citiesData, cityName, selectedCityNames, selectedCityIds, cityId]);

  // If selectedCityIds are set but do not belong to the currently loaded cities for this state, filter them
  useEffect(() => {
    if (selectedCityIds.length > 0 && citiesData.length > 0 && !isCitiesLoading) {
      const validIds = selectedCityIds.filter((cid) =>
        citiesData.some((ci) => ci._id === cid || ci.id === cid)
      );
      if (validIds.length !== selectedCityIds.length) {
        setSelectedCityIds(validIds);
        const validNames = citiesData
          .filter((ci) => validIds.includes(ci._id || ci.id || ""))
          .map((ci) => ci.name);
        setSelectedCityNames(validNames);
        setCityId(validIds[0] || "");
        setCityName(validNames.join(", "));
      }
    }
  }, [citiesData, selectedCityIds, isCitiesLoading]);

  // Local state arrays for embedded visits and tasks
  const [visits, setVisits] = useState<Array<Record<string, any>>>([]);
  const [works, setWorks] = useState<Array<Record<string, any>>>([]);

  // Modal states for embedded visits and tasks
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [editingVisitIndex, setEditingVisitIndex] = useState<number | null>(null);

  const [workModalOpen, setWorkModalOpen] = useState(false);
  const [editingWorkIndex, setEditingWorkIndex] = useState<number | null>(null);

  // Modal state for selecting previous pending/in-progress items
  const [previousModalMode, setPreviousModalMode] = useState<"visits" | "tasks" | null>(null);

  // Modal state for importing items from Scratchpad / Notes
  const [importNotesMode, setImportNotesMode] = useState<"visits" | "tasks" | null>(null);
  const [importedNoteIds, setImportedNoteIds] = useState<string[]>([]);

  // Deletion confirmation modal state
  const [deleteItemTarget, setDeleteItemTarget] = useState<{
    type: "visit" | "task";
    index: number;
    title: string;
  } | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  // Task rollover loading state
  const [rolloverLoading, setRolloverLoading] = useState(false);

  // Creation Email Panel Modal state
  const [createMailModalOpen, setCreateMailModalOpen] = useState(false);
  const [pendingPlanData, setPendingPlanData] = useState<{
    payload: Partial<WorkPlanRecord>;
    visits: Array<Record<string, any>>;
    works: Array<Record<string, any>>;
    displayPlan: WorkPlanRecord;
  } | null>(null);

  // Discussion with manager state
  const [isDiscussedWithManager, setIsDiscussedWithManager] = useState<boolean | null>(null);
  const [discussedManagerId, setDiscussedManagerId] = useState<string>("");
  const [discussedManagerName, setDiscussedManagerName] = useState<string>("");
  const [discussionMethod, setDiscussionMethod] = useState<"on_call" | "on_direct_meeting" | "on_email" | "other">("on_call");
  const [managerSearch, setManagerSearch] = useState("");
  const [managerDropdownOpen, setManagerDropdownOpen] = useState(false);
  const [showManagerPicker, setShowManagerPicker] = useState(false);
  const managerDropdownRef = useRef<HTMLDivElement>(null);

  // Search & Combobox states for executive selection
  const [execSearch, setExecSearch] = useState("");
  const [execDropdownOpen, setExecDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Real-time Draft States
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved" | "restored">("idle");
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string | null>(null);
  const [availableDraft, setAvailableDraft] = useState<WorkPlanFormDraft | null>(null);
  const isHydratedRef = useRef(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setExecDropdownOpen(false);
      }
      if (managerDropdownRef.current && !managerDropdownRef.current.contains(event.target as Node)) {
        setManagerDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch all users for executive selection (admins) and manager discussion selection
  const { data: usersData } = useGetUsersQuery(undefined, { skip: !adminRole });
  const { data: eligibleManagersData } = useGetEligibleManagersQuery();
  const [fetchPlan] = useLazyGetPlanQuery();
  const [lazyGetPlans] = useLazyGetPlansQuery();
  const [createPlanMut] = useCreatePlanMutation();
  const [updatePlanMut] = useUpdatePlanMutation();
  const [submitPlanMut] = useSubmitPlanMutation();
  const [addVisitMut] = useAddVisitMutation();
  const [updateVisitMut] = useUpdateVisitMutation();
  const [removeVisitMut] = useRemoveVisitMutation();
  const [addWorkMut] = useAddWorkMutation();
  const [updateWorkMut] = useUpdateWorkMutation();
  const [removeWorkMut] = useRemoveWorkMutation();
  const [lazyGetDraft] = useLazyGetWorkPlanDraftQuery();
  const [saveDraftMut] = useSaveWorkPlanDraftMutation();
  const [deleteDraftMut] = useDeleteWorkPlanDraftMutation();
  const [markNotesConvertedMut] = useMarkNotesConvertedMutation();

  // Fetch Target User Work Planner Settings (Manager assignments & custom task templates)
  const targetUserId = salesUserId || sessionUser?._id || "";
  const { data: dbUserSettings } = useGetUserSettingsQuery(targetUserId, { skip: !targetUserId });

  const effectiveSettings = useMemo(() => {
    if (dbUserSettings) return dbUserSettings;
    if (targetUserId) return getUserWorkPlannerSettings(targetUserId);
    return null;
  }, [dbUserSettings, targetUserId]);

  const allUsers = useMemo<ExecutiveUser[]>(() => {
    if (adminRole && usersData) return (usersData as ExecutiveUser[]) || [];
    const list: ExecutiveUser[] = [];
    const seen = new Set<string>();

    const addUser = (u: any) => {
      if (!u) return;
      const id = String(u._id || u.id || "");
      if (id && !seen.has(id)) {
        seen.add(id);
        list.push(u as ExecutiveUser);
      }
    };

    if (sessionUser) addUser(sessionUser);
    if (Array.isArray(eligibleManagersData)) {
      eligibleManagersData.forEach(addUser);
    }
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
  }, [adminRole, usersData, sessionUser, eligibleManagersData, myTeamData]);

  // Resolve assigned manager for current plan type (or fallback to global default manager)
  const assignedPlanTypeManager = useMemo(() => {
    if (!effectiveSettings) return null;
    const pts = effectiveSettings.planTypeSettings?.[planType];
    const mgrId = pts?.assignedManagerId;
    const mgrName = pts?.assignedManagerName;
    const mgrEmail = pts?.assignedManagerEmail;

    if (mgrId || mgrName) {
      const matched = allUsers.find(
        (u) => String(u._id || u.id || "") === String(mgrId)
      );
      if (matched) {
        return {
          _id: String(matched._id || matched.id || ""),
          name: matched.name,
          email: matched.email,
          department: matched.department,
          isSpecificPlanType: true,
        };
      }
      if (mgrName) {
        return {
          _id: mgrId || "",
          name: mgrName,
          email: mgrEmail || "",
          department: "",
          isSpecificPlanType: true,
        };
      }
    }

    // Fallback to global default manager
    const globalId = effectiveSettings.assignedManagerId;
    const globalName = effectiveSettings.assignedManagerName;
    const globalEmail = effectiveSettings.assignedManagerEmail;

    if (globalId || globalName) {
      const matched = allUsers.find(
        (u) => String(u._id || u.id || "") === String(globalId)
      );
      if (matched) {
        return {
          _id: String(matched._id || matched.id || ""),
          name: matched.name,
          email: matched.email,
          department: matched.department,
          isSpecificPlanType: false,
        };
      }
      if (globalName) {
        return {
          _id: globalId || "",
          name: globalName,
          email: globalEmail || "",
          department: "",
          isSpecificPlanType: false,
        };
      }
    }

    return null;
  }, [effectiveSettings, planType, allUsers]);

  const currentDisplayedManager = useMemo(() => {
    if (discussedManagerId) {
      const matched = allUsers.find(
        (u) => String(u._id || u.id || "") === String(discussedManagerId)
      );
      if (matched) {
        const isPlanTypeMgr =
          assignedPlanTypeManager?.isSpecificPlanType &&
          String(assignedPlanTypeManager._id) === String(matched._id || matched.id);
        const isDefaultMgr =
          !assignedPlanTypeManager?.isSpecificPlanType &&
          assignedPlanTypeManager?._id &&
          String(assignedPlanTypeManager._id) === String(matched._id || matched.id);

        const portalRole = getWorkPlannerUserRole(matched);

        return {
          name: matched.name,
          email: matched.email,
          badgeText: isPlanTypeMgr
            ? `${planType} Manager`
            : isDefaultMgr
            ? "Reporting Manager"
            : portalRole === "Admin"
            ? "Portal Admin"
            : portalRole === "Coordinator"
            ? "Portal Coordinator"
            : "Portal Manager",
          isSpecificPlanType: isPlanTypeMgr,
        };
      }
    }

    if (discussedManagerName) {
      const isPlanTypeMgr =
        assignedPlanTypeManager?.isSpecificPlanType &&
        assignedPlanTypeManager.name === discussedManagerName;
      const isDefaultMgr =
        !assignedPlanTypeManager?.isSpecificPlanType &&
        assignedPlanTypeManager?.name === discussedManagerName;

      return {
        name: discussedManagerName,
        email: "Reporting Manager",
        badgeText: isPlanTypeMgr
          ? `${planType} Manager`
          : isDefaultMgr
          ? "Reporting Manager"
          : "Discussed Manager",
        isSpecificPlanType: isPlanTypeMgr,
      };
    }

    if (assignedPlanTypeManager) {
      return {
        name: assignedPlanTypeManager.name,
        email: assignedPlanTypeManager.email || "Reporting Manager configured in User Settings",
        badgeText: assignedPlanTypeManager.isSpecificPlanType
          ? `${planType} Manager`
          : "Reporting Manager",
        isSpecificPlanType: assignedPlanTypeManager.isSpecificPlanType,
      };
    }

    return null;
  }, [
    discussedManagerId,
    discussedManagerName,
    assignedPlanTypeManager,
    allUsers,
    planType,
  ]);

  // Load roster of executives for manager selection
  const executives = useMemo<ExecutiveUser[]>(() => {
    if (adminRole && usersData) {
      return usersData as ExecutiveUser[];
    }
    const list: ExecutiveUser[] = [];
    const seen = new Set<string>();
    if (sessionUser?._id) {
      list.push({
        _id: sessionUser._id,
        id: sessionUser._id,
        name: sessionUser.name,
        email: sessionUser.email,
        department: sessionUser.department,
        portals: sessionUser.portals,
      } as ExecutiveUser);
      seen.add(String(sessionUser._id));
    }
    if (myTeamData?.members && Array.isArray(myTeamData.members)) {
      for (const m of myTeamData.members) {
        const id = String(m._id || m.id || "");
        if (id && !seen.has(id)) {
          seen.add(id);
          list.push(m as ExecutiveUser);
        }
      }
    }
    return list;
  }, [adminRole, usersData, myTeamData, sessionUser]);

  const applyPlanCities = (planCityId?: string, planCityName?: string, planCityIds?: string[], planCities?: string[]) => {
    const cId = planCityId || "";
    const cName = planCityName || "";
    setCityId(cId);
    setCityName(cName);
    const ids = Array.isArray(planCityIds) && planCityIds.length > 0 ? planCityIds.map(String) : (cId ? [cId] : []);
    let names = Array.isArray(planCities) && planCities.length > 0 ? planCities.map(String) : [];
    if (names.length === 0 && cName) {
      names = cName.split(",").map((s) => s.trim()).filter(Boolean);
    }
    setSelectedCityIds(ids);
    setSelectedCityNames(names);
  };

  useEffect(() => {
    if (!planId) return;
    async function loadPlan() {
      try {
        setLoading(true);
        const plan = await fetchPlan(planId!).unwrap();
        if (plan) {
          setPlanStatus(plan.status || null);
          if (plan.plan_date) {
            setPlanDate(new Date(plan.plan_date).toISOString().split("T")[0]);
          }
          setPlanType(plan.plan_type || "");
          setLocation(plan.location || "");
          setCountryId(plan.country_id || "");
          setCountryName(plan.country || "");
          setStateId(plan.state_id || "");
          setStateName(plan.state || "");
          applyPlanCities(plan.city_id, plan.city, plan.city_ids, plan.cities);
          setRemarks(plan.remarks || "");
          if (plan.sales_user) {
            const sUser =
              typeof plan.sales_user === "object"
                ? plan.sales_user._id || plan.sales_user.id
                : plan.sales_user;
            if (sUser) setSalesUserId(String(sUser));
          }

          // Load discussion details
          const isDiscussed = Boolean(plan.is_discussed_with_manager);
          setIsDiscussedWithManager(isDiscussed);
          if (isDiscussed) {
            const mId =
              typeof plan.discussed_manager_id === "object"
                ? plan.discussed_manager_id?._id
                : plan.discussed_manager_id;
            const mName =
              plan.discussed_manager_name ||
              (typeof plan.discussed_manager_id === "object"
                ? plan.discussed_manager_id?.name
                : "") ||
              "";
            if (mId) {
              setDiscussedManagerId(String(mId));
              setDiscussedManagerName(mName);
            } else if (mName) {
              setDiscussedManagerId("");
              setDiscussedManagerName(mName);
            }
            if (plan.discussion_method) {
              setDiscussionMethod(plan.discussion_method as any);
            }
          } else {
            setDiscussedManagerId("");
            setDiscussedManagerName("");
            setDiscussionMethod("on_call");
          }

          if (Array.isArray(plan.visits)) {
            setVisits(plan.plan_type === "Leave" ? [] : plan.visits);
          }
          if (Array.isArray(plan.works)) {
            setWorks(plan.plan_type === "Leave" ? [] : plan.works);
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load plan details";
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    }
    loadPlan();
  }, [planId, fetchPlan]);

  // Load source plan data for copy mode
  useEffect(() => {
    if (!copyId || isEditing) return;
    async function loadSourcePlan() {
      try {
        setLoading(true);
        const plan = await fetchPlan(copyId!).unwrap();
        if (plan) {
          setPlanStatus(null);
          setPlanType(plan.plan_type || "");
          setLocation(plan.location || "");
          setCountryId(plan.country_id || "");
          setCountryName(plan.country || "");
          setStateId(plan.state_id || "");
          setStateName(plan.state || "");
          applyPlanCities(plan.city_id, plan.city, plan.city_ids, plan.cities);
          setRemarks(plan.remarks || "");
          if (plan.sales_user) {
            const sUser =
              typeof plan.sales_user === "object"
                ? plan.sales_user._id || plan.sales_user.id
                : plan.sales_user;
            if (sUser) setSalesUserId(String(sUser));
          }

          // Discussion state on copy
          const isDiscussed = Boolean(plan.is_discussed_with_manager);
          setIsDiscussedWithManager(isDiscussed);
          if (isDiscussed) {
            const mId =
              typeof plan.discussed_manager_id === "object"
                ? plan.discussed_manager_id?._id
                : plan.discussed_manager_id;
            const mName =
              plan.discussed_manager_name ||
              (typeof plan.discussed_manager_id === "object"
                ? plan.discussed_manager_id?.name
                : "") ||
              "";
            if (mId) {
              setDiscussedManagerId(String(mId));
              setDiscussedManagerName(mName);
            } else if (mName) {
              setDiscussedManagerId("");
              setDiscussedManagerName(mName);
            }
            if (plan.discussion_method) {
              setDiscussionMethod(plan.discussion_method as any);
            }
          }

          // When copying: if item is completed, create new; if item is uncompleted, reassign it
          if (Array.isArray(plan.visits)) {
            const copiedVisits = plan.visits
              .map((v: any, idx: number) => ({
                ...v,
                sequence: idx + 1,
                _id: v.status === "completed" ? undefined : v._id,
                id: v.status === "completed" ? undefined : v.id,
                status: v.status === "completed" ? "created" : v.status,
                is_from_previous_plan: true,
                previous_plan_date: plan.plan_date,
              }));
            setVisits(copiedVisits);
            copiedVisitsRef.current = copiedVisits;
          }
          if (Array.isArray(plan.works)) {
            const copiedWorks = plan.works
              .map((w: any, idx: number) => ({
                ...w,
                sequence: idx + 1,
                _id: w.status === "completed" ? undefined : w._id,
                id: w.status === "completed" ? undefined : w.id,
                status: w.status === "completed" ? "created" : w.status,
                is_from_previous_plan: true,
                previous_plan_date: plan.plan_date,
              }));
            setWorks(copiedWorks);
            copiedWorksRef.current = copiedWorks;
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load copy plan";
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    }
    loadSourcePlan();
  }, [copyId, isEditing, fetchPlan]);

  // Load existing plan automatically if one exists on the selected planDate / targetUserId
  useEffect(() => {
    let isMounted = true;
    if (planId) return; // Only skip if fixed planId was passed in route props
    if (!planDate || !targetUserId) return;

    const currentKey = `${targetUserId}_${planDate}`;
    if (prevFetchedKey.current === currentKey) return;
    const isInitialMount = !prevFetchedKey.current;
    prevFetchedKey.current = currentKey;

    async function checkPlanForSelectedDate() {
      try {
        setCheckingExisting(true);
        const res = await lazyGetPlans({
          sales_user: targetUserId,
          sales_user_id: targetUserId,
          from: planDate,
          to: planDate,
          limit: 1,
          include_standalone: true,
          include_visits: true,
          include_works: true,
        }).unwrap();

        if (!isMounted) return;

        const found = res?.data?.[0];
        if (found) {
          const foundId = String(found._id || found.id);
          const isStandaloneVirtual = Boolean(
            found?.is_standalone ||
            foundId.startsWith("standalone_")
          );

          if (isStandaloneVirtual) {
            // Standalone tasks/visits exist, but no WorkPlan document has been saved yet -> New Create Mode!
            setExistingPlanId(null);
            setDetectedPlan(null);
            setPlanStatus(null);
          } else {
            // Real existing WorkPlan document -> Update Mode
            setExistingPlanId(foundId);
            setDetectedPlan(found);
            setPlanStatus(found.status || null);
          }

          // Populate with full existing plan or standalone data
          const fullPlan = await fetchPlan(foundId).unwrap();
          if (!isMounted) return;

          if (fullPlan) {
            const planVisits = Array.isArray(fullPlan.visits) ? fullPlan.visits : [];
            const planWorks = Array.isArray(fullPlan.works) ? fullPlan.works : [];

            // Add custom work templates additionally to existing plan tasks if not already included
            const templates = effectiveSettings?.customWorkTemplates || [];
            const mergedWorksWithTemplates = [...planWorks];
            templates.forEach((t: any) => {
              const alreadyExists = mergedWorksWithTemplates.some(
                (w) => String(w.title || "").trim().toLowerCase() === String(t.title || "").trim().toLowerCase()
              );
              if (!alreadyExists) {
                mergedWorksWithTemplates.push({
                  sequence: mergedWorksWithTemplates.length + 1,
                  title: t.title,
                  description: t.description || "",
                  planned_start_time: t.planned_start_time || "",
                  planned_end_time: t.planned_end_time || "",
                  work_type: t.work_type || "default",
                  is_template_task: true,
                  status: "created",
                });
              }
            });

            // If this is a real existing saved work plan, preserve its saved plan_type.
            // If it is virtual standalone activities, do not auto-assign a plan type.
            if (!isStandaloneVirtual && fullPlan.plan_type) {
              setPlanType(fullPlan.plan_type);
            } else {
              setPlanType("");
            }
            setLocation(fullPlan.location || "");
            setCountryId(fullPlan.country_id || "");
            setCountryName(fullPlan.country || "");
            setStateId(fullPlan.state_id || "");
            setStateName(fullPlan.state || "");
            applyPlanCities(fullPlan.city_id, fullPlan.city, fullPlan.city_ids, fullPlan.cities);
            setRemarks(fullPlan.remarks || "");

            // Discussion state
            const isDiscussed = Boolean(fullPlan.is_discussed_with_manager);
            setIsDiscussedWithManager(isDiscussed);
            if (isDiscussed) {
              const mId =
                typeof fullPlan.discussed_manager_id === "object"
                  ? fullPlan.discussed_manager_id?._id
                  : fullPlan.discussed_manager_id;
              const mName =
                fullPlan.discussed_manager_name ||
                (typeof fullPlan.discussed_manager_id === "object"
                  ? fullPlan.discussed_manager_id?.name
                  : "") ||
                "";
              if (mId) {
                setDiscussedManagerId(String(mId));
                setDiscussedManagerName(mName);
              } else if (mName) {
                setDiscussedManagerId("");
                setDiscussedManagerName(mName);
              }
              if (fullPlan.discussion_method) {
                setDiscussionMethod(fullPlan.discussion_method as any);
              }
            } else if (assignedPlanTypeManager) {
              setIsDiscussedWithManager(true);
              setDiscussedManagerId(assignedPlanTypeManager._id || "");
              setDiscussedManagerName(assignedPlanTypeManager.name || "");
              setDiscussionMethod("on_call");
            } else {
              setIsDiscussedWithManager(false);
              setDiscussedManagerId("");
              setDiscussedManagerName("");
              setDiscussionMethod("on_call");
            }

            if (copyId) {
              // When copying into an existing active plan: merge existing items with copied items
              const existingVisits = Array.isArray(fullPlan.visits) ? fullPlan.visits : [];
              const copiedVisits = copiedVisitsRef.current || [];
              const mergedVisits = [
                ...existingVisits,
                ...copiedVisits.map((cv, idx) => ({
                  ...cv,
                  sequence: existingVisits.length + idx + 1,
                })),
              ];
              setVisits(mergedVisits);

              const copiedWorks = copiedWorksRef.current || [];
              const mergedWorks = [
                ...mergedWorksWithTemplates,
                ...copiedWorks.map((cw, idx) => ({
                  ...cw,
                  sequence: mergedWorksWithTemplates.length + idx + 1,
                })),
              ];
              setWorks(mergedWorks);
            } else if (importedNotesRef.current && Array.isArray(importedNotesRef.current.notes)) {
              // Merge imported scratchpad notes into existing active plan
              const { mappedVisits, mappedWorks, noteIds } = mapNotesToVisitsAndWorks(importedNotesRef.current.notes);
              const mergedVisits = [
                ...planVisits,
                ...mappedVisits.map((mv, idx) => ({ ...mv, sequence: planVisits.length + idx + 1 })),
              ];
              const mergedWorks = [
                ...mergedWorksWithTemplates,
                ...mappedWorks.map((mw, idx) => ({ ...mw, sequence: mergedWorksWithTemplates.length + idx + 1 })),
              ];
              setVisits(mergedVisits);
              setWorks(mergedWorks);
              if (mergedVisits.length > 0 && mergedWorks.length > 0) {
                setPlanType("Tasks & Visits");
              } else if (mergedVisits.length > 0) {
                setPlanType(fullPlan.plan_type || "Visits");
              }
              setImportedNoteIds((prev) => [...new Set([...prev, ...noteIds])]);
              toast.success(`Imported ${importedNotesRef.current.notes.length} item(s) from Scratchpad Notes into this Work Plan`);
              importedNotesRef.current = null;
            } else {
              setVisits(planVisits);
              setWorks(mergedWorksWithTemplates);
            }

            if (fullPlan.status === "completed") {
              toast.error(`Work plan for ${planDate} is Completed. No editing or updating allowed.`, {
                id: `completed-plan-${foundId}`,
              });
            } else if (isStandaloneVirtual) {
              toast.info(`Pre-planned tasks & visits found for ${planDate}. Loaded into new work plan draft.`, {
                id: `standalone-activities-${foundId}`,
              });
            } else {
              toast.info(
                copyId
                  ? `Existing work plan found for ${planDate}. Copied items merged into existing plan.`
                  : `Existing work plan found for ${planDate}. Loaded plan for Update & Mail.`,
                {
                  id: `existing-plan-${foundId}`,
                }
              );
            }
          }
        } else {
          // No active plan for this date & member -> switch to create mode and reset form fields
          setExistingPlanId(null);
          setDetectedPlan(null);
          setPlanStatus(null);
          setLocation("");
          setCountryId("");
          setCountryName("");
          setStateId("");
          setStateName("");
          setCityId("");
          setCityName("");
          setSelectedCityIds([]);
          setSelectedCityNames([]);
          setRemarks("");

          if (copyId) {
            setVisits(copiedVisitsRef.current);
            setWorks(copiedWorksRef.current);
          } else if (importedNotesRef.current && Array.isArray(importedNotesRef.current.notes)) {
            // Load scratchpad notes into fresh new plan
            const { mappedVisits, mappedWorks, noteIds } = mapNotesToVisitsAndWorks(importedNotesRef.current.notes);
            setVisits(mappedVisits);
            setWorks(mappedWorks);
            if (mappedVisits.length > 0 && mappedWorks.length > 0) {
              setPlanType("Tasks & Visits");
            } else if (mappedVisits.length > 0) {
              setPlanType("Visits");
            } else {
              setPlanType("Tasks & Visits");
            }
            setImportedNoteIds((prev) => [...new Set([...prev, ...noteIds])]);
            toast.success(`Loaded ${importedNotesRef.current.notes.length} item(s) from Scratchpad Notes into this Work Plan`);
            importedNotesRef.current = null;
          } else {
            setVisits([]);
            setWorks([]);
            setPlanType("");
          }

          setIsDiscussedWithManager(null);
          setDiscussedManagerId("");
          setDiscussedManagerName("");
          setDiscussionMethod("on_call");

          if (!isInitialMount && !importedNotesRef.current) {
            toast.info(`Switched to Create Work Plan mode for ${planDate}.`, { id: `create-mode-${planDate}` });
          }
        }
      } catch (err) {
        console.error("Error checking existing plan by date:", err);
      } finally {
        if (isMounted) setCheckingExisting(false);
      }
    }

    checkPlanForSelectedDate();
  }, [planDate, targetUserId, planId, copyId, lazyGetPlans, fetchPlan]);

  // Effect 1: Auto-populate custom work tasks additionally when switching to a task-enabled plan
  useEffect(() => {
    if (isEditing || isCopying) return;
    if (isWorkTaskPlan(planType)) {
      const templates = effectiveSettings?.customWorkTemplates || [];
      if (templates.length > 0) {
        setWorks((prevWorks) => {
          const merged = [...prevWorks];
          templates.forEach((t: any) => {
            const alreadyExists = merged.some(
              (w) => String(w.title || "").trim().toLowerCase() === String(t.title || "").trim().toLowerCase()
            );
            if (!alreadyExists) {
              merged.push({
                sequence: merged.length + 1,
                title: t.title,
                description: t.description || "",
                planned_start_time: t.planned_start_time || "",
                planned_end_time: t.planned_end_time || "",
                work_type: t.work_type || "default",
                is_template_task: true,
                status: "created",
              });
            }
          });
          return merged;
        });
      }
    }
  }, [planType, dbUserSettings, isEditing, isCopying]);

  // Handle manual rollover of uncompleted tasks from previous valid plans
  const handleManualRollover = async () => {
    if (isPlanCompleted) return;
    if (!planDate || !targetUserId) {
      toast.error("Please select a valid work plan date and executive.");
      return;
    }

    try {
      setRolloverLoading(true);
      const res = await lazyGetPlans({
        sales_user: targetUserId,
        sales_user_id: targetUserId,
        limit: 50,
        include_standalone: false,
        include_visits: false,
        include_works: true,
      }).unwrap();

      const allPlans: WorkPlanRecord[] = res?.data || [];
      const currentPlanDateNormalized = planDate.split("T")[0];

      // Filter previous plans strictly prior to current plan date
      const previousPlans = allPlans
        .filter((p) => {
          if (!p.plan_date) return false;
          const pDateNormalized = p.plan_date.split("T")[0];
          if (pDateNormalized >= currentPlanDateNormalized) return false;
          return true;
        })
        .sort((a, b) => new Date(b.plan_date).getTime() - new Date(a.plan_date).getTime());

      if (previousPlans.length === 0) {
        toast.info("No eligible previous plans found for task rollover.");
        return;
      }

      const existingWorkIds = new Set(works.map((w) => String(w._id || w.id || "")).filter(Boolean));
      const newWorksToAdd: Array<Record<string, any>> = [];

      for (const p of previousPlans) {
        const pDateStr = p.plan_date;
        if (Array.isArray(p.works)) {
          for (const w of p.works) {
            const wId = String(w._id || w.id || "");
            if (wId && existingWorkIds.has(wId)) continue;
            if (["created", "pending", "in_progress"].includes(w.status)) {
              if (wId) existingWorkIds.add(wId);
              newWorksToAdd.push({
                ...w,
                is_from_previous_plan: true,
                previous_plan_date: pDateStr,
              });
            }
          }
        }
      }

      const tasksCount = newWorksToAdd.length;

      if (tasksCount === 0) {
        toast.info("No uncompleted tasks found to roll over.");
        return;
      }

      if (tasksCount > 0) {
        setWorks((prev) => [...prev, ...newWorksToAdd]);
      }

      if (tasksCount > 0 && (planType === "Visits" || visits.length > 0)) {
        setPlanType("Tasks & Visits");
      }

      toast.success(
        `Task rollover completed: ${tasksCount} task${tasksCount === 1 ? "" : "s"} rolled over.`
      );
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err, "Task rollover failed."));
    } finally {
      setRolloverLoading(false);
    }
  };



  // Filter eligible managers for discussion dropdown: strictly reporting manager, portal admins, and portal managers
  const eligibleManagers = useMemo(() => {
    const map = new Map<
      string,
      {
        _id: string;
        name: string;
        email: string;
        department?: string;
        roleBadge: string;
        isReportingManager: boolean;
      }
    >();

    // 1. If assignedPlanTypeManager is configured, insert as the top option
    if (assignedPlanTypeManager && (assignedPlanTypeManager._id || assignedPlanTypeManager.name)) {
      const id = String(assignedPlanTypeManager._id || assignedPlanTypeManager.name);
      map.set(id, {
        _id: String(assignedPlanTypeManager._id || ""),
        name: assignedPlanTypeManager.name,
        email: assignedPlanTypeManager.email || "",
        department: assignedPlanTypeManager.department || "",
        roleBadge: assignedPlanTypeManager.isSpecificPlanType
          ? `${planType} Manager`
          : "Reporting Manager",
        isReportingManager: true,
      });
    }

    // 2. Add Portal Admins / Eligible Managers from backend
    const managersSource = Array.isArray(eligibleManagersData) && eligibleManagersData.length > 0
      ? eligibleManagersData
      : allUsers;

    for (const u of managersSource) {
      const id = String(u._id || u.id || "");
      if (!id) continue;
      const role = getWorkPlannerUserRole(u);
      const isPortalAdmin = role === "Admin" || String(u.roleBadge || "").includes("Admin");
      const isPortalManager = role === "Manager" || String(u.roleBadge || "").includes("Manager");
      const isPortalCoordinator = role === "Coordinator" || String(u.roleBadge || "").includes("Coordinator");

      if (!isPortalAdmin && !isPortalManager && !isPortalCoordinator) continue;

      if (!map.has(id)) {
        map.set(id, {
          _id: id,
          name: u.name,
          email: u.email || "",
          department: typeof u.department === "object" ? u.department?.name : (u.department || ""),
          roleBadge: u.roleBadge || (isPortalAdmin ? "Portal Admin" : isPortalCoordinator ? "Portal Coordinator" : "Portal Manager"),
          isReportingManager: false,
        });
      }
    }

    const list = Array.from(map.values());

    if (!managerSearch.trim()) return list;
    const q = managerSearch.toLowerCase().trim();
    return list.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.roleBadge?.toLowerCase().includes(q) ||
        u.department?.toLowerCase().includes(q)
    );
  }, [allUsers, eligibleManagersData, assignedPlanTypeManager, planType, managerSearch]);

  const selectedManager = useMemo(() => {
    if (!discussedManagerId) return null;
    const fromEligible = eligibleManagers.find((u) => u._id === discussedManagerId);
    if (fromEligible) return fromEligible;
    return allUsers.find((u) => u._id === discussedManagerId || u.id === discussedManagerId) || null;
  }, [discussedManagerId, eligibleManagers, allUsers]);

  // Filter executives assigned to Work Planner portal according to role hierarchy:
  // - Admin: can make plan for all portal members
  // - Manager: can make plan for himself and executives reporting to him only
  // - Executive: can make plan for himself only
  const eligibleExecutives = useMemo(() => {
    // 1. Regular executive can only make plans for himself
    if (!elevatedRole) {
      if (!sessionUser) return [];
      return [{
        _id: sessionUser._id,
        id: sessionUser._id,
        name: `${sessionUser.name} (Self)`,
        email: sessionUser.email,
        department: sessionUser.department,
      }];
    }

    // 2. Admin can make plans for all portal members
    if (adminRole) {
      const list = executives.filter((u) => hasWorkPlannerAccess(u, sessionUser?._id));
      if (!execSearch.trim()) return list;
      const q = execSearch.toLowerCase().trim();
      return list.filter(
        (u) =>
          u.name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.department?.toLowerCase().includes(q)
      );
    }

    // 3. Manager can make plans for himself and executives reporting to him only
    const myTeamMembers = (myTeamData?.members || []) as Array<{ _id?: string; id?: string }>;
    const teamIdSet = new Set<string>(
      myTeamMembers.map((m) => String(m._id || m.id || ""))
    );
    if (sessionUser?._id) {
      teamIdSet.add(String(sessionUser._id));
    }

    const list = executives.filter((u) => {
      const uId = String(u._id || u.id || "");
      return teamIdSet.has(uId);
    });

    if (!execSearch.trim()) return list;
    const q = execSearch.toLowerCase().trim();
    return list.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.department?.toLowerCase().includes(q)
    );
  }, [executives, sessionUser, adminRole, isElevatedNonAdmin, elevatedRole, myTeamData, execSearch]);

  const selectedExecutive = useMemo(() => {
    if (!salesUserId || salesUserId === sessionUser?._id) {
      return {
        _id: sessionUser?._id || "",
        name: sessionUser?.name || "Current User",
        email: sessionUser?.email || "",
        department: sessionUser?.department || "sales",
        portals: sessionUser?.portals,
        isSelf: true,
      };
    }
    const found = executives.find((u) => u._id === salesUserId || u.id === salesUserId);
    if (found) {
      return {
        ...found,
        isSelf: (found._id || found.id) === sessionUser?._id,
      };
    }
    return {
      _id: salesUserId,
      name: "Selected Executive",
      email: "",
      portals: [],
      isSelf: false,
    };
  }, [salesUserId, executives, sessionUser]);

  const selectedExecutivePortalRole = useMemo(() => {
    return getWorkPlannerUserPortalRole(selectedExecutive);
  }, [selectedExecutive]);

  function isManagerCreatedItem(item?: Record<string, any>): boolean {
    if (!item) return false;
    const role = String(item.created_by_role || "").toLowerCase().trim();
    return ["manager", "admin", "super_admin", "super admin"].includes(role);
  }

  // Visit modal handlers
  async function handleVisitSubmit(body: Record<string, any>) {
    if (isPlanCompleted) {
      toast.error("This work plan is completed and cannot be edited.");
      return;
    }
    if (isEditing && activePlanId) {
      try {
        if (editingVisitIndex !== null && visits[editingVisitIndex]?._id) {
          const vId = visits[editingVisitIndex]._id || visits[editingVisitIndex].id;
          await updateVisitMut({ planId: activePlanId, visitId: vId, body }).unwrap();
          toast.success("Visit updated");
        } else {
          await addVisitMut({ planId: activePlanId, body }).unwrap();
          toast.success("Visit added");
        }
        const updatedPlan = await fetchPlan(activePlanId).unwrap();
        setVisits(updatedPlan.visits || []);
      } catch (err: any) {
        toast.error(err?.data?.message || err?.message || "Failed to save visit");
      }
    } else {
      if (editingVisitIndex !== null) {
        setVisits((prev) => {
          const next = [...prev];
          next[editingVisitIndex] = { ...next[editingVisitIndex], ...body };
          return next;
        });
      } else {
        setVisits((prev) => [...prev, body]);
      }
    }
    setVisitModalOpen(false);
    setEditingVisitIndex(null);
  }

  function handleRemoveVisit(index: number) {
    if (isPlanCompleted) {
      toast.error("This work plan is completed and cannot be edited.");
      return;
    }
    const v = visits[index];
    if (!v) return;
    if (!elevatedRole && isManagerCreatedItem(v)) {
      toast.error("Visits created by a Portal Admin or Portal Manager cannot be removed by Executives.");
      return;
    }
    const visitTitle = v?.customer_name || v?.client_name || v?.purpose || `Visit #${index + 1}`;
    setDeleteItemTarget({
      type: "visit",
      index,
      title: visitTitle,
    });
  }

  // Work task modal handlers
  async function handleWorkSubmit(body: Record<string, any>) {
    if (isPlanCompleted) {
      toast.error("This work plan is completed and cannot be edited.");
      return;
    }
    if (isEditing && activePlanId) {
      try {
        if (editingWorkIndex !== null && works[editingWorkIndex]?._id) {
          const wId = works[editingWorkIndex]._id || works[editingWorkIndex].id;
          await updateWorkMut({ planId: activePlanId, workId: wId, body }).unwrap();
          toast.success("Task updated");
        } else {
          await addWorkMut({ planId: activePlanId, body }).unwrap();
          toast.success("Task added");
        }
        const updatedPlan = await fetchPlan(activePlanId).unwrap();
        setWorks(updatedPlan.works || []);
      } catch (err: any) {
        toast.error(err?.data?.message || err?.message || "Failed to save task");
      }
    } else {
      if (editingWorkIndex !== null) {
        setWorks((prev) => {
          const next = [...prev];
          next[editingWorkIndex] = { ...next[editingWorkIndex], ...body };
          return next;
        });
      } else {
        setWorks((prev) => [...prev, body]);
      }
    }
    setWorkModalOpen(false);
    setEditingWorkIndex(null);
  }

  function handleRemoveWork(index: number) {
    if (isPlanCompleted) {
      toast.error("This work plan is completed and cannot be edited.");
      return;
    }
    const w = works[index];
    if (!w) return;
    const isDefaultTask = w.work_type === "default" || w.is_default_task;
    if (isDefaultTask) {
      toast.error("Default work tasks cannot be removed.");
      return;
    }
    if (!elevatedRole && isManagerCreatedItem(w)) {
      toast.error("Tasks created by a Portal Admin or Portal Manager cannot be removed by Executives.");
      return;
    }
    const taskTitle = w?.title || w?.task_name || w?.task || `Task #${index + 1}`;
    setDeleteItemTarget({
      type: "task",
      index,
      title: taskTitle,
    });
  }

  async function handleConfirmDeleteItem() {
    if (!deleteItemTarget) return;
    const { type, index } = deleteItemTarget;
    setIsDeletingItem(true);
    try {
      if (type === "visit") {
        const v = visits[index];
        if (isEditing && activePlanId && (v?._id || v?.id)) {
          await removeVisitMut({ planId: activePlanId, visitId: v._id || v.id }).unwrap();
          toast.success("Visit removed");
          const updatedPlan = await fetchPlan(activePlanId).unwrap();
          setVisits(updatedPlan.visits || []);
        } else {
          setVisits((prev) => prev.filter((_, i) => i !== index));
          toast.success("Visit removed");
        }
      } else {
        const w = works[index];
        if (isEditing && activePlanId && (w?._id || w?.id)) {
          await removeWorkMut({ planId: activePlanId, workId: w._id || w.id }).unwrap();
          toast.success("Task removed");
          const updatedPlan = await fetchPlan(activePlanId).unwrap();
          setWorks(updatedPlan.works || []);
        } else {
          setWorks((prev) => prev.filter((_, i) => i !== index));
          toast.success("Task removed");
        }
      }
      setDeleteItemTarget(null);
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || `Failed to remove ${type}`);
    } finally {
      setIsDeletingItem(false);
    }
  }

  // --- Real-Time Draft Engine (Cloud Database + Local Fallback) ---
  // Check for unsaved real-time draft in database when target user or planDate changes
  useEffect(() => {
    if (isPlanCompleted || !targetUserId || !planDate) {
      setAvailableDraft(null);
      return;
    }

    let isMounted = true;
    (async () => {
      try {
        const cloudRes = await lazyGetDraft({ sales_user: targetUserId, plan_date: planDate }, true).unwrap();
        const cloudDraft = cloudRes?.data || cloudRes;
        if (cloudDraft && isMounted) {
          const formattedCloudDraft: WorkPlanFormDraft = {
            version: 1,
            salesUserId: String(cloudDraft.sales_user?._id || cloudDraft.sales_user || targetUserId),
            planDate: String(cloudDraft.plan_date).slice(0, 10),
            planType: cloudDraft.plan_type || "",
            location: cloudDraft.location || "",
            remarks: cloudDraft.remarks || "",
            isDiscussedWithManager: cloudDraft.is_discussed_with_manager !== undefined ? cloudDraft.is_discussed_with_manager : null,
            discussedManagerId: String(cloudDraft.discussed_manager_id?._id || cloudDraft.discussed_manager_id || ""),
            discussedManagerName: cloudDraft.discussed_manager_name || "",
            discussionMethod: cloudDraft.discussion_method || "on_call",
            visits: Array.isArray(cloudDraft.visits) ? cloudDraft.visits : [],
            works: Array.isArray(cloudDraft.works) ? cloudDraft.works : [],
            lastSavedAt: cloudDraft.last_saved_at || cloudDraft.updatedAt || new Date().toISOString(),
          };

          if (isDraftMeaningful(formattedCloudDraft)) {
            setAvailableDraft(formattedCloudDraft);
            setLastDraftSavedAt(formattedCloudDraft.lastSavedAt);
            return;
          }
        }
      } catch {
        // Fallback to local draft if offline or network error
      }

      if (isMounted) {
        const savedDraft = loadWorkPlanDraft(targetUserId, planDate);
        if (savedDraft && isDraftMeaningful(savedDraft)) {
          setAvailableDraft(savedDraft);
          setLastDraftSavedAt(savedDraft.lastSavedAt);
        } else {
          setAvailableDraft(null);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [targetUserId, planDate, isPlanCompleted, lazyGetDraft]);

  // Mark hydration settled once plan or existing check loading completes
  useEffect(() => {
    if (!loading && !checkingExisting) {
      const t = setTimeout(() => {
        isHydratedRef.current = true;
      }, 350);
      return () => clearTimeout(t);
    }
  }, [loading, checkingExisting]);

  // Real-time Debounced Cloud & Device Auto-Save
  useEffect(() => {
    if (!isHydratedRef.current || loading || checkingExisting || isPlanCompleted || !planDate || !targetUserId) {
      return;
    }

    const cloudPayload = {
      sales_user: targetUserId,
      plan_date: planDate,
      plan_type: planType,
      location,
      country_id: countryId || undefined,
      state_id: stateId || undefined,
      city_id: cityId || (selectedCityIds[0] || undefined),
      country: countryName || undefined,
      state: stateName || undefined,
      city: cityName || (selectedCityNames.join(", ") || undefined),
      city_ids: selectedCityIds.length ? selectedCityIds : (cityId ? [cityId] : undefined),
      cities: selectedCityNames.length ? selectedCityNames : (cityName ? [cityName] : undefined),
      remarks,
      is_discussed_with_manager: isDiscussedWithManager,
      discussed_manager_id: discussedManagerId || undefined,
      discussed_manager_name: discussedManagerName || undefined,
      discussion_method: discussionMethod || undefined,
      visits,
      works,
    };

    const localPayload = {
      salesUserId: targetUserId,
      planDate,
      planType,
      location,
      countryId,
      countryName,
      stateId,
      stateName,
      cityId,
      cityName,
      selectedCityIds,
      selectedCityNames,
      remarks,
      isDiscussedWithManager,
      discussedManagerId,
      discussedManagerName,
      discussionMethod,
      visits,
      works,
    };

    if (!isDraftMeaningful(localPayload)) {
      return;
    }

    setDraftStatus("saving");
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        saveWorkPlanDraft(localPayload); // fast local backup
        await saveDraftMut(cloudPayload).unwrap(); // primary database sync
        setDraftStatus("saved");
        setLastDraftSavedAt(new Date().toISOString());
      } catch (err) {
        console.warn("Cloud draft sync notice:", err);
        setDraftStatus("saved");
      }
    }, 1200);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [
    targetUserId,
    planDate,
    planType,
    location,
    remarks,
    isDiscussedWithManager,
    discussedManagerId,
    discussedManagerName,
    discussionMethod,
    visits,
    works,
    countryId,
    countryName,
    stateId,
    stateName,
    cityId,
    cityName,
    selectedCityIds,
    selectedCityNames,
    loading,
    checkingExisting,
    isPlanCompleted,
    saveDraftMut,
  ]);

  // Flush unsaved draft synchronously before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isHydratedRef.current && !isPlanCompleted && planDate && targetUserId) {
        const localPayload = {
          salesUserId: targetUserId,
          planDate,
          planType,
          location,
          countryId,
          countryName,
          stateId,
          stateName,
          cityId,
          cityName,
          selectedCityIds,
          selectedCityNames,
          remarks,
          isDiscussedWithManager,
          discussedManagerId,
          discussedManagerName,
          discussionMethod,
          visits,
          works,
        };
        if (isDraftMeaningful(localPayload)) {
          saveWorkPlanDraft(localPayload);
        }
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [
    targetUserId,
    planDate,
    planType,
    location,
    countryId,
    countryName,
    stateId,
    stateName,
    cityId,
    cityName,
    selectedCityIds,
    selectedCityNames,
    remarks,
    isDiscussedWithManager,
    discussedManagerId,
    discussedManagerName,
    discussionMethod,
    visits,
    works,
    isPlanCompleted,
  ]);

  const handleRestoreDraft = () => {
    if (!availableDraft) return;
    if (availableDraft.planType) setPlanType(availableDraft.planType);
    if (availableDraft.location !== undefined) setLocation(availableDraft.location);
    if (availableDraft.countryId !== undefined) setCountryId(availableDraft.countryId);
    if (availableDraft.countryName !== undefined) setCountryName(availableDraft.countryName);
    if (availableDraft.stateId !== undefined) setStateId(availableDraft.stateId);
    if (availableDraft.stateName !== undefined) setStateName(availableDraft.stateName);
    if (availableDraft.cityId !== undefined) setCityId(availableDraft.cityId);
    if (availableDraft.cityName !== undefined) setCityName(availableDraft.cityName);
    if (Array.isArray(availableDraft.selectedCityIds)) setSelectedCityIds(availableDraft.selectedCityIds);
    if (Array.isArray(availableDraft.selectedCityNames)) setSelectedCityNames(availableDraft.selectedCityNames);
    if (availableDraft.remarks !== undefined) setRemarks(availableDraft.remarks);
    setIsDiscussedWithManager(availableDraft.isDiscussedWithManager !== undefined ? availableDraft.isDiscussedWithManager : null);
    setDiscussedManagerId(availableDraft.discussedManagerId || "");
    setDiscussedManagerName(availableDraft.discussedManagerName || "");
    if (availableDraft.discussionMethod) setDiscussionMethod(availableDraft.discussionMethod);
    if (Array.isArray(availableDraft.visits)) setVisits(availableDraft.visits);
    if (Array.isArray(availableDraft.works)) setWorks(availableDraft.works);

    setDraftStatus("restored");
    setLastDraftSavedAt(availableDraft.lastSavedAt || new Date().toISOString());
    setAvailableDraft(null);
    toast.success("Cloud database running draft restored successfully!");
  };

  const handleDiscardDraft = async () => {
    if (targetUserId && planDate) {
      clearWorkPlanDraft(targetUserId, planDate);
      try {
        await deleteDraftMut({ sales_user: targetUserId, plan_date: planDate }).unwrap();
      } catch {
        // ignore delete error
      }
    }
    setAvailableDraft(null);
    setDraftStatus("idle");
    setLastDraftSavedAt(null);
    toast.info("Draft discarded from cloud and device.");
  };

  const handleManualSaveDraft = async () => {
    if (isPlanCompleted) {
      toast.error("Completed work plans cannot be saved as drafts.");
      return;
    }
    if (!planDate || !targetUserId) {
      toast.error("Plan date and executive are required to save draft.");
      return;
    }
    const cloudPayload = {
      sales_user: targetUserId,
      plan_date: planDate,
      plan_type: planType,
      location,
      country_id: countryId || undefined,
      state_id: stateId || undefined,
      city_id: cityId || (selectedCityIds[0] || undefined),
      country: countryName || undefined,
      state: stateName || undefined,
      city: cityName || (selectedCityNames.join(", ") || undefined),
      city_ids: selectedCityIds.length ? selectedCityIds : (cityId ? [cityId] : undefined),
      cities: selectedCityNames.length ? selectedCityNames : (cityName ? [cityName] : undefined),
      remarks,
      is_discussed_with_manager: isDiscussedWithManager,
      discussed_manager_id: discussedManagerId || undefined,
      discussed_manager_name: discussedManagerName || undefined,
      discussion_method: discussionMethod || undefined,
      visits: planType === "Leave" ? [] : visits,
      works: planType === "Leave" ? [] : works,
    };
    const localPayload = {
      salesUserId: targetUserId,
      planDate,
      planType,
      location,
      countryId: countryId || undefined,
      countryName: countryName || undefined,
      stateId: stateId || undefined,
      stateName: stateName || undefined,
      cityId: cityId || undefined,
      cityName: cityName || undefined,
      selectedCityIds,
      selectedCityNames,
      remarks,
      isDiscussedWithManager,
      discussedManagerId,
      discussedManagerName,
      discussionMethod,
      visits: planType === "Leave" ? [] : visits,
      works: planType === "Leave" ? [] : works,
    };
    try {
      saveWorkPlanDraft(localPayload);
      await saveDraftMut(cloudPayload).unwrap();
      const nowIso = new Date().toISOString();
      setDraftStatus("saved");
      setLastDraftSavedAt(nowIso);
      setAvailableDraft(null);
      toast.success("Running draft saved to database successfully.");
    } catch {
      toast.error("Failed to save draft to database.");
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPlanCompleted) {
      toast.error("This work plan is completed and cannot be created or updated.");
      return;
    }
    if (!planDate) {
      toast.error("Plan date is required");
      return;
    }

    if (!planType) {
      toast.error("Please select a plan type");
      return;
    }

    if (requiresGeo) {
      if (!countryId || !countryName.trim()) {
        toast.error("Country is required for visits plan");
        return;
      }
      if (!stateId || !stateName.trim()) {
        toast.error("State / Province is required for visits plan");
        return;
      }
      if ((!cityId || !cityName.trim()) && selectedCityIds.length === 0) {
        toast.error("City / District is required for visits plan");
        return;
      }
    }

    const effectiveLocation =
      location.trim() ||
      (requiresGeo && (selectedCityNames.length > 0 ? selectedCityNames.join(", ") : cityName)
        ? [selectedCityNames.length > 0 ? selectedCityNames.join(", ") : cityName, stateName, countryName]
            .filter(Boolean)
            .join(", ")
        : "");
    if (!leaveType && !effectiveLocation) {
      toast.error("Work location / city is required");
      return;
    }

    if (!remarks.trim()) {
      toast.error(
        leaveType
          ? "Leave reason & remarks are required"
          : "Remarks & objectives are required"
      );
      return;
    }

    if (isBothTasksAndVisitsPlan(planType)) {
      if (visits.length === 0) {
        toast.error("For 'Tasks & Visits' plan type, at least one planned visit is required.");
        return;
      }
      if (works.length === 0) {
        toast.error("For 'Tasks & Visits' plan type, at least one planned task is required.");
        return;
      }
    } else if (planType === "Visits") {
      if (visits.length === 0) {
        toast.error("For 'Visits' plan type, at least one planned visit is required.");
        return;
      }
    } else if (planType === "Work From Home" || planType === "Work From Office") {
      if (works.length === 0) {
        toast.error(`For '${planType}' plan type, at least one planned task is required.`);
        return;
      }
    }

    if (minPlanDate && planDate < minPlanDate) {
      toast.error(
        `Work plans cannot be created or edited for dates earlier than 2 days before today (${minPlanDate}).`
      );
      return;
    }

    if (isDiscussedWithManager === null) {
      toast.error("Please indicate whether this plan was discussed with the manager");
      return;
    }

    if (isDiscussedWithManager === true) {
      if (!discussedManagerId && !discussedManagerName.trim()) {
        toast.error("Please select a manager from the list");
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload: Partial<WorkPlanRecord> = {
        plan_date: planDate,
        plan_type: planType as WorkPlanRecord["plan_type"],
        ...(planType === "Leave" ? { status: "completed" as const } : {}),
        location: effectiveLocation,
        ...(requiresGeo
          ? {
              country_id: countryId || undefined,
              state_id: stateId || undefined,
              city_id: cityId || (selectedCityIds[0] || undefined),
              country: countryName || undefined,
              state: stateName || undefined,
              city: cityName || (selectedCityNames.join(", ") || undefined),
              city_ids: selectedCityIds.length ? selectedCityIds : (cityId ? [cityId] : undefined),
              cities: selectedCityNames.length ? selectedCityNames : (cityName ? [cityName] : undefined),
            }
          : {}),
        remarks: remarks.trim(),
        is_discussed_with_manager: Boolean(isDiscussedWithManager),
        discussed_manager_id:
          isDiscussedWithManager && discussedManagerId
            ? discussedManagerId
            : undefined,
        discussed_manager_name: isDiscussedWithManager
          ? selectedManager?.name || discussedManagerName.trim() || undefined
          : undefined,
        discussion_method: isDiscussedWithManager ? discussionMethod : undefined,
        ...(managerRole && salesUserId ? { sales_user: salesUserId } : {}),
      };

      const selectedExec = managerRole && salesUserId
        ? executives.find((e) => e._id === salesUserId || e.id === salesUserId)
        : sessionUser;

      const draftRecord: WorkPlanRecord = {
        _id: activePlanId || undefined,
        plan_date: planDate,
        plan_type: planType as WorkPlanRecord["plan_type"],
        location: effectiveLocation,
        country_id: countryId || undefined,
        state_id: stateId || undefined,
        city_id: cityId || (selectedCityIds[0] || undefined),
        country: countryName || undefined,
        state: stateName || undefined,
        city: cityName || (selectedCityNames.join(", ") || undefined),
        city_ids: selectedCityIds.length ? selectedCityIds : (cityId ? [cityId] : undefined),
        cities: selectedCityNames.length ? selectedCityNames : (cityName ? [cityName] : undefined),
        remarks: remarks.trim(),
        is_discussed_with_manager: Boolean(isDiscussedWithManager),
        discussed_manager_id:
          isDiscussedWithManager && selectedManager
            ? ({ _id: selectedManager._id, name: selectedManager.name, email: selectedManager.email } as any)
            : discussedManagerId || undefined,
        discussed_manager_name: isDiscussedWithManager
          ? selectedManager?.name || discussedManagerName.trim() || undefined
          : undefined,
        discussion_method: isDiscussedWithManager ? discussionMethod : undefined,
        sales_user: selectedExec as any,
        status: planType === "Leave" ? "completed" : "planned",
        visits: planType === "Leave" ? [] : visits.map((v, idx) => ({
          sequence: idx + 1,
          party_name: v.party_name || (typeof v.party === "object" ? v.party?.party_name : undefined) || "Client Visit",
          contact_person: v.contact_person,
          contact_number: v.contact_number,
          contact_email: v.contact_email,
          contacts: v.contacts,
          address: v.address,
          planned_start_time: v.planned_start_time,
          status: v.status || "created",
          created_by_role: v.created_by_role,
        })),
        works: planType === "Leave" ? [] : works.map((w, idx) => ({
          sequence: idx + 1,
          title: w.title,
          description: w.description,
          planned_start_time: w.planned_start_time,
          status: w.status || "created",
          created_by_role: w.created_by_role,
        })),
      };

      setPendingPlanData({
        payload,
        visits: planType === "Leave" ? [] : visits,
        works: planType === "Leave" ? [] : works,
        displayPlan: draftRecord,
      });
      setCreateMailModalOpen(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to prepare work plan";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateAndSendEmail(emailPayload: CreateEmailPayload) {
    if (!pendingPlanData) return;
    if (isPlanCompleted) {
      toast.error("This work plan is completed and cannot be updated.");
      return;
    }
    setSubmitting(true);
    try {
      let targetPlanId = activePlanId;

      if (isEditing && targetPlanId) {
        // Update existing plan
        await updatePlanMut({ id: targetPlanId, body: pendingPlanData.payload }).unwrap();

        // Post unposted or reassigned visits
        if (isVisitsPlan(pendingPlanData.payload.plan_type || "") && pendingPlanData.visits.length > 0) {
          const visitsToPost = pendingPlanData.visits.filter(
            (v) => !v._id && !v.id || (v.work_plan && String(v.work_plan) !== String(targetPlanId))
          );
          for (const v of visitsToPost) {
            const partyObj = typeof v.party === "object" ? v.party : null;
            const resolvedPartyType = v.party_type || (v.party ? "existing" : "new_party");
            const partyId = partyObj ? partyObj._id || partyObj.id : (typeof v.party === "string" ? v.party : undefined);
            const visitBody: any = {
              ...(v._id || v.id ? { _id: v._id || v.id } : {}),
              party_type: resolvedPartyType,
              party_name: v.party_name || partyObj?.party_name || "Client Visit",
              contact_person: v.contact_person || "Contact Person",
              contact_number: v.contact_number || "+91 98765 43210",
              contact_email:
                v.contact_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v.contact_email).trim())
                  ? String(v.contact_email).trim()
                  : `${(v.contact_person || "contact").toLowerCase().replace(/[^a-z0-9]/g, "") || "contact"}@client.com`,
              contacts: v.contacts,
              address: v.address || undefined,
              purpose: v.purpose || undefined,
              notes: v.notes || undefined,
              planned_start_time: v.planned_start_time || undefined,
              planned_end_time: v.planned_end_time || undefined,
            };
            if (resolvedPartyType === "existing" && partyId) {
              visitBody.party = partyId;
            }
            await addVisitMut({ planId: targetPlanId, body: visitBody }).unwrap();
          }
        }

        // Post unposted or reassigned tasks
        if (isWorkTaskPlan(pendingPlanData.payload.plan_type || "") && pendingPlanData.works.length > 0) {
          const worksToPost = pendingPlanData.works.filter(
            (w) => !w._id && !w.id || (w.work_plan && String(w.work_plan) !== String(targetPlanId))
          );
          for (const w of worksToPost) {
            const workBody = {
              ...(w._id || w.id ? { _id: w._id || w.id } : {}),
              title: w.title,
              description: w.description || undefined,
              planned_start_time: w.planned_start_time || undefined,
              planned_end_time: w.planned_end_time || undefined,
            };
            await addWorkMut({ planId: targetPlanId, body: workBody }).unwrap();
          }
        }
      } else {
        // Create new plan
        let created: any = null;
        try {
          created = await createPlanMut(pendingPlanData.payload).unwrap();
        } catch (createErr: any) {
          const createMsg = extractErrorMessage(createErr, "Failed to create work plan");
          if (createErr?.status === 409 || createMsg.toLowerCase().includes("already exists")) {
            toast.info("A work plan already exists for this date. Updating existing plan...", { id: "plan-409-fallback" });
            const existingRes = await lazyGetPlans({
              date: pendingPlanData.payload.plan_date,
              sales_user: targetUserId,
              limit: 1,
            }).unwrap();
            const existingFound = (existingRes?.data || []).find(
              (p: any) => String(p.status) !== "deleted" && !p.deletedAt
            );
            if (existingFound) {
              const exId = String(existingFound._id || existingFound.id);
              setExistingPlanId(exId);
              targetPlanId = exId;
              await updatePlanMut({ id: exId, body: pendingPlanData.payload }).unwrap();
            } else {
              throw createErr;
            }
          } else {
            throw createErr;
          }
        }

        if (created) {
          targetPlanId = created._id || created.id;
        }
        if (!targetPlanId) throw new Error("Failed to obtain work plan ID");

        // Post visits
        if (isVisitsPlan(pendingPlanData.payload.plan_type || "") && pendingPlanData.visits.length > 0) {
          for (const v of pendingPlanData.visits) {
            const partyObj = typeof v.party === "object" ? v.party : null;
            const resolvedPartyType = v.party_type || (v.party ? "existing" : "new_party");
            const partyId = partyObj ? partyObj._id || partyObj.id : (typeof v.party === "string" ? v.party : undefined);
            const visitBody: any = {
              ...(v._id || v.id ? { _id: v._id || v.id } : {}),
              party_type: resolvedPartyType,
              party_name: v.party_name || partyObj?.party_name || "Client Visit",
              contact_person: v.contact_person || "Contact Person",
              contact_number: v.contact_number || "+91 98765 43210",
              contact_email:
                v.contact_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v.contact_email).trim())
                  ? String(v.contact_email).trim()
                  : `${(v.contact_person || "contact").toLowerCase().replace(/[^a-z0-9]/g, "") || "contact"}@client.com`,
              contacts: v.contacts,
              address: v.address || undefined,
              purpose: v.purpose || undefined,
              notes: v.notes || undefined,
              planned_start_time: v.planned_start_time || undefined,
              planned_end_time: v.planned_end_time || undefined,
            };
            if (resolvedPartyType === "existing" && partyId) {
              visitBody.party = partyId;
            }
            await addVisitMut({ planId: targetPlanId, body: visitBody }).unwrap();
          }
        }

        // Post works
        if (isWorkTaskPlan(pendingPlanData.payload.plan_type || "") && pendingPlanData.works.length > 0) {
          for (const w of pendingPlanData.works) {
            const workBody = {
              ...(w._id || w.id ? { _id: w._id || w.id } : {}),
              title: w.title,
              description: w.description || undefined,
              planned_start_time: w.planned_start_time || undefined,
              planned_end_time: w.planned_end_time || undefined,
            };
            await addWorkMut({ planId: targetPlanId, body: workBody }).unwrap();
          }
        }
      }

      // Sync imported scratchpad notes as converted
      if (importedNoteIds.length > 0 && targetPlanId) {
        markNotesConvertedMut({
          note_ids: importedNoteIds,
          work_plan_id: targetPlanId,
          work_plan_date: pendingPlanData.payload.plan_date,
        }).catch(() => {});
      }

      // Submit plan on backend and send mail
      try {
        await submitPlanMut({
          id: targetPlanId!,
          body: {
            to_email: emailPayload.toEmail,
            cc_emails: emailPayload.ccEmails,
            subject: emailPayload.subject,
            body_html: emailPayload.bodyHtml,
            attachment_ids: emailPayload.attachmentIds,
          },
        }).unwrap();
      } catch (submitErr: any) {
        console.error("Error submitting plan email:", submitErr);
        const errMsg = extractErrorMessage(submitErr, "Failed to submit plan email");
        toast.error(errMsg);
        throw submitErr;
      }

      // Clear cloud and local storage draft upon successful submission
      if (targetUserId && planDate) {
        clearWorkPlanDraft(targetUserId, planDate);
        deleteDraftMut({ sales_user: targetUserId, plan_date: planDate }).catch(() => {});
      }
      setDraftStatus("idle");
      setLastDraftSavedAt(null);
      setAvailableDraft(null);

      toast.success(
        pendingPlanData.payload.plan_type === "Leave"
          ? (isEditing ? "Leave plan updated successfully!" : "Leave plan submitted and completed successfully!")
          : (isEditing ? "Work plan updated and email dispatched successfully!" : "Work plan created and email dispatched successfully!")
      );
      setCreateMailModalOpen(false);
      router.push("/dashboard/plans");
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, "Failed to save work plan and send email");
      toast.error(msg);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted font-sans">
        Loading work plan details…
      </div>
    );
  }

  const visitsType = isVisitsPlan(planType);
  const tasksType = isWorkTaskPlan(planType);
  const leaveType = isLeavePlan(planType);

  return (
    <div className="mx-auto max-w-3xl space-y-6 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/plans"
            className="rounded-lg border border-border p-2 text-muted hover:bg-surface-muted hover:text-foreground transition inline-flex items-center justify-center cursor-pointer shrink-0"
            title="Back to Work Plans"
            aria-label="Back to Work Plans"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-foreground">
                {isPlanCompleted ? "Work Plan (Completed)" : isEditing ? "Edit Work Plan" : isCopying ? "Copy Work Plan" : "Create Work Plan"}
              </h1>
              {/* Draft Status Badges */}
              {!isPlanCompleted && draftStatus === "saving" && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving draft…
                </span>
              )}
              {!isPlanCompleted && draftStatus === "saved" && lastDraftSavedAt && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"
                  title={`Draft persisted at ${lastDraftSavedAt}`}
                >
                  <Check className="h-3 w-3" />
                  Draft auto-saved ({formatDraftTime(lastDraftSavedAt)})
                </span>
              )}
              {!isPlanCompleted && draftStatus === "restored" && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                  <RotateCcw className="h-3 w-3" />
                  Draft restored
                </span>
              )}
            </div>
            <p className="text-xs text-muted">
              {isPlanCompleted
                ? `Work plan for ${planDate} is completed and locked. Creation and updating are disabled.`
                : detectedPlan
                ? `Loaded existing work plan for ${planDate} (${detectedPlan.status}). Submitting will update and mail this plan.`
                : isEditing
                ? "Update plan dates, executive, location, remarks, visits or tasks"
                : isCopying
                ? "Creating a new work plan from a copied template — adjust date, visits, and tasks as needed"
                : "Schedule a new work plan with initial visits or tasks"}
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        {!isPlanCompleted && (
          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={handleManualSaveDraft}
              disabled={submitting || checkingExisting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card hover:bg-surface-muted px-3 py-1.5 text-xs font-semibold text-foreground transition shadow-2xs cursor-pointer"
              title="Save current work plan state as a local draft"
            >
              <Save className="h-3.5 w-3.5 text-muted" />
              <span>Save Draft</span>
            </button>
          </div>
        )}
      </div>

      {/* Unsaved Real-time Draft Recovery Alert Banner */}
      {availableDraft && !isPlanCompleted && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2 text-xs shadow-xs animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-2.5 text-amber-700 dark:text-amber-300">
              <History className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5 sm:mt-0" />
              <div>
                <span className="font-bold">Unsaved Real-time Draft Found</span>
                <span className="ml-1.5 text-muted font-normal text-[11px]">
                  (Saved {formatDraftTime(availableDraft.lastSavedAt)})
                </span>
                <p className="text-muted text-[11px] mt-0.5">
                  Contains {availableDraft.visits?.length || 0} visit{availableDraft.visits?.length === 1 ? "" : "s"} and {availableDraft.works?.length || 0} task{availableDraft.works?.length === 1 ? "" : "s"}
                  {availableDraft.location ? ` • Location: "${availableDraft.location}"` : ""}.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                type="button"
                onClick={handleRestoreDraft}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restore Draft
              </button>
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card hover:bg-surface-muted px-2.5 py-1.5 text-xs font-semibold text-muted hover:text-foreground transition cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing Plan Notice Banner / Completed Lock Banner */}
      {isPlanCompleted ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold">
              <AlertTriangle className="h-4 w-4" />
              <span>Work Plan Completed — Read Only</span>
            </div>
            <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 text-[10px] font-extrabold text-rose-600 dark:text-rose-400 uppercase">
              Completed
            </span>
          </div>
          <p className="text-muted">
            The work plan for <strong>{planDate}</strong> is marked as <strong>Completed</strong>. Creation of new work plans or updating completed work plans for this date is not allowed.
          </p>
        </div>
      ) : detectedPlan ? (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold">
              <Mail className="h-4 w-4" />
              <span>Existing Work Plan Found for Selected Date ({planDate})</span>
            </div>
            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">
              Status: {detectedPlan.status}
            </span>
          </div>
          <p className="text-muted">
            A work plan already exists for this date. The plan details have been fetched and loaded below. Submitting will <strong>Update &amp; Mail</strong> this work plan.
          </p>
        </div>
      ) : null}

      {/* Top Controls Card: Date & Assigned Executive Selection (Outside of Form) */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">
              Schedule &amp; Assigned Executive
            </h2>
          </div>
          <span className="text-[11px] text-muted">
            {isEditing ? "Editing work plan" : "Select executive & plan date"}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Executive Selection with Search (Admin or Manager) */}
          {elevatedRole && (
            <div className="relative" ref={dropdownRef}>
              <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-foreground">
                <span>
                  Assigned Executive / User <span className="text-rose-500">*</span>
                </span>
                <span className="text-[11px] font-normal text-muted">
                  {adminRole
                    ? "All portal members (Admin)"
                    : "Reporting team & self (Manager)"}
                </span>
              </label>

              {/* Trigger Button / Display field */}
              <button
                type="button"
                onClick={() => setExecDropdownOpen((prev) => !prev)}
                className="w-full flex items-center justify-between rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary transition hover:bg-surface-muted/80 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                    <UserIcon className="h-3.5 w-3.5" />
                  </div>
                  <div className="text-left truncate flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-foreground">
                      {selectedExecutive.name}
                    </span>
                    {selectedExecutive.isSelf && (
                      <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                        Self
                      </span>
                    )}
                    {selectedExecutivePortalRole && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border ${
                          selectedExecutivePortalRole === "Admin"
                            ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20"
                            : selectedExecutivePortalRole === "Manager"
                            ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20"
                            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        }`}
                      >
                        {selectedExecutivePortalRole === "Admin"
                          ? "Portal Admin"
                          : selectedExecutivePortalRole === "Manager"
                          ? "Portal Manager"
                          : "Executive"}
                      </span>
                    )}
                    {selectedExecutive.department && (
                      <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">
                        {selectedExecutive.department}
                      </span>
                    )}
                    {selectedExecutive.email && (
                      <span className="text-muted ml-1 text-[11px]">
                        ({selectedExecutive.email})
                      </span>
                    )}
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted transition-transform duration-200 shrink-0 ml-2 ${execDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {/* Dropdown Card */}
              {execDropdownOpen && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-border bg-card shadow-lg p-2 space-y-2">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted" />
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search executive by name, email, department..."
                      value={execSearch}
                      onChange={(e) => setExecSearch(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface-muted pl-8 pr-8 py-1.5 text-xs font-medium text-foreground outline-none focus:border-primary"
                    />
                    {execSearch && (
                      <button
                        type="button"
                        onClick={() => setExecSearch("")}
                        className="absolute right-2.5 top-2 text-muted hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* List of eligible executives */}
                  <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                    {eligibleExecutives.length === 0 ? (
                      <p className="p-3 text-center text-xs text-muted">
                        No executives found matching &ldquo;{execSearch}&rdquo; with Work Planner portal access.
                      </p>
                    ) : (
                      eligibleExecutives.map((u) => {
                        const uId = u._id || u.id || "";
                        const isSelf = uId === sessionUser?._id;
                        const isSelected = uId === salesUserId || (isSelf && salesUserId === sessionUser?._id);
                        const userRole = getWorkPlannerUserPortalRole(u);
                        return (
                          <button
                            key={uId}
                            type="button"
                            onClick={() => {
                              prevFetchedKey.current = "";
                              setSalesUserId(uId);
                              setExecDropdownOpen(false);
                              setExecSearch("");
                            }}
                            className={`w-full flex items-center justify-between rounded-lg p-2 text-xs text-left transition ${
                              isSelected
                                ? "bg-primary/10 text-primary font-semibold"
                                : "hover:bg-surface-muted text-foreground"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <div
                                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shrink-0 ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-surface-muted text-muted"
                                }`}
                              >
                                {u.name ? u.name.charAt(0).toUpperCase() : "U"}
                              </div>
                              <div className="truncate">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold text-foreground">
                                    {u.name}
                                  </span>
                                  {isSelf && (
                                    <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                                      Self
                                    </span>
                                  )}
                                  {userRole && (
                                    <span
                                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border ${
                                        userRole === "Admin"
                                          ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20"
                                          : userRole === "Manager"
                                          ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                          : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                      }`}
                                    >
                                      {userRole === "Admin"
                                        ? "Portal Admin"
                                        : userRole === "Manager"
                                        ? "Portal Manager"
                                        : "Executive"}
                                    </span>
                                  )}
                                  {u.department && (
                                    <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">
                                      {u.department}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-muted truncate">{u.email}</p>
                              </div>
                            </div>
                            {isSelected && <Check className="h-4 w-4 text-primary shrink-0 ml-2" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Plan Date */}
          <div className={elevatedRole ? "" : "sm:col-span-2"}>
            <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-foreground">
              <span>
                Plan Date <span className="text-rose-500">*</span>
              </span>
              {checkingExisting && (
                <span className="text-[11px] font-normal text-primary animate-pulse flex items-center gap-1">
                  <Clock className="h-3 w-3 animate-spin" /> Checking existing plan…
                </span>
              )}
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
              <input
                type="date"
                required
                value={planDate}
                min={minPlanDate}
                onChange={(e) => {
                  prevFetchedKey.current = "";
                  setPlanDate(e.target.value);
                }}
                className="w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            {isSunday(planDate) && (
              <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-purple-500/20 bg-purple-500/10 px-2.5 py-1.5 text-[11px] font-medium text-purple-600 dark:text-purple-400">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>ℹ️ <strong>Sunday (Weekly Off)</strong> — Creating a work plan for Sunday is optional (only required if working).</span>
              </div>
            )}
            {minPlanDate && (
              <p className="mt-1 text-[11px] text-muted font-medium">
                ℹ️ Work plans can be scheduled from {minPlanDate} onwards (up to 2 days prior to today).
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-6">
        <div className="space-y-4">
          {/* Plan Type Selector */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Plan Type <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {WORK_PLAN_TYPE_TABS.filter((t) => t.id !== "all").map((t) => {
                const isSelected = planType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={isPlanCompleted}
                    onClick={() => {
                      const val = t.id;
                      setPlanType(val);
                      if (val === "Work From Home" && !location) setLocation("Remote / Work From Home");
                      else if (val === "Work From Office" && !location) setLocation("Head Office / Branch Office");
                      else if (val === "Leave") {
                        setLocation("");
                        setVisits([]);
                        setWorks([]);
                      }
                    }}
                    className={`rounded-lg px-3 py-2.5 text-xs font-semibold border transition text-center flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary shadow-xs"
                        : "border-border bg-surface-muted/50 text-foreground hover:bg-surface-muted"
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
            {!planType && (
              <div className="mt-2.5 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 text-center text-xs text-muted">
                <span className="font-semibold text-foreground">👉 Please select a Plan Type</span> above (Visits, Tasks &amp; Visits, Work From Office/Home, or Leave) to configure your activities for this day.
              </div>
            )}
          </div>
        </div>

        {/* Location & Geography */}
        {!leaveType && requiresGeo ? (
          <div className="space-y-3 rounded-xl border border-border/70 bg-surface/50 p-3.5 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <MapPin className="h-4 w-4 text-primary shrink-0" />
                <span>Target Geography & Location</span>
                <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-muted">
                Visits &amp; master searches will be filtered to this geography
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Country */}
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted">
                  Country <span className="text-rose-500">*</span>
                </label>
                <select
                  value={countryId}
                  onChange={(e) => {
                    const cId = e.target.value;
                    setCountryId(cId);
                    const found = countriesData.find((c) => c._id === cId || c.id === cId);
                    setCountryName(found?.name || "");
                    setStateId("");
                    setStateName("");
                    setCityId("");
                    setCityName("");
                    setSelectedCityIds([]);
                    setSelectedCityNames([]);
                  }}
                  disabled={isPlanCompleted || isCountriesLoading}
                  className="w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {isCountriesLoading ? "Loading countries..." : "Select Country"}
                  </option>
                  {countriesData.map((c) => {
                    const id = c._id || c.id || "";
                    return (
                      <option key={id} value={id}>
                        {c.name}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* State */}
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted">
                  State / Province <span className="text-rose-500">*</span>
                </label>
                <select
                  value={stateId}
                  onChange={(e) => {
                    const sId = e.target.value;
                    setStateId(sId);
                    const found = statesData.find((s) => s._id === sId || s.id === sId);
                    setStateName(found?.name || "");
                    setCityId("");
                    setCityName("");
                    setSelectedCityIds([]);
                    setSelectedCityNames([]);
                  }}
                  disabled={isPlanCompleted || !countryId || isStatesLoading}
                  className="w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {!countryId
                      ? "Select Country first"
                      : isStatesLoading
                      ? "Loading states..."
                      : "Select State"}
                  </option>
                  {countryId &&
                    statesData.map((s) => {
                      const id = s._id || s.id || "";
                      return (
                        <option key={id} value={id}>
                          {s.name}
                        </option>
                      );
                    })}
                </select>
              </div>

              {/* City / District (Multi-Select) */}
              <div className="relative" ref={cityDropdownRef}>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-medium text-muted">
                    City / District <span className="text-rose-500">*</span>
                  </label>
                  {selectedCityIds.length > 0 && !isPlanCompleted && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCityIds([]);
                        setSelectedCityNames([]);
                        setCityId("");
                        setCityName("");
                      }}
                      className="text-[10px] text-muted hover:text-rose-500 transition cursor-pointer"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {/* Dropdown Trigger Button */}
                <button
                  type="button"
                  disabled={isPlanCompleted || !stateId || isCitiesLoading}
                  onClick={() => setIsCityDropdownOpen((prev) => !prev)}
                  className="flex min-h-[38px] w-full items-center justify-between rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-xs font-medium text-foreground outline-none hover:border-primary/50 focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed transition text-left"
                >
                  <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0 pr-2">
                    {!stateId ? (
                      <span className="text-muted">Select State first</span>
                    ) : isCitiesLoading ? (
                      <span className="text-muted">Loading cities...</span>
                    ) : selectedCityNames.length === 0 ? (
                      <span className="text-muted">Select one or more cities...</span>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          {selectedCityNames[0]}
                        </span>
                        {selectedCityNames.length > 1 && (
                          <span className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                            +{selectedCityNames.length - 1} more
                          </span>
                        )}
                        <span className="text-[11px] text-muted truncate">
                          ({selectedCityNames.length} selected)
                        </span>
                      </>
                    )}
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${
                      isCityDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Dropdown Menu Popover */}
                {isCityDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 w-full rounded-xl border border-border bg-card shadow-xl overflow-hidden flex flex-col">
                    {/* Search bar inside dropdown */}
                    <div className="p-2 border-b border-border bg-surface-muted/50">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted" />
                        <input
                          type="text"
                          placeholder="Search cities..."
                          value={citySearchQuery}
                          onChange={(e) => setCitySearchQuery(e.target.value)}
                          className="w-full rounded-md border border-border bg-card pl-8 pr-7 py-1 text-xs text-foreground outline-none focus:border-primary"
                          autoFocus
                        />
                        {citySearchQuery && (
                          <button
                            type="button"
                            onClick={() => setCitySearchQuery("")}
                            className="absolute right-2 top-1.5 text-muted hover:text-foreground"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Quick action bar */}
                      <div className="flex items-center justify-between mt-1.5 px-0.5 text-[11px]">
                        <span className="text-muted">
                          {
                            citiesData.filter((c) =>
                              c.name.toLowerCase().includes(citySearchQuery.toLowerCase().trim())
                            ).length
                          }{" "}
                          cities available
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const matching = citiesData.filter((c) =>
                                c.name.toLowerCase().includes(citySearchQuery.toLowerCase().trim())
                              );
                              const newIds = Array.from(new Set([...selectedCityIds, ...matching.map((c) => c._id || c.id || "")]));
                              const newNames = citiesData.filter((c) => newIds.includes(c._id || c.id || "")).map((c) => c.name);
                              setSelectedCityIds(newIds);
                              setSelectedCityNames(newNames);
                              if (newIds[0]) setCityId(newIds[0]);
                              if (newNames.length) setCityName(newNames.join(", "));
                            }}
                            className="text-primary hover:underline font-semibold cursor-pointer"
                          >
                            Select All
                          </button>
                          <span className="text-muted">•</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCityIds([]);
                              setSelectedCityNames([]);
                              setCityId("");
                              setCityName("");
                            }}
                            className="text-rose-500 hover:underline cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Scrollable list of cities with checkboxes */}
                    <div className="overflow-y-auto max-h-48 p-1">
                      {citiesData
                        .filter((ci) =>
                          ci.name.toLowerCase().includes(citySearchQuery.toLowerCase().trim())
                        )
                        .map((ci) => {
                          const id = ci._id || ci.id || "";
                          const isChecked = selectedCityIds.includes(id);
                          return (
                            <label
                              key={id}
                              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer hover:bg-surface-muted transition select-none ${
                                isChecked ? "bg-primary/10 text-primary font-medium" : "text-foreground"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  let nextIds: string[];
                                  let nextNames: string[];
                                  if (e.target.checked) {
                                    nextIds = [...selectedCityIds, id];
                                  } else {
                                    nextIds = selectedCityIds.filter((cid) => cid !== id);
                                  }
                                  nextNames = citiesData
                                    .filter((c) => nextIds.includes(c._id || c.id || ""))
                                    .map((c) => c.name);
                                  setSelectedCityIds(nextIds);
                                  setSelectedCityNames(nextNames);
                                  setCityId(nextIds[0] || "");
                                  setCityName(nextNames.join(", "));
                                  if (nextNames.length > 0 && (!location || location === stateName || location.includes(cityName))) {
                                    setLocation(stateName ? `${nextNames.join(", ")}, ${stateName}` : nextNames.join(", "));
                                  }
                                }}
                                className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                              />
                              <span className="flex-1 truncate">{ci.name}</span>
                              {isChecked && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                            </label>
                          );
                        })}
                      {citiesData.filter((ci) =>
                        ci.name.toLowerCase().includes(citySearchQuery.toLowerCase().trim())
                      ).length === 0 && (
                        <div className="p-3 text-center text-xs text-muted">
                          No cities matching &quot;{citySearchQuery}&quot;
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Selected city badges display below dropdown */}
                {selectedCityNames.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedCityNames.map((name, idx) => {
                      const cId = selectedCityIds[idx];
                      return (
                        <span
                          key={cId || name}
                          className="inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/10 pl-2 pr-1 py-0.5 text-[11px] font-medium text-primary shadow-2xs"
                        >
                          <span>{name}</span>
                          {!isPlanCompleted && (
                            <button
                              type="button"
                              onClick={() => {
                                const nextIds = selectedCityIds.filter((_, i) => i !== idx);
                                const nextNames = selectedCityNames.filter((_, i) => i !== idx);
                                setSelectedCityIds(nextIds);
                                setSelectedCityNames(nextNames);
                                setCityId(nextIds[0] || "");
                                setCityName(nextNames.join(", "));
                              }}
                              className="rounded p-0.5 hover:bg-primary/20 hover:text-primary transition cursor-pointer"
                              title={`Remove ${name}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Area / Territory / Specific location details */}
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted">
                Area / Territory / Specific Locality
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
                <input
                  type="text"
                  disabled={isPlanCompleted}
                  placeholder="e.g. Andheri East, BKC, Sector 62 Industrial Area"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        ) : !leaveType ? (
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Work Location / City <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
              <input
                type="text"
                disabled={isPlanCompleted}
                placeholder={
                  planType === "Work From Home"
                    ? "e.g. Work From Home / Remote Location"
                    : planType === "Work From Office"
                      ? "e.g. Main Office / Branch Office"
                      : "e.g. Mumbai Metro Area, Sector 18 Noida"
                }
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        ) : null}

        {/* Remarks / Objectives */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-foreground">
            {leaveType ? "Leave Reason & Remarks" : "Remarks & Objectives"}{" "}
            <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <FileText className="absolute left-3 top-3 h-4 w-4 text-muted" />
            <textarea
              rows={3}
              disabled={isPlanCompleted}
              placeholder={
                leaveType
                  ? "Reason for leave (casual, medical, vacation, etc.)..."
                  : tasksType
                    ? "Key internal tasks, documentation, or team objectives planned..."
                    : "Key visit objectives, client targets, or meeting details..."
              }
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Manager Discussion Section */}
        <div className="rounded-xl border border-border bg-surface-muted/30 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">
                  Is this Plan discussed with the Manager? <span className="text-rose-500">*</span>
                </span>
              </div>
              <div className="flex items-center gap-5 pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="is_discussed_with_manager"
                    disabled={isPlanCompleted}
                    checked={isDiscussedWithManager === true}
                    onChange={() => {
                      setIsDiscussedWithManager(true);
                      if (assignedPlanTypeManager) {
                        setDiscussedManagerId(assignedPlanTypeManager._id || "");
                        setDiscussedManagerName(assignedPlanTypeManager.name || "");
                        setShowManagerPicker(false);
                      }
                    }}
                    className="h-4 w-4 border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <span className="text-xs font-medium text-foreground">Yes</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="is_discussed_with_manager"
                    disabled={isPlanCompleted}
                    checked={isDiscussedWithManager === false}
                    onChange={() => {
                      setIsDiscussedWithManager(false);
                      setDiscussedManagerId("");
                      setDiscussedManagerName("");
                    }}
                    className="h-4 w-4 border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <span className="text-xs font-medium text-foreground">No</span>
                </label>
              </div>
            </div>
            {isDiscussedWithManager === true && (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <Check className="h-3 w-3" />
                Discussion Logged
              </span>
            )}
          </div>

          {isDiscussedWithManager === true && (
            <div className="pt-2 border-t border-border/60 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Manager Selection Display */}
                <div className="sm:col-span-2 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-foreground">
                      Discussed Manager <span className="text-rose-500">*</span>
                    </label>
                    {assignedPlanTypeManager && !showManagerPicker && !isPlanCompleted && (
                      <button
                        type="button"
                        onClick={() => setShowManagerPicker(true)}
                        className="text-[11px] font-medium text-primary hover:underline cursor-pointer"
                      >
                        Change Manager
                      </button>
                    )}
                    {showManagerPicker && assignedPlanTypeManager && !isPlanCompleted && (
                      <button
                        type="button"
                        onClick={() => setShowManagerPicker(false)}
                        className="text-[11px] font-medium text-primary hover:underline cursor-pointer"
                      >
                        ← Back to Default
                      </button>
                    )}
                  </div>

                  {!showManagerPicker && currentDisplayedManager ? (
                    <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 truncate">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm shrink-0">
                          {currentDisplayedManager.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="truncate">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-foreground truncate">
                              {currentDisplayedManager.name}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                currentDisplayedManager.isSpecificPlanType
                                  ? "bg-primary/15 text-primary border border-primary/20"
                                  : "bg-blue-500/15 text-blue-500 border border-blue-500/20"
                              }`}
                            >
                              {currentDisplayedManager.badgeText}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted truncate">
                            {currentDisplayedManager.email}
                          </p>
                        </div>
                      </div>

                      {!isPlanCompleted && (
                        <button
                          type="button"
                          onClick={() => setShowManagerPicker(true)}
                          className="text-[11px] font-bold text-primary hover:underline shrink-0 cursor-pointer"
                        >
                          Change
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="relative" ref={managerDropdownRef}>
                      <button
                        type="button"
                        disabled={isPlanCompleted}
                        onClick={() => setManagerDropdownOpen(!managerDropdownOpen)}
                        className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-muted px-3 py-2 text-left text-xs font-medium text-foreground focus:border-primary focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <div className="truncate">
                          {selectedManager ? (
                            <span className="font-semibold text-foreground">
                              {selectedManager.name}{" "}
                              <span className="text-[11px] font-normal text-muted">
                                ({selectedManager.department || selectedManager.email})
                              </span>
                            </span>
                          ) : discussedManagerName ? (
                            <span className="font-semibold text-foreground">{discussedManagerName}</span>
                          ) : (
                            <span className="text-muted">Search &amp; select manager, coordinator, or admin...</span>
                          )}
                        </div>
                        <ChevronDown className="h-4 w-4 text-muted shrink-0 ml-2" />
                      </button>

                      {managerDropdownOpen && !isPlanCompleted && (
                        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-xl border border-border bg-card p-2 shadow-xl">
                          <div className="relative mb-2">
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted" />
                            <input
                              type="text"
                              placeholder="Search manager, coordinator, or admin by name, email, role..."
                              value={managerSearch}
                              onChange={(e) => setManagerSearch(e.target.value)}
                              className="w-full rounded-lg border border-border bg-surface-muted pl-8 pr-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                              autoFocus
                            />
                          </div>
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {eligibleManagers.length === 0 ? (
                              <div className="p-3 text-center text-xs text-muted">
                                No reporting managers, coordinators, or admins found
                              </div>
                            ) : (
                              eligibleManagers.map((u) => {
                                const isSelected =
                                  (u._id) === discussedManagerId;
                                return (
                                  <button
                                    key={u._id || u.name}
                                    type="button"
                                    onClick={() => {
                                      setDiscussedManagerId(u._id || "");
                                      setDiscussedManagerName(u.name || "");
                                      setShowManagerPicker(false);
                                      setManagerDropdownOpen(false);
                                    }}
                                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                                      isSelected
                                        ? "bg-primary/10 text-primary font-medium"
                                        : "text-foreground hover:bg-surface-muted"
                                    }`}
                                  >
                                    <div className="truncate">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-semibold">{u.name}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                          u.isReportingManager
                                            ? "bg-primary/15 text-primary"
                                            : u.roleBadge === "Portal Admin"
                                            ? "bg-purple-500/15 text-purple-600 dark:text-purple-400"
                                            : u.roleBadge === "Portal Coordinator"
                                            ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                                            : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                                        }`}>
                                          {u.roleBadge}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-muted truncate">{u.email}</div>
                                    </div>
                                    {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Discussion Method */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-foreground">
                    Method of Discussion <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={discussionMethod}
                    disabled={isPlanCompleted}
                    onChange={(e) => setDiscussionMethod(e.target.value as any)}
                    className="w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="on_call">On Call</option>
                    <option value="on_direct_meeting">On Direct Meeting</option>
                    <option value="on_email">On Email</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Embedded Section: Field Visits (if Plan Type is Visits) */}
        {visitsType && (
          <div className="rounded-xl border border-border bg-surface-muted/40 p-3 sm:p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-border pb-2.5">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary shrink-0" />
                <h3 className="text-xs font-bold text-foreground">
                  Planned Visits ({visits.length}) {visitsType && <span className="text-rose-500 font-bold">*</span>}
                </h3>
              </div>
              {!isPlanCompleted && (
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => setImportNotesMode("visits")}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition shadow-xs cursor-pointer"
                    title="Import pending visits from private scratchpad notes"
                  >
                    <StickyNote className="h-3.5 w-3.5 shrink-0" />
                    <span>Import Notes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviousModalMode("visits")}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-xs font-semibold text-foreground hover:bg-surface-hover transition shadow-xs cursor-pointer"
                    title="Add previous created or pending visits"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    <span>Add Previous</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingVisitIndex(null);
                      setVisitModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary-hover transition shadow-xs cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    <span>Add Visit</span>
                  </button>
                </div>
              )}
            </div>

            {visits.length === 0 ? (
              <p className="text-xs text-muted py-3 text-center">
                No visits added yet. {isPlanCompleted ? "" : "Click \"Add Visit\" to add party visits for this plan date."}
              </p>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {visits.map((v, idx) => {
                  const partyName =
                    v.party_name ||
                    (typeof v.party === "object" && v.party?.party_name) ||
                    "Party Visit";
                  return (
                    <div
                      key={idx}
                      className="flex items-start justify-between gap-2 rounded-lg border border-border bg-card p-3 shadow-2xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Building2 className="h-3.5 w-3.5 text-muted shrink-0" />
                          <span className="text-xs font-bold text-foreground truncate">
                            {partyName}
                          </span>
                          {renderVisitStatusBadge(v.status)}
                        </div>
                        {v.purpose && (
                          <p className="text-[11px] text-muted line-clamp-1">
                            Purpose: {v.purpose}
                          </p>
                        )}
                        {(() => {
                          const visitContacts = Array.isArray(v.contacts) && v.contacts.length > 0
                            ? v.contacts
                            : (v.contact_person || v.contact_number || v.phone)
                              ? [{ contact_person: v.contact_person, contact_number: v.contact_number || v.phone }]
                              : [];
                          if (visitContacts.length === 0) return null;
                          const primary = visitContacts[0];
                          const extraCount = visitContacts.length - 1;
                          return (
                            <p className="text-[11px] text-foreground font-medium flex items-center gap-1.5 flex-wrap">
                              <span>
                                {primary.contact_person} {primary.contact_number ? `(${primary.contact_number})` : ""}
                              </span>
                              {extraCount > 0 && (
                                <span className="inline-flex rounded bg-primary/10 px-1.5 py-0.2 text-[9px] font-bold text-primary">
                                  +{extraCount} more
                                </span>
                              )}
                            </p>
                          );
                        })()}
                        {(v.locality || v.city || v.address) && (
                          <p className="text-[10px] text-muted flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 text-muted shrink-0" />
                            <span>{[v.locality, v.city, v.address].filter(Boolean).join(", ")}</span>
                          </p>
                        )}
                        {(v.remarks || v.notes || (v as any).description) && (
                          <p className="text-[11px] text-muted line-clamp-2 bg-surface-muted/50 p-1.5 rounded-md border border-border/40">
                            <span className="font-semibold text-foreground">Notes: </span>
                            <span>{v.remarks || v.notes || (v as any).description}</span>
                          </p>
                        )}
                        {v.planned_start_time && (
                          <p className="text-[10px] text-muted flex items-center gap-1 font-medium">
                            <Clock className="h-3 w-3" />
                            {formatTime(v.planned_start_time)}
                          </p>
                        )}
                      </div>

                      {!isPlanCompleted && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingVisitIndex(idx);
                              setVisitModalOpen(true);
                            }}
                            className="rounded p-1 text-muted hover:bg-surface-muted hover:text-foreground"
                            title="Edit visit"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          {elevatedRole || !isManagerCreatedItem(v) ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveVisit(idx)}
                              className="rounded p-1 text-muted hover:bg-rose-500/10 hover:text-rose-500"
                              title="Remove visit"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="rounded p-1 text-muted/30 cursor-not-allowed opacity-50"
                              title="Created by Portal Admin / Manager — cannot be removed by Executive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Dynamic Embedded Section: Work Tasks (if Plan Type is WFH or WFO) */}
        {tasksType && (
          <div className="rounded-xl border border-border bg-surface-muted/40 p-3 sm:p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-border pb-2.5">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                <h3 className="text-xs font-bold text-foreground">
                  Planned Tasks ({works.length}) {tasksType && <span className="text-rose-500 font-bold">*</span>}
                </h3>
              </div>
              {!isPlanCompleted && (
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => setImportNotesMode("tasks")}
                    className="inline-flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition shadow-xs cursor-pointer"
                    title="Import pending tasks and quick notes from private scratchpad"
                  >
                    <StickyNote className="h-3.5 w-3.5 shrink-0" />
                    <span>Import Notes</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleManualRollover}
                    disabled={rolloverLoading}
                    className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition shadow-xs cursor-pointer disabled:opacity-50"
                    title="Rollover uncompleted tasks from previous plans"
                  >
                    <RotateCcw className={`h-3.5 w-3.5 shrink-0 ${rolloverLoading ? "animate-spin" : ""}`} />
                    <span>Rollover</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviousModalMode("tasks")}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-xs font-semibold text-foreground hover:bg-surface-hover transition shadow-xs cursor-pointer"
                    title="Add previous created or pending tasks"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    <span>Add Previous</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingWorkIndex(null);
                      setWorkModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary-hover transition shadow-xs cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    <span>Add Task</span>
                  </button>
                </div>
              )}
            </div>

            {/* Custom Work Task Templates from User Settings */}
            {effectiveSettings?.customWorkTemplates &&
              effectiveSettings.customWorkTemplates.length > 0 &&
              !isPlanCompleted && (
                <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      Custom Work Task Templates ({effectiveSettings.customWorkTemplates.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const templates: CustomWorkTaskTemplate[] =
                          (effectiveSettings.customWorkTemplates as CustomWorkTaskTemplate[]) || [];
                        const toAdd = templates.filter(
                          (t: CustomWorkTaskTemplate) =>
                            !works.some(
                              (w: any) =>
                                String(w.title || "").trim().toLowerCase() ===
                                String(t.title || "").trim().toLowerCase()
                            )
                        );
                        if (toAdd.length === 0) {
                          toast.info("All custom task templates are already added to this plan.");
                          return;
                        }
                        const newWorks = [
                          ...works,
                          ...toAdd.map((t: CustomWorkTaskTemplate, i: number) => ({
                            sequence: works.length + i + 1,
                            title: t.title,
                            description: t.description || "",
                            planned_start_time: t.planned_start_time || "",
                            planned_end_time: t.planned_end_time || "",
                            work_type: t.work_type || "default",
                            is_template_task: true,
                            status: "created",
                          })),
                        ];
                        setWorks(newWorks);
                        toast.success(`Added ${toAdd.length} custom work task${toAdd.length > 1 ? "s" : ""}`);
                      }}
                      className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                    >
                      + Add All Templates
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {effectiveSettings.customWorkTemplates.map((t: CustomWorkTaskTemplate) => {
                      const isAdded = works.some(
                        (w: any) =>
                          String(w.title || "").trim().toLowerCase() ===
                          String(t.title || "").trim().toLowerCase()
                      );
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            if (isAdded) {
                              toast.info(`"${t.title}" is already added.`);
                              return;
                            }
                            setWorks((prev) => [
                              ...prev,
                              {
                                sequence: prev.length + 1,
                                title: t.title,
                                description: t.description || "",
                                planned_start_time: t.planned_start_time || "",
                                planned_end_time: t.planned_end_time || "",
                                work_type: t.work_type || "default",
                                is_template_task: true,
                                status: "created",
                              },
                            ]);
                            toast.success(`Added "${t.title}" to planned tasks`);
                          }}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                            isAdded
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 opacity-80"
                              : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-surface-muted"
                          }`}
                        >
                          {isAdded ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Plus className="h-3 w-3 text-primary" />
                          )}
                          <span className="font-semibold">{t.title}</span>
                          {t.planned_start_time && (
                            <span className="text-[10px] text-muted">
                              ({t.planned_start_time}{t.planned_end_time ? `-${t.planned_end_time}` : ""})
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            {works.length === 0 ? (
              <p className="text-xs text-muted py-3 text-center">
                No work tasks added yet. {isPlanCompleted ? "" : "Click \"Add Task\" to add tasks for this plan date."}
              </p>
            ) : (
              <div className="space-y-2">
                {works.map((w, idx) => {
                  const isDefaultTask = w.work_type === "default" || w.is_default_task;
                  const isManagerItem = !elevatedRole && isManagerCreatedItem(w);
                  const canRemove = !isDefaultTask && !isManagerItem;

                  return (
                    <div
                      key={idx}
                      className="flex items-start justify-between gap-2.5 rounded-lg border border-border bg-card p-3 shadow-2xs min-w-0"
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <Briefcase className="h-4 w-4 text-muted shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-foreground break-words">
                              {w.title}
                            </span>
                            {renderWorkStatusBadge(w.status)}
                            {w.work_type && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase shrink-0 ${
                                  w.work_type === "optional"
                                    ? "bg-amber-500/15 text-amber-500 border border-amber-500/20"
                                    : "bg-primary/15 text-primary border border-primary/20"
                                }`}
                              >
                                {w.work_type === "optional" ? "Optional" : "Default"}
                              </span>
                            )}
                          </div>
                          {w.description && (
                            <p className="text-[11px] text-muted line-clamp-2 break-words">{w.description}</p>
                          )}
                          {w.planned_start_time && (
                            <p className="text-[10px] text-muted flex items-center gap-1 font-medium mt-0.5">
                              <Clock className="h-3 w-3 shrink-0" />
                              {formatTime(w.planned_start_time)}
                            </p>
                          )}
                        </div>
                      </div>

                      {!isPlanCompleted && (
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingWorkIndex(idx);
                              setWorkModalOpen(true);
                            }}
                            className="rounded p-1 text-muted hover:bg-surface-muted hover:text-foreground"
                            title="Edit task"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          {canRemove ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveWork(idx)}
                              className="rounded p-1 text-muted hover:bg-rose-500/10 hover:text-rose-500"
                              title="Remove task"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="rounded p-1 text-muted/30 cursor-not-allowed opacity-50"
                              title={
                                isDefaultTask
                                  ? "Default task — cannot be removed"
                                  : "Created by Portal Admin / Manager — cannot be removed by Executive"
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Dynamic Embedded Section: Leave Banner */}
        {leaveType && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-1 text-xs">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold">
              <Calendar className="h-4 w-4" />
              <span>Leave Application</span>
            </div>
            <p className="text-muted">
              This plan will be submitted as leave for the selected date. No field visits or office tasks will be scheduled.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border">
          <div>
            {!isPlanCompleted && lastDraftSavedAt && (
              <span className="text-[11px] text-muted flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                Auto-saved in real time ({formatDraftTime(lastDraftSavedAt)})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <Link
              href="/dashboard/plans"
              className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
            >
              Cancel
            </Link>
            {!isPlanCompleted && (
              <button
                type="button"
                onClick={handleManualSaveDraft}
                disabled={submitting || checkingExisting}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card hover:bg-surface-muted px-4 py-2 text-xs font-semibold text-foreground transition shadow-2xs cursor-pointer"
              >
                <Save className="h-3.5 w-3.5 text-muted" />
                Save Draft
              </button>
            )}
            <button
              type="submit"
              disabled={submitting || checkingExisting || isPlanCompleted}
              className={`inline-flex items-center gap-2 rounded-lg px-5 py-2 text-xs font-bold text-white shadow-xs transition ${
                isPlanCompleted
                  ? "bg-gray-400 dark:bg-gray-700 cursor-not-allowed opacity-60"
                  : "bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
              }`}
            >
              {isPlanCompleted ? (
                <>
                  <Lock className="h-4 w-4" />
                  Completed (Locked)
                </>
              ) : isEditing ? (
                <>
                  <Mail className="h-4 w-4" />
                  {submitting ? "Updating…" : "Update & Mail"}
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  {submitting ? "Processing…" : "Create & Mail"}
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Embedded Modals for adding/editing visits and tasks */}
      {visitModalOpen && (
        <VisitFormModal
          open={visitModalOpen}
          mode={editingVisitIndex !== null ? "edit" : "create"}
          initial={editingVisitIndex !== null ? (visits[editingVisitIndex] as WorkPlanVisitRecord) : null}
          planDate={planDate}
          salesUserId={salesUserId || sessionUser?._id}
          planOwnerId={salesUserId || sessionUser?._id}
          defaultCountryId={countryId}
          defaultCountryName={countryName}
          defaultStateId={stateId}
          defaultStateName={stateName}
          defaultCityId={cityId}
          defaultCityName={cityName}
          defaultCityIds={selectedCityIds.length > 0 ? selectedCityIds : (cityId ? [cityId] : [])}
          defaultCityNames={selectedCityNames.length > 0 ? selectedCityNames : (cityName ? [cityName] : [])}
          isSaving={false}
          onClose={() => {
            setVisitModalOpen(false);
            setEditingVisitIndex(null);
          }}
          onSubmit={handleVisitSubmit}
        />
      )}

      {workModalOpen && (
        <WorkFormModal
          open={workModalOpen}
          mode={editingWorkIndex !== null ? "edit" : "create"}
          initial={editingWorkIndex !== null ? (works[editingWorkIndex] as WorkPlanWorkRecord) : null}
          planDate={planDate}
          salesUserId={salesUserId || sessionUser?._id}
          isSaving={false}
          onClose={() => {
            setWorkModalOpen(false);
            setEditingWorkIndex(null);
          }}
          onSubmit={handleWorkSubmit}
        />
      )}

      {createMailModalOpen && pendingPlanData && (
        <WorkPlanCreateMailModal
          planId={activePlanId || undefined}
          plan={pendingPlanData.displayPlan}
          sessionUser={sessionUser}
          isOpen={createMailModalOpen}
          isEditing={isEditing}
          onClose={() => {
            setCreateMailModalOpen(false);
          }}
          onCreateAndSend={handleCreateAndSendEmail}
          loading={submitting}
        />
      )}

      {previousModalMode && (
        <SelectPreviousPendingItemsModal
          open={Boolean(previousModalMode)}
          mode={previousModalMode}
          salesUserId={salesUserId || sessionUser?._id}
          excludeIds={
            previousModalMode === "visits"
              ? visits.map((v) => String(v._id || v.id || "")).filter(Boolean)
              : works.map((w) => String(w._id || w.id || "")).filter(Boolean)
          }
          onClose={() => setPreviousModalMode(null)}
          onAddItems={(selectedItems) => {
            if (previousModalMode === "visits") {
              setVisits((prev) => [...prev, ...selectedItems]);
            } else {
              setWorks((prev) => [...prev, ...selectedItems]);
            }
          }}
        />
      )}

      {importNotesMode && (
        <ImportNotesModal
          open={Boolean(importNotesMode)}
          mode={importNotesMode}
          onClose={() => setImportNotesMode(null)}
          onImportVisits={(newVisits, noteIds) => {
            setVisits((prev) => [...prev, ...(newVisits as WorkPlanVisitRecord[])]);
            setImportedNoteIds((prev) => [...new Set([...prev, ...noteIds])]);
            toast.success(`Imported ${newVisits.length} visit(s) with full details from Scratchpad`);
          }}
          onImportTasks={(newWorks, noteIds) => {
            const currentCount = works.length;
            const sequenced = newWorks.map((w, i) => ({
              ...w,
              sequence: currentCount + i + 1,
              status: w.status || "created",
            }));
            setWorks((prev) => [...prev, ...(sequenced as WorkPlanWorkRecord[])]);
            setImportedNoteIds((prev) => [...new Set([...prev, ...noteIds])]);
            toast.success(`Imported ${newWorks.length} task(s) with full details from Scratchpad`);
          }}
        />
      )}

      {deleteItemTarget && (
        <ConfirmDeleteModal
          open={Boolean(deleteItemTarget)}
          title={`Remove ${deleteItemTarget.type === "visit" ? "Visit" : "Task"}`}
          description={`Are you sure you want to remove "${deleteItemTarget.title}"? This will restore any associated notes back to your Scratchpad.`}
          confirmLabel="Remove"
          isDeleting={isDeletingItem}
          onClose={() => {
            if (!isDeletingItem) setDeleteItemTarget(null);
          }}
          onConfirm={handleConfirmDeleteItem}
        />
      )}
    </div>
  );
}

export default WorkPlanFormPage;
