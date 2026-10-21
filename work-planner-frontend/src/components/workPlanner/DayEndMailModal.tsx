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
  ExternalLink,
  AlertTriangle,
  UserCheck,
  Users,
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
  useGetUserSettingsQuery,
  useGetMyTeamQuery,
  useGetEligibleManagersQuery,
} from "@/store/api/workPlannerApiSlice";
import { isWpAdmin, isWpCoordinator, isWpElevated, isWpManager, getWpAccessRoles, readSessionFromStorage } from "@/utils/authStorage";
import { getUserWorkPlannerSettings } from "@/utils/userWorkPlannerSettings";
import type {
  DayEndPayload,
  WorkPlanDayEndAttachment,
  WorkPlanRecord,
} from "@/types/workPlanner";

interface DayEndMailModalProps {
  planId: string;
  plan: WorkPlanRecord;
  sessionUser?: { name?: string; email?: string } | null;
  isOpen: boolean;
  onClose: () => void;
  onCompleteSuccess: () => void;
  onSendAndComplete: (payload: DayEndPayload) => Promise<void>;
  loading?: boolean;
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

function generateDayEndHtmlTemplate(
  plan: WorkPlanRecord,
  executiveName: string,
  executiveEmail: string
): string {
  const planDateStr = plan.plan_date
    ? new Date(plan.plan_date).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-GB");

  const expenses = plan.expenses || [];
  const expensesTotal = expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const visits = plan.visits || [];
  const tasks = plan.works || [];

  const getStatusBadgeStyle = (statusStr?: string) => {
    const s = String(statusStr || "pending").toLowerCase().trim();
    if (s === "completed") return "background-color: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;";
    if (s === "in_progress") return "background-color: #fef3c7; color: #b45309; border: 1px solid #fde68a;";
    if (s === "created") return "background-color: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd;";
    if (["cancelled", "skipped", "rejected"].includes(s)) return "background-color: #fee2e2; color: #b91c1c; border: 1px solid #fecaca;";
    return "background-color: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;";
  };

  let visitsTableHtml = '<p style="font-size: 13px; color: #64748b; font-style: italic; margin: 8px 0;">No visits recorded for this plan.</p>';
  if (visits.length > 0) {
    const visitRows = visits
      .map((v, i) => {
        const party =
          (typeof v.party === "object" && v.party ? (v.party as any).party_name : null) ||
          v.party_name ||
          v.contact_person ||
          "N/A";
        const contact =
          v.contact_person ||
          (typeof v.party === "object" && v.party ? (v.party as any).contact_person : "") ||
          "";
        const purpose = v.purpose || "General";
        const status = (v.status || "pending").toLowerCase();
        const time = v.planned_start_time
          ? `${v.planned_start_time}${v.planned_end_time ? " - " + v.planned_end_time : ""}`
          : "—";

        let remarksHtml = "—";
        if (status === "completed") {
          const out = v.outcome || "";
          const outHtml = out ? `<div style="color: #15803d; font-weight: 500; margin-bottom: 6px;">${out}</div>` : "";

          const hasChecklist = [
            v.meeting_with_doctor,
            v.meeting_with_purchase,
            v.meeting_with_finance,
            v.meeting_with_engineer,
            v.new_product_introduced,
            v.order_received,
          ].some((val) => val !== undefined && val !== null);

          let checklistHtml = "";
          if (hasChecklist) {
            const renderTag = (label: string, val?: boolean) => {
              const isYes = Boolean(val);
              const style = isYes
                ? "background-color: #dcfce7; color: #166534; border: 1px solid #bbf7d0;"
                : "background-color: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0;";
              return `<span style="display: inline-block; padding: 2px 6px; margin: 2px 4px 2px 0; border-radius: 4px; font-size: 10px; font-weight: 600; ${style}">${label}: ${isYes ? "✓ Yes" : "✗ No"}</span>`;
            };

            checklistHtml = `
              <div style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed #cbd5e1;">
                <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 2px; letter-spacing: 0.5px;">Checklist:</div>
                <div>
                  ${renderTag("Doctor", v.meeting_with_doctor)}
                  ${renderTag("Purchase", v.meeting_with_purchase)}
                  ${renderTag("Finance", v.meeting_with_finance)}
                  ${renderTag("Engineer", v.meeting_with_engineer)}
                  ${renderTag("New Product", v.new_product_introduced)}
                  ${renderTag("Order", v.order_received)}
                </div>
              </div>
            `;
          }
          remarksHtml = outHtml || checklistHtml ? `${outHtml}${checklistHtml}` : "—";
        } else if (status === "in_progress") {
          const inp = v.in_progress_remarks || "";
          remarksHtml = inp ? `<div><span style="color: #b45309; font-weight: 700; font-size: 11px; text-transform: uppercase;">In Progress:</span> <span style="color: #334155;">${inp}</span></div>` : "—";
        } else if (status === "pending" || status === "created") {
          const pnd = v.pending_remarks || "";
          remarksHtml = pnd ? `<div><span style="color: #475569; font-weight: 700; font-size: 11px; text-transform: uppercase;">Pending Reason:</span> <span style="color: #334155;">${pnd}</span></div>` : "—";
        } else {
          const other = v.outcome || v.in_progress_remarks || v.pending_remarks || "";
          remarksHtml = other || "—";
        }

        const formattedStatus = status.replace(/_/g, " ").toUpperCase();

        return `
          <tr style="background-color: ${i % 2 === 0 ? "#ffffff" : "#f8fafc"};">
            <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #0f172a;">
              <div style="font-weight: 600;">${i + 1}. ${party}</div>
              ${contact ? `<div style="font-size: 11px; color: #64748b;">Contact: ${contact}</div>` : ""}
            </td>
            <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #334155;">
              ${purpose}
            </td>
            <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 12px; color: #475569; white-space: nowrap;">
              ${time}
            </td>
            <td style="padding: 10px 12px; border: 1px solid #e2e8f0; text-align: center; white-space: nowrap;">
              <span style="display: inline-block; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; ${getStatusBadgeStyle(status)}">
                ${formattedStatus}
              </span>
            </td>
            <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #334155;">
              ${remarksHtml}
            </td>
          </tr>
        `;
      })
      .join("");

    visitsTableHtml = `
      <table style="width: 100%; border-collapse: collapse; margin: 12px 0 20px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
        <thead>
          <tr style="background-color: #0f172a; color: #ffffff;">
            <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Client / Party</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Purpose</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Time</th>
            <th style="padding: 10px 12px; text-align: center; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Status</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Outcome / Notes</th>
          </tr>
        </thead>
        <tbody>
          ${visitRows}
        </tbody>
      </table>
    `;
  }

  let tasksTableHtml = '<p style="font-size: 13px; color: #64748b; font-style: italic; margin: 8px 0;">No tasks recorded for this plan.</p>';
  if (tasks.length > 0) {
    const taskRows = tasks
      .map((t, i) => {
        const title = t.title || "Task #" + (i + 1);
        const desc = t.description || "—";
        const status = (t.status || "pending").toLowerCase();

        let remarksHtml = "—";
        if (status === "completed") {
          const out = t.completion_remarks || t.outcome || "";
          remarksHtml = out ? `<div style="color: #15803d; font-weight: 500;">${out}</div>` : "—";
        } else if (status === "in_progress") {
          const inp = t.in_progress_remarks || "";
          remarksHtml = inp ? `<div><span style="color: #b45309; font-weight: 700; font-size: 11px; text-transform: uppercase;">In Progress:</span> <span style="color: #334155;">${inp}</span></div>` : "—";
        } else if (status === "pending" || status === "created") {
          const pnd = t.pending_remarks || "";
          remarksHtml = pnd ? `<div><span style="color: #475569; font-weight: 700; font-size: 11px; text-transform: uppercase;">Pending Reason:</span> <span style="color: #334155;">${pnd}</span></div>` : "—";
        } else {
          const other = t.completion_remarks || t.outcome || t.in_progress_remarks || t.pending_remarks || "";
          remarksHtml = other || "—";
        }

        const formattedStatus = status.replace(/_/g, " ").toUpperCase();

        return `
          <tr style="background-color: ${i % 2 === 0 ? "#ffffff" : "#f8fafc"};">
            <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #0f172a; font-weight: 600; width: 28%;">
              ${i + 1}. ${title}
            </td>
            <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #334155; width: 35%;">
              ${desc}
            </td>
            <td style="padding: 10px 12px; border: 1px solid #e2e8f0; text-align: center; white-space: nowrap; width: 15%;">
              <span style="display: inline-block; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; ${getStatusBadgeStyle(status)}">
                ${formattedStatus}
              </span>
            </td>
            <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #334155; width: 22%;">
              ${remarksHtml}
            </td>
          </tr>
        `;
      })
      .join("");

    tasksTableHtml = `
      <table style="width: 100%; border-collapse: collapse; margin: 12px 0 20px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
        <thead>
          <tr style="background-color: #0f172a; color: #ffffff;">
            <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Task Title</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Description</th>
            <th style="padding: 10px 12px; text-align: center; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Status</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${taskRows}
        </tbody>
      </table>
    `;
  }

  return `
<div style="font-family: Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b;">
  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
    <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 18px;">Day End Report — Summary</h2>
    <p style="margin: 4px 0; font-size: 14px;"><strong>Executive:</strong> ${executiveName} ${executiveEmail ? `(${executiveEmail})` : ""}</p>
    <p style="margin: 4px 0; font-size: 14px;"><strong>Plan Date:</strong> ${planDateStr}</p>
    <p style="margin: 4px 0; font-size: 14px;"><strong>Plan Type:</strong> ${plan.plan_type || "Visits"} | <strong>Location:</strong> ${plan.location || "N/A"}</p>
    <p style="margin: 4px 0; font-size: 14px;"><strong>Total Expenses Logged:</strong> ₹${expensesTotal.toLocaleString("en-IN")}</p>
  </div>

  <h3 style="color: #0f172a; font-size: 16px; border-bottom: 2px solid #0284c7; padding-bottom: 6px; margin-top: 24px;">Field Visits (${visits.length})</h3>
  ${visitsTableHtml}

  <h3 style="color: #0f172a; font-size: 16px; border-bottom: 2px solid #059669; padding-bottom: 6px; margin-top: 24px;">Tasks / Work Items (${tasks.length})</h3>
  ${tasksTableHtml}

  <h3 style="color: #0f172a; font-size: 16px; border-bottom: 2px solid #475569; padding-bottom: 6px; margin-top: 24px;">Key Highlights & Day End Remarks</h3>
  <p style="font-size: 14px; color: #334155; padding: 12px; background: #f1f5f9; border-radius: 6px;">
    ${plan.remarks ? plan.remarks : "Please add any specific highlights, order wins, follow-ups, or escalations here..."}
  </p>
</div>
  `.trim();
}

export function DayEndMailModal({
  planId,
  plan,
  sessionUser,
  isOpen,
  onClose,
  onCompleteSuccess,
  onSendAndComplete,
  loading: parentLoading = false,
}: DayEndMailModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentSessionUser = sessionUser || readSessionFromStorage()?.user;
  const adminRole = isWpAdmin(currentSessionUser as any);
  const isElevatedNonAdmin = isWpElevated(currentSessionUser as any) && !adminRole;

  // Fetch prefilled Day End draft from backend
  const { data: draftData, isLoading: draftLoading } = useGetDayEndDraftQuery(planId, {
    skip: !isOpen,
  });
  const { data: usersData } = useGetUsersQuery(undefined, { skip: !isOpen || !adminRole });
  const { data: myTeamData } = useGetMyTeamQuery(undefined, { skip: !isOpen || !isElevatedNonAdmin });
  const { data: eligibleManagersData } = useGetEligibleManagersQuery(undefined, { skip: !isOpen });

  const [uploadAttachmentMut] = useUploadWorkPlanAttachmentMutation();

  // Fetch user settings for plan type manager/CC lookup
  const targetUserObj =
    typeof plan?.sales_user === "object" && plan?.sales_user ? plan.sales_user : null;
  const targetExecId = targetUserObj
    ? String(targetUserObj._id || targetUserObj.id || "")
    : String((currentSessionUser as any)?._id || (currentSessionUser as any)?.id || "");

  const { data: dbUserSettings } = useGetUserSettingsQuery(targetExecId, {
    skip: !isOpen || !targetExecId,
  });

  const effectiveSettings = useMemo(() => {
    if (dbUserSettings) return dbUserSettings;
    if (targetExecId) return getUserWorkPlannerSettings(targetExecId);
    return null;
  }, [dbUserSettings, targetExecId]);

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

    // 3. Add Portal Admins / Managers / Coordinators
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

  const fromName =
    (typeof plan?.sales_user === "object" && plan?.sales_user ? (plan.sales_user as any)?.name : null) ||
    currentSessionUser?.name ||
    sessionUser?.name ||
    "Executive";
  const fromEmail =
    draftData?.from_email ||
    (typeof plan?.sales_user === "object" && plan?.sales_user ? (plan.sales_user as any)?.email : null) ||
    currentSessionUser?.email ||
    sessionUser?.email ||
    "";

  const userEditedSubjectRef = useRef(false);
  const userEditedBodyRef = useRef(false);
  const userEditedToRef = useRef(false);
  const userEditedCcRef = useRef(false);
  const appliedDraftKeyRef = useRef<string | null>(null);

  // Initialize draft values once fetched or settings loaded
  useEffect(() => {
    if (!isOpen) {
      appliedDraftKeyRef.current = null;
      userEditedSubjectRef.current = false;
      userEditedBodyRef.current = false;
      userEditedToRef.current = false;
      userEditedCcRef.current = false;
      setBodyHtml("");
      setSubject("");
      setToEmail("");
      setCcEmails([]);
      setAttachments([]);
      setIsAddingCc(false);
      setNewCcInput("");
      return;
    }

    if (!plan) return;

    const planDateStr = plan.plan_date
      ? new Date(plan.plan_date).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : new Date().toLocaleDateString("en-GB");

    const defaultSubject = `Day End Report — ${fromName} (${planDateStr})`;

    const planTypeStr = plan?.plan_type || "Visits";
    const pts = effectiveSettings?.planTypeSettings?.[planTypeStr];
    const ptsManagerEmail = pts?.assignedManagerEmail;
    const globalManagerEmail = effectiveSettings?.assignedManagerEmail;

    // Priority for TO recipient:
    // 1. Plan-type assigned manager email
    // 2. Global assigned manager email
    // 3. Draft TO email / discussed manager email / first manager in roster
    const chosenTo =
      ptsManagerEmail ||
      globalManagerEmail ||
      draftData?.to ||
      (plan?.discussed_manager_id && typeof plan.discussed_manager_id === "object"
        ? (plan.discussed_manager_id as any)?.email
        : "") ||
      availableManagers[0]?.email ||
      "";

    if (!userEditedToRef.current) {
      if (chosenTo && (!toEmail || toEmail !== chosenTo)) {
        setToEmail(chosenTo);
      } else if (!toEmail && draftData?.to) {
        setToEmail(draftData.to);
      }
    }

    // CC Field: Use plan type CC emails (or global CC if plan type CC is empty) + draft CC
    if (!userEditedCcRef.current) {
      const ptsCc = pts?.ccEmails || [];
      const globalCc = effectiveSettings?.ccEmails || [];
      const configuredCc = ptsCc.length > 0 ? ptsCc : globalCc;

      const activeFrom = fromEmail.toLowerCase().trim();
      const normTo = (chosenTo || toEmail || "").toLowerCase().trim();
      const combinedCcSet = new Set<string>();

      configuredCc.forEach((emailStr: string) => {
        const norm = String(emailStr).trim().toLowerCase();
        if (norm && norm !== normTo && norm !== activeFrom) {
          combinedCcSet.add(norm);
        }
      });

      if (draftData?.cc && Array.isArray(draftData.cc)) {
        draftData.cc.forEach((emailStr: string) => {
          const norm = String(emailStr).trim().toLowerCase();
          if (norm && norm !== normTo && norm !== activeFrom) {
            combinedCcSet.add(norm);
          }
        });
      }

      setCcEmails(Array.from(combinedCcSet));
    }

    // Initialize/update Subject and Body from draftData or fallback generator
    const draftKey = draftData ? `${planId}-${draftData.subject || "draft"}-${draftData.body_html ? "body" : ""}` : null;
    if (draftData && appliedDraftKeyRef.current !== draftKey) {
      if (!userEditedSubjectRef.current && draftData.subject) {
        setSubject(draftData.subject);
      }
      if (!userEditedBodyRef.current && draftData.body_html) {
        setBodyHtml(draftData.body_html);
      }
      appliedDraftKeyRef.current = draftKey;
    } else if (!draftData && !bodyHtml) {
      // Immediate client-side fallback generation so the editor is never blank
      const fallbackHtml = generateDayEndHtmlTemplate(plan, fromName, fromEmail);
      if (!userEditedBodyRef.current) {
        setBodyHtml(fallbackHtml);
      }
      if (!userEditedSubjectRef.current && !subject) {
        setSubject(defaultSubject);
      }
    }
  }, [isOpen, draftData, effectiveSettings, plan, availableManagers, fromName, fromEmail, planId]);

  // Handle adding CC tag
  const handleAddCc = (emailToAdd: string) => {
    userEditedCcRef.current = true;
    const trimmed = emailToAdd.trim().toLowerCase();
    if (!trimmed) return;
    if (!ccEmails.some((e) => e.toLowerCase() === trimmed)) {
      setCcEmails([...ccEmails, trimmed]);
    }
    setNewCcInput("");
    setIsAddingCc(false);
  };

  const handleRemoveCc = (indexToRemove: number) => {
    userEditedCcRef.current = true;
    setCcEmails(ccEmails.filter((_, i) => i !== indexToRemove));
  };

  // Handle file uploads
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    for (const file of fileList) {
      const tempId = `uploading-${Date.now()}-${file.name}`;
      setUploadingFiles((prev) => [...prev, file.name]);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("resourceId", planId);

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

  // Handle final submission
  const handleSubmitDayEnd = async () => {
    if (!toEmail.trim()) {
      toast.error("Please enter or select a recipient (To email)");
      return;
    }
    if (!subject.trim()) {
      toast.error("Please provide a subject for the Day End report");
      return;
    }
    if (uploadingFiles.length > 0) {
      toast.error("Please wait for all attachments to finish uploading");
      return;
    }

    setSubmitting(true);
    try {
      const payload: DayEndPayload = {
        from_email: fromEmail,
        to_email: toEmail.trim(),
        cc_emails: ccEmails,
        subject: subject.trim(),
        body_html: bodyHtml,
        attachment_ids: attachments.map((a) => a._id),
      };

      await onSendAndComplete(payload);
      toast.success("Day End submitted and email report dispatched successfully!");
      onCompleteSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, "Failed to complete Day End");
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isBusy = submitting || parentLoading;

  return (
    <div className="fixed inset-0 z-50 flex flex-col w-screen h-screen bg-card text-foreground overflow-hidden">
      {/* Header Bar */}
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border bg-surface px-4 py-3 sm:px-6 sm:py-3.5 shrink-0 shadow-xs gap-3">
        <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
            <Mail className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate">Day End Report Mail</h3>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                Official Completion Dispatch
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-muted line-clamp-1 sm:line-clamp-2">
              Standard email composer panel to review, customize, attach files, and dispatch report to managers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0 self-end sm:self-auto">
          <button
            type="button"
            disabled={isBusy}
            onClick={onClose}
            title="Discard and close"
            className="rounded-xl border border-border bg-card px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
          >
            Discard
          </button>
          <button
            type="button"
            disabled={isBusy || uploadingFiles.length > 0}
            onClick={handleSubmitDayEnd}
            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-emerald-600 px-3.5 sm:px-5 py-1.5 sm:py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer shrink-0"
          >
            {isBusy ? (
              <>
                <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>Send & Complete</span>
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
                onChange={(e) => {
                  userEditedToRef.current = true;
                  setToEmail(e.target.value);
                }}
                placeholder="Primary Manager Email (e.g. manager@shaktipumps.com)"
                className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus:border-emerald-500 focus:outline-hidden"
              />
            </div>

            {availableManagers.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-[11px] max-w-full">
                <span className="text-muted text-[10px] sm:text-[11px] font-semibold shrink-0">Quick pick:</span>
                {availableManagers.map((m) => {
                  const isSelected = toEmail.toLowerCase() === m.email.toLowerCase();
                  const isInCc = ccEmails.some((e) => e.toLowerCase() === m.email.toLowerCase());
                  return (
                    <div key={m._id || m.email} className="inline-flex items-center rounded-lg border border-border bg-surface overflow-hidden shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          userEditedToRef.current = true;
                          setToEmail(m.email);
                        }}
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

            {/* Quick suggestions from remaining managers */}
            {availableManagers
              .filter(
                (m) =>
                  m.email !== toEmail &&
                  !ccEmails.some((c) => c.toLowerCase() === m.email.toLowerCase())
              )
              .slice(0, 3)
              .map((m) => (
                <button
                  key={m._id}
                  type="button"
                  onClick={() => handleAddCc(m.email)}
                  className="rounded-md border border-border/80 bg-surface/50 px-2 py-0.5 text-[11px] text-muted hover:bg-surface-muted transition cursor-pointer shrink-0"
                >
                  + {m.name}
                </button>
              ))}
          </div>
        </div>

        {/* SUBJECT Field */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          <span className="w-auto sm:w-16 font-semibold text-muted shrink-0 text-left sm:text-right">Subject:</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => {
              userEditedSubjectRef.current = true;
              setSubject(e.target.value);
            }}
            placeholder="Day End Report Subject"
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground focus:border-emerald-500 focus:outline-hidden min-w-0"
          />
        </div>

          {/* ATTACHMENTS Bar */}
          <div className="flex items-start gap-3 pt-1">
            <span className="w-16 font-semibold text-muted shrink-0 text-right pt-1.5">Attach:</span>
            <div className="flex-1 flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,image/*,.xlsx,.xls,.csv,.doc,.docx"
                onChange={handleFilesSelected}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition cursor-pointer"
              >
                <Paperclip className="h-3.5 w-3.5 text-muted" />
                Attach Files (PDF, Image, Excel, etc.)
              </button>

              {/* Uploading indicator tags */}
              {uploadingFiles.map((fname, i) => (
                <div
                  key={i}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-600 dark:text-emerald-400"
                >
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="truncate max-w-[150px]">{fname}</span>
                  <span className="text-[10px] font-medium">Uploading...</span>
                </div>
              ))}

              {/* Attached file chips */}
              {attachments.map((att) => (
                <div
                  key={att._id}
                  className="group inline-flex items-center gap-2 rounded-lg border border-border bg-surface-muted/50 px-2.5 py-1 text-xs text-foreground shadow-2xs hover:bg-surface transition"
                >
                  {getFileIcon(att.mime_type, att.original_name)}
                  <span
                    className="truncate max-w-[160px] font-medium"
                    title={att.original_name || att.file_name}
                  >
                    {att.original_name || att.file_name}
                  </span>
                  <span className="text-[10px] text-muted font-normal">
                    ({formatFileSize(att.size)})
                  </span>

                  {att.url && (
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Preview attachment"
                      className="text-muted hover:text-foreground transition"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(att._id)}
                    title="Remove attachment"
                    className="text-muted hover:text-rose-500 transition cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rich Text Editor Body */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden bg-surface/30">
          <div className="flex items-center justify-between pb-2 text-xs text-muted">
            <span className="font-semibold uppercase tracking-wider text-[11px]">
              Email Body (Rich WYSIWYG Editor)
            </span>
            <span>Formatted HTML summary of visits, tasks, and notes</span>
          </div>

          {draftLoading && !bodyHtml ? (
            <div className="flex-1 flex items-center justify-center border border-border rounded-xl bg-card">
              <div className="flex flex-col items-center gap-2 text-muted">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                <span className="text-xs">Preparing standard Day End email template...</span>
              </div>
            </div>
          ) : (
            <DayEndRichEditor
              value={bodyHtml}
              onChange={(val) => {
                userEditedBodyRef.current = true;
                setBodyHtml(val);
              }}
              placeholder="Edit your day end remarks and summary..."
              className="flex-1 h-full"
              minHeight="280px"
            />
          )}
        </div>

        {/* Footer Warning & Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border bg-surface px-5 py-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
            <span className="text-[11px] leading-tight">
              Completing Day End marks this work plan as completed and locks further edits to visits and tasks.
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              disabled={isBusy}
              onClick={onClose}
              className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isBusy || uploadingFiles.length > 0}
              onClick={handleSubmitDayEnd}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
            >
              {isBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending & Completing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm & Complete Day End
                </>
              )}
            </button>
          </div>
        </div>
      </div>
  );
}

export default DayEndMailModal;
