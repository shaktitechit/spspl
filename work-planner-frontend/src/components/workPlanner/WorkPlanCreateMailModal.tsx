"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Mail,
  Send,
  X,
  Paperclip,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  File,
  Trash2,
  Users,
  UserCheck,
  CheckCircle2,
  Loader2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { DayEndRichEditor } from "./DayEndRichEditor";
import { useGetUsersQuery } from "@/store/api/authApiSlice";
import {
  useGetDayEndDraftQuery,
  useUploadWorkPlanAttachmentMutation,
  useSubmitPlanMutation,
  useGetUserSettingsQuery,
  useGetMyTeamQuery,
  useGetEligibleManagersQuery,
} from "@/store/api/workPlannerApiSlice";
import { isWpAdmin, isWpManager, isWpCoordinator, isWpElevated, getWpAccessRoles, readSessionFromStorage } from "@/utils/authStorage";
import { getUserWorkPlannerSettings } from "@/utils/userWorkPlannerSettings";
import type {
  WorkPlanRecord,
  WorkPlanDayEndAttachment,
} from "@/types/workPlanner";

export interface CreateEmailPayload {
  toEmail: string;
  ccEmails: string[];
  subject: string;
  bodyHtml: string;
  attachmentIds: string[];
}

interface WorkPlanCreateMailModalProps {
  planId?: string;
  plan: Partial<WorkPlanRecord> | null;
  sessionUser?: { name?: string; email?: string } | null;
  isOpen: boolean;
  onClose: () => void;
  onCreateAndSend: (payload: CreateEmailPayload) => Promise<void>;
  loading?: boolean;
  isEditing?: boolean;
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType?: string, fileName?: string) {
  const mime = (mimeType || "").toLowerCase();
  const name = (fileName || "").toLowerCase();

  if (mime.includes("pdf") || name.endsWith(".pdf")) {
    return <FileText className="h-4 w-4 text-rose-500 shrink-0" />;
  }
  if (
    mime.includes("image") ||
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".webp")
  ) {
    return <ImageIcon className="h-4 w-4 text-sky-500 shrink-0" />;
  }
  if (
    mime.includes("sheet") ||
    mime.includes("excel") ||
    mime.includes("csv") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    name.endsWith(".csv")
  ) {
    return <FileSpreadsheet className="h-4 w-4 text-emerald-500 shrink-0" />;
  }
  return <File className="h-4 w-4 text-slate-400 shrink-0" />;
}

function getWorkPlannerUserRole(u: any): "Admin" | "Manager" | "Coordinator" | null {
  if (!u) return null;
  const roles = getWpAccessRoles(u);
  if (roles.includes("admin")) return "Admin";
  if (roles.includes("manager")) return "Manager";
  if (roles.includes("coordinator")) return "Coordinator";
  return null;
}

export function WorkPlanCreateMailModal({
  planId,
  plan,
  sessionUser,
  isOpen,
  onClose,
  onCreateAndSend,
  loading: parentLoading = false,
  isEditing = false,
}: WorkPlanCreateMailModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentSessionUser = sessionUser || readSessionFromStorage()?.user;
  const adminRole = isWpAdmin(currentSessionUser as any);
  const isElevatedNonAdmin = isWpElevated(currentSessionUser as any) && !adminRole;

  // Fetch prefilled draft / manager list from backend if available
  const { data: draftData, isLoading: draftLoading } = useGetDayEndDraftQuery(planId || "", {
    skip: !isOpen || !planId,
  });
  const { data: usersData } = useGetUsersQuery(undefined, { skip: !isOpen || !adminRole });
  const { data: myTeamData } = useGetMyTeamQuery(undefined, { skip: !isOpen || !isElevatedNonAdmin });
  const { data: eligibleManagersData } = useGetEligibleManagersQuery(undefined, { skip: !isOpen });

  const [uploadAttachmentMut] = useUploadWorkPlanAttachmentMutation();
  const [submitPlanMut] = useSubmitPlanMutation();

  // Form State
  const [toEmail, setToEmail] = useState("");
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [newCcInput, setNewCcInput] = useState("");
  const [isAddingCc, setIsAddingCc] = useState(false);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [attachments, setAttachments] = useState<WorkPlanDayEndAttachment[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const isLeave = plan?.plan_type === "Leave";

  const fromName = sessionUser?.name || currentSessionUser?.name || "Executive";
  const fromEmail = sessionUser?.email || currentSessionUser?.email || draftData?.from_email || "";

  const allUsers = useMemo<any[]>(() => {
    if (adminRole && usersData) return (usersData as any[]) || [];
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

    if (currentSessionUser) addUser(currentSessionUser);
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
  }, [adminRole, usersData, currentSessionUser, eligibleManagersData, myTeamData]);

  // Check if current user (Manager) is creating a plan for a target Executive
  const targetUserObj =
    typeof plan?.sales_user === "object" && plan?.sales_user ? plan.sales_user : null;
  const targetExecutiveEmail = targetUserObj?.email || "";
  const targetExecutiveName = targetUserObj?.name || "";

  const isManagerCreatingForExecutive = useMemo(() => {
    if (!targetExecutiveEmail || !sessionUser?.email) return false;
    return targetExecutiveEmail.toLowerCase().trim() !== sessionUser.email.toLowerCase().trim();
  }, [targetExecutiveEmail, sessionUser?.email]);

  const targetExecId = targetUserObj ? String(targetUserObj._id || targetUserObj.id || "") : String((sessionUser as any)?._id || (sessionUser as any)?.id || "");
  const { data: dbUserSettings } = useGetUserSettingsQuery(targetExecId, { skip: !isOpen || !targetExecId });

  const effectiveSettings = useMemo(() => {
    if (dbUserSettings) return dbUserSettings;
    if (targetExecId) return getUserWorkPlannerSettings(targetExecId);
    return null;
  }, [dbUserSettings, targetExecId]);

  // Resolve assigned manager for current plan type (or fallback to global default manager)
  const assignedPlanTypeManager = useMemo(() => {
    if (!effectiveSettings) return null;
    const pts = effectiveSettings.planTypeSettings?.[plan?.plan_type || "Visits"];
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
          email: matched.email || mgrEmail || "",
          badgeText: `${plan?.plan_type || "Visits"} Manager`,
          isReportingManager: true,
        };
      }
      if (mgrName) {
        return {
          _id: mgrId || "",
          name: mgrName,
          email: mgrEmail || "",
          badgeText: `${plan?.plan_type || "Visits"} Manager`,
          isReportingManager: true,
        };
      }
    }

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
          email: matched.email || globalEmail || "",
          badgeText: "Reporting Manager",
          isReportingManager: true,
        };
      }
      if (globalName) {
        return {
          _id: globalId || "",
          name: globalName,
          email: globalEmail || "",
          badgeText: "Reporting Manager",
          isReportingManager: true,
        };
      }
    }

    return null;
  }, [effectiveSettings, plan?.plan_type, allUsers]);

  // Build eligible managers list: 1. Assigned Reporting Manager, 2. Discussed Manager, 3. Portal Admins of work_planner portal
  const eligibleManagers = useMemo(() => {
    const map = new Map<string, { _id: string; name: string; email: string; roleBadge: string; isReportingManager: boolean }>();

    // 1. Add assigned reporting manager
    if (assignedPlanTypeManager && assignedPlanTypeManager.email) {
      map.set(assignedPlanTypeManager.email.toLowerCase(), {
        _id: assignedPlanTypeManager._id || assignedPlanTypeManager.email,
        name: assignedPlanTypeManager.name,
        email: assignedPlanTypeManager.email,
        roleBadge: assignedPlanTypeManager.badgeText,
        isReportingManager: true,
      });
    }

    // 2. Add discussed manager if present
    if (plan?.is_discussed_with_manager) {
      const mId = typeof plan.discussed_manager_id === "object" ? plan.discussed_manager_id?._id : plan.discussed_manager_id;
      const mName = plan.discussed_manager_name || (typeof plan.discussed_manager_id === "object" ? plan.discussed_manager_id?.name : "");
      const mEmail = typeof plan.discussed_manager_id === "object" ? plan.discussed_manager_id?.email : "";

      if (mId || mName || mEmail) {
        const matched = allUsers.find((u) => String(u._id || u.id) === String(mId) || (mEmail && u.email?.toLowerCase() === mEmail.toLowerCase()));
        const email = matched?.email || mEmail;
        if (email && !map.has(email.toLowerCase())) {
          map.set(email.toLowerCase(), {
            _id: String(matched?._id || mId || email),
            name: matched?.name || mName || "Discussed Manager",
            email: email,
            roleBadge: "Discussed Manager",
            isReportingManager: true,
          });
        }
      }
    }

    // 3. Add Portal Admins / Managers
    const mgrSource = Array.isArray(eligibleManagersData) && eligibleManagersData.length > 0
      ? eligibleManagersData
      : allUsers;

    for (const u of mgrSource) {
      const id = String(u._id || u.id || "");
      if (!id || !u.email) continue;
      const role = getWorkPlannerUserRole(u);
      const isPortalAdmin = role === "Admin" || String(u.roleBadge || "").includes("Admin");
      const isPortalManager = role === "Manager" || String(u.roleBadge || "").includes("Manager");
      const isPortalCoordinator = role === "Coordinator" || String(u.roleBadge || "").includes("Coordinator");
      if (!isPortalAdmin && !isPortalManager && !isPortalCoordinator) continue;

      if (!map.has(u.email.toLowerCase())) {
        map.set(u.email.toLowerCase(), {
          _id: id,
          name: u.name,
          email: u.email,
          roleBadge: u.roleBadge || (isPortalAdmin ? "Portal Admin" : isPortalCoordinator ? "Portal Coordinator" : "Portal Manager"),
          isReportingManager: false,
        });
      }
    }

    // Fallback: If no managers identified, include draftData.managers
    if (map.size === 0 && draftData?.managers && draftData.managers.length > 0) {
      draftData.managers.forEach((m: any) => {
        if (m.email && !map.has(m.email.toLowerCase())) {
          map.set(m.email.toLowerCase(), {
            _id: String(m._id || m.email),
            name: m.name,
            email: m.email,
            roleBadge: "Manager",
            isReportingManager: false,
          });
        }
      });
    }

    return Array.from(map.values());
  }, [allUsers, eligibleManagersData, assignedPlanTypeManager, plan, draftData]);

  const availableManagers = eligibleManagers;
  const initializedRef = useRef(false);

  // Generate initial HTML Body for Work Plan Creation & default recipient email fields
  useEffect(() => {
    if (!isOpen) {
      initializedRef.current = false;
      setBodyHtml("");
      setSubject("");
      setToEmail("");
      setCcEmails([]);
      setAttachments([]);
      setIsAddingCc(false);
      setNewCcInput("");
      return;
    }

    if (initializedRef.current || !plan) return;

    const executiveName = isManagerCreatingForExecutive
      ? targetExecutiveName || "Executive"
      : sessionUser?.name || "Executive";

    const planDateStr = plan.plan_date
      ? new Date(plan.plan_date).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : new Date().toLocaleDateString("en-GB");

    const isDiscussed = Boolean(plan.is_discussed_with_manager);

    // Determine Discussed Manager Email if executive is creating plan and discussion occurred
    let discussedManagerEmail = "";
    if (isDiscussed) {
      if (typeof plan.discussed_manager_id === "object" && plan.discussed_manager_id?.email) {
        discussedManagerEmail = plan.discussed_manager_id.email;
      } else if (plan.discussed_manager_id || plan.discussed_manager_name) {
        const matchId = String(
          typeof plan.discussed_manager_id === "string" ? plan.discussed_manager_id : ""
        ).toLowerCase();
        const matchName = String(plan.discussed_manager_name || "").toLowerCase().trim();

        const matched = availableManagers.find((m) => {
          if (m._id && matchId && String(m._id).toLowerCase() === matchId) return true;
          if (m.name && matchName && String(m.name).toLowerCase().trim() === matchName) return true;
          return false;
        });
        if (matched?.email) {
          discussedManagerEmail = matched.email;
        }
      }
    }

    const planTypeStr = plan.plan_type || "Visits";
    const actionStr = isEditing ? "Updated" : "Created";

    const pts = effectiveSettings?.planTypeSettings?.[planTypeStr];
    const ptsManagerEmail = pts?.assignedManagerEmail;
    const globalManagerEmail = effectiveSettings?.assignedManagerEmail;

    let activeTo = "";

    if (isManagerCreatingForExecutive && targetExecutiveEmail) {
      activeTo = targetExecutiveEmail;
      setToEmail(targetExecutiveEmail);
      if (!subject) {
        setSubject(
          planTypeStr === "Leave"
            ? `Leave Plan Assigned — ${executiveName} (${planDateStr})`
            : `Work Plan Assigned (${planTypeStr}) — ${executiveName} (${planDateStr})`
        );
      }
    } else {
      if (!subject) {
        setSubject(
          planTypeStr === "Leave"
            ? `Leave Notification / Application — ${executiveName} (${planDateStr})`
            : `Work Plan ${actionStr} (${planTypeStr}) — ${executiveName} (${planDateStr})`
        );
      }

      // Priority for TO recipient:
      // 1. Plan-type assigned manager email
      // 2. Global assigned manager email
      // 3. Discussed manager email (if discussion was logged)
      // 4. First manager in available managers roster / draft to email
      const chosenTo =
        ptsManagerEmail ||
        globalManagerEmail ||
        (isDiscussed && discussedManagerEmail ? discussedManagerEmail : "") ||
        availableManagers[0]?.email ||
        draftData?.to ||
        "";

      if (chosenTo && (!toEmail || toEmail !== chosenTo)) {
        setToEmail(chosenTo);
        activeTo = chosenTo;
      } else {
        activeTo = toEmail || chosenTo;
      }
    }

    // CC Field: Use plan type configured CC emails (or global CC emails if not set)
    const ptsCc = pts?.ccEmails || [];
    const globalCc = effectiveSettings?.ccEmails || [];
    const configuredCc = ptsCc.length > 0 ? ptsCc : globalCc;

    const activeFrom = fromEmail.toLowerCase().trim();
    const normTo = activeTo.toLowerCase().trim();
    const combinedCcSet = new Set<string>();

    configuredCc.forEach((emailStr: string) => {
      const norm = String(emailStr).trim().toLowerCase();
      if (norm && norm !== normTo && norm !== activeFrom) {
        combinedCcSet.add(norm);
      }
    });

    setCcEmails(Array.from(combinedCcSet));

    if (!bodyHtml) {
      const isLeave = plan.plan_type === "Leave";
      const visits = isLeave ? [] : (plan.visits || []);
      const tasks = isLeave ? [] : (plan.works || []);
      const isDiscussed = plan.is_discussed_with_manager;
      const discussedManager =
        plan.discussed_manager_name ||
        (typeof plan.discussed_manager_id === "object"
          ? (plan.discussed_manager_id as any)?.name
          : "") ||
        "Manager";

      const getBadgeStyle = (statusStr?: string) => {
        const s = String(statusStr || "created").toLowerCase().trim();
        if (s === "completed") return "background-color: #dcfce7; color: #15803d;";
        if (s === "in_progress") return "background-color: #fef9c3; color: #a16207;";
        if (s === "cancelled" || s === "rejected") return "background-color: #ffe4e6; color: #be123c;";
        if (s === "pending") return "background-color: #ffedd5; color: #c2410c;";
        return "background-color: #e0f2fe; color: #0369a1;";
      };

      let visitsHtml = "";
      if (visits.length > 0) {
        visitsHtml = `
          <h3 style="color: #0f172a; font-size: 15px; border-bottom: 2px solid #0284c7; padding-bottom: 6px; margin-top: 20px;">Planned Field Visits (${visits.length})</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px;">
            <thead>
              <tr style="background-color: #f1f5f9; text-align: left; font-weight: bold; color: #475569;">
                <th style="padding: 8px; border: 1px solid #cbd5e1;">#</th>
                <th style="padding: 8px; border: 1px solid #cbd5e1;">Party Name</th>
                <th style="padding: 8px; border: 1px solid #cbd5e1;">Contact / Person</th>
                <th style="padding: 8px; border: 1px solid #cbd5e1;">Location / Address</th>
                <th style="padding: 8px; border: 1px solid #cbd5e1;">Status</th>
                <th style="padding: 8px; border: 1px solid #cbd5e1;">Planned Schedule</th>
              </tr>
            </thead>
            <tbody>
              ${visits
                .map(
                  (v, idx) => `
                <tr>
                  <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">${idx + 1}</td>
                  <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; color: #0f172a;">${v.party_name || "N/A"}</td>
                  <td style="padding: 8px; border: 1px solid #cbd5e1;">${v.contact_person || "—"}<br/><small style="color:#64748b">${v.contact_number || ""}</small></td>
                  <td style="padding: 8px; border: 1px solid #cbd5e1;">${v.address || "—"}</td>
                  <td style="padding: 8px; border: 1px solid #cbd5e1;"><span style="${getBadgeStyle(v.status)}; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px;">${String(v.status || "created").replace(/_/g, " ").toUpperCase()}</span></td>
                  <td style="padding: 8px; border: 1px solid #cbd5e1;">${v.planned_start_time || "Full Day"}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        `;
      }

      let tasksHtml = "";
      if (tasks.length > 0) {
        tasksHtml = `
          <h3 style="color: #0f172a; font-size: 15px; border-bottom: 2px solid #059669; padding-bottom: 6px; margin-top: 20px;">Planned Work Tasks (${tasks.length})</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px;">
            <thead>
              <tr style="background-color: #f1f5f9; text-align: left; font-weight: bold; color: #475569;">
                <th style="padding: 8px; border: 1px solid #cbd5e1;">#</th>
                <th style="padding: 8px; border: 1px solid #cbd5e1;">Task Title</th>
                <th style="padding: 8px; border: 1px solid #cbd5e1;">Description</th>
                <th style="padding: 8px; border: 1px solid #cbd5e1;">Status</th>
                <th style="padding: 8px; border: 1px solid #cbd5e1;">Planned Schedule</th>
              </tr>
            </thead>
            <tbody>
              ${tasks
                .map(
                  (t, idx) => `
                <tr>
                  <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">${idx + 1}</td>
                  <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; color: #0f172a;">${t.title || "Task"}</td>
                  <td style="padding: 8px; border: 1px solid #cbd5e1;">${t.description || "—"}</td>
                  <td style="padding: 8px; border: 1px solid #cbd5e1;"><span style="${getBadgeStyle(t.status)}; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px;">${String(t.status || "created").replace(/_/g, " ").toUpperCase()}</span></td>
                  <td style="padding: 8px; border: 1px solid #cbd5e1;">${t.planned_start_time || "Full Day"}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        `;
      }

      const headerTitle = isLeave
        ? `Leave Notification (${actionStr}) — Summary`
        : `Work Plan ${actionStr} — Summary`;
      const locationLine = isLeave
        ? ""
        : ` | <strong>Location:</strong> ${plan.location || "N/A"}`;
      const remarksHeading = isLeave
        ? "Leave Reason & Remarks"
        : "Executive Remarks / Notes";

      const defaultHtml = `
<div style="font-family: Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b;">
  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
    <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 18px;">${headerTitle}</h2>
    <p style="margin: 4px 0; font-size: 14px;"><strong>Executive:</strong> ${executiveName} (${fromEmail})</p>
    <p style="margin: 4px 0; font-size: 14px;"><strong>Plan Date:</strong> ${planDateStr}</p>
    <p style="margin: 4px 0; font-size: 14px;"><strong>Plan Type:</strong> ${plan.plan_type || "Visits"}${locationLine}</p>
    <p style="margin: 4px 0; font-size: 14px;"><strong>Discussed with Manager:</strong> ${isDiscussed ? `Yes (${discussedManager})` : "No"}</p>
  </div>

  ${visitsHtml}
  ${tasksHtml}

  <h3 style="color: #0f172a; font-size: 15px; border-bottom: 2px solid ${isLeave ? '#e11d48' : '#475569'}; padding-bottom: 6px; margin-top: 20px;">${remarksHeading}</h3>
  <p style="font-size: 14px; color: #334155; padding: 12px; background: #f1f5f9; border-radius: 6px;">
    ${plan.remarks || (isLeave ? "Leave for the day." : "No additional remarks added for this work plan.")}
  </p>
</div>
      `;

      setBodyHtml(defaultHtml);
    }
    initializedRef.current = true;
  }, [isOpen, plan, draftData, availableManagers, effectiveSettings]);

  // Handle adding CC tag
  const handleAddCc = (emailToAdd: string) => {
    const trimmed = emailToAdd.trim().toLowerCase();
    if (!trimmed) return;
    if (!ccEmails.some((e) => e.toLowerCase() === trimmed)) {
      setCcEmails([...ccEmails, trimmed]);
    }
    setNewCcInput("");
    setIsAddingCc(false);
  };

  const handleRemoveCc = (indexToRemove: number) => {
    setCcEmails(ccEmails.filter((_, i) => i !== indexToRemove));
  };

  // Handle file uploads
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    for (const file of fileList) {
      setUploadingFiles((prev) => [...prev, file.name]);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("resourceId", planId || "new-plan");

      try {
        const res = await uploadAttachmentMut(formData).unwrap();
        if (res) {
          setAttachments((prev) => [
            ...prev,
            {
              _id: res._id,
              original_name: res.original_name || file.name,
              file_name: res.file_name || file.name,
              mime_type: res.mime_type || file.type,
              size: res.size || file.size,
              url: res.url,
            },
          ]);
          toast.success(`Attached ${file.name}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to upload file";
        toast.error(`Error uploading ${file.name}: ${msg}`);
      } finally {
        setUploadingFiles((prev) => prev.filter((name) => name !== file.name));
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveAttachment = (idToRemove: string) => {
    setAttachments((prev) => prev.filter((a) => a._id !== idToRemove));
  };

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

  // Send Email & Create/Update Plan Notification
  const handleSendEmail = async () => {
    if (!toEmail.trim()) {
      toast.error("Please enter or select a recipient (To email)");
      return;
    }
    if (!subject.trim()) {
      toast.error("Please provide a subject line");
      return;
    }
    if (uploadingFiles.length > 0) {
      toast.error("Please wait for all attachments to finish uploading");
      return;
    }

    setSubmitting(true);
    try {
      await onCreateAndSend({
        toEmail: toEmail.trim(),
        ccEmails,
        subject: subject.trim(),
        bodyHtml,
        attachmentIds: attachments.map((a) => a._id),
      });
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, "Failed to save work plan and send email");
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isBusy = submitting || parentLoading;

  return (
    <div className="fixed inset-0 z-50 flex flex-col w-screen h-screen bg-card text-foreground overflow-hidden font-sans">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border bg-surface px-4 py-3 sm:px-6 sm:py-3.5 shrink-0 shadow-xs gap-3">
        <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
          <div className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl ${isLeave ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"} shrink-0`}>
            <Mail className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate">
                {isLeave
                  ? isEditing
                    ? "Leave Plan Update & Mail Dispatch"
                    : "Leave Plan Confirmation & Mail Dispatch"
                  : isManagerCreatingForExecutive
                  ? `Work Plan Assigned — ${targetExecutiveName || "Executive"}`
                  : isEditing
                  ? "Work Plan Update & Mail Dispatch"
                  : "Work Plan Creation & Mail Dispatch"}
              </h3>
              <span className={`rounded-full px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold shrink-0 ${
                isLeave
                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                  : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              }`}>
                {isLeave
                  ? "Leave Plan"
                  : isManagerCreatingForExecutive
                  ? "Assignment"
                  : isEditing
                  ? "Plan Update"
                  : "Plan Creation"}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-muted line-clamp-1 sm:line-clamp-2">
              {isLeave
                ? isEditing
                  ? "Review leave plan summary, configure recipient emails, format notes, and dispatch notification email to update leave"
                  : "Review leave plan summary, configure recipient emails, format initial notes, and dispatch notification email to complete leave"
                : isManagerCreatingForExecutive
                ? `Review assigned work plan details, format initial notes, and send notification email to ${targetExecutiveName}`
                : isEditing
                ? "Review updated work plan summary, configure recipient emails, format notes, and dispatch notification email to save changes"
                : "Review work plan summary, configure recipient emails, format initial notes, and dispatch notification email to create plan"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0 self-end sm:self-auto">
          <button
            type="button"
            disabled={isBusy}
            onClick={onClose}
            title="Discard changes and close"
            className="rounded-xl border border-border bg-card px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
          >
            Discard
          </button>
          <button
            type="button"
            disabled={isBusy || uploadingFiles.length > 0}
            onClick={handleSendEmail}
            className={`inline-flex items-center gap-1.5 sm:gap-2 rounded-xl px-3.5 sm:px-5 py-1.5 sm:py-2 text-xs font-bold text-white shadow-xs disabled:opacity-50 transition cursor-pointer shrink-0 ${
              isLeave
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {isBusy ? (
              <>
                <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                <span>{isLeave ? (isEditing ? "Updating Leave..." : "Submitting Leave...") : isEditing ? "Updating..." : "Creating..."}</span>
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>{isLeave ? (isEditing ? "Update & Send" : "Complete & Send") : isEditing ? "Update & Send" : "Create & Send"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Email Header Fields */}
      <div className="border-b border-border bg-card p-3 sm:p-4 space-y-2.5 sm:space-y-3 shrink-0 text-xs overflow-x-hidden">
        {/* FROM Field */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          <span className="w-auto sm:w-16 font-semibold text-muted shrink-0 text-left sm:text-right">From:</span>
          <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-muted/60 px-3 py-1.5 text-xs text-foreground max-w-full overflow-hidden">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white uppercase shrink-0">
              {fromName.slice(0, 1)}
            </div>
            <span className="font-medium truncate">{fromName}</span>
            <span className="text-muted text-[11px] truncate">&lt;{fromEmail}&gt;</span>
          </div>
        </div>

        {/* TO Field */}
        <div className="flex flex-col sm:flex-row sm:items-start md:items-center gap-1 sm:gap-3">
          <span className="w-auto sm:w-16 font-semibold text-muted shrink-0 text-left sm:text-right pt-0 sm:pt-1 md:pt-0">To:</span>
          <div className="flex-1 flex flex-col md:flex-row md:items-center gap-2 min-w-0 max-w-full">
            <div className="relative flex-1 min-w-0">
              <input
                type="email"
                value={toEmail}
                onChange={(e) => !isManagerCreatingForExecutive && setToEmail(e.target.value)}
                readOnly={isManagerCreatingForExecutive}
                disabled={isManagerCreatingForExecutive}
                placeholder="Executive or Manager Email"
                className={`w-full rounded-lg border px-3 py-1.5 text-xs text-foreground focus:outline-hidden ${
                  isManagerCreatingForExecutive
                    ? "bg-surface-muted/80 border-border text-foreground font-semibold cursor-not-allowed"
                    : "bg-surface border-border focus:border-emerald-500"
                }`}
              />
            </div>

            {isManagerCreatingForExecutive ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 text-[11px] font-bold text-sky-600 dark:text-sky-400 shrink-0">
                <UserCheck className="h-3.5 w-3.5" />
                Assigned Executive (Non-editable)
              </span>
            ) : (
              availableManagers.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-[11px] max-w-full">
                  <span className="text-muted text-[10px] sm:text-[11px] font-semibold shrink-0">Quick pick:</span>
                  {availableManagers.map((m) => {
                    const isSelected = toEmail.toLowerCase() === m.email.toLowerCase();
                    const isInCc = ccEmails.some((e) => e.toLowerCase() === m.email.toLowerCase());
                    return (
                      <div key={m._id || m.email} className="inline-flex items-center rounded-lg border border-border bg-surface overflow-hidden shrink-0">
                        <button
                          type="button"
                          onClick={() => setToEmail(m.email)}
                          className={`inline-flex items-center gap-1 px-2 py-1 font-medium transition cursor-pointer text-[11px] ${
                            isSelected
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold"
                              : "hover:bg-surface-muted text-foreground"
                          }`}
                          title={`Set TO: ${m.name} (${m.email})`}
                        >
                          <span className="truncate max-w-[110px] sm:max-w-none">{m.name}</span>
                          <span
                            className={`rounded px-1 py-0.2 text-[9px] font-semibold border ${
                              m.isReportingManager
                                ? "bg-primary/15 text-primary border-primary/20"
                                : m.roleBadge === "Portal Admin"
                                ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20"
                                : m.roleBadge === "Portal Coordinator"
                                ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/20"
                                : "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20"
                            }`}
                          >
                            {m.roleBadge}
                          </span>
                        </button>
                        {!isSelected && !isInCc && (
                          <button
                            type="button"
                            onClick={() => handleAddCc(m.email)}
                            className="px-1.5 py-1 text-[10px] text-muted hover:text-primary hover:bg-primary/10 border-l border-border transition cursor-pointer font-semibold"
                            title={`Add ${m.name} to CC`}
                          >
                            +CC
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>

        {/* CC Field */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
          <span className="w-auto sm:w-16 font-semibold text-muted shrink-0 text-left sm:text-right pt-0 sm:pt-1.5">Cc:</span>
          <div className="flex-1 flex flex-wrap items-center gap-1.5 min-h-[32px] min-w-0">
            {ccEmails.map((email, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-foreground max-w-full"
              >
                <Users className="h-3 w-3 text-muted shrink-0" />
                <span className="truncate max-w-[140px] sm:max-w-none">{email}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveCc(idx)}
                  className="rounded hover:bg-surface-muted p-0.5 text-muted hover:text-foreground cursor-pointer shrink-0"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}

            {isAddingCc ? (
              <div className="flex items-center gap-1 flex-wrap">
                <input
                  type="email"
                  autoFocus
                  value={newCcInput}
                  onChange={(e) => setNewCcInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCc(newCcInput);
                    } else if (e.key === "Escape") {
                      setIsAddingCc(false);
                    }
                  }}
                  placeholder="email@shaktipumps.com"
                  className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-foreground focus:border-emerald-500 focus:outline-hidden min-w-[160px]"
                />
                <button
                  type="button"
                  onClick={() => handleAddCc(newCcInput)}
                  className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingCc(false)}
                  className="rounded-lg border border-border px-2 py-1 text-xs text-muted hover:bg-surface-muted cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingCc(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-2.5 py-1 text-xs font-semibold text-muted hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer shrink-0"
              >
                <Plus className="h-3 w-3" />
                Add CC
              </button>
            )}

            {availableManagers
              .filter((m) => m.email && m.email !== toEmail && !ccEmails.includes(m.email))
              .map((m) => (
                <button
                  key={m._id}
                  type="button"
                  onClick={() => handleAddCc(m.email)}
                  className="rounded-md border border-border/60 bg-surface-muted px-2 py-0.5 text-[10px] text-muted hover:bg-surface hover:text-foreground transition cursor-pointer shrink-0"
                >
                  + CC {m.name}
                </button>
              ))}
          </div>
        </div>

        {/* Subject Field */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          <span className="w-auto sm:w-16 font-semibold text-muted shrink-0 text-left sm:text-right">Subject:</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="New Work Plan Created — Executive Name"
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground focus:border-emerald-500 focus:outline-hidden min-w-0"
          />
        </div>
      </div>

      {/* Editor Main Content Area */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden bg-surface-muted/30">
        <div className="flex items-center justify-between mb-2 shrink-0">
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-emerald-500" />
            Plan Notification Body & Remarks:
          </span>
          <span className="text-[11px] text-muted">
            Includes auto-generated summary table of planned visits and work tasks
          </span>
        </div>

        <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-border bg-card overflow-hidden shadow-xs">
          <DayEndRichEditor value={bodyHtml} onChange={setBodyHtml} placeholder="Type remarks..." />
        </div>

        {/* Attachments Section */}
        <div className="mt-3 shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-muted" />
              <span className="text-xs font-semibold text-foreground">
                Email Attachments ({attachments.length})
              </span>
            </div>

            <button
              type="button"
              disabled={isBusy}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground hover:bg-surface-muted transition cursor-pointer"
            >
              <Paperclip className="h-3.5 w-3.5 text-emerald-500" />
              Attach Document / Image
            </button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFilesSelected}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
            />
          </div>

          {/* List attached files */}
          {(attachments.length > 0 || uploadingFiles.length > 0) && (
            <div className="flex flex-wrap items-center gap-2 max-h-24 overflow-y-auto">
              {uploadingFiles.map((fileName, idx) => (
                <div
                  key={`uploading-${idx}`}
                  className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-600 dark:text-emerald-400 animate-pulse"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Uploading {fileName}...</span>
                </div>
              ))}

              {attachments.map((att) => (
                <div
                  key={att._id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs shadow-2xs group"
                >
                  {getFileIcon(att.mime_type, att.file_name)}
                  <span className="font-medium text-foreground max-w-[180px] truncate">
                    {att.original_name || att.file_name}
                  </span>
                  <span className="text-[10px] text-muted">({formatFileSize(att.size)})</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(att._id)}
                    className="rounded p-0.5 text-muted hover:bg-rose-500/10 hover:text-rose-500 transition cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WorkPlanCreateMailModal;
