"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Clock,
  Sparkles,
  Layers,
  Compass,
  FileText,
  Sliders,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  X,
  Edit2,
  ChevronDown,
  ChevronUp,
  Star,
  Upload,
  Calendar,
  Check,
  Search,
  RotateCcw,
  ShieldCheck,
  User,
  Eye,
  Settings,
  Hash,
  Type,
  ToggleLeft,
  CheckSquare,
  FileUp,
  SlidersHorizontal,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useGetUsersQuery } from "@/store/api/authApiSlice";
import {
  useGetUserTasksQuery,
  useUpdateUserTasksMutation,
  useGetUserVisitTemplateQuery,
  useUpdateUserVisitTemplateMutation,
} from "@/store/api/workPlannerApiSlice";
import {
  isWpAdmin,
  hasWorkPlannerPortalAccess,
  readSessionFromStorage,
} from "@/utils/authStorage";
import {
  countWords,
  type UserTaskDefinition,
  type TaskTemplateField,
  type TemplateFieldType,
} from "@/utils/userTaskTemplateSettings";
import {
  DEFAULT_PRESET_VISIT_TEMPLATE,
  type UserVisitTemplateDefinition,
} from "@/utils/userVisitTemplateSettings";

const FIELD_TYPES: { id: TemplateFieldType; label: string; icon: React.ElementType; description: string }[] = [
  { id: "text", label: "Single-line Text", icon: Type, description: "Short input with word/character limit" },
  { id: "textarea", label: "Multi-line Textarea", icon: FileText, description: "Detailed remarks or observations" },
  { id: "number", label: "Integer Number", icon: Hash, description: "Counts, quantities or units" },
  { id: "currency", label: "Currency (₹)", icon: Hash, description: "Financial figures or amounts in INR" },
  { id: "select", label: "Single Select Dropdown", icon: ChevronDown, description: "Choose one option from a list" },
  { id: "multi-select", label: "Multi-Select Tags", icon: CheckSquare, description: "Choose multiple tags or SKUs" },
  { id: "radio", label: "Radio Options", icon: CheckCircle2, description: "Single-choice radio buttons" },
  { id: "switch", label: "Toggle Switch", icon: ToggleLeft, description: "Yes / No or On / Off boolean flag" },
  { id: "date", label: "Date Picker", icon: Calendar, description: "Calendar date selector" },
  { id: "time", label: "Time Picker", icon: Clock, description: "Time selector (HH:MM)" },
  { id: "file", label: "File / Photo Attachment", icon: FileUp, description: "Upload bill, signed sheet or photo proof" },
  { id: "rating", label: "Star Rating (1-5)", icon: Star, description: "Performance or collaboration rating" },
  { id: "slider", label: "Range Slider", icon: SlidersHorizontal, description: "Numeric slider scale" },
  { id: "url", label: "Web Link / URL", icon: ExternalLink, description: "External URL reference" },
];

function getInitials(name: string): string {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface UserTemplatesConfigPageProps {
  userParam: string;
  initialTab?: "tasks" | "visits";
}

export function UserTemplatesConfigPage({
  userParam,
  initialTab = "tasks",
}: UserTemplatesConfigPageProps) {
  const router = useRouter();
  const sessionUser = useMemo(() => readSessionFromStorage()?.user, []);
  const adminAccess = isWpAdmin(sessionUser);

  const { data: usersData, isLoading: loadingUsers } = useGetUsersQuery(undefined, {
    skip: !adminAccess,
  });

  const portalUsers = useMemo(() => {
    if (!Array.isArray(usersData)) return [];
    return usersData.filter(hasWorkPlannerPortalAccess);
  }, [usersData]);

  // Target User lookup
  const targetUser = useMemo(() => {
    const rawParam = decodeURIComponent(userParam || "").toLowerCase().trim();
    if (!rawParam) return null;
    return (
      portalUsers.find((u: any) => {
        const uId = String(u._id || u.id || "").toLowerCase();
        const uEmail = String(u.email || "").toLowerCase();
        const uName = String(u.name || "").toLowerCase().replace(/\s+/g, "");
        const uUsername = String(u.username || "").toLowerCase();
        return uUsername === rawParam || uId === rawParam || uEmail === rawParam || uName === rawParam;
      }) || null
    );
  }, [portalUsers, userParam]);

  const targetIdentifier = useMemo(() => {
    if (targetUser) {
      return (targetUser as any).username || targetUser.email || targetUser._id || userParam;
    }
    return userParam;
  }, [targetUser, userParam]);

  // Active top-level module: "tasks" | "visits"
  const [activeModule, setActiveModule] = useState<"tasks" | "visits">(initialTab);

  // Sync initial tab when changed from props
  useEffect(() => {
    if (initialTab) {
      setActiveModule(initialTab);
    }
  }, [initialTab]);

  const handleSwitchModule = (mod: "tasks" | "visits") => {
    setActiveModule(mod);
    if (typeof window !== "undefined") {
      const newUrl = `/dashboard/settings/${encodeURIComponent(targetIdentifier)}/${mod}`;
      window.history.replaceState(null, "", newUrl);
    }
  };

  // -------------------------------------------------------------
  // TASKS DATA & STATE
  // -------------------------------------------------------------
  const [tasks, setTasks] = useState<UserTaskDefinition[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [taskSearch, setTaskSearch] = useState("");
  const [activeTaskEditorTab, setActiveTaskEditorTab] = useState<"basics" | "create_template" | "outcome_template" | "simulator">("basics");
  const [hasUnsavedTasks, setHasUnsavedTasks] = useState(false);

  const { data: backendTasksData, isLoading: loadingTasks } = useGetUserTasksQuery(targetIdentifier, {
    skip: !targetIdentifier,
  });
  const [updateUserTasksApi, { isLoading: isSavingTasks }] = useUpdateUserTasksMutation();

  useEffect(() => {
    if (backendTasksData?.tasks) {
      setTasks(backendTasksData.tasks);
      if (backendTasksData.tasks.length > 0) {
        setSelectedTaskId((prev) => (prev && backendTasksData.tasks.some((t: any) => t.id === prev) ? prev : backendTasksData.tasks[0].id));
      } else {
        setSelectedTaskId("");
      }
      setHasUnsavedTasks(false);
    }
  }, [backendTasksData]);

  const currentTask = useMemo(() => {
    return tasks.find((t) => t.id === selectedTaskId) || null;
  }, [tasks, selectedTaskId]);

  const filteredTasks = useMemo(() => {
    if (!taskSearch.trim()) return tasks;
    const q = taskSearch.toLowerCase();
    return tasks.filter((t) => t.title.toLowerCase().includes(q) || (t.category && t.category.toLowerCase().includes(q)));
  }, [tasks, taskSearch]);

  const handleUpdateCurrentTask = (updater: (prev: UserTaskDefinition) => UserTaskDefinition) => {
    if (!currentTask) return;
    setTasks((prev) =>
      prev.map((t) => (t.id === currentTask.id ? updater({ ...t, updatedAt: new Date().toISOString() }) : t))
    );
    setHasUnsavedTasks(true);
  };

  const handleSaveAllTasks = async () => {
    try {
      await updateUserTasksApi({
        userId: targetIdentifier,
        body: { tasks },
      }).unwrap();
      setHasUnsavedTasks(false);
      toast.success("User task templates saved!", {
        description: `Saved ${tasks.length} task configurations for ${targetUser?.name || targetIdentifier} to database.`,
      });
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to save tasks to backend");
    }
  };

  const handleCreateNewTask = () => {
    const newId = `task_${Date.now()}`;
    const newTask: UserTaskDefinition = {
      id: newId,
      title: "New Custom Work Task",
      category: "Field Operations",
      description: "Define instructions for the executive here.",
      isDefault: false,
      plannedStartTime: "10:00",
      plannedEndTime: "11:00",
      createTemplate: {
        enabled: true,
        title: "Task Planning Requirements",
        fields: [
          {
            id: `f_${Date.now()}_1`,
            key: "objective",
            label: "Primary Objective",
            type: "text",
            placeholder: "What needs to be achieved?",
            isRequired: true,
            wordLimit: 20,
          },
        ],
      },
      outcomeTemplate: {
        enabled: true,
        title: "Task Outcome & Completion Report",
        fields: [
          {
            id: `f_${Date.now()}_2`,
            key: "status",
            label: "Task Status",
            type: "select",
            isRequired: true,
            options: ["Completed", "Partially Done", "Postponed", "Cancelled"],
          },
          {
            id: `f_${Date.now()}_3`,
            key: "outcome_remarks",
            label: "Outcome Remarks & Next Steps",
            type: "textarea",
            isRequired: true,
            wordLimit: 100,
            placeholder: "Detailed completion notes...",
          },
        ],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setTasks((prev) => [newTask, ...prev]);
    setSelectedTaskId(newId);
    setHasUnsavedTasks(true);
    toast.success("New task created");
  };

  const handleDeleteTask = (taskId: string) => {
    if (tasks.length <= 1) {
      toast.error("At least one task definition must remain");
      return;
    }
    const updated = tasks.filter((t) => t.id !== taskId);
    setTasks(updated);
    if (selectedTaskId === taskId) {
      setSelectedTaskId(updated[0]?.id || "");
    }
    setHasUnsavedTasks(true);
    toast.info("Task removed");
  };

  // -------------------------------------------------------------
  // VISIT TEMPLATE DATA & STATE
  // -------------------------------------------------------------
  const [visitTemplate, setVisitTemplate] = useState<UserVisitTemplateDefinition | null>(null);
  const [activeVisitEditorTab, setActiveVisitEditorTab] = useState<"create_template" | "outcome_template" | "simulator">("create_template");
  const [hasUnsavedVisits, setHasUnsavedVisits] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  const { data: backendVisitData, isLoading: loadingVisit } = useGetUserVisitTemplateQuery(targetIdentifier, {
    skip: !targetIdentifier,
  });
  const [updateUserVisitTemplateApi, { isLoading: isSavingVisitTemplate }] = useUpdateUserVisitTemplateMutation();

  useEffect(() => {
    if (backendVisitData) {
      setVisitTemplate(backendVisitData);
      setHasUnsavedVisits(false);
    }
  }, [backendVisitData]);

  const handleUpdateVisitTemplate = (updater: (prev: UserVisitTemplateDefinition) => UserVisitTemplateDefinition) => {
    if (!visitTemplate) return;
    setVisitTemplate((prev) => (prev ? updater({ ...prev, updatedAt: new Date().toISOString() }) : prev));
    setHasUnsavedVisits(true);
  };

  const handleSaveVisitTemplate = async () => {
    if (!visitTemplate) return;
    try {
      await updateUserVisitTemplateApi({
        userId: targetIdentifier,
        body: visitTemplate,
      }).unwrap();
      setHasUnsavedVisits(false);
      toast.success("Visit template saved!", {
        description: `Field visit template for ${targetUser?.name || targetIdentifier} saved to database.`,
      });
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to save visit template");
    }
  };

  const handleResetVisitDefaults = () => {
    const reset: UserVisitTemplateDefinition = {
      ...DEFAULT_PRESET_VISIT_TEMPLATE,
      userIdOrUsername: targetIdentifier,
      updatedAt: new Date().toISOString(),
    };
    setVisitTemplate(reset);
    setHasUnsavedVisits(true);
    setShowResetModal(false);
    toast.success("Reset to factory defaults! Remember to click Save.");
  };

  // -------------------------------------------------------------
  // SHARED DYNAMIC FIELD MODAL STATE
  // -------------------------------------------------------------
  const [fieldModalOpen, setFieldModalOpen] = useState(false);
  const [modalTargetModule, setModalTargetModule] = useState<"tasks" | "visits">("tasks");
  const [modalTargetPhase, setModalTargetPhase] = useState<"create" | "outcome">("create");
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldKey, setFieldKey] = useState("");
  const [fieldType, setFieldType] = useState<TemplateFieldType>("text");
  const [fieldPlaceholder, setFieldPlaceholder] = useState("");
  const [fieldHelpText, setFieldHelpText] = useState("");
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldWordLimit, setFieldWordLimit] = useState<number | undefined>(undefined);
  const [fieldMin, setFieldMin] = useState<number | undefined>(undefined);
  const [fieldMax, setFieldMax] = useState<number | undefined>(undefined);
  const [fieldOptions, setFieldOptions] = useState<string[]>([]);
  const [newOptionInput, setNewOptionInput] = useState("");

  const handleOpenAddField = (targetMod: "tasks" | "visits", phase: "create" | "outcome") => {
    setModalTargetModule(targetMod);
    setModalTargetPhase(phase);
    setEditingFieldId(null);
    setFieldLabel("");
    setFieldKey("");
    setFieldType("text");
    setFieldPlaceholder("");
    setFieldHelpText("");
    setFieldRequired(false);
    setFieldWordLimit(undefined);
    setFieldMin(undefined);
    setFieldMax(undefined);
    setFieldOptions(["Option 1", "Option 2"]);
    setNewOptionInput("");
    setFieldModalOpen(true);
  };

  const handleOpenEditField = (
    targetMod: "tasks" | "visits",
    phase: "create" | "outcome",
    field: TaskTemplateField
  ) => {
    setModalTargetModule(targetMod);
    setModalTargetPhase(phase);
    setEditingFieldId(field.id);
    setFieldLabel(field.label);
    setFieldKey(field.key);
    setFieldType(field.type);
    setFieldPlaceholder(field.placeholder || "");
    setFieldHelpText(field.helpText || "");
    setFieldRequired(field.isRequired);
    setFieldWordLimit(field.wordLimit);
    setFieldMin(field.min);
    setFieldMax(field.max);
    setFieldOptions(field.options ? [...field.options] : []);
    setNewOptionInput("");
    setFieldModalOpen(true);
  };

  const handleSaveField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldLabel.trim()) {
      toast.error("Field label is required");
      return;
    }
    const cleanKey = fieldKey.trim() || fieldLabel.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 30);

    const fieldData: TaskTemplateField = {
      id: editingFieldId || `f_${Date.now()}`,
      label: fieldLabel.trim(),
      key: cleanKey,
      type: fieldType,
      placeholder: fieldPlaceholder.trim() || undefined,
      helpText: fieldHelpText.trim() || undefined,
      isRequired: fieldRequired,
      wordLimit: fieldWordLimit ? Number(fieldWordLimit) : undefined,
      min: fieldMin !== undefined ? Number(fieldMin) : undefined,
      max: fieldMax !== undefined ? Number(fieldMax) : undefined,
      options: ["select", "multi-select", "radio"].includes(fieldType) ? fieldOptions : undefined,
    };

    if (modalTargetModule === "tasks") {
      handleUpdateCurrentTask((t) => {
        const template = modalTargetPhase === "create" ? t.createTemplate : t.outcomeTemplate;
        let newFields: TaskTemplateField[];
        if (editingFieldId) {
          newFields = template.fields.map((f) => (f.id === editingFieldId ? fieldData : f));
        } else {
          newFields = [...template.fields, fieldData];
        }

        if (modalTargetPhase === "create") {
          return { ...t, createTemplate: { ...t.createTemplate, fields: newFields } };
        } else {
          return { ...t, outcomeTemplate: { ...t.outcomeTemplate, fields: newFields } };
        }
      });
    } else {
      handleUpdateVisitTemplate((vt) => {
        const template = modalTargetPhase === "create" ? vt.createTemplate : vt.outcomeTemplate;
        let newFields: TaskTemplateField[];
        if (editingFieldId) {
          newFields = template.fields.map((f) => (f.id === editingFieldId ? fieldData : f));
        } else {
          newFields = [...template.fields, fieldData];
        }

        if (modalTargetPhase === "create") {
          return { ...vt, createTemplate: { ...vt.createTemplate, fields: newFields } };
        } else {
          return { ...vt, outcomeTemplate: { ...vt.outcomeTemplate, fields: newFields } };
        }
      });
    }

    setFieldModalOpen(false);
    toast.success(editingFieldId ? "Field updated" : "Field added to template");
  };

  const handleDeleteField = (targetMod: "tasks" | "visits", phase: "create" | "outcome", fieldId: string) => {
    if (targetMod === "tasks") {
      handleUpdateCurrentTask((t) => {
        if (phase === "create") {
          return {
            ...t,
            createTemplate: {
              ...t.createTemplate,
              fields: t.createTemplate.fields.filter((f) => f.id !== fieldId),
            },
          };
        } else {
          return {
            ...t,
            outcomeTemplate: {
              ...t.outcomeTemplate,
              fields: t.outcomeTemplate.fields.filter((f) => f.id !== fieldId),
            },
          };
        }
      });
    } else {
      handleUpdateVisitTemplate((vt) => {
        if (phase === "create") {
          return {
            ...vt,
            createTemplate: {
              ...vt.createTemplate,
              fields: vt.createTemplate.fields.filter((f) => f.id !== fieldId),
            },
          };
        } else {
          return {
            ...vt,
            outcomeTemplate: {
              ...vt.outcomeTemplate,
              fields: vt.outcomeTemplate.fields.filter((f) => f.id !== fieldId),
            },
          };
        }
      });
    }
    toast.info("Field removed");
  };

  const handleMoveField = (
    targetMod: "tasks" | "visits",
    phase: "create" | "outcome",
    index: number,
    direction: "up" | "down"
  ) => {
    const newIdx = direction === "up" ? index - 1 : index + 1;

    if (targetMod === "tasks") {
      if (!currentTask) return;
      const template = phase === "create" ? currentTask.createTemplate : currentTask.outcomeTemplate;
      if (newIdx < 0 || newIdx >= template.fields.length) return;

      const list = [...template.fields];
      const [moved] = list.splice(index, 1);
      list.splice(newIdx, 0, moved);

      handleUpdateCurrentTask((t) => {
        if (phase === "create") {
          return { ...t, createTemplate: { ...t.createTemplate, fields: list } };
        } else {
          return { ...t, outcomeTemplate: { ...t.outcomeTemplate, fields: list } };
        }
      });
    } else {
      if (!visitTemplate) return;
      const template = phase === "create" ? visitTemplate.createTemplate : visitTemplate.outcomeTemplate;
      if (newIdx < 0 || newIdx >= template.fields.length) return;

      const list = [...template.fields];
      const [moved] = list.splice(index, 1);
      list.splice(newIdx, 0, moved);

      handleUpdateVisitTemplate((vt) => {
        if (phase === "create") {
          return { ...vt, createTemplate: { ...vt.createTemplate, fields: list } };
        } else {
          return { ...vt, outcomeTemplate: { ...vt.outcomeTemplate, fields: list } };
        }
      });
    }
  };

  const handleAddOption = () => {
    if (!newOptionInput.trim()) return;
    if (fieldOptions.includes(newOptionInput.trim())) {
      toast.error("Option already exists");
      return;
    }
    setFieldOptions([...fieldOptions, newOptionInput.trim()]);
    setNewOptionInput("");
  };

  const handleRemoveOption = (opt: string) => {
    setFieldOptions(fieldOptions.filter((o) => o !== opt));
  };

  // -------------------------------------------------------------
  // SIMULATOR STATE
  // -------------------------------------------------------------
  const [taskSimPhase, setTaskSimPhase] = useState<"create" | "outcome">("create");
  const [taskSimValues, setTaskSimValues] = useState<Record<string, any>>({});
  const [taskSimErrors, setTaskSimErrors] = useState<Record<string, string>>({});

  const [visitSimPhase, setVisitSimPhase] = useState<"create" | "outcome">("create");
  const [visitSimValues, setVisitSimValues] = useState<Record<string, any>>({});
  const [visitSimErrors, setVisitSimErrors] = useState<Record<string, string>>({});

  const handleSimulateTaskSubmit = () => {
    if (!currentTask) return;
    const fields = taskSimPhase === "create" ? currentTask.createTemplate.fields : currentTask.outcomeTemplate.fields;
    const errs: Record<string, string> = {};

    fields.forEach((f) => {
      const val = taskSimValues[f.key];
      if (f.isRequired) {
        if (val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0)) {
          errs[f.key] = `${f.label} is required.`;
        }
      }
      if (typeof val === "string" && f.wordLimit && f.wordLimit > 0) {
        const words = countWords(val);
        if (words > f.wordLimit) {
          errs[f.key] = `Word limit exceeded (${words}/${f.wordLimit} words).`;
        }
      }
    });

    setTaskSimErrors(errs);
    if (Object.keys(errs).length === 0) {
      toast.success("Validation Passed! Task template functioning correctly.", {
        description: "All word limits and required constraints satisfied.",
      });
    } else {
      toast.error(`Validation Failed: ${Object.keys(errs).length} issues found`);
    }
  };

  const handleSimulateVisitSubmit = () => {
    if (!visitTemplate) return;
    const fields = visitSimPhase === "create" ? visitTemplate.createTemplate.fields : visitTemplate.outcomeTemplate.fields;
    const errs: Record<string, string> = {};

    fields.forEach((f) => {
      const val = visitSimValues[f.key];
      if (f.isRequired) {
        if (val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0)) {
          errs[f.key] = `${f.label} is required.`;
        }
      }
      if (typeof val === "string" && f.wordLimit && f.wordLimit > 0) {
        const words = countWords(val);
        if (words > f.wordLimit) {
          errs[f.key] = `Word limit exceeded (${words}/${f.wordLimit} words).`;
        }
      }
    });

    setVisitSimErrors(errs);
    if (Object.keys(errs).length === 0) {
      toast.success("Validation Passed! Visit template functioning correctly.", {
        description: "All word limits and required constraints satisfied.",
      });
    } else {
      toast.error(`Validation Failed: ${Object.keys(errs).length} issues found`);
    }
  };

  if (!adminAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] p-6 text-center animate-fade-in">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-500/10 text-amber-500 mb-5 border border-amber-500/20 shadow-xl shadow-amber-500/5">
          <ShieldCheck className="h-10 w-10" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-rose-500 text-xs font-bold uppercase tracking-wider mb-2 border border-rose-500/20">
          Admin Portal Only
        </div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Access Restricted</h2>
        <p className="mt-2 text-sm text-muted max-w-md leading-relaxed">
          Configuring custom user task &amp; visit templates is restricted to Work Planner Portal Administrators.
        </p>
        <Link
          href="/dashboard/settings"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-95 transition shadow-sm"
        >
          Return to Settings
        </Link>
      </div>
    );
  }

  const visitCreateCount = visitTemplate?.createTemplate.fields.length || 0;
  const visitOutcomeCount = visitTemplate?.outcomeTemplate.fields.length || 0;

  return (
    <div className="space-y-6 font-sans pb-28 max-w-7xl mx-auto">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/settings"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-muted hover:text-foreground hover:bg-surface-muted transition shadow-2xs"
            title="Back to Portal Settings"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-muted">
              <Link href="/dashboard/settings" className="hover:text-primary transition">
                Portal Settings
              </Link>
              <span>/</span>
              <span className="text-foreground">
                {activeModule === "tasks" ? "Custom Tasks" : "Visit Template"}
              </span>
              <span>/</span>
              <span className="text-primary font-bold">{targetUser?.name || targetIdentifier}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight mt-0.5">
              User Tasks &amp; Visits Designer
            </h1>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          {activeModule === "tasks" ? (
            <>
              <button
                type="button"
                onClick={handleCreateNewTask}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground hover:bg-surface-muted transition shadow-2xs"
              >
                <Plus className="h-4 w-4 text-primary" />
                <span>New Task</span>
              </button>
              <button
                type="button"
                disabled={isSavingTasks}
                onClick={handleSaveAllTasks}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 active:scale-98 transition disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>{isSavingTasks ? "Saving..." : "Save Tasks"}</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setShowResetModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs font-bold text-rose-500 hover:bg-rose-500/10 transition shadow-2xs"
                title="Reset to Factory Defaults"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="hidden sm:inline">Reset Defaults</span>
              </button>
              <button
                type="button"
                disabled={isSavingVisitTemplate || !visitTemplate}
                onClick={handleSaveVisitTemplate}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-98 transition disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>{isSavingVisitTemplate ? "Saving..." : "Save Visit Template"}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Target User Banner Card with Live Counters */}
      <div className="rounded-3xl border border-border bg-gradient-to-r from-card via-card to-primary/5 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 font-extrabold text-white text-base shadow-sm">
              {getInitials(targetUser?.name || targetIdentifier)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-foreground truncate">
                  {targetUser?.name || targetIdentifier}
                </h2>
                <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[9px] font-extrabold uppercase text-primary">
                  {(targetUser as any)?.wp_role || "Executive"}
                </span>

                {hasUnsavedTasks && (
                  <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400 animate-pulse">
                    Unsaved Tasks
                  </span>
                )}
                {hasUnsavedVisits && (
                  <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 animate-pulse">
                    Unsaved Visit Template
                  </span>
                )}
              </div>
              <p className="text-xs text-muted truncate mt-0.5">
                {targetUser?.email || "No email"} • {targetUser?.department || "Field Staff"}
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2.5 shrink-0 text-xs text-muted">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-center">
              <span className="block text-[10px] uppercase font-bold text-primary">Tasks</span>
              <span className="text-sm font-black text-foreground">{tasks.length}</span>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-1.5 text-center">
              <span className="block text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">
                Visit Template
              </span>
              <span className="text-sm font-black text-foreground">
                {visitTemplate ? `${visitCreateCount}P • ${visitOutcomeCount}O` : "Default"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* UNIFIED MODULE TABS: Tasks vs Visits */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-1">
        <button
          type="button"
          onClick={() => handleSwitchModule("tasks")}
          className={`flex items-center gap-2.5 rounded-2xl px-5 py-3 text-xs font-bold transition border ${
            activeModule === "tasks"
              ? "bg-primary/15 border-primary/30 text-primary shadow-xs"
              : "border-transparent text-muted hover:bg-surface-muted hover:text-foreground"
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Custom Tasks Catalog</span>
          <span className="rounded-full bg-primary/20 text-primary px-2 py-0.5 text-[10px] font-extrabold">
            {tasks.length} Tasks
          </span>
          {hasUnsavedTasks && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />}
        </button>

        <button
          type="button"
          onClick={() => handleSwitchModule("visits")}
          className={`flex items-center gap-2.5 rounded-2xl px-5 py-3 text-xs font-bold transition border ${
            activeModule === "visits"
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-xs"
              : "border-transparent text-muted hover:bg-surface-muted hover:text-foreground"
          }`}
        >
          <Compass className="h-4 w-4" />
          <span>Single Visit Template</span>
          <span className="rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-extrabold">
            {visitCreateCount} Plan • {visitOutcomeCount} Outcome
          </span>
          {hasUnsavedVisits && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />}
        </button>
      </div>

      {/* ========================================================= */}
      {/* MODULE 1: CUSTOM TASKS CATALOG DESIGNER */}
      {/* ========================================================= */}
      {activeModule === "tasks" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          {/* Left Column: Tasks Navigation List */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                Assigned Tasks ({tasks.length})
              </span>
              <button
                type="button"
                onClick={handleCreateNewTask}
                className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>

            {/* Search Tasks */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted" />
              <input
                type="text"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                placeholder="Filter tasks by name..."
                className="w-full rounded-2xl border border-border bg-card pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>

            {/* Task Cards List */}
            <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
              {filteredTasks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted">
                  No matching tasks found.
                </div>
              ) : (
                filteredTasks.map((t) => {
                  const isSelected = t.id === selectedTaskId;
                  const createCount = t.createTemplate.fields.length;
                  const outcomeCount = t.outcomeTemplate.fields.length;
                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTaskId(t.id)}
                      className={`group relative rounded-2xl border p-3.5 cursor-pointer transition ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-xs"
                          : "border-border bg-card hover:border-border/80 hover:bg-surface-muted/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-xs font-bold text-foreground leading-snug truncate">
                              {t.title}
                            </h4>
                            {t.isDefault && (
                              <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2 text-[8px] font-extrabold uppercase text-emerald-600">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted truncate mt-0.5">
                            {t.category || "General"} • {t.plannedStartTime || "Anytime"} - {t.plannedEndTime || "Anytime"}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTask(t.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-muted hover:text-rose-500 p-1 rounded-lg transition"
                          title="Delete Task"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="mt-2.5 flex items-center gap-2 text-[10px] font-semibold text-muted pt-2 border-t border-border/50">
                        <span className="flex items-center gap-1">
                          <Layers className="h-3 w-3 text-primary" />
                          {createCount} Planning Fields
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          {outcomeCount} Outcome Fields
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Task Editor Workspace */}
          <div className="lg:col-span-8 space-y-4">
            {currentTask ? (
              <div className="rounded-3xl border border-border bg-card shadow-xs overflow-hidden">
                {/* Task Header & Tab Navigation */}
                <div className="p-4 sm:p-5 border-b border-border bg-surface-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Editing Task</span>
                      <span className="text-muted">•</span>
                      <span className="text-xs font-semibold text-muted">{currentTask.category || "General"}</span>
                    </div>
                    <h3 className="text-base font-bold text-foreground truncate mt-0.5">{currentTask.title}</h3>
                  </div>

                  {/* Sub-tabs */}
                  <div className="flex items-center gap-1 rounded-xl bg-card border border-border p-1 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setActiveTaskEditorTab("basics")}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        activeTaskEditorTab === "basics"
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      Basics
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTaskEditorTab("create_template")}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition flex items-center gap-1 ${
                        activeTaskEditorTab === "create_template"
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      Create Template
                      <span className="rounded-full bg-primary-foreground/20 px-1 text-[9px]">
                        {currentTask.createTemplate.fields.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTaskEditorTab("outcome_template")}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition flex items-center gap-1 ${
                        activeTaskEditorTab === "outcome_template"
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      Outcome Template
                      <span className="rounded-full bg-primary-foreground/20 px-1 text-[9px]">
                        {currentTask.outcomeTemplate.fields.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTaskEditorTab("simulator")}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition flex items-center gap-1 ${
                        activeTaskEditorTab === "simulator"
                          ? "bg-purple-600 text-white shadow-xs"
                          : "text-muted hover:text-purple-600"
                      }`}
                    >
                      <Eye className="h-3 w-3" />
                      Preview
                    </button>
                  </div>
                </div>

                {/* SUBTAB 1: BASICS */}
                {activeTaskEditorTab === "basics" && (
                  <div className="p-6 space-y-5 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1.5">Task Title / Name</label>
                        <input
                          type="text"
                          value={currentTask.title}
                          onChange={(e) => handleUpdateCurrentTask((t) => ({ ...t, title: e.target.value }))}
                          className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1.5">Category</label>
                        <input
                          type="text"
                          value={currentTask.category || ""}
                          onChange={(e) => handleUpdateCurrentTask((t) => ({ ...t, category: e.target.value }))}
                          placeholder="e.g. Field Operations, Audit, Doctor Briefing"
                          className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1.5">Default Start Time</label>
                        <input
                          type="time"
                          value={currentTask.plannedStartTime || ""}
                          onChange={(e) => handleUpdateCurrentTask((t) => ({ ...t, plannedStartTime: e.target.value }))}
                          className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1.5">Default End Time</label>
                        <input
                          type="time"
                          value={currentTask.plannedEndTime || ""}
                          onChange={(e) => handleUpdateCurrentTask((t) => ({ ...t, plannedEndTime: e.target.value }))}
                          className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                        />
                      </div>

                      <div className="flex flex-col justify-end">
                        <div className="flex items-center justify-between rounded-xl border border-border bg-surface-muted/40 p-2.5">
                          <div>
                            <span className="text-xs font-bold text-foreground">Auto-Include</span>
                            <p className="text-[10px] text-muted">Include in daily plan by default</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={currentTask.isDefault}
                              onChange={(e) => handleUpdateCurrentTask((t) => ({ ...t, isDefault: e.target.checked }))}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-surface-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">
                        Instructions &amp; Description for Executive
                      </label>
                      <textarea
                        rows={3}
                        value={currentTask.description || ""}
                        onChange={(e) => handleUpdateCurrentTask((t) => ({ ...t, description: e.target.value }))}
                        placeholder="Explain what the field executive is expected to do for this task..."
                        className="w-full rounded-xl border border-border bg-surface-muted p-3 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* SUBTAB 2 & 3: TEMPLATE BUILDERS (CREATE / OUTCOME) */}
                {(activeTaskEditorTab === "create_template" || activeTaskEditorTab === "outcome_template") && (
                  <div className="p-6 space-y-5 animate-fade-in">
                    {(() => {
                      const phase = activeTaskEditorTab === "create_template" ? "create" : "outcome";
                      const template = phase === "create" ? currentTask.createTemplate : currentTask.outcomeTemplate;

                      return (
                        <>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
                            <div>
                              <h4 className="text-xs font-bold text-foreground">
                                {phase === "create"
                                  ? "Task Planning Inputs (Create Phase)"
                                  : "Task Completion & Reporting Inputs (Outcome Phase)"}
                              </h4>
                              <p className="text-[11px] text-muted">
                                {phase === "create"
                                  ? "Fields executive must provide when adding or planning this task."
                                  : "Fields executive must provide when completing the task and recording results."}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenAddField("tasks", phase)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 transition shadow-2xs self-start sm:self-auto"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span>Add Field</span>
                            </button>
                          </div>

                          {/* Fields List */}
                          {template.fields.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-border p-8 text-center space-y-2">
                              <p className="text-xs font-bold text-foreground">No custom fields defined yet</p>
                              <p className="text-[11px] text-muted">
                                Click &ldquo;Add Field&rdquo; to add text inputs, dropdowns, attachments, or ratings.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2.5">
                              {template.fields.map((f, idx) => {
                                const typeInfo = FIELD_TYPES.find((t) => t.id === f.type) || FIELD_TYPES[0];
                                const TypeIcon = typeInfo.icon;
                                return (
                                  <div
                                    key={f.id}
                                    className="rounded-2xl border border-border bg-surface-muted/30 p-3.5 flex items-center justify-between gap-3 transition hover:border-border/80"
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                        <TypeIcon className="h-4 w-4" />
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-bold text-foreground truncate">{f.label}</span>
                                          {f.isRequired ? (
                                            <span className="text-[9px] font-extrabold text-rose-500 bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/20">
                                              Required
                                            </span>
                                          ) : (
                                            <span className="text-[9px] font-semibold text-muted bg-surface-muted px-1.5 py-0.2 rounded">
                                              Optional
                                            </span>
                                          )}
                                          {f.wordLimit && (
                                            <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                                              Max {f.wordLimit} Words
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-[10px] text-muted truncate mt-0.5">
                                          key: <code className="text-primary font-mono">{f.key}</code> • Type: {typeInfo.label}
                                          {f.options ? ` • ${f.options.length} options` : ""}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Field Action Controls */}
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        disabled={idx === 0}
                                        onClick={() => handleMoveField("tasks", phase, idx, "up")}
                                        className="p-1 rounded-lg text-muted hover:text-foreground disabled:opacity-20 transition"
                                        title="Move Up"
                                      >
                                        <ChevronUp className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={idx === template.fields.length - 1}
                                        onClick={() => handleMoveField("tasks", phase, idx, "down")}
                                        className="p-1 rounded-lg text-muted hover:text-foreground disabled:opacity-20 transition"
                                        title="Move Down"
                                      >
                                        <ChevronDown className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditField("tasks", phase, f)}
                                        className="p-1 rounded-lg text-muted hover:text-primary transition"
                                        title="Edit Field"
                                      >
                                        <Edit2 className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteField("tasks", phase, f.id)}
                                        className="p-1 rounded-lg text-muted hover:text-rose-500 transition"
                                        title="Delete Field"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* SUBTAB 4: INTERACTIVE SIMULATOR */}
                {activeTaskEditorTab === "simulator" && (
                  <div className="p-6 space-y-6 animate-fade-in">
                    <div className="flex items-center justify-between pb-3 border-b border-border">
                      <div>
                        <h4 className="text-xs font-bold text-foreground">Interactive Task Form Simulator</h4>
                        <p className="text-[11px] text-muted">
                          Test how this custom task behaves when filled out in the field.
                        </p>
                      </div>

                      <div className="flex items-center gap-1 rounded-xl bg-surface-muted p-1 border border-border">
                        <button
                          type="button"
                          onClick={() => {
                            setTaskSimPhase("create");
                            setTaskSimErrors({});
                          }}
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                            taskSimPhase === "create"
                              ? "bg-primary text-primary-foreground shadow-2xs"
                              : "text-muted hover:text-foreground"
                          }`}
                        >
                          Create Form
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTaskSimPhase("outcome");
                            setTaskSimErrors({});
                          }}
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                            taskSimPhase === "outcome"
                              ? "bg-primary text-primary-foreground shadow-2xs"
                              : "text-muted hover:text-foreground"
                          }`}
                        >
                          Outcome Form
                        </button>
                      </div>
                    </div>

                    {/* Simulator Form */}
                    {(() => {
                      const fields =
                        taskSimPhase === "create"
                          ? currentTask.createTemplate.fields
                          : currentTask.outcomeTemplate.fields;

                      if (fields.length === 0) {
                        return (
                          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted">
                            No fields defined in this phase.
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-4 max-w-xl mx-auto rounded-3xl border border-border bg-card p-6 shadow-sm">
                          <div className="border-b border-border pb-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                              {taskSimPhase === "create" ? "Planning Mode" : "Reporting Outcome"}
                            </span>
                            <h3 className="text-sm font-bold text-foreground mt-0.5">{currentTask.title}</h3>
                            <p className="text-xs text-muted mt-1">{currentTask.description}</p>
                          </div>

                          {fields.map((field) => {
                            const val = taskSimValues[field.key] ?? field.defaultValue ?? "";
                            const error = taskSimErrors[field.key];
                            const wordCount = typeof val === "string" ? countWords(val) : 0;
                            const isWordExceeded = Boolean(field.wordLimit && wordCount > field.wordLimit);

                            return (
                              <div key={field.id} className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-semibold text-foreground">
                                    {field.label} {field.isRequired && <span className="text-rose-500">*</span>}
                                  </label>
                                  {field.wordLimit && (
                                    <span
                                      className={`text-[10px] font-bold ${
                                        isWordExceeded ? "text-rose-500" : "text-muted"
                                      }`}
                                    >
                                      {wordCount} / {field.wordLimit} words
                                    </span>
                                  )}
                                </div>

                                {field.type === "text" && (
                                  <input
                                    type="text"
                                    value={val}
                                    onChange={(e) => setTaskSimValues({ ...taskSimValues, [field.key]: e.target.value })}
                                    placeholder={field.placeholder || "Enter text..."}
                                    className={`w-full rounded-xl border bg-surface-muted px-3.5 py-2 text-xs font-medium text-foreground focus:outline-none ${
                                      error || isWordExceeded ? "border-rose-500" : "border-border focus:border-primary"
                                    }`}
                                  />
                                )}

                                {field.type === "textarea" && (
                                  <textarea
                                    rows={3}
                                    value={val}
                                    onChange={(e) => setTaskSimValues({ ...taskSimValues, [field.key]: e.target.value })}
                                    placeholder={field.placeholder || "Enter detailed remarks..."}
                                    className={`w-full rounded-xl border bg-surface-muted p-3 text-xs font-medium text-foreground focus:outline-none ${
                                      error || isWordExceeded ? "border-rose-500" : "border-border focus:border-primary"
                                    }`}
                                  />
                                )}

                                {(field.type === "number" || field.type === "currency") && (
                                  <div className="relative">
                                    {field.type === "currency" && (
                                      <span className="absolute left-3 top-2 text-xs font-bold text-muted">₹</span>
                                    )}
                                    <input
                                      type="number"
                                      value={val}
                                      min={field.min}
                                      max={field.max}
                                      onChange={(e) => setTaskSimValues({ ...taskSimValues, [field.key]: e.target.value })}
                                      placeholder={field.placeholder || "0"}
                                      className={`w-full rounded-xl border bg-surface-muted py-2 text-xs font-medium text-foreground focus:outline-none ${
                                        field.type === "currency" ? "pl-7 pr-3" : "px-3.5"
                                      } ${error ? "border-rose-500" : "border-border focus:border-primary"}`}
                                    />
                                  </div>
                                )}

                                {field.type === "select" && (
                                  <select
                                    value={val}
                                    onChange={(e) => setTaskSimValues({ ...taskSimValues, [field.key]: e.target.value })}
                                    className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                                  >
                                    <option value="">Select option...</option>
                                    {(field.options || []).map((opt) => (
                                      <option key={opt} value={opt}>
                                        {opt}
                                      </option>
                                    ))}
                                  </select>
                                )}

                                {field.type === "multi-select" && (
                                  <div className="flex flex-wrap gap-1.5 pt-1">
                                    {(field.options || []).map((opt) => {
                                      const selectedArr: string[] = Array.isArray(val) ? val : [];
                                      const isSel = selectedArr.includes(opt);
                                      return (
                                        <button
                                          key={opt}
                                          type="button"
                                          onClick={() => {
                                            const next = isSel ? selectedArr.filter((o) => o !== opt) : [...selectedArr, opt];
                                            setTaskSimValues({ ...taskSimValues, [field.key]: next });
                                          }}
                                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition ${
                                            isSel
                                              ? "bg-primary text-primary-foreground border-primary"
                                              : "bg-surface-muted text-muted border-border hover:text-foreground"
                                          }`}
                                        >
                                          {opt}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}

                                {field.type === "radio" && (
                                  <div className="space-y-1.5 pt-1">
                                    {(field.options || []).map((opt) => (
                                      <label key={opt} className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                                        <input
                                          type="radio"
                                          name={field.key}
                                          value={opt}
                                          checked={val === opt}
                                          onChange={() => setTaskSimValues({ ...taskSimValues, [field.key]: opt })}
                                          className="h-3.5 w-3.5 text-primary border-border focus:ring-primary cursor-pointer"
                                        />
                                        <span>{opt}</span>
                                      </label>
                                    ))}
                                  </div>
                                )}

                                {field.type === "switch" && (
                                  <div className="flex items-center gap-3 pt-1">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(val)}
                                        onChange={(e) => setTaskSimValues({ ...taskSimValues, [field.key]: e.target.checked })}
                                        className="sr-only peer"
                                      />
                                      <div className="w-10 h-5 bg-surface-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                    </label>
                                    <span className="text-xs font-semibold text-foreground">
                                      {val ? "Yes / Confirmed" : "No / Not Applicable"}
                                    </span>
                                  </div>
                                )}

                                {field.type === "rating" && (
                                  <div className="flex items-center gap-1.5 pt-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <button
                                        key={star}
                                        type="button"
                                        onClick={() => setTaskSimValues({ ...taskSimValues, [field.key]: star })}
                                        className={`p-1 rounded-md transition ${
                                          (Number(val) || 0) >= star ? "text-amber-400" : "text-muted/40 hover:text-muted"
                                        }`}
                                      >
                                        <Star className="h-5 w-5 fill-current" />
                                      </button>
                                    ))}
                                    <span className="text-xs font-bold text-foreground ml-2">{val || 0} / 5</span>
                                  </div>
                                )}

                                {field.type === "file" && (
                                  <div className="rounded-xl border border-dashed border-border bg-surface-muted/40 p-4 text-center">
                                    <Upload className="h-5 w-5 text-muted mx-auto mb-1" />
                                    <p className="text-xs font-semibold text-foreground">Click to upload or drag file</p>
                                    <p className="text-[10px] text-muted">Supports images, PDF documents up to 10MB</p>
                                  </div>
                                )}

                                {(field.type === "date" || field.type === "time") && (
                                  <input
                                    type={field.type}
                                    value={val}
                                    onChange={(e) => setTaskSimValues({ ...taskSimValues, [field.key]: e.target.value })}
                                    className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                                  />
                                )}

                                {field.helpText && <p className="text-[10px] text-muted">{field.helpText}</p>}
                                {error && <p className="text-[10px] font-bold text-rose-500">{error}</p>}
                              </div>
                            );
                          })}

                          <div className="pt-4 border-t border-border flex justify-end">
                            <button
                              type="button"
                              onClick={handleSimulateTaskSubmit}
                              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700 transition shadow-xs"
                            >
                              <Check className="h-4 w-4" />
                              <span>Validate &amp; Test Submit</span>
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-border p-12 text-center text-muted">
                Select or create a task from the list to begin editing templates.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODULE 2: SINGLE VISIT TEMPLATE DESIGNER */}
      {/* ========================================================= */}
      {activeModule === "visits" && (
        <div className="space-y-4 animate-fade-in">
          {!visitTemplate ? (
            <div className="flex h-64 items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="rounded-3xl border border-border bg-card shadow-xs overflow-hidden">
              {/* Tab Navigation Header */}
              <div className="p-4 sm:p-5 border-b border-border bg-surface-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Field Visit Form Configuration
                  </span>
                  <h3 className="text-base font-bold text-foreground truncate mt-0.5">
                    {visitTemplate.templateTitle || "Single Universal Visit Template"}
                  </h3>
                </div>

                <div className="flex items-center gap-1 rounded-xl bg-card border border-border p-1 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setActiveVisitEditorTab("create_template")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                      activeVisitEditorTab === "create_template"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    <Compass className="h-3.5 w-3.5" />
                    <span>Planning Template (Create)</span>
                    <span className="rounded-full bg-primary-foreground/20 px-1.5 text-[9px]">
                      {visitCreateCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveVisitEditorTab("outcome_template")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                      activeVisitEditorTab === "outcome_template"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Outcome Template (Completion)</span>
                    <span className="rounded-full bg-primary-foreground/20 px-1.5 text-[9px]">
                      {visitOutcomeCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveVisitEditorTab("simulator")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                      activeVisitEditorTab === "simulator"
                        ? "bg-purple-600 text-white shadow-xs"
                        : "text-muted hover:text-purple-600"
                    }`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Live Simulator</span>
                  </button>
                </div>
              </div>

              {/* SUBTAB 1: CREATE TEMPLATE (PLANNING PHASE) */}
              {activeVisitEditorTab === "create_template" && (
                <div className="p-6 space-y-5 animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
                    <div>
                      <h4 className="text-xs font-bold text-foreground">
                        Pre-Visit Planning Details (Create Phase)
                      </h4>
                      <p className="text-[11px] text-muted">
                        Custom fields the executive must specify when adding or scheduling a field doctor, hospital or chemist visit.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenAddField("visits", "create")}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 transition shadow-2xs self-start sm:self-auto"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Planning Field</span>
                    </button>
                  </div>

                  {visitTemplate.createTemplate.fields.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border p-8 text-center space-y-2">
                      <p className="text-xs font-bold text-foreground">No planning fields defined</p>
                      <p className="text-[11px] text-muted">
                        Click &ldquo;Add Planning Field&rdquo; to define required objectives, brands or prior visit follow-ups.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {visitTemplate.createTemplate.fields.map((f, idx) => {
                        const typeInfo = FIELD_TYPES.find((t) => t.id === f.type) || FIELD_TYPES[0];
                        const TypeIcon = typeInfo.icon;
                        return (
                          <div
                            key={f.id}
                            className="rounded-2xl border border-border bg-surface-muted/30 p-3.5 flex items-center justify-between gap-3 transition hover:border-border/80"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <TypeIcon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-foreground truncate">{f.label}</span>
                                  {f.isRequired ? (
                                    <span className="text-[9px] font-extrabold text-rose-500 bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/20">
                                      Required
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-semibold text-muted bg-surface-muted px-1.5 py-0.2 rounded">
                                      Optional
                                    </span>
                                  )}
                                  {f.wordLimit && (
                                    <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                                      Max {f.wordLimit} Words
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted truncate mt-0.5">
                                  key: <code className="text-primary font-mono">{f.key}</code> • Type: {typeInfo.label}
                                  {f.options ? ` • ${f.options.length} options` : ""}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveField("visits", "create", idx, "up")}
                                className="p-1 rounded-lg text-muted hover:text-foreground disabled:opacity-20 transition"
                                title="Move Up"
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === visitTemplate.createTemplate.fields.length - 1}
                                onClick={() => handleMoveField("visits", "create", idx, "down")}
                                className="p-1 rounded-lg text-muted hover:text-foreground disabled:opacity-20 transition"
                                title="Move Down"
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditField("visits", "create", f)}
                                className="p-1 rounded-lg text-muted hover:text-primary transition"
                                title="Edit Field"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteField("visits", "create", f.id)}
                                className="p-1 rounded-lg text-muted hover:text-rose-500 transition"
                                title="Delete Field"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* SUBTAB 2: OUTCOME TEMPLATE (DEBRIEF PHASE) */}
              {activeVisitEditorTab === "outcome_template" && (
                <div className="p-6 space-y-5 animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
                    <div>
                      <h4 className="text-xs font-bold text-foreground">
                        Post-Visit Debrief &amp; Outcomes (Completion Phase)
                      </h4>
                      <p className="text-[11px] text-muted">
                        Mandatory outcome questions, sample quantities, booking orders, or doctor feedback required to mark visit done.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenAddField("visits", "outcome")}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 transition shadow-2xs self-start sm:self-auto"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Outcome Field</span>
                    </button>
                  </div>

                  {visitTemplate.outcomeTemplate.fields.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border p-8 text-center space-y-2">
                      <p className="text-xs font-bold text-foreground">No outcome fields defined</p>
                      <p className="text-[11px] text-muted">
                        Click &ldquo;Add Outcome Field&rdquo; to add call debrief notes, orders booked, or star ratings.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {visitTemplate.outcomeTemplate.fields.map((f, idx) => {
                        const typeInfo = FIELD_TYPES.find((t) => t.id === f.type) || FIELD_TYPES[0];
                        const TypeIcon = typeInfo.icon;
                        return (
                          <div
                            key={f.id}
                            className="rounded-2xl border border-border bg-surface-muted/30 p-3.5 flex items-center justify-between gap-3 transition hover:border-border/80"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <TypeIcon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-foreground truncate">{f.label}</span>
                                  {f.isRequired ? (
                                    <span className="text-[9px] font-extrabold text-rose-500 bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/20">
                                      Required
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-semibold text-muted bg-surface-muted px-1.5 py-0.2 rounded">
                                      Optional
                                    </span>
                                  )}
                                  {f.wordLimit && (
                                    <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                                      Max {f.wordLimit} Words
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted truncate mt-0.5">
                                  key: <code className="text-primary font-mono">{f.key}</code> • Type: {typeInfo.label}
                                  {f.options ? ` • ${f.options.length} options` : ""}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveField("visits", "outcome", idx, "up")}
                                className="p-1 rounded-lg text-muted hover:text-foreground disabled:opacity-20 transition"
                                title="Move Up"
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === visitTemplate.outcomeTemplate.fields.length - 1}
                                onClick={() => handleMoveField("visits", "outcome", idx, "down")}
                                className="p-1 rounded-lg text-muted hover:text-foreground disabled:opacity-20 transition"
                                title="Move Down"
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditField("visits", "outcome", f)}
                                className="p-1 rounded-lg text-muted hover:text-primary transition"
                                title="Edit Field"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteField("visits", "outcome", f.id)}
                                className="p-1 rounded-lg text-muted hover:text-rose-500 transition"
                                title="Delete Field"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* SUBTAB 3: SIMULATOR */}
              {activeVisitEditorTab === "simulator" && (
                <div className="p-6 space-y-6 animate-fade-in">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Interactive Visit Form Simulator</h4>
                      <p className="text-[11px] text-muted">
                        Test how this visit template will behave during doctor &amp; client field visits.
                      </p>
                    </div>

                    <div className="flex items-center gap-1 rounded-xl bg-surface-muted p-1 border border-border">
                      <button
                        type="button"
                        onClick={() => {
                          setVisitSimPhase("create");
                          setVisitSimErrors({});
                        }}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                          visitSimPhase === "create"
                            ? "bg-primary text-primary-foreground shadow-2xs"
                            : "text-muted hover:text-foreground"
                        }`}
                      >
                        Plan Phase
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setVisitSimPhase("outcome");
                          setVisitSimErrors({});
                        }}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                          visitSimPhase === "outcome"
                            ? "bg-primary text-primary-foreground shadow-2xs"
                            : "text-muted hover:text-foreground"
                        }`}
                      >
                        Outcome Debrief
                      </button>
                    </div>
                  </div>

                  {/* Simulator Form */}
                  {(() => {
                    const fields =
                      visitSimPhase === "create"
                        ? visitTemplate.createTemplate.fields
                        : visitTemplate.outcomeTemplate.fields;

                    if (fields.length === 0) {
                      return (
                        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted">
                          No fields defined in this phase.
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-4 max-w-xl mx-auto rounded-3xl border border-border bg-card p-6 shadow-sm">
                        <div className="border-b border-border pb-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                            {visitSimPhase === "create" ? "Planning Mode (Create Call)" : "Reporting Outcome (Debrief)"}
                          </span>
                          <h3 className="text-sm font-bold text-foreground mt-0.5">
                            {visitTemplate.templateTitle || "Single Universal Visit Template"}
                          </h3>
                        </div>

                        {fields.map((field) => {
                          const val = visitSimValues[field.key] ?? field.defaultValue ?? "";
                          const error = visitSimErrors[field.key];
                          const wordCount = typeof val === "string" ? countWords(val) : 0;
                          const isWordExceeded = Boolean(field.wordLimit && wordCount > field.wordLimit);

                          return (
                            <div key={field.id} className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-foreground">
                                  {field.label} {field.isRequired && <span className="text-rose-500">*</span>}
                                </label>
                                {field.wordLimit && (
                                  <span
                                    className={`text-[10px] font-bold ${
                                      isWordExceeded ? "text-rose-500" : "text-muted"
                                    }`}
                                  >
                                    {wordCount} / {field.wordLimit} words
                                  </span>
                                )}
                              </div>

                              {field.type === "text" && (
                                <input
                                  type="text"
                                  value={val}
                                  onChange={(e) => setVisitSimValues({ ...visitSimValues, [field.key]: e.target.value })}
                                  placeholder={field.placeholder || "Enter text..."}
                                  className={`w-full rounded-xl border bg-surface-muted px-3.5 py-2 text-xs font-medium text-foreground focus:outline-none ${
                                    error || isWordExceeded ? "border-rose-500" : "border-border focus:border-primary"
                                  }`}
                                />
                              )}

                              {field.type === "textarea" && (
                                <textarea
                                  rows={3}
                                  value={val}
                                  onChange={(e) => setVisitSimValues({ ...visitSimValues, [field.key]: e.target.value })}
                                  placeholder={field.placeholder || "Enter detailed remarks..."}
                                  className={`w-full rounded-xl border bg-surface-muted p-3 text-xs font-medium text-foreground focus:outline-none ${
                                    error || isWordExceeded ? "border-rose-500" : "border-border focus:border-primary"
                                  }`}
                                />
                              )}

                              {(field.type === "number" || field.type === "currency") && (
                                <div className="relative">
                                  {field.type === "currency" && (
                                    <span className="absolute left-3 top-2 text-xs font-bold text-muted">₹</span>
                                  )}
                                  <input
                                    type="number"
                                    value={val}
                                    min={field.min}
                                    max={field.max}
                                    onChange={(e) => setVisitSimValues({ ...visitSimValues, [field.key]: e.target.value })}
                                    placeholder={field.placeholder || "0"}
                                    className={`w-full rounded-xl border bg-surface-muted py-2 text-xs font-medium text-foreground focus:outline-none ${
                                      field.type === "currency" ? "pl-7 pr-3" : "px-3.5"
                                    } ${error ? "border-rose-500" : "border-border focus:border-primary"}`}
                                  />
                                </div>
                              )}

                              {field.type === "select" && (
                                <select
                                  value={val}
                                  onChange={(e) => setVisitSimValues({ ...visitSimValues, [field.key]: e.target.value })}
                                  className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                                >
                                  <option value="">Select option...</option>
                                  {(field.options || []).map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              )}

                              {field.type === "multi-select" && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {(field.options || []).map((opt) => {
                                    const selectedArr: string[] = Array.isArray(val) ? val : [];
                                    const isSel = selectedArr.includes(opt);
                                    return (
                                      <button
                                        key={opt}
                                        type="button"
                                        onClick={() => {
                                          const next = isSel ? selectedArr.filter((o) => o !== opt) : [...selectedArr, opt];
                                          setVisitSimValues({ ...visitSimValues, [field.key]: next });
                                        }}
                                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition ${
                                          isSel
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "bg-surface-muted text-muted border-border hover:text-foreground"
                                        }`}
                                      >
                                        {opt}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {field.type === "radio" && (
                                <div className="space-y-1.5 pt-1">
                                  {(field.options || []).map((opt) => (
                                    <label key={opt} className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                                      <input
                                        type="radio"
                                        name={field.key}
                                        value={opt}
                                        checked={val === opt}
                                        onChange={() => setVisitSimValues({ ...visitSimValues, [field.key]: opt })}
                                        className="h-3.5 w-3.5 text-primary border-border focus:ring-primary cursor-pointer"
                                      />
                                      <span>{opt}</span>
                                    </label>
                                  ))}
                                </div>
                              )}

                              {field.type === "switch" && (
                                <div className="flex items-center gap-3 pt-1">
                                  <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(val)}
                                      onChange={(e) => setVisitSimValues({ ...visitSimValues, [field.key]: e.target.checked })}
                                      className="sr-only peer"
                                    />
                                    <div className="w-10 h-5 bg-surface-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                  </label>
                                  <span className="text-xs font-semibold text-foreground">
                                    {val ? "Yes / Confirmed" : "No / Not Applicable"}
                                  </span>
                                </div>
                              )}

                              {field.type === "rating" && (
                                <div className="flex items-center gap-1.5 pt-1">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                      key={star}
                                      type="button"
                                      onClick={() => setVisitSimValues({ ...visitSimValues, [field.key]: star })}
                                      className={`p-1 rounded-md transition ${
                                        (Number(val) || 0) >= star ? "text-amber-400" : "text-muted/40 hover:text-muted"
                                      }`}
                                    >
                                      <Star className="h-5 w-5 fill-current" />
                                    </button>
                                  ))}
                                  <span className="text-xs font-bold text-foreground ml-2">{val || 0} / 5</span>
                                </div>
                              )}

                              {field.type === "file" && (
                                <div className="rounded-xl border border-dashed border-border bg-surface-muted/40 p-4 text-center">
                                  <Upload className="h-5 w-5 text-muted mx-auto mb-1" />
                                  <p className="text-xs font-semibold text-foreground">Click to upload or drag file</p>
                                  <p className="text-[10px] text-muted">Supports images, PDF documents up to 10MB</p>
                                </div>
                              )}

                              {(field.type === "date" || field.type === "time") && (
                                <input
                                  type={field.type}
                                  value={val}
                                  onChange={(e) => setVisitSimValues({ ...visitSimValues, [field.key]: e.target.value })}
                                  className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                                />
                              )}

                              {field.helpText && <p className="text-[10px] text-muted">{field.helpText}</p>}
                              {error && <p className="text-[10px] font-bold text-rose-500">{error}</p>}
                            </div>
                          );
                        })}

                        <div className="pt-4 border-t border-border flex justify-end">
                          <button
                            type="button"
                            onClick={handleSimulateVisitSubmit}
                            className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700 transition shadow-xs"
                          >
                            <Check className="h-4 w-4" />
                            <span>Validate &amp; Test Submit</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* SHARED MODAL: ADD / EDIT FIELD */}
      {/* ========================================================= */}
      {fieldModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 my-8 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary">
                  {modalTargetModule === "tasks" ? "Custom Task" : "Visit Template"} •{" "}
                  {modalTargetPhase === "create" ? "Planning Phase" : "Outcome Phase"}
                </span>
                <h3 className="text-sm font-bold text-foreground mt-0.5">
                  {editingFieldId ? "Edit Field Configuration" : "Add Dynamic Field"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setFieldModalOpen(false)}
                className="text-muted hover:text-foreground p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveField} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Field Label</label>
                <input
                  type="text"
                  required
                  value={fieldLabel}
                  onChange={(e) => {
                    setFieldLabel(e.target.value);
                    if (!editingFieldId) {
                      setFieldKey(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 30));
                    }
                  }}
                  placeholder="e.g. Doctor Discussion Summary"
                  className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Field Key (Identifier)</label>
                  <input
                    type="text"
                    required
                    value={fieldKey}
                    onChange={(e) => setFieldKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    placeholder="e.g. doctor_summary"
                    className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2 text-xs font-mono text-primary focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Data Type</label>
                  <select
                    value={fieldType}
                    onChange={(e) => setFieldType(e.target.value as TemplateFieldType)}
                    className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Placeholder</label>
                <input
                  type="text"
                  value={fieldPlaceholder}
                  onChange={(e) => setFieldPlaceholder(e.target.value)}
                  placeholder="e.g. Enter details..."
                  className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Help / Tooltip Text</label>
                <input
                  type="text"
                  value={fieldHelpText}
                  onChange={(e) => setFieldHelpText(e.target.value)}
                  placeholder="Guidance shown below input..."
                  className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              {/* Options for select / radio / multi-select */}
              {["select", "multi-select", "radio"].includes(fieldType) && (
                <div className="space-y-2 rounded-2xl border border-border bg-surface-muted/30 p-3.5">
                  <label className="block text-xs font-semibold text-foreground">Options List</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newOptionInput}
                      onChange={(e) => setNewOptionInput(e.target.value)}
                      placeholder="Add an option..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddOption();
                        }
                      }}
                      className="flex-1 rounded-xl border border-border bg-surface-muted px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90"
                    >
                      Add
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {fieldOptions.map((opt) => (
                      <span
                        key={opt}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-card border border-border px-2.5 py-1 text-xs font-medium text-foreground"
                      >
                        {opt}
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(opt)}
                          className="text-muted hover:text-rose-500"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Word limit & Min/Max */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {["text", "textarea"].includes(fieldType) && (
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">Word Limit</label>
                    <input
                      type="number"
                      min={0}
                      value={fieldWordLimit ?? ""}
                      onChange={(e) => setFieldWordLimit(e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="e.g. 50"
                      className="w-full rounded-xl border border-border bg-surface-muted px-3 py-1.5 text-xs text-foreground focus:outline-none"
                    />
                  </div>
                )}

                {["number", "currency", "slider"].includes(fieldType) && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Min Value</label>
                      <input
                        type="number"
                        value={fieldMin ?? ""}
                        onChange={(e) => setFieldMin(e.target.value ? Number(e.target.value) : undefined)}
                        placeholder="Min"
                        className="w-full rounded-xl border border-border bg-surface-muted px-3 py-1.5 text-xs text-foreground focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Max Value</label>
                      <input
                        type="number"
                        value={fieldMax ?? ""}
                        onChange={(e) => setFieldMax(e.target.value ? Number(e.target.value) : undefined)}
                        placeholder="Max"
                        className="w-full rounded-xl border border-border bg-surface-muted px-3 py-1.5 text-xs text-foreground focus:outline-none"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Required Switch */}
              <div className="flex items-center justify-between rounded-xl border border-border bg-surface-muted/40 p-3">
                <div>
                  <span className="text-xs font-bold text-foreground">Mandatory Field</span>
                  <p className="text-[10px] text-muted">Field executive cannot submit without providing this</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fieldRequired}
                    onChange={(e) => setFieldRequired(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-surface-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setFieldModalOpen(false)}
                  className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-foreground hover:bg-surface-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
                >
                  {editingFieldId ? "Save Changes" : "Add to Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET VISIT CONFIRMATION */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
              <RotateCcw className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Reset to Standard Defaults?</h3>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                This will overwrite the single visit template with universal presets (call objective, target brand, discussion summary, sample count, POB amount).
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-foreground hover:bg-surface-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetVisitDefaults}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700"
              >
                Reset Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
