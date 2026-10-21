/**
 * @fileoverview Comprehensive Auto-Notification & Scheduled Reminder service for Work Planner.
 * Strictly uses work_planner portal access roles (not parent roles or department).
 * @module modules/workPlanner/workPlannerAutoNotification.service
 */
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { getModels } = require('../../data/mongoRegistry');
const { toPlain } = require('../../utils/mongoJson');
const emailHelper = require('../messages/helpers/email.helper');
const { logger } = require('../../utils/logger');
const {
  NOTIFICATION_SERVICE_URL,
  JWT_SECRET,
  FRONTEND_URL,
} = require('../../config/env');
const { resolveEmailAttachments } = require('../../services/fileManagement');
const {
  resolveDirectReportingManager,
  resolveReportingStakeholderEmails,
} = require('./workPlannerTeamReporting.service');

function getServiceToken() {
  return jwt.sign(
    {
      sub: 'work-planner-service',
      name: 'Work Planner Service',
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

/**
 * Normalizes role string to lowercase trimmed token.
 */
function normalizeRole(r) {
  return String(r || '').trim().toLowerCase();
}

/**
 * Extracts ONLY portal access_roles for 'work_planner' (ignoring parent roles & department).
 */
function getWorkPlannerPortalRoles(user) {
  if (!user) return [];
  const portals = Array.isArray(user.portals) ? user.portals : [];
  const wpPortal = portals.find(
    (p) => p && normalizeRole(p.portal_code || p.portal) === 'work_planner'
  );
  if (!wpPortal || !Array.isArray(wpPortal.access_roles)) return [];
  return wpPortal.access_roles.map(normalizeRole).filter(Boolean);
}

function isWpExecutive(user) {
  const roles = getWorkPlannerPortalRoles(user);
  return roles.some((r) => ['executive', 'sales'].includes(r));
}

function isWpCoordinator(user) {
  const roles = getWorkPlannerPortalRoles(user);
  return roles.includes('coordinator');
}

function isWpManager(user) {
  const roles = getWorkPlannerPortalRoles(user);
  return roles.includes('manager');
}

function isWpAdmin(user) {
  const roles = getWorkPlannerPortalRoles(user);
  return roles.includes('admin');
}

/**
 * Fetches all active users possessing a given role in work_planner portal access_roles.
 */
async function getActiveUsersByWpRole(roleFilter = 'all') {
  try {
    const { User } = getModels();
    const users = await User.find({ is_active: { $ne: false } }).lean();

    return users.filter((u) => {
      const roles = getWorkPlannerPortalRoles(u);
      if (roles.length === 0) return false;
      if (roleFilter === 'all') return true;
      if (roleFilter === 'executive') return roles.some((r) => ['executive', 'sales'].includes(r));
      if (roleFilter === 'coordinator') return roles.includes('coordinator') || roles.includes('manager') || roles.includes('admin');
      if (roleFilter === 'manager') return roles.includes('manager') || roles.includes('admin');
      if (roleFilter === 'admin') return roles.includes('admin');
      return false;
    });
  } catch (err) {
    logger.error(`[AutoNotification] Failed to query active users for role ${roleFilter}: ${err.message}`);
    return [];
  }
}

/**
 * Gets all active coordinators, managers & admins for work_planner portal.
 */
async function getWorkPlannerManagers() {
  return getActiveUsersByWpRole('coordinator');
}

/**
 * Gets all active portal admins for work_planner portal.
 */
async function getWorkPlannerAdmins() {
  return getActiveUsersByWpRole('admin');
}

/**
 * Sends in-app notification (SSE / WebPush via notification-service + MongoDB fallback).
 */
async function sendInAppNotification(userId, { title, message, type = 'info', entity_type = 'work_planner', entity_id = null }) {
  if (!userId) return null;
  const strUserId = String(userId);

  // 1. Direct MongoDB write so it is immediately accessible
  let createdDoc = null;
  try {
    const { Notification } = getModels();
    const doc = await Notification.create({
      user: strUserId,
      title,
      message,
      type,
      module: 'work_planner',
      entity_type,
      entity_id: entity_id ? String(entity_id) : undefined,
      is_read: false,
    });
    createdDoc = toPlain(doc.toObject());
  } catch (err) {
    logger.warn(`[AutoNotification] Local notification write failed: ${err.message}`);
  }

  // 2. Broadcast via notification-service for real-time SSE & Web Push
  if (NOTIFICATION_SERVICE_URL) {
    try {
      const url = `${NOTIFICATION_SERVICE_URL.replace(/\/$/, '')}/api/notifications/internal/create`;
      await axios.post(
        url,
        {
          userId: strUserId,
          payload: {
            title,
            message,
            type,
            module: 'work_planner',
            entity_type,
            entity_id: entity_id ? String(entity_id) : undefined,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${getServiceToken()}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }
      );
    } catch (pushErr) {
      // Best-effort: do not throw
    }
  }

  return createdDoc;
}

/**
 * Resolves all stakeholders for a given plan / sales user:
 * - Executive user
 * - Direct Reporting Manager
 * - Portal Managers
 * - Configured CC Emails
 */
async function resolveStakeholders(salesUserId, planDoc = null) {
  const { User } = getModels();
  const salesUser = await User.findOne({ _id: salesUserId, is_active: { $ne: false } }).lean();
  const {
    directManager,
    uplineManagers,
    primaryRecipientEmail,
    ccList,
    inAppUserIds,
  } = await resolveReportingStakeholderEmails(salesUserId, planDoc);

  const allManagers = await getWorkPlannerManagers();

  return {
    salesUser,
    directManager,
    uplineManagers,
    allManagers,
    primaryRecipientEmail,
    ccList,
    inAppUserIds,
  };
}

/**
 * Resolves stakeholders strictly for Request Created and Claims Logged:
 * - Primary TO: Direct Manager
 * - CC: Portal Admins (excluding direct manager)
 * - If NO direct manager: Primary TO = Portal Admin (1st), CC = Remaining Admins (or managers if no admins)
 * - In-App: Direct Manager + All Admins
 */
async function resolveDirectManagerAndAdmins(salesUserId, planDoc = null) {
  const { User } = getModels();
  const salesUser = await User.findOne({ _id: salesUserId, is_active: { $ne: false } }).lean();
  const allManagers = await getWorkPlannerManagers();
  const allAdmins = await getWorkPlannerAdmins();

  const { directManager, settingsCcEmails } = await resolveDirectReportingManager(salesUserId, planDoc);

  const adminEmails = allAdmins.map((a) => a.email).filter(Boolean);
  const managerEmails = allManagers.map((m) => m.email).filter(Boolean);

  let primaryRecipientEmail = '';
  const ccEmails = new Set(
    settingsCcEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean)
  );

  const inAppUserIds = new Set();
  for (const a of allAdmins) {
    if (a._id) inAppUserIds.add(String(a._id));
  }

  if (directManager && directManager.email) {
    primaryRecipientEmail = directManager.email;
    if (directManager._id) inAppUserIds.add(String(directManager._id));

    for (const adminEmail of adminEmails) {
      if (adminEmail.toLowerCase() !== primaryRecipientEmail.toLowerCase()) {
        ccEmails.add(adminEmail.toLowerCase());
      }
    }
  } else if (adminEmails.length > 0) {
    primaryRecipientEmail = adminEmails[0];
    for (let i = 1; i < adminEmails.length; i++) {
      ccEmails.add(adminEmails[i].toLowerCase());
    }
  } else if (managerEmails.length > 0) {
    primaryRecipientEmail = managerEmails[0];
    for (let i = 1; i < managerEmails.length; i++) {
      ccEmails.add(managerEmails[i].toLowerCase());
    }
    for (const m of allManagers) {
      if (m._id) inAppUserIds.add(String(m._id));
    }
  }

  if (primaryRecipientEmail) {
    ccEmails.delete(primaryRecipientEmail.toLowerCase());
  }

  return {
    salesUser,
    directManager,
    allAdmins,
    allManagers,
    primaryRecipientEmail,
    ccList: Array.from(ccEmails),
    inAppUserIds: Array.from(inAppUserIds),
  };
}

function formatDate(d) {
  if (!d) return 'N/A';
  try {
    return new Date(d).toISOString().split('T')[0];
  } catch {
    return String(d);
  }
}

function formatTime(d) {
  if (!d) return '—';
  try {
    const date = new Date(d);
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return String(d);
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripHtml(html) {
  if (!html) return '';
  return String(html).replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
}

function getUserRoleLabel(user) {
  if (!user) return 'Senior Authority';
  const roles = getWorkPlannerPortalRoles(user);
  if (roles.includes('admin')) return 'Portal Admin';
  if (roles.includes('coordinator')) return 'Coordinator';
  if (roles.includes('manager')) return 'Senior Manager';
  const r = String(user.role || '').toLowerCase();
  if (r.includes('admin')) return 'Admin';
  if (r.includes('manager')) return 'Manager';
  return 'Senior Authority';
}

function renderVisitsTable(visitsList) {
  if (!Array.isArray(visitsList) || visitsList.length === 0) {
    return '<p style="font-size: 13px; color: #64748b; font-style: italic; margin: 8px 0;">No visits recorded for this plan.</p>';
  }
  const rows = visitsList
    .map((v, i) => {
      const party =
        (v.party && typeof v.party === 'object' ? v.party.party_name : null) ||
        v.party_name ||
        v.contact_person ||
        'N/A';
      const contact =
        v.contact_person ||
        (v.party && typeof v.party === 'object' ? v.party.contact_person : '') ||
        '';
      const purpose = v.purpose || 'General';
      const status = (v.status || 'pending').toLowerCase();
      const time = v.planned_start_time
        ? `${formatTime(v.planned_start_time)}${v.planned_end_time ? ' - ' + formatTime(v.planned_end_time) : ''}`
        : '—';

      let statusBadgeStyle = 'background-color: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;';
      if (status === 'completed') {
        statusBadgeStyle = 'background-color: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;';
      } else if (status === 'in_progress' || status === 'checked_in') {
        statusBadgeStyle = 'background-color: #fef3c7; color: #b45309; border: 1px solid #fde68a;';
      } else if (status === 'created' || status === 'pending') {
        statusBadgeStyle = 'background-color: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd;';
      } else if (['cancelled', 'skipped'].includes(status)) {
        statusBadgeStyle = 'background-color: #fee2e2; color: #b91c1c; border: 1px solid #fecaca;';
      }

      let remarksHtml = '—';
      if (status === 'completed') {
        const out = v.outcome || v.notes || '';
        const outHtml = out ? `<div style="color: #15803d; font-weight: 500; margin-bottom: 6px;">${escapeHtml(out)}</div>` : '';

        const hasChecklist = [
          v.meeting_with_doctor,
          v.meeting_with_purchase,
          v.meeting_with_finance,
          v.meeting_with_engineer,
          v.new_product_introduced,
          v.order_received,
        ].some((val) => val !== undefined && val !== null);

        let checklistHtml = '';
        if (hasChecklist) {
          const renderTag = (label, val) => {
            const isYes = Boolean(val);
            const style = isYes
              ? 'background-color: #dcfce7; color: #166534; border: 1px solid #bbf7d0;'
              : 'background-color: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0;';
            return `<span style="display: inline-block; padding: 2px 6px; margin: 2px 4px 2px 0; border-radius: 4px; font-size: 10px; font-weight: 600; ${style}">${label}: ${isYes ? '✓ Yes' : '✗ No'}</span>`;
          };

          checklistHtml = `
            <div style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed #cbd5e1;">
              <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 2px; letter-spacing: 0.5px;">Checklist:</div>
              <div>
                ${renderTag('Doctor', v.meeting_with_doctor)}
                ${renderTag('Purchase', v.meeting_with_purchase)}
                ${renderTag('Finance', v.meeting_with_finance)}
                ${renderTag('Engineer', v.meeting_with_engineer)}
                ${renderTag('New Product', v.new_product_introduced)}
                ${renderTag('Order', v.order_received)}
              </div>
            </div>
          `;
        }
        remarksHtml = outHtml || checklistHtml ? `${outHtml}${checklistHtml}` : '—';
      } else if (status === 'in_progress') {
        const inp = v.in_progress_remarks || v.notes || '';
        remarksHtml = inp ? `<div><span style="color: #b45309; font-weight: 700; font-size: 11px; text-transform: uppercase;">In Progress:</span> <span style="color: #334155;">${escapeHtml(inp)}</span></div>` : '—';
      } else if (status === 'pending' || status === 'created') {
        const pnd = v.pending_remarks || v.notes || '';
        remarksHtml = pnd ? `<div><span style="color: #475569; font-weight: 700; font-size: 11px; text-transform: uppercase;">Pending:</span> <span style="color: #334155;">${escapeHtml(pnd)}</span></div>` : '—';
      }

      const formattedStatus = status.replace(/_/g, ' ').toUpperCase();

      return `
        <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #0f172a;">
            <div style="font-weight: 600;">${i + 1}. ${escapeHtml(party)}</div>
            ${contact ? `<div style="font-size: 11px; color: #64748b;">Contact: ${escapeHtml(contact)}</div>` : ''}
          </td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #334155;">
            ${escapeHtml(purpose)}
          </td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 12px; color: #475569; white-space: nowrap;">
            ${time}
          </td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; text-align: center; white-space: nowrap;">
            <span style="display: inline-block; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; ${statusBadgeStyle}">
              ${formattedStatus}
            </span>
          </td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #334155;">
            ${remarksHtml}
          </td>
        </tr>
      `;
    })
    .join('');

  return `
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
        ${rows}
      </tbody>
    </table>
  `;
}

function renderTasksTable(taskList) {
  if (!Array.isArray(taskList) || taskList.length === 0) {
    return '<p style="font-size: 13px; color: #64748b; font-style: italic; margin: 8px 0;">No tasks recorded for this plan.</p>';
  }
  const rows = taskList
    .map((t, i) => {
      const title = t.title || 'Task #' + (i + 1);
      const desc = t.description || '—';
      const status = (t.status || 'pending').toLowerCase();
      const time = t.planned_start_time
        ? `${formatTime(t.planned_start_time)}${t.planned_end_time ? ' - ' + formatTime(t.planned_end_time) : ''}`
        : '—';

      let statusBadgeStyle = 'background-color: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;';
      if (status === 'completed') {
        statusBadgeStyle = 'background-color: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;';
      } else if (status === 'in_progress') {
        statusBadgeStyle = 'background-color: #fef3c7; color: #b45309; border: 1px solid #fde68a;';
      } else if (status === 'created' || status === 'pending') {
        statusBadgeStyle = 'background-color: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd;';
      } else if (status === 'cancelled') {
        statusBadgeStyle = 'background-color: #fee2e2; color: #b91c1c; border: 1px solid #fecaca;';
      }

      let remarksHtml = '—';
      if (status === 'completed') {
        const out = t.completion_remarks || t.outcome || '';
        remarksHtml = out ? `<div style="color: #15803d; font-weight: 500;">${escapeHtml(out)}</div>` : '—';
      } else if (status === 'in_progress') {
        const inp = t.in_progress_remarks || '';
        remarksHtml = inp ? `<div><span style="color: #b45309; font-weight: 700; font-size: 11px; text-transform: uppercase;">In Progress:</span> <span style="color: #334155;">${escapeHtml(inp)}</span></div>` : '—';
      } else if (status === 'pending' || status === 'created') {
        const pnd = t.pending_remarks || '';
        remarksHtml = pnd ? `<div><span style="color: #475569; font-weight: 700; font-size: 11px; text-transform: uppercase;">Pending:</span> <span style="color: #334155;">${escapeHtml(pnd)}</span></div>` : '—';
      }

      const formattedStatus = status.replace(/_/g, ' ').toUpperCase();

      return `
        <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #0f172a; font-weight: 600; width: 25%;">
            ${i + 1}. ${escapeHtml(title)}
          </td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #334155; width: 35%;">
            ${escapeHtml(desc)}
          </td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 12px; color: #475569; white-space: nowrap; width: 15%;">
            ${time}
          </td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; text-align: center; white-space: nowrap; width: 10%;">
            <span style="display: inline-block; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; ${statusBadgeStyle}">
              ${formattedStatus}
            </span>
          </td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #334155; width: 15%;">
            ${remarksHtml}
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <table style="width: 100%; border-collapse: collapse; margin: 12px 0 20px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
      <thead>
        <tr style="background-color: #0f172a; color: #ffffff;">
          <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Task Title</th>
          <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Description</th>
          <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Time</th>
          <th style="padding: 10px 12px; text-align: center; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Status</th>
          <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Remarks</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

/**
 * 1. WORK PLAN CREATED AUTO NOTIFICATION
 */
async function notifyWorkPlanCreated({ planId, actorUser, creationMailData = {} }) {
  try {
    const { WorkPlan, WorkPlanVisit, WorkPlanWork } = getModels();
    const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null }).lean();
    if (!plan) return;

    const salesUserId = plan.sales_user;
    const { salesUser, inAppUserIds } =
      await resolveStakeholders(salesUserId, plan);

    const planDateStr = formatDate(plan.plan_date);
    const executiveName = salesUser?.name || salesUser?.email?.split('@')[0] || 'Executive';
    const actorName = actorUser?.name || actorUser?.email?.split('@')[0] || 'User';

    // In-App Notifications
    const isSelf = String(actorUser?._id || actorUser?.id) === String(salesUserId);
    for (const uid of inAppUserIds) {
      if (String(uid) === String(salesUserId)) {
        if (!isSelf) {
          await sendInAppNotification(uid, {
            title: 'New Work Plan Assigned',
            message: `${actorName} created a new Work Plan for you for ${planDateStr} (${plan.plan_type || 'Visits'}).`,
            type: 'info',
            entity_type: 'work_plan',
            entity_id: plan._id,
          });
        }
      } else {
        await sendInAppNotification(uid, {
          title: `New Work Plan: ${executiveName}`,
          message: `${executiveName} submitted a ${plan.plan_type || 'Visits'} plan for ${planDateStr}${plan.location ? ' in ' + plan.location : ''}.`,
          type: 'info',
          entity_type: 'work_plan',
          entity_id: plan._id,
        });
      }
    }

    // Load related items
    const [visits, workItems] = await Promise.all([
      WorkPlanVisit.find({ work_plan: planId, deletedAt: null }).sort({ sequence: 1 }).lean(),
      WorkPlanWork.find({ work_plan: planId, deletedAt: null }).sort({ sequence: 1 }).lean(),
    ]);

    const explicitTo = creationMailData.to_email || creationMailData.toEmail;
    const recipient = typeof explicitTo === 'string' ? explicitTo.trim() : '';
    if (!recipient) {
      logger.info(`[AutoNotification] In-app work plan notice sent for ${planId}; no mail because the client did not set a recipient`);
      return;
    }

    const providedCreationCc = creationMailData.cc_emails !== undefined
      ? creationMailData.cc_emails
      : creationMailData.ccEmails;
    // CC only what the client sent. Do not fill in portal admins or managers.
    const mailCc = Array.isArray(providedCreationCc)
      ? providedCreationCc.map((e) => String(e).trim()).filter(Boolean)
      : [];

    const fromAddress = salesUser?.email ? `${executiveName} <${salesUser.email}>` : `${actorName} <${actorUser.email}>`;
    const visitsTableHtml = renderVisitsTable(visits);
    const tasksTableHtml = renderTasksTable(workItems);
    const baseUrl = (FRONTEND_URL || process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const workPlanUrl = baseUrl ? `${baseUrl}/work-plans` : '';

    const subject = creationMailData.subject?.trim() || `New Work Plan Created — ${executiveName} (${planDateStr})`;

    const customBody = creationMailData.body_html || creationMailData.bodyHtml;
    const emailHtml = (customBody && customBody.trim()) ? customBody : `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 680px; margin: 0 auto; color: #1e293b; line-height: 1.5;">
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: #ffffff; padding: 24px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #ffffff;">New Work Plan Submitted</h2>
          <p style="margin: 0; font-size: 14px; opacity: 0.9;">Work plan scheduled for <strong>${planDateStr}</strong></p>
        </div>
        <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; background-color: #ffffff; border-radius: 0 0 8px 8px;">
          <table style="width: 100%; margin-bottom: 20px; font-size: 13px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; width: 140px;"><strong>Executive:</strong></td>
              <td style="padding: 6px 0; color: #0f172a;">${escapeHtml(executiveName)} (${escapeHtml(salesUser?.email || '')})</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;"><strong>Plan Type:</strong></td>
              <td style="padding: 6px 0; color: #0f172a;"><span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-weight: 600;">${escapeHtml(plan.plan_type || 'Visits')}</span></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;"><strong>Location:</strong></td>
              <td style="padding: 6px 0; color: #0f172a;">${escapeHtml(plan.location || 'N/A')}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;"><strong>General Remarks:</strong></td>
              <td style="padding: 6px 0; color: #0f172a;">${escapeHtml(plan.remarks || 'None')}</td>
            </tr>
          </table>

          <h3 style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 18px 0 8px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
            Planned Visits (${visits.length})
          </h3>
          ${visitsTableHtml}

          <h3 style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 24px 0 8px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
            Planned Tasks / Work Items (${workItems.length})
          </h3>
          ${tasksTableHtml}

          ${workPlanUrl ? `
            <div style="margin-top: 24px; text-align: center;">
              <a href="${workPlanUrl}" style="background-color: #2563eb; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px; display: inline-block;">
                View Plan in OPMS Portal
              </a>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    const rawAtts = creationMailData.attachment_ids || creationMailData.attachmentIds || creationMailData.attachments;
    const emailAttachments = await resolveEmailAttachments(rawAtts);

    await emailHelper.sendEmail(
      recipient,
      subject,
      '',
      emailHtml,
      emailAttachments,
      mailCc,
      fromAddress,
      'work_plan_created'
    );
    logger.info(`[AutoNotification] Sent Work Plan creation email to ${recipient} (CC: ${mailCc.join(', ')}, Attachments: ${emailAttachments.length})`);
  } catch (err) {
    logger.error(`[AutoNotification] Failed to dispatch work plan creation notification: ${err.message}`);
  }
}

/**
 * 2. VISIT CREATED AUTO NOTIFICATION
 */
async function notifyVisitCreated({ visit, planDoc = null, actorUser = null }) {
  try {
    if (!visit) return;
    const { WorkPlan, Party } = getModels();
    let plan = planDoc;
    if (!plan && visit.work_plan) {
      plan = await WorkPlan.findOne({ _id: visit.work_plan, deletedAt: null }).lean();
    }

    const salesUserId = visit.sales_user || plan?.sales_user;
    const { salesUser, directManager, allManagers, primaryRecipientEmail, ccList, inAppUserIds } =
      await resolveStakeholders(salesUserId, plan);

    const partyName = visit.party_name || (visit.party && typeof visit.party === 'object' ? visit.party.party_name : 'New Party');
    const planDateStr = formatDate(visit.plan_date || plan?.plan_date || new Date());
    const executiveName = salesUser?.name || salesUser?.email?.split('@')[0] || 'Executive';
    const actorName = actorUser?.name || actorUser?.email?.split('@')[0] || 'Manager';
    const isSelf = String(actorUser?._id || actorUser?.id) === String(salesUserId);

    // In-App Notifications
    for (const uid of inAppUserIds) {
      if (String(uid) === String(salesUserId)) {
        if (!isSelf) {
          await sendInAppNotification(uid, {
            title: `New Visit Added: ${partyName}`,
            message: `${actorName} scheduled a visit to "${partyName}" for you on ${planDateStr}.`,
            type: 'info',
            entity_type: 'visit',
            entity_id: visit._id,
          });
        }
      } else {
        await sendInAppNotification(uid, {
          title: `New Visit: ${executiveName} → ${partyName}`,
          message: `${executiveName} scheduled a visit to "${partyName}" on ${planDateStr} (${visit.purpose || 'General'}).`,
          type: 'info',
          entity_type: 'visit',
          entity_id: visit._id,
        });
      }
    }

    logger.info(`[AutoNotification] Dispatched in-app notifications for visit created: ${partyName}`);
  } catch (err) {
    logger.error(`[AutoNotification] Failed to dispatch visit created notification: ${err.message}`);
  }
}

/**
 * 3. WORK TASK CREATED AUTO NOTIFICATION
 */
async function notifyTaskCreated({ task, planDoc = null, actorUser = null }) {
  try {
    if (!task) return;
    const { WorkPlan } = getModels();
    let plan = planDoc;
    if (!plan && task.work_plan) {
      plan = await WorkPlan.findOne({ _id: task.work_plan, deletedAt: null }).lean();
    }

    const salesUserId = task.sales_user || plan?.sales_user;
    const { salesUser, directManager, allManagers, primaryRecipientEmail, ccList, inAppUserIds } =
      await resolveStakeholders(salesUserId, plan);

    const planDateStr = formatDate(task.plan_date || plan?.plan_date || new Date());
    const executiveName = salesUser?.name || salesUser?.email?.split('@')[0] || 'Executive';
    const actorName = actorUser?.name || actorUser?.email?.split('@')[0] || 'Manager';
    const isSelf = String(actorUser?._id || actorUser?.id) === String(salesUserId);

    // In-App Notifications
    for (const uid of inAppUserIds) {
      if (String(uid) === String(salesUserId)) {
        if (!isSelf) {
          await sendInAppNotification(uid, {
            title: `New Task Assigned: "${task.title}"`,
            message: `${actorName} assigned task "${task.title}" to you for ${planDateStr}.`,
            type: 'info',
            entity_type: 'task',
            entity_id: task._id,
          });
        }
      } else {
        await sendInAppNotification(uid, {
          title: `New Task: ${executiveName} → "${task.title}"`,
          message: `${executiveName} added work task "${task.title}" on ${planDateStr}.`,
          type: 'info',
          entity_type: 'task',
          entity_id: task._id,
        });
      }
    }

    logger.info(`[AutoNotification] Dispatched in-app notifications for task created: "${task.title}"`);
  } catch (err) {
    logger.error(`[AutoNotification] Failed to dispatch task created notification: ${err.message}`);
  }
}

/**
 * 3.5. SENIOR DIRECTIVE / AUTHORITY REMARK ADDED AUTO NOTIFICATION (IN-APP + EMAIL TO JUNIOR)
 */
async function notifyAuthorityRemarkAdded({ planId, visitId = null, workId = null, expenseId = null, remarkText, actorUser }) {
  try {
    if (!remarkText || !String(remarkText).trim()) return;
    const { WorkPlan, WorkPlanVisit, WorkPlanWork, WorkPlanExpense, User } = getModels();

    let plan = null;
    let visit = null;
    let task = null;
    let expense = null;

    if (planId) {
      plan = await WorkPlan.findOne({ _id: planId, deletedAt: null }).lean();
    }
    if (visitId) {
      visit = await WorkPlanVisit.findOne({ _id: visitId, deletedAt: null }).lean();
      if (!plan && visit?.work_plan) {
        plan = await WorkPlan.findOne({ _id: visit.work_plan, deletedAt: null }).lean();
      }
    }
    if (workId) {
      task = await WorkPlanWork.findOne({ _id: workId, deletedAt: null }).lean();
      if (!plan && task?.work_plan) {
        plan = await WorkPlan.findOne({ _id: task.work_plan, deletedAt: null }).lean();
      }
    }
    if (expenseId) {
      expense = await WorkPlanExpense.findOne({ _id: expenseId, deletedAt: null }).lean();
      if (!plan && expense?.work_plan) {
        plan = await WorkPlan.findOne({ _id: expense.work_plan, deletedAt: null }).lean();
      }
    }

    if (!plan) return;

    const salesUserId = plan.sales_user;
    if (!salesUserId) return;

    const salesUser = await User.findById(salesUserId).lean();
    if (!salesUser) return;

    const actorId = String(actorUser?._id || actorUser?.id || '');
    const juniorId = String(salesUser._id || salesUser.id || '');

    // If junior is somehow acting on own, do not self-notify
    if (actorId && juniorId && actorId === juniorId) {
      return;
    }

    const seniorName = actorUser?.name || actorUser?.email?.split('@')[0] || 'Senior Authority';
    const seniorRole = getUserRoleLabel(actorUser);
    const planDateStr = formatDate(plan.plan_date);
    const cleanRemarkText = stripHtml(remarkText);

    let itemTypeLabel = 'Work Plan';
    let itemTitle = `Work Plan (${planDateStr})`;
    if (visit) {
      itemTypeLabel = 'Field Visit';
      itemTitle = visit.party_name || (typeof visit.party === 'object' ? visit.party?.party_name : '') || 'Field Visit';
    } else if (task) {
      itemTypeLabel = 'Task';
      itemTitle = task.title || 'Task';
    } else if (expense) {
      itemTypeLabel = 'Expense Claim';
      itemTitle = `${expense.category || 'Expense'} Claim (₹${expense.amount || 0})`;
    }

    // 1. In-App Notification to the concerned junior
    const notifTitle = `Senior Directive: ${itemTitle}`;
    const notifMessage = `${seniorName} (${seniorRole}) added guidance on your ${itemTypeLabel.toLowerCase()}: "${cleanRemarkText.length > 120 ? cleanRemarkText.slice(0, 117) + '...' : cleanRemarkText}"`;

    await sendInAppNotification(juniorId, {
      title: notifTitle,
      message: notifMessage,
      type: 'warning',
      entity_type: 'work_plan',
      entity_id: plan._id,
    });

    // 2. Email Notification to the concerned junior
    if (salesUser.email) {
      const baseUrl = (FRONTEND_URL || process.env.FRONTEND_URL || '').replace(/\/$/, '');
      const workPlanUrl = baseUrl ? `${baseUrl}/work-plans?planId=${plan._id}` : '';
      const subject = `Senior Directive Added: ${itemTitle} (${planDateStr})`;

      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; color: #1e293b; line-height: 1.5;">
          <div style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); color: #ffffff; padding: 24px; border-radius: 8px 8px 0 0;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.9; margin-bottom: 4px; font-weight: 700;">Work Planner &bull; Senior Guidance</div>
            <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #ffffff;">Senior Directive / Remark Added</h2>
            <p style="margin: 0; font-size: 14px; opacity: 0.95;">Guidance from <strong>${escapeHtml(seniorName)}</strong> (${escapeHtml(seniorRole)})</p>
          </div>
          <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; background-color: #ffffff; border-radius: 0 0 8px 8px;">
            <p style="font-size: 14px; margin-top: 0; color: #334155;">
              Hi <strong>${escapeHtml(salesUser.name || 'Executive')}</strong>,
            </p>
            <p style="font-size: 13px; color: #475569; margin-bottom: 16px;">
              A senior authority has recorded directives / feedback for your scheduled ${escapeHtml(itemTypeLabel.toLowerCase())}:
            </p>

            <table style="width: 100%; margin-bottom: 18px; font-size: 13px; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; width: 130px;"><strong>Item Type:</strong></td>
                <td style="padding: 6px 0; color: #0f172a;"><span style="background: #f3e8ff; color: #7e22ce; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 12px;">${escapeHtml(itemTypeLabel)}</span></td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;"><strong>Item Target:</strong></td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${escapeHtml(itemTitle)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;"><strong>Plan Date:</strong></td>
                <td style="padding: 6px 0; color: #0f172a;">${escapeHtml(planDateStr)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;"><strong>Given By:</strong></td>
                <td style="padding: 6px 0; color: #0f172a;">${escapeHtml(seniorName)} (${escapeHtml(seniorRole)})</td>
              </tr>
            </table>

            <div style="background-color: #faf5ff; border: 1px solid #e9d5ff; border-left: 4px solid #9333ea; border-radius: 6px; padding: 14px; margin: 18px 0;">
              <div style="font-size: 11px; font-weight: 700; color: #7e22ce; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em;">Senior Directive / Instruction:</div>
              <div style="font-size: 13px; color: #1e1b4b; line-height: 1.6;">${remarkText}</div>
            </div>

            ${
              workPlanUrl
                ? `
            <div style="margin: 24px 0 12px 0; text-align: center;">
              <a href="${workPlanUrl}" style="background-color: #7c3aed; color: #ffffff; padding: 10px 22px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px; display: inline-block;">
                Open Work Plan
              </a>
            </div>
            `
                : ''
            }
            <p style="font-size: 11px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 12px;">
              This is an automated notification from Work Planner. Please review and adhere to the guidance provided.
            </p>
          </div>
        </div>
      `;

      await emailHelper.sendEmail(
        salesUser.email,
        subject,
        cleanRemarkText,
        emailHtml,
        [],
        [],
        null,
        'directive_assigned'
      ).catch((err) => {
        logger.warn(`[AutoNotification] Failed sending senior remark email to ${salesUser.email}: ${err.message}`);
      });
    }

    logger.info(`[AutoNotification] Dispatched senior remark in-app & email notices for ${itemTypeLabel} (Plan: ${plan._id}) to junior ${salesUser.email}`);
  } catch (err) {
    logger.error(`[AutoNotification] Failed to dispatch senior remark notification: ${err.message}`);
  }
}

/**
 * 4. DAY END CREATED / WORK PLAN COMPLETED AUTO NOTIFICATION
 */
async function notifyDayEndCompleted({ planId, actorUser, dayEndData = null }) {
  try {
    const { WorkPlan, WorkPlanVisit, WorkPlanWork, WorkPlanExpense } = getModels();
    const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null }).lean();
    if (!plan) return;

    const salesUserId = plan.sales_user;
    const { salesUser, directManager, allManagers, primaryRecipientEmail, ccList, inAppUserIds } =
      await resolveStakeholders(salesUserId, plan);

    const [visits, workItems, expenses] = await Promise.all([
      WorkPlanVisit.find({ work_plan: planId, deletedAt: null }).sort({ sequence: 1 }).lean(),
      WorkPlanWork.find({ work_plan: planId, deletedAt: null }).sort({ sequence: 1 }).lean(),
      WorkPlanExpense.find({ work_plan: planId, deletedAt: null }).select('amount').lean(),
    ]);

    const expensesTotal = expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const planDateStr = formatDate(plan.plan_date);
    const executiveName = salesUser?.name || salesUser?.email?.split('@')[0] || 'Executive';

    // In-App Notifications
    for (const uid of inAppUserIds) {
      if (String(uid) === String(salesUserId)) {
        await sendInAppNotification(uid, {
          title: 'Day End Submitted',
          message: `Your Day End report for ${planDateStr} has been submitted successfully (${visits.length} visits, ${workItems.length} tasks).`,
          type: 'success',
          entity_type: 'day_end',
          entity_id: plan._id,
        });
      } else {
        await sendInAppNotification(uid, {
          title: `Day End Submitted: ${executiveName}`,
          message: `${executiveName} submitted Day End report for ${planDateStr} with ${visits.length} visits, ${workItems.length} tasks, and ₹${expensesTotal.toLocaleString('en-IN')} expenses.`,
          type: 'info',
          entity_type: 'day_end',
          entity_id: plan._id,
        });
      }
    }

    // Email Notification
    const recipient = dayEndData?.to_email || primaryRecipientEmail;
    if (!recipient) return;

    const providedDayEndCc = dayEndData?.cc_emails !== undefined
      ? dayEndData.cc_emails
      : dayEndData?.ccEmails;
    const mailCc = Array.isArray(providedDayEndCc)
      ? providedDayEndCc.map((e) => String(e).trim()).filter(Boolean)
      : [];

    const fromAddress = salesUser?.email ? `${executiveName} <${salesUser.email}>` : null;
    const visitsTableHtml = renderVisitsTable(visits);
    const tasksTableHtml = renderTasksTable(workItems);
    const baseUrl = (FRONTEND_URL || process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const workPlanUrl = baseUrl ? `${baseUrl}/work-plans` : '';

    const subject = dayEndData?.subject?.trim() || `Day End Report — ${executiveName} (${planDateStr})`;

    const emailHtml = dayEndData?.body_html || `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 680px; margin: 0 auto; color: #1e293b; line-height: 1.5;">
        <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; padding: 24px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #ffffff;">Day End Report Completed</h2>
          <p style="margin: 0; font-size: 14px; opacity: 0.9;">Work Summary for <strong>${planDateStr}</strong></p>
        </div>
        <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; background-color: #ffffff; border-radius: 0 0 8px 8px;">
          <table style="width: 100%; margin-bottom: 20px; font-size: 13px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; width: 140px;"><strong>Executive:</strong></td>
              <td style="padding: 6px 0; color: #0f172a;">${escapeHtml(executiveName)} (${escapeHtml(salesUser?.email || '')})</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;"><strong>Plan Type:</strong></td>
              <td style="padding: 6px 0; color: #0f172a;"><span style="background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 4px; font-weight: 600;">${escapeHtml(plan.plan_type || 'Visits')}</span></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;"><strong>Location:</strong></td>
              <td style="padding: 6px 0; color: #0f172a;">${escapeHtml(plan.location || 'N/A')}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;"><strong>Expenses Total:</strong></td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">₹${expensesTotal.toLocaleString('en-IN')}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;"><strong>Remarks:</strong></td>
              <td style="padding: 6px 0; color: #0f172a;">${escapeHtml(plan.remarks || 'None')}</td>
            </tr>
          </table>

          <h3 style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 18px 0 8px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
            Visits & Outcome Summary (${visits.length})
          </h3>
          ${visitsTableHtml}

          <h3 style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 24px 0 8px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
            Work Tasks Summary (${workItems.length})
          </h3>
          ${tasksTableHtml}

          ${workPlanUrl ? `
            <div style="margin-top: 24px; text-align: center;">
              <a href="${workPlanUrl}" style="background-color: #059669; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px; display: inline-block;">
                View Completed Plan in Portal
              </a>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    const rawAtts = dayEndData?.attachment_ids || dayEndData?.attachmentIds || dayEndData?.attachments || plan.day_end?.attachments;
    const emailAttachments = await resolveEmailAttachments(rawAtts);

    await emailHelper.sendEmail(
      recipient,
      subject,
      '',
      emailHtml,
      emailAttachments,
      mailCc,
      fromAddress,
      'work_plan_completed'
    );
    logger.info(`[AutoNotification] Sent Day End completion email to ${recipient} (CC: ${mailCc.join(', ')}, Attachments: ${emailAttachments.length})`);
  } catch (err) {
    logger.error(`[AutoNotification] Failed to dispatch Day End completion notification: ${err.message}`);
  }
}

/**
 * 5. WORK PLAN APPROVED AUTO NOTIFICATION
 */
async function notifyWorkPlanApproved({ planId, actorUser }) {
  try {
    const { WorkPlan, User } = getModels();
    const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null }).lean();
    if (!plan) return;

    const salesUserId = plan.sales_user;
    const salesUser = await User.findById(salesUserId).lean();
    if (!salesUser) return;

    const planDateStr = formatDate(plan.plan_date);
    const actorName = actorUser?.name || actorUser?.email?.split('@')[0] || 'Manager';
    const actorRole = getUserRoleLabel(actorUser);

    // In-App Notification to Executive
    await sendInAppNotification(salesUserId, {
      title: 'Work Plan Approved',
      message: `Your Work Plan for ${planDateStr} has been approved by ${actorName} (${actorRole}).`,
      type: 'success',
      entity_type: 'work_plan',
      entity_id: plan._id,
    });

    // Email to Executive
    if (salesUser.email) {
      const baseUrl = (FRONTEND_URL || process.env.FRONTEND_URL || '').replace(/\/$/, '');
      const workPlanUrl = baseUrl ? `${baseUrl}/work-plans?planId=${plan._id}` : '';
      const subject = `Work Plan Approved — ${planDateStr}`;
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.5;">
          <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; padding: 24px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #ffffff;">Work Plan Approved</h2>
            <p style="margin: 0; font-size: 14px; opacity: 0.95;">Approved for <strong>${escapeHtml(planDateStr)}</strong></p>
          </div>
          <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; background-color: #ffffff; border-radius: 0 0 8px 8px;">
            <p style="font-size: 14px; margin-top: 0; color: #334155;">
              Hi <strong>${escapeHtml(salesUser.name || 'Executive')}</strong>,
            </p>
            <p style="font-size: 13px; color: #475569;">
              Your daily Work Plan for <strong>${escapeHtml(planDateStr)}</strong> (${escapeHtml(plan.plan_type || 'Visits')}) has been approved by <strong>${escapeHtml(actorName)}</strong> (${escapeHtml(actorRole)}).
            </p>
            ${
              workPlanUrl
                ? `
              <div style="margin: 24px 0 12px 0; text-align: center;">
                <a href="${workPlanUrl}" style="background-color: #059669; color: #ffffff; padding: 10px 22px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px; display: inline-block;">
                  View Approved Plan
                </a>
              </div>
            `
                : ''
            }
          </div>
        </div>
      `;

      await emailHelper.sendEmail(salesUser.email, subject, '', emailHtml, [], [], null, 'work_plan_approved').catch((err) => {
        logger.warn(`[AutoNotification] Failed sending approval email to ${salesUser.email}: ${err.message}`);
      });
    }
  } catch (err) {
    logger.error(`[AutoNotification] Error in notifyWorkPlanApproved: ${err.message}`);
  }
}

/**
 * 6. WORK PLAN REJECTED AUTO NOTIFICATION
 */
async function notifyWorkPlanRejected({ planId, actorUser, reason }) {
  try {
    const { WorkPlan, User } = getModels();
    const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null }).lean();
    if (!plan) return;

    const salesUserId = plan.sales_user;
    const salesUser = await User.findById(salesUserId).lean();
    if (!salesUser) return;

    const planDateStr = formatDate(plan.plan_date);
    const actorName = actorUser?.name || actorUser?.email?.split('@')[0] || 'Manager';
    const actorRole = getUserRoleLabel(actorUser);

    // In-App Notification to Executive
    await sendInAppNotification(salesUserId, {
      title: 'Work Plan Rejected',
      message: `Your Work Plan for ${planDateStr} was rejected by ${actorName}. Reason: ${reason || 'Revision required'}`,
      type: 'warning',
      entity_type: 'work_plan',
      entity_id: plan._id,
    });

    // Email to Executive
    if (salesUser.email) {
      const baseUrl = (FRONTEND_URL || process.env.FRONTEND_URL || '').replace(/\/$/, '');
      const workPlanUrl = baseUrl ? `${baseUrl}/work-plans?planId=${plan._id}` : '';
      const subject = `Work Plan Revision Needed / Rejected — ${planDateStr}`;
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.5;">
          <div style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); color: #ffffff; padding: 24px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #ffffff;">Work Plan Revision Needed</h2>
            <p style="margin: 0; font-size: 14px; opacity: 0.95;">Plan Date: <strong>${escapeHtml(planDateStr)}</strong></p>
          </div>
          <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; background-color: #ffffff; border-radius: 0 0 8px 8px;">
            <p style="font-size: 14px; margin-top: 0; color: #334155;">
              Hi <strong>${escapeHtml(salesUser.name || 'Executive')}</strong>,
            </p>
            <p style="font-size: 13px; color: #475569;">
              Your daily Work Plan for <strong>${escapeHtml(planDateStr)}</strong> has been marked for revision by <strong>${escapeHtml(actorName)}</strong> (${escapeHtml(actorRole)}).
            </p>
            <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-left: 4px solid #ef4444; border-radius: 6px; padding: 14px; margin: 18px 0;">
              <div style="font-size: 11px; font-weight: 700; color: #b91c1c; text-transform: uppercase; margin-bottom: 4px;">Reason for Rejection / Revision:</div>
              <div style="font-size: 13px; color: #7f1d1d; font-weight: 500;">${escapeHtml(reason || 'Please update your visits/tasks as discussed.')}</div>
            </div>
            ${
              workPlanUrl
                ? `
              <div style="margin: 24px 0 12px 0; text-align: center;">
                <a href="${workPlanUrl}" style="background-color: #dc2626; color: #ffffff; padding: 10px 22px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px; display: inline-block;">
                  Edit & Re-submit Plan
                </a>
              </div>
            `
                : ''
            }
          </div>
        </div>
      `;

      await emailHelper.sendEmail(salesUser.email, subject, '', emailHtml, [], [], null, 'work_plan_rejected').catch((err) => {
        logger.warn(`[AutoNotification] Failed sending rejection email to ${salesUser.email}: ${err.message}`);
      });
    }
  } catch (err) {
    logger.error(`[AutoNotification] Error in notifyWorkPlanRejected: ${err.message}`);
  }
}

/**
 * 7. JUNIOR FOLLOW-UP / RESPONSE ADDED AUTO NOTIFICATION
 */
async function notifyJuniorFollowupAdded({ targetType, targetId, remark, followup, actorUser }) {
  try {
    const { User } = getModels();
    const actorName = actorUser?.name || actorUser?.email?.split('@')[0] || 'Executive';
    const seniorUserId = remark?.user || remark?.created_by;
    if (!seniorUserId) return;

    const seniorUser = await User.findById(seniorUserId).lean();
    if (!seniorUser) return;

    // Do not notify self
    if (String(actorUser?._id || actorUser?.id) === String(seniorUser._id)) return;

    const targetLabel = targetType === 'plan' ? 'Work Plan' : targetType === 'visit' ? 'Field Visit' : targetType === 'task' ? 'Task' : 'Expense Claim';
    const cleanResponse = stripHtml(followup?.response || '');

    const attCount = (Array.isArray(followup?.attachments) ? followup.attachments.length : 0) ||
      (Array.isArray(followup?.attachment_details) ? followup.attachment_details.length : 0);
    const attSuffix = attCount > 0 ? ` [📎 ${attCount} file${attCount > 1 ? 's' : ''} attached]` : '';

    // In-App Notification to Senior
    await sendInAppNotification(seniorUser._id, {
      title: `Reply to Directive: ${targetLabel}`,
      message: `${actorName} responded: "${cleanResponse.length > 100 ? cleanResponse.slice(0, 97) + '...' : cleanResponse}"${attSuffix}`,
      type: 'info',
      entity_type: 'senior_remark',
      entity_id: targetId,
    });

    // Email to Senior
    if (seniorUser.email) {
      const baseUrl = (FRONTEND_URL || process.env.FRONTEND_URL || '').replace(/\/$/, '');
      const feedUrl = baseUrl ? `${baseUrl}/dashboard/senior-remarks` : '';
      const subject = `Reply to Directive on ${targetLabel} — from ${actorName}${attSuffix}`;
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.5;">
          <div style="background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: #ffffff; padding: 24px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #ffffff;">Executive Responded to Directive</h2>
            <p style="margin: 0; font-size: 14px; opacity: 0.95;">Target: <strong>${escapeHtml(targetLabel)}</strong></p>
          </div>
          <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; background-color: #ffffff; border-radius: 0 0 8px 8px;">
            <p style="font-size: 14px; margin-top: 0; color: #334155;">
              Hi <strong>${escapeHtml(seniorUser.name || 'Senior Authority')}</strong>,
            </p>
            <p style="font-size: 13px; color: #475569;">
              <strong>${escapeHtml(actorName)}</strong> has responded to your directive on ${escapeHtml(targetLabel.toLowerCase())}:
            </p>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #6366f1; border-radius: 6px; padding: 14px; margin: 18px 0;">
              <div style="font-size: 11px; font-weight: 700; color: #4f46e5; text-transform: uppercase; margin-bottom: 4px;">Executive Response:</div>
              <div style="font-size: 13px; color: #1e293b; line-height: 1.5;">${escapeHtml(cleanResponse)}</div>
              ${
                attCount > 0
                  ? `<div style="margin-top: 10px; font-size: 12px; color: #4f46e5; font-weight: 600;">📎 ${attCount} attachment${attCount > 1 ? 's' : ''} provided</div>`
                  : ''
              }
            </div>
            ${
              feedUrl
                ? `
              <div style="margin: 24px 0 12px 0; text-align: center;">
                <a href="${feedUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 10px 22px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px; display: inline-block;">
                  View Directives Feed
                </a>
              </div>
            `
                : ''
            }
          </div>
        </div>
      `;

      await emailHelper.sendEmail(seniorUser.email, subject, '', emailHtml, [], [], null, 'directive_resolved').catch((err) => {
        logger.warn(`[AutoNotification] Failed sending followup email to ${seniorUser.email}: ${err.message}`);
      });
    }
  } catch (err) {
    logger.error(`[AutoNotification] Error in notifyJuniorFollowupAdded: ${err.message}`);
  }
}

/**
 * 8. DIRECTIVE RESOLVED AUTO NOTIFICATION
 */
async function notifyDirectiveResolved({ targetType, targetId, doc, remark, actorUser }) {
  try {
    const { User } = getModels();
    const actorName = actorUser?.name || actorUser?.email?.split('@')[0] || 'Senior Authority';
    const actorRole = getUserRoleLabel(actorUser);

    const salesUserId = doc?.sales_user || (typeof doc?.user === 'object' ? doc?.user?._id : doc?.user);
    if (!salesUserId) return;

    const salesUser = await User.findById(salesUserId).lean();
    if (!salesUser) return;

    // Do not notify self
    if (String(actorUser?._id || actorUser?.id) === String(salesUser._id)) return;

    const targetLabel = targetType === 'plan' ? 'Work Plan' : targetType === 'visit' ? 'Field Visit' : targetType === 'task' ? 'Task' : 'Expense Claim';

    // In-App Notification to Junior
    await sendInAppNotification(salesUser._id, {
      title: `Directive Resolved: ${targetLabel}`,
      message: `${actorName} marked the directive on your ${targetLabel.toLowerCase()} as Resolved.`,
      type: 'success',
      entity_type: 'senior_remark',
      entity_id: targetId,
    });

    // Email to Junior
    if (salesUser.email) {
      const subject = `Directive Resolved: ${targetLabel}`;
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.5;">
          <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; padding: 24px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #ffffff;">Directive Resolved & Closed</h2>
            <p style="margin: 0; font-size: 14px; opacity: 0.95;">Target: <strong>${escapeHtml(targetLabel)}</strong></p>
          </div>
          <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; background-color: #ffffff; border-radius: 0 0 8px 8px;">
            <p style="font-size: 14px; margin-top: 0; color: #334155;">
              Hi <strong>${escapeHtml(salesUser.name || 'Executive')}</strong>,
            </p>
            <p style="font-size: 13px; color: #475569;">
              <strong>${escapeHtml(actorName)}</strong> (${escapeHtml(actorRole)}) has reviewed your response and marked the directive on your ${escapeHtml(targetLabel.toLowerCase())} as <strong>Resolved</strong>.
            </p>
            ${
              remark.resolution_remarks
                ? `
              <div style="background-color: #f0fdf4; border: 1px solid #dcfce7; border-left: 4px solid #16a34a; border-radius: 6px; padding: 14px; margin: 18px 0;">
                <div style="font-size: 11px; font-weight: 700; color: #15803d; text-transform: uppercase; margin-bottom: 4px;">Resolution Notes:</div>
                <div style="font-size: 13px; color: #14532d;">${escapeHtml(remark.resolution_remarks)}</div>
              </div>
            `
                : ''
            }
          </div>
        </div>
      `;

      await emailHelper.sendEmail(salesUser.email, subject, '', emailHtml, [], [], null, 'directive_resolved').catch((err) => {
        logger.warn(`[AutoNotification] Failed sending resolution email to ${salesUser.email}: ${err.message}`);
      });
    }
  } catch (err) {
    logger.error(`[AutoNotification] Error in notifyDirectiveResolved: ${err.message}`);
  }
}

/**
 * 9. EXPENSE SUBMITTED AUTO NOTIFICATION
 */
async function notifyExpenseSubmitted({ planId, count = 1, totalAmount = 0, actorUser, selectedCcEmails = [] }) {
  try {
    const { WorkPlan } = getModels();
    const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null }).lean();
    if (!plan) return;

    const salesUserId = plan.sales_user;
    const {
      salesUser,
      directManager,
      allAdmins,
      primaryRecipientEmail,
      ccList,
      inAppUserIds,
    } = await resolveDirectManagerAndAdmins(salesUserId, plan);
    const actorName = actorUser?.name || actorUser?.email?.split('@')[0] || 'Executive';
    const planDateStr = formatDate(plan.plan_date);

    // In-App Notification to Direct Manager and Admins
    for (const uId of inAppUserIds) {
      await sendInAppNotification(uId, {
        title: `Expense Claim Submitted: ${actorName}`,
        message: `${actorName} submitted ${count} expense claim(s) totaling ₹${Number(totalAmount).toLocaleString('en-IN')} for ${planDateStr}.`,
        type: 'info',
        entity_type: 'expense',
        entity_id: plan._id,
      });
    }

    // Email to Direct Manager (TO) with Admins in CC; if no Direct Manager, sent TO Admins
    if (primaryRecipientEmail) {
      const baseUrl = (FRONTEND_URL || process.env.FRONTEND_URL || '').replace(/\/$/, '');
      const expenseUrl = baseUrl ? `${baseUrl}/dashboard/expenses/claims` : '';
      const subject = `Expense Claim Submitted — ${actorName} (${planDateStr})`;
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.5;">
          <div style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff; padding: 24px; border-radius: 8px 8px 0 0;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.85; margin-bottom: 4px; font-weight: 600;">Work Planner Expense Claim</div>
            <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #ffffff;">Expense Claim Submitted</h2>
            <p style="margin: 0; font-size: 14px; opacity: 0.95;">For Plan Date: <strong>${escapeHtml(planDateStr)}</strong></p>
          </div>
          <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; background-color: #ffffff; border-radius: 0 0 8px 8px;">
            <table style="width: 100%; margin-bottom: 20px; font-size: 13px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; width: 140px;"><strong>Executive:</strong></td>
                <td style="padding: 6px 0; color: #0f172a;">${escapeHtml(actorName)} (${escapeHtml(salesUser?.email || '')})</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;"><strong>Total Amount:</strong></td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 700; font-size: 15px;">₹${Number(totalAmount).toLocaleString('en-IN')}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;"><strong>Claims Count:</strong></td>
                <td style="padding: 6px 0; color: #0f172a;">${count} item(s)</td>
              </tr>
            </table>
            ${
              expenseUrl
                ? `
              <div style="margin: 24px 0 12px 0; text-align: center;">
                <a href="${expenseUrl}" style="background-color: #0284c7; color: #ffffff; padding: 10px 22px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px; display: inline-block;">
                  Review Expenses in Portal
                </a>
              </div>
            `
                : ''
            }
          </div>
        </div>
      `;

      const mailCc = Array.from(
        new Set([
          ...(Array.isArray(selectedCcEmails) ? selectedCcEmails : []),
          ...(Array.isArray(ccList) ? ccList : []),
        ])
      )
        .map((e) => String(e).trim())
        .filter((e) => e && e.toLowerCase() !== primaryRecipientEmail.toLowerCase());

      await emailHelper.sendEmail(primaryRecipientEmail, subject, '', emailHtml, [], mailCc, null, 'expense_submitted').catch((err) => {
        logger.warn(`[AutoNotification] Failed sending expense submission email: ${err.message}`);
      });
    }
  } catch (err) {
    logger.error(`[AutoNotification] Error in notifyExpenseSubmitted: ${err.message}`);
  }
}

/**
 * 10. EXPENSE APPROVED AUTO NOTIFICATION
 */
async function notifyExpenseApproved({ planId, count = 1, totalAmount = 0, actorUser }) {
  try {
    const { WorkPlan, User } = getModels();
    const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null }).lean();
    if (!plan) return;

    const salesUserId = plan.sales_user;
    const salesUser = await User.findById(salesUserId).lean();
    if (!salesUser) return;

    const actorName = actorUser?.name || actorUser?.email?.split('@')[0] || 'Manager';
    const planDateStr = formatDate(plan.plan_date);

    // In-App Notification to Executive
    await sendInAppNotification(salesUserId, {
      title: 'Expense Claim Approved',
      message: `Your ${count} expense claim(s) totaling ₹${Number(totalAmount).toLocaleString('en-IN')} for ${planDateStr} were approved by ${actorName}.`,
      type: 'success',
      entity_type: 'expense',
      entity_id: plan._id,
    });

    // Email to Executive
    if (salesUser.email) {
      const subject = `Expense Approved — ₹${Number(totalAmount).toLocaleString('en-IN')} (${planDateStr})`;
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.5;">
          <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; padding: 24px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #ffffff;">Expense Approved</h2>
            <p style="margin: 0; font-size: 14px; opacity: 0.95;">Plan Date: <strong>${escapeHtml(planDateStr)}</strong></p>
          </div>
          <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; background-color: #ffffff; border-radius: 0 0 8px 8px;">
            <p style="font-size: 14px; margin-top: 0; color: #334155;">
              Hi <strong>${escapeHtml(salesUser.name || 'Executive')}</strong>,
            </p>
            <p style="font-size: 13px; color: #475569;">
              Your expense claim (${count} item(s)) totaling <strong>₹${Number(totalAmount).toLocaleString('en-IN')}</strong> has been approved by <strong>${escapeHtml(actorName)}</strong>.
            </p>
          </div>
        </div>
      `;

      await emailHelper.sendEmail(salesUser.email, subject, '', emailHtml, [], [], null, 'expense_status_update').catch((err) => {
        logger.warn(`[AutoNotification] Failed sending expense approval email: ${err.message}`);
      });
    }
  } catch (err) {
    logger.error(`[AutoNotification] Error in notifyExpenseApproved: ${err.message}`);
  }
}

/**
 * 11. EXPENSE REJECTED AUTO NOTIFICATION
 */
async function notifyExpenseRejected({ planId, count = 1, totalAmount = 0, reason, actorUser }) {
  try {
    const { WorkPlan, User } = getModels();
    const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null }).lean();
    if (!plan) return;

    const salesUserId = plan.sales_user;
    const salesUser = await User.findById(salesUserId).lean();
    if (!salesUser) return;

    const actorName = actorUser?.name || actorUser?.email?.split('@')[0] || 'Manager';
    const planDateStr = formatDate(plan.plan_date);

    // In-App Notification to Executive
    await sendInAppNotification(salesUserId, {
      title: 'Expense Claim Rejected',
      message: `Your expense claim (${count} item(s), ₹${Number(totalAmount).toLocaleString('en-IN')}) for ${planDateStr} was rejected by ${actorName}. Reason: ${reason}`,
      type: 'warning',
      entity_type: 'expense',
      entity_id: plan._id,
    });

    // Email to Executive
    if (salesUser.email) {
      const subject = `Expense Claim Rejected — ₹${Number(totalAmount).toLocaleString('en-IN')} (${planDateStr})`;
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.5;">
          <div style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); color: #ffffff; padding: 24px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #ffffff;">Expense Claim Rejected</h2>
            <p style="margin: 0; font-size: 14px; opacity: 0.95;">Plan Date: <strong>${escapeHtml(planDateStr)}</strong></p>
          </div>
          <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; background-color: #ffffff; border-radius: 0 0 8px 8px;">
            <p style="font-size: 14px; margin-top: 0; color: #334155;">
              Hi <strong>${escapeHtml(salesUser.name || 'Executive')}</strong>,
            </p>
            <p style="font-size: 13px; color: #475569;">
              Your expense claim (${count} item(s)) totaling <strong>₹${Number(totalAmount).toLocaleString('en-IN')}</strong> was rejected by <strong>${escapeHtml(actorName)}</strong>.
            </p>
            <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-left: 4px solid #ef4444; border-radius: 6px; padding: 14px; margin: 18px 0;">
              <div style="font-size: 11px; font-weight: 700; color: #b91c1c; text-transform: uppercase; margin-bottom: 4px;">Rejection Reason:</div>
              <div style="font-size: 13px; color: #7f1d1d; font-weight: 500;">${escapeHtml(reason || 'Clarification required on expense amounts/receipts.')}</div>
            </div>
          </div>
        </div>
      `;

      await emailHelper.sendEmail(salesUser.email, subject, '', emailHtml, [], [], null, 'expense_status_update').catch((err) => {
        logger.warn(`[AutoNotification] Failed sending expense rejection email: ${err.message}`);
      });
    }
  } catch (err) {
    logger.error(`[AutoNotification] Error in notifyExpenseRejected: ${err.message}`);
  }
}

/**
 * 12. TOUR ADVANCE REQUESTED AUTO NOTIFICATION
 */
async function notifyTourAdvanceRequested({ advanceDoc, actorUser, selectedCcEmails = [] }) {
  try {
    if (!advanceDoc) return;

    const salesUserId = advanceDoc.sales_user?._id || advanceDoc.sales_user;
    if (!salesUserId) return;

    const {
      salesUser,
      directManager,
      allAdmins,
      primaryRecipientEmail,
      ccList,
      inAppUserIds,
    } = await resolveDirectManagerAndAdmins(salesUserId);
    if (!salesUser) return;

    const actorName = actorUser?.name || salesUser.name || 'Executive';
    const amountStr = Number(advanceDoc.amount || 0).toLocaleString('en-IN');
    const reqDateStr = formatDate(advanceDoc.request_date || advanceDoc.createdAt);

    // In-App Notification to Direct Manager and Admins
    for (const uId of inAppUserIds) {
      await sendInAppNotification(uId, {
        title: `Tour Advance Requested: ${actorName}`,
        message: `${actorName} requested a tour advance of ₹${amountStr} for "${advanceDoc.purpose || 'Tour'}".`,
        type: 'info',
        entity_type: 'tour_advance',
        entity_id: advanceDoc._id,
      });
    }

    // Email to Direct Manager (TO) with Admins in CC; if no Direct Manager, sent TO Admins
    if (primaryRecipientEmail) {
      const baseUrl = (FRONTEND_URL || process.env.FRONTEND_URL || '').replace(/\/$/, '');
      const advanceUrl = baseUrl ? `${baseUrl}/dashboard/expenses/advances` : '';
      const subject = `Tour Advance Request — ${actorName} (₹${amountStr})`;
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.5;">
          <div style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff; padding: 24px; border-radius: 8px 8px 0 0;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.85; margin-bottom: 4px; font-weight: 600;">Work Planner Tour Advance</div>
            <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #ffffff;">Tour Advance Requested</h2>
            <p style="margin: 0; font-size: 14px; opacity: 0.95;">Request Date: <strong>${escapeHtml(reqDateStr)}</strong></p>
          </div>
          <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; background-color: #ffffff; border-radius: 0 0 8px 8px;">
            <table style="width: 100%; margin-bottom: 20px; font-size: 13px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; width: 140px;"><strong>Executive:</strong></td>
                <td style="padding: 6px 0; color: #0f172a;">${escapeHtml(actorName)} (${escapeHtml(salesUser?.email || '')})</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;"><strong>Advance Number:</strong></td>
                <td style="padding: 6px 0; color: #0f172a; font-family: monospace; font-weight: 600;">${escapeHtml(advanceDoc.advance_number || 'ADV-PENDING')}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;"><strong>Requested Amount:</strong></td>
                <td style="padding: 6px 0; color: #0369a1; font-weight: 700; font-size: 16px;">₹${amountStr}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;"><strong>Tour Purpose:</strong></td>
                <td style="padding: 6px 0; color: #0f172a;">${escapeHtml(advanceDoc.purpose || '—')}</td>
              </tr>
              ${
                advanceDoc.notes
                  ? `
                <tr>
                  <td style="padding: 6px 0; color: #64748b;"><strong>Notes:</strong></td>
                  <td style="padding: 6px 0; color: #475569;">${escapeHtml(advanceDoc.notes)}</td>
                </tr>
              `
                  : ''
              }
            </table>
            ${
              advanceUrl
                ? `
              <div style="margin: 24px 0 12px 0; text-align: center;">
                <a href="${advanceUrl}" style="background-color: #0284c7; color: #ffffff; padding: 10px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px; display: inline-block;">
                  Review & Approve Tour Advance
                </a>
              </div>
            `
                : ''
            }
          </div>
        </div>
      `;

      const mailCc = Array.from(
        new Set([
          ...(Array.isArray(selectedCcEmails) ? selectedCcEmails : []),
          ...(Array.isArray(ccList) ? ccList : []),
        ])
      )
        .map((e) => String(e).trim())
        .filter((e) => e && e.toLowerCase() !== primaryRecipientEmail.toLowerCase());

      await emailHelper.sendEmail(primaryRecipientEmail, subject, '', emailHtml, [], mailCc, null, 'tour_advance_requested').catch((err) => {
        logger.warn(`[AutoNotification] Failed sending tour advance request email: ${err.message}`);
      });
    }
  } catch (err) {
    logger.error(`[AutoNotification] Error in notifyTourAdvanceRequested: ${err.message}`);
  }
}

/**
 * 13. TOUR ADVANCE APPROVED AUTO NOTIFICATION
 */
async function notifyTourAdvanceApproved({ advanceDoc, actorUser }) {
  try {
    if (!advanceDoc) return;
    const { User } = getModels();

    const salesUserId = advanceDoc.sales_user?._id || advanceDoc.sales_user;
    const salesUser = advanceDoc.sales_user?.name
      ? advanceDoc.sales_user
      : await User.findById(salesUserId).lean();
    if (!salesUser) return;

    const actorName = actorUser?.name || actorUser?.email?.split('@')[0] || 'Manager';
    const amountStr = Number(advanceDoc.amount || 0).toLocaleString('en-IN');
    const advanceNo = advanceDoc.advance_number || 'ADV';

    // In-App Notification to Executive
    await sendInAppNotification(salesUserId, {
      title: 'Tour Advance Approved',
      message: `Your tour advance #${advanceNo} for ₹${amountStr} was approved by ${actorName}. It has been forwarded for disbursement.`,
      type: 'success',
      entity_type: 'tour_advance',
      entity_id: advanceDoc._id,
    });

    // Email to Executive
    if (salesUser.email) {
      const subject = `Tour Advance Approved — ₹${amountStr} (${advanceNo})`;
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.5;">
          <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; padding: 24px; border-radius: 8px 8px 0 0;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.85; margin-bottom: 4px; font-weight: 600;">Work Planner Tour Advance</div>
            <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #ffffff;">Tour Advance Approved</h2>
            <p style="margin: 0; font-size: 14px; opacity: 0.95;">Advance Number: <strong>${escapeHtml(advanceNo)}</strong></p>
          </div>
          <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; background-color: #ffffff; border-radius: 0 0 8px 8px;">
            <p style="font-size: 14px; margin-top: 0; color: #334155;">
              Hi <strong>${escapeHtml(salesUser.name || 'Executive')}</strong>,
            </p>
            <p style="font-size: 13px; color: #475569;">
              Your tour advance request of <strong>₹${amountStr}</strong> for <em>"${escapeHtml(advanceDoc.purpose || 'Tour')}"</em> has been <strong>approved</strong> by <strong>${escapeHtml(actorName)}</strong>.
            </p>
            <div style="background-color: #f0fdf4; border: 1px solid #dcfce7; border-left: 4px solid #10b981; border-radius: 6px; padding: 14px; margin: 18px 0;">
              <div style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase; margin-bottom: 2px;">Next Step:</div>
              <div style="font-size: 13px; color: #15803d;">Finance/Management will disburse the funds and notify you with transaction details.</div>
            </div>
          </div>
        </div>
      `;

      await emailHelper.sendEmail(salesUser.email, subject, '', emailHtml, [], [], null, 'tour_advance_status').catch((err) => {
        logger.warn(`[AutoNotification] Failed sending tour advance approval email: ${err.message}`);
      });
    }
  } catch (err) {
    logger.error(`[AutoNotification] Error in notifyTourAdvanceApproved: ${err.message}`);
  }
}

/**
 * 14. TOUR ADVANCE REJECTED AUTO NOTIFICATION
 */
async function notifyTourAdvanceRejected({ advanceDoc, reason, actorUser }) {
  try {
    if (!advanceDoc) return;
    const { User } = getModels();

    const salesUserId = advanceDoc.sales_user?._id || advanceDoc.sales_user;
    const salesUser = advanceDoc.sales_user?.name
      ? advanceDoc.sales_user
      : await User.findById(salesUserId).lean();
    if (!salesUser) return;

    const actorName = actorUser?.name || actorUser?.email?.split('@')[0] || 'Manager';
    const amountStr = Number(advanceDoc.amount || 0).toLocaleString('en-IN');
    const advanceNo = advanceDoc.advance_number || 'ADV';
    const rejectionReason = reason || advanceDoc.rejection_reason || 'Advance request rejected by manager.';

    // In-App Notification to Executive
    await sendInAppNotification(salesUserId, {
      title: 'Tour Advance Rejected',
      message: `Your tour advance request #${advanceNo} (₹${amountStr}) was rejected by ${actorName}. Reason: ${rejectionReason}`,
      type: 'warning',
      entity_type: 'tour_advance',
      entity_id: advanceDoc._id,
    });

    // Email to Executive
    if (salesUser.email) {
      const subject = `Tour Advance Rejected — ₹${amountStr} (${advanceNo})`;
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.5;">
          <div style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); color: #ffffff; padding: 24px; border-radius: 8px 8px 0 0;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.85; margin-bottom: 4px; font-weight: 600;">Work Planner Tour Advance</div>
            <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #ffffff;">Tour Advance Rejected</h2>
            <p style="margin: 0; font-size: 14px; opacity: 0.95;">Advance Number: <strong>${escapeHtml(advanceNo)}</strong></p>
          </div>
          <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; background-color: #ffffff; border-radius: 0 0 8px 8px;">
            <p style="font-size: 14px; margin-top: 0; color: #334155;">
              Hi <strong>${escapeHtml(salesUser.name || 'Executive')}</strong>,
            </p>
            <p style="font-size: 13px; color: #475569;">
              Your tour advance request of <strong>₹${amountStr}</strong> for <em>"${escapeHtml(advanceDoc.purpose || 'Tour')}"</em> was <strong>rejected</strong> by <strong>${escapeHtml(actorName)}</strong>.
            </p>
            <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-left: 4px solid #ef4444; border-radius: 6px; padding: 14px; margin: 18px 0;">
              <div style="font-size: 11px; font-weight: 700; color: #b91c1c; text-transform: uppercase; margin-bottom: 4px;">Rejection Reason:</div>
              <div style="font-size: 13px; color: #7f1d1d; font-weight: 500;">${escapeHtml(rejectionReason)}</div>
            </div>
          </div>
        </div>
      `;

      await emailHelper.sendEmail(salesUser.email, subject, '', emailHtml, [], [], null, 'tour_advance_status').catch((err) => {
        logger.warn(`[AutoNotification] Failed sending tour advance rejection email: ${err.message}`);
      });
    }
  } catch (err) {
    logger.error(`[AutoNotification] Error in notifyTourAdvanceRejected: ${err.message}`);
  }
}

/**
 * 15. TOUR ADVANCE DISBURSED AUTO NOTIFICATION
 */
async function notifyTourAdvanceDisbursed({ advanceDoc, actorUser }) {
  try {
    if (!advanceDoc) return;
    const { User } = getModels();

    const salesUserId = advanceDoc.sales_user?._id || advanceDoc.sales_user;
    const salesUser = advanceDoc.sales_user?.name
      ? advanceDoc.sales_user
      : await User.findById(salesUserId).lean();
    if (!salesUser) return;

    const actorName = actorUser?.name || actorUser?.email?.split('@')[0] || 'Finance Authority';
    const disbursedAmountStr = Number(advanceDoc.disbursed_amount || advanceDoc.amount || 0).toLocaleString('en-IN');
    const advanceNo = advanceDoc.advance_number || 'ADV';

    // In-App Notification to Executive
    await sendInAppNotification(salesUserId, {
      title: 'Tour Advance Disbursed',
      message: `₹${disbursedAmountStr} has been disbursed for advance #${advanceNo} via ${advanceDoc.payment_method || 'Bank Transfer'}.`,
      type: 'success',
      entity_type: 'tour_advance',
      entity_id: advanceDoc._id,
    });

    // Email to Executive
    if (salesUser.email) {
      const subject = `Tour Advance Disbursed — ₹${disbursedAmountStr} (${advanceNo})`;
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.5;">
          <div style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color: #ffffff; padding: 24px; border-radius: 8px 8px 0 0;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.85; margin-bottom: 4px; font-weight: 600;">Work Planner Tour Advance</div>
            <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #ffffff;">Tour Advance Disbursed</h2>
            <p style="margin: 0; font-size: 14px; opacity: 0.95;">Advance Number: <strong>${escapeHtml(advanceNo)}</strong></p>
          </div>
          <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; background-color: #ffffff; border-radius: 0 0 8px 8px;">
            <p style="font-size: 14px; margin-top: 0; color: #334155;">
              Hi <strong>${escapeHtml(salesUser.name || 'Executive')}</strong>,
            </p>
            <p style="font-size: 13px; color: #475569;">
              Funds for your tour advance have been <strong>disbursed</strong> by <strong>${escapeHtml(actorName)}</strong>.
            </p>
            <table style="width: 100%; margin: 18px 0; font-size: 13px; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; width: 140px;"><strong>Disbursed Amount:</strong></td>
                <td style="padding: 8px 0; color: #7c3aed; font-weight: 700; font-size: 16px;">₹${disbursedAmountStr}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b;"><strong>Payment Mode:</strong></td>
                <td style="padding: 8px 0; color: #0f172a;">${escapeHtml(advanceDoc.payment_method || 'Bank Transfer')}</td>
              </tr>
              ${
                advanceDoc.transaction_reference
                  ? `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px 0; color: #64748b;"><strong>Txn / UTR Ref:</strong></td>
                  <td style="padding: 8px 0; color: #0f172a; font-family: monospace;">${escapeHtml(advanceDoc.transaction_reference)}</td>
                </tr>
              `
                  : ''
              }
              ${
                advanceDoc.bank_name
                  ? `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px 0; color: #64748b;"><strong>Bank:</strong></td>
                  <td style="padding: 8px 0; color: #0f172a;">${escapeHtml(advanceDoc.bank_name)}</td>
                </tr>
              `
                  : ''
              }
              ${
                advanceDoc.disbursement_notes
                  ? `
                <tr>
                  <td style="padding: 8px 0; color: #64748b;"><strong>Notes:</strong></td>
                  <td style="padding: 8px 0; color: #475569;">${escapeHtml(advanceDoc.disbursement_notes)}</td>
                </tr>
              `
                  : ''
              }
            </table>
            <div style="background-color: #f5f3ff; border: 1px solid #ede9fe; border-left: 4px solid #7c3aed; border-radius: 6px; padding: 12px; margin: 18px 0; font-size: 12px; color: #5b21b6;">
              Please log tour expense claims against this advance. Any remaining unspent balance must be refunded back to company accounts upon tour completion.
            </div>
          </div>
        </div>
      `;

      await emailHelper.sendEmail(salesUser.email, subject, '', emailHtml, [], [], null, 'tour_advance_disbursed').catch((err) => {
        logger.warn(`[AutoNotification] Failed sending tour advance disbursement email: ${err.message}`);
      });
    }
  } catch (err) {
    logger.error(`[AutoNotification] Error in notifyTourAdvanceDisbursed: ${err.message}`);
  }
}

/**
 * 16. TOUR ADVANCE REFUNDED AUTO NOTIFICATION
 */
async function notifyTourAdvanceRefunded({ advanceDoc, refundItem, actorUser }) {
  try {
    if (!advanceDoc || !refundItem) return;
    const { User } = getModels();

    const salesUserId = advanceDoc.sales_user?._id || advanceDoc.sales_user;
    const salesUser = advanceDoc.sales_user?.name
      ? advanceDoc.sales_user
      : await User.findById(salesUserId).lean();
    if (!salesUser) return;

    const actorName = actorUser?.name || actorUser?.email?.split('@')[0] || 'Finance Manager';
    const refundAmountStr = Number(refundItem.amount || 0).toLocaleString('en-IN');
    const remainingBalanceStr = Number(advanceDoc.remaining_balance || 0).toLocaleString('en-IN');
    const advanceNo = advanceDoc.advance_number || 'ADV';

    // In-App Notification to Executive
    await sendInAppNotification(salesUserId, {
      title: 'Tour Advance Refund Acknowledged',
      message: `Refund of ₹${refundAmountStr} for advance #${advanceNo} was acknowledged. Remaining advance in hand: ₹${remainingBalanceStr}.`,
      type: 'info',
      entity_type: 'tour_advance',
      entity_id: advanceDoc._id,
    });

    // Email to Executive
    if (salesUser.email) {
      const subject = `Advance Refund Acknowledged — ₹${refundAmountStr} (${advanceNo})`;
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.5;">
          <div style="background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%); color: #ffffff; padding: 24px; border-radius: 8px 8px 0 0;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.85; margin-bottom: 4px; font-weight: 600;">Work Planner Tour Advance</div>
            <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #ffffff;">Advance Refund Acknowledged</h2>
            <p style="margin: 0; font-size: 14px; opacity: 0.95;">Advance Number: <strong>${escapeHtml(advanceNo)}</strong></p>
          </div>
          <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; background-color: #ffffff; border-radius: 0 0 8px 8px;">
            <p style="font-size: 14px; margin-top: 0; color: #334155;">
              Hi <strong>${escapeHtml(salesUser.name || 'Executive')}</strong>,
            </p>
            <p style="font-size: 13px; color: #475569;">
              Your advance refund of <strong>₹${refundAmountStr}</strong> has been received and verified by <strong>${escapeHtml(actorName)}</strong>.
            </p>
            <table style="width: 100%; margin: 18px 0; font-size: 13px; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; width: 150px;"><strong>Refunded Amount:</strong></td>
                <td style="padding: 8px 0; color: #0f766e; font-weight: 700; font-size: 15px;">₹${refundAmountStr}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b;"><strong>Payment Mode:</strong></td>
                <td style="padding: 8px 0; color: #0f172a;">${escapeHtml(refundItem.payment_method || 'UPI')}</td>
              </tr>
              ${
                refundItem.transaction_reference
                  ? `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px 0; color: #64748b;"><strong>Txn / UTR Ref:</strong></td>
                  <td style="padding: 8px 0; color: #0f172a; font-family: monospace;">${escapeHtml(refundItem.transaction_reference)}</td>
                </tr>
              `
                  : ''
              }
              <tr>
                <td style="padding: 8px 0; color: #64748b;"><strong>Remaining Advance:</strong></td>
                <td style="padding: 8px 0; color: #0f172a; font-weight: 700;">₹${remainingBalanceStr}</td>
              </tr>
            </table>
          </div>
        </div>
      `;

      await emailHelper.sendEmail(salesUser.email, subject, '', emailHtml, [], [], null, 'tour_advance_disbursed').catch((err) => {
        logger.warn(`[AutoNotification] Failed sending tour advance refund email: ${err.message}`);
      });
    }
  } catch (err) {
    logger.error(`[AutoNotification] Error in notifyTourAdvanceRefunded: ${err.message}`);
  }
}

/**
 * 17. EXPENSE SETTLEMENT COMPLETED AUTO NOTIFICATION
 */
async function notifyExpenseSettlementCompleted({ settlementDoc, actorUser }) {
  try {
    if (!settlementDoc) return;
    const { User } = getModels();

    const salesUserId = settlementDoc.sales_user?._id || settlementDoc.sales_user;
    const salesUser = settlementDoc.sales_user?.name
      ? settlementDoc.sales_user
      : await User.findById(salesUserId).lean();
    if (!salesUser) return;

    const actorName = actorUser?.name || actorUser?.email?.split('@')[0] || 'Finance Manager';
    const totalClaimStr = Number(settlementDoc.total_claim_amount || 0).toLocaleString('en-IN');
    const advanceDeductionStr = Number(settlementDoc.advance_deduction_amount || 0).toLocaleString('en-IN');
    const directPaymentStr = Number(settlementDoc.direct_payment_amount || 0).toLocaleString('en-IN');
    const settlementNo = settlementDoc.settlement_number || 'SETTLE';
    const claimsCount = Array.isArray(settlementDoc.claims) ? settlementDoc.claims.length : 0;

    // In-App Notification to Executive
    await sendInAppNotification(salesUserId, {
      title: `Expense Settlement Completed: #${settlementNo}`,
      message: `Settlement voucher #${settlementNo} generated for ₹${totalClaimStr} (${claimsCount} claim(s)). Direct Payout: ₹${directPaymentStr}, Advance Adjusted: ₹${advanceDeductionStr}.`,
      type: 'success',
      entity_type: 'expense_settlement',
      entity_id: settlementDoc._id,
    });

    // Email to Executive
    if (salesUser.email) {
      const baseUrl = (FRONTEND_URL || process.env.FRONTEND_URL || '').replace(/\/$/, '');
      const settlementUrl = baseUrl ? `${baseUrl}/dashboard/expenses/settlements` : '';
      const subject = `Expense Settlement Voucher — ${settlementNo} (₹${totalClaimStr})`;
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.5;">
          <div style="background: linear-gradient(135deg, #4338ca 0%, #3730a3 100%); color: #ffffff; padding: 24px; border-radius: 8px 8px 0 0;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.85; margin-bottom: 4px; font-weight: 600;">Work Planner Expense Settlement</div>
            <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #ffffff;">Expense Settlement Voucher</h2>
            <p style="margin: 0; font-size: 14px; opacity: 0.95;">Voucher No: <strong>${escapeHtml(settlementNo)}</strong></p>
          </div>
          <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; background-color: #ffffff; border-radius: 0 0 8px 8px;">
            <p style="font-size: 14px; margin-top: 0; color: #334155;">
              Hi <strong>${escapeHtml(salesUser.name || 'Executive')}</strong>,
            </p>
            <p style="font-size: 13px; color: #475569;">
              Your expense claims (${claimsCount} item(s)) have been settled by <strong>${escapeHtml(actorName)}</strong>.
            </p>
            
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 18px 0;">
              <div style="font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 10px;">Voucher Summary:</div>
              <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 6px 0; color: #64748b;">Total Approved Claims Settled:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-weight: 700; text-align: right;">₹${totalClaimStr}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 6px 0; color: #64748b;">Tour Advance Adjusted:</td>
                  <td style="padding: 6px 0; color: #dc2626; font-weight: 600; text-align: right;">- ₹${advanceDeductionStr}</td>
                </tr>
                <tr style="border-top: 2px solid #cbd5e1;">
                  <td style="padding: 8px 0; color: #0f172a; font-weight: 700; font-size: 14px;">Net Direct Payout:</td>
                  <td style="padding: 8px 0; color: #059669; font-weight: 800; font-size: 16px; text-align: right;">₹${directPaymentStr}</td>
                </tr>
              </table>
            </div>

            ${
              settlementDoc.direct_payment_amount > 0
                ? `
              <table style="width: 100%; margin-bottom: 18px; font-size: 13px; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 6px 0; color: #64748b; width: 140px;"><strong>Payout Method:</strong></td>
                  <td style="padding: 6px 0; color: #0f172a;">${escapeHtml(settlementDoc.payment_method || 'Bank Transfer')}</td>
                </tr>
                ${
                  settlementDoc.transaction_reference
                    ? `
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 6px 0; color: #64748b;"><strong>Txn / UTR Ref:</strong></td>
                    <td style="padding: 6px 0; color: #0f172a; font-family: monospace;">${escapeHtml(settlementDoc.transaction_reference)}</td>
                  </tr>
                `
                    : ''
                }
                ${
                  settlementDoc.bank_name
                    ? `
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 6px 0; color: #64748b;"><strong>Bank Name:</strong></td>
                    <td style="padding: 6px 0; color: #0f172a;">${escapeHtml(settlementDoc.bank_name)}</td>
                  </tr>
                `
                    : ''
                }
              </table>
            `
                : ''
            }

            ${
              settlementUrl
                ? `
              <div style="margin: 24px 0 12px 0; text-align: center;">
                <a href="${settlementUrl}" style="background-color: #4338ca; color: #ffffff; padding: 10px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px; display: inline-block;">
                  View Settlement Details
                </a>
              </div>
            `
                : ''
            }
          </div>
        </div>
      `;

      await emailHelper.sendEmail(salesUser.email, subject, '', emailHtml, [], [], null, 'expense_settlement').catch((err) => {
        logger.warn(`[AutoNotification] Failed sending expense settlement voucher email: ${err.message}`);
      });
    }
  } catch (err) {
    logger.error(`[AutoNotification] Error in notifyExpenseSettlementCompleted: ${err.message}`);
  }
}

/**
 * 12. MORNING 11:30 AM PENDING WORK PLAN REMINDER DISPATCHER
 */
async function sendPendingWorkPlanMorningReminder(pendingUsers, dateStr, timeZone) {
  try {
    if (!Array.isArray(pendingUsers) || pendingUsers.length === 0) {
      logger.info(`[AutoNotification] Morning 11:30 AM reminder: No pending work plans for ${dateStr}.`);
      return;
    }

    const { WorkPlan } = getModels();

    // Live safety filter: Ensure none of these users have created/planned a work plan or taken leave for dateStr
    const boundsStart = new Date(`${dateStr}T00:00:00.000Z`);
    boundsStart.setHours(boundsStart.getHours() - 12);
    const boundsEnd = new Date(`${dateStr}T23:59:59.999Z`);
    boundsEnd.setHours(boundsEnd.getHours() + 12);

    const userIds = pendingUsers.map((u) => u._id || u.id).filter(Boolean);
    const activePlans = await WorkPlan.find({
      sales_user: { $in: userIds },
      plan_date: { $gte: boundsStart, $lte: boundsEnd },
      $or: [
        { status: { $in: ['planned', 'submitted', 'approved', 'completed', 'in_progress'] } },
        { plan_type: 'Leave' },
      ],
      deletedAt: null,
    }).select('sales_user status plan_type').lean();

    const plannedUserIds = new Set(activePlans.map((p) => String(p.sales_user)));
    const verifiedPendingUsers = pendingUsers.filter((u) => !plannedUserIds.has(String(u._id || u.id)));

    if (verifiedPendingUsers.length === 0) {
      logger.info(`[AutoNotification] Morning 11:30 AM reminder: All executives verified planned for ${dateStr}. No reminders sent.`);
      return;
    }

    logger.info(`[AutoNotification] Morning 11:30 AM reminder: Sending alerts for ${verifiedPendingUsers.length} pending executives.`);

    // Group pending users by direct manager for manager digest
    const managerDigestMap = new Map();

    for (const exec of verifiedPendingUsers) {
      const execName = exec.name || exec.email.split('@')[0];
      const { directManager } = await resolveStakeholders(exec._id);

      // In-App Notification to Executive
      await sendInAppNotification(exec._id, {
        title: 'Morning Reminder: Work Plan Pending',
        message: `You have not planned your Work Plan for today (${dateStr}). Please plan your visits & tasks.`,
        type: 'warning',
        entity_type: 'work_plan_reminder',
      });

      // Individual Email to Executive
      if (exec.email) {
        const mgrCc = [];
        const subject = `Morning 11:30 AM Reminder: Work Plan Pending for Today (${dateStr})`;
        const emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 550px; margin: 0 auto; color: #1e293b; line-height: 1.5;">
            <div style="background-color: #d97706; color: #ffffff; padding: 20px 24px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; color: #ffffff;">Work Plan Pending</h2>
              <p style="margin: 0; font-size: 13px; opacity: 0.95;">Morning 11:30 AM Alert • <strong>${dateStr}</strong></p>
            </div>
            <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; background-color: #ffffff; border-radius: 0 0 8px 8px;">
              <p style="font-size: 14px; margin-top: 0;">Hi <strong>${escapeHtml(execName)}</strong>,</p>
              <p style="font-size: 13px; color: #334155;">
                This is a reminder that your daily Work Plan for today, <strong>${dateStr}</strong>, has not been planned yet.
              </p>
              <p style="font-size: 13px; color: #334155;">
                Please log in to the Work Planner portal or mobile app to plan your scheduled visits and tasks for today.
              </p>
              <div style="margin: 24px 0 10px 0; text-align: center;">
                <a href="${(FRONTEND_URL || '').replace(/\/$/, '')}/work-plans" style="background-color: #d97706; color: #ffffff; padding: 10px 22px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px; display: inline-block;">
                  Plan Today's Work
                </a>
              </div>
            </div>
          </div>
        `;

        await emailHelper.sendEmail(
          exec.email,
          subject,
          '',
          emailHtml,
          [],
          mgrCc,
          null,
          'morning_plan_reminder'
        ).catch((err) => {
          logger.warn(`[AutoNotification] Failed sending 11:30 AM email to ${exec.email}: ${err.message}`);
        });
      }

      // Add to manager digest bucket
      if (directManager) {
        const mgrId = String(directManager._id);
        if (!managerDigestMap.has(mgrId)) {
          managerDigestMap.set(mgrId, { manager: directManager, pendingExecs: [] });
        }
        managerDigestMap.get(mgrId).pendingExecs.push(exec);
      }
    }

    // Portal Admins to CC on all manager digests
    const portalAdmins = await getActiveUsersByWpRole('admin');

    // Send Manager Digests
    for (const [mgrId, data] of managerDigestMap.entries()) {
      const { manager, pendingExecs } = data;
      if (pendingExecs.length === 0) continue;
      const mgrName = manager.name || manager.email.split('@')[0];

      // In-App Notification to Manager
      await sendInAppNotification(mgrId, {
        title: `Work Plan Pending Digest (${dateStr})`,
        message: `${pendingExecs.length} team member(s) have not planned their work plan for today: ${pendingExecs.map((e) => e.name || e.email).join(', ')}.`,
        type: 'warning',
        entity_type: 'manager_digest',
      });

      // Digest Email to Manager (CC Portal Admins)
      if (manager.email) {
        const execRows = pendingExecs
          .map(
            (e, i) => `
            <tr>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 13px; font-weight: 600;">${i + 1}. ${escapeHtml(e.name || e.email)}</td>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #475569;">${escapeHtml(e.email)}</td>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 13px; text-align: center;"><span style="color: #b45309; font-weight: 700; font-size: 11px; background: #fef3c7; padding: 2px 8px; border-radius: 9999px;">Not Planned</span></td>
            </tr>
          `
          )
          .join('');

        const digestHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.5;">
            <div style="background-color: #1e293b; color: #ffffff; padding: 20px 24px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; color: #ffffff;">Team Work Plan Pending Digest</h2>
              <p style="margin: 0; font-size: 13px; opacity: 0.85;">Morning 11:30 AM Check • <strong>${dateStr}</strong></p>
            </div>
            <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; background-color: #ffffff; border-radius: 0 0 8px 8px;">
              <p style="font-size: 14px; margin-top: 0;">Hi <strong>${escapeHtml(mgrName)}</strong>,</p>
              <p style="font-size: 13px; color: #334155;">
                The following <strong>${pendingExecs.length}</strong> team member(s) have not yet planned their Work Plan for today (<strong>${dateStr}</strong>):
              </p>
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <thead>
                  <tr style="background-color: #f8fafc;">
                    <th style="padding: 8px 12px; border: 1px solid #e2e8f0; text-align: left; font-size: 12px;">Executive</th>
                    <th style="padding: 8px 12px; border: 1px solid #e2e8f0; text-align: left; font-size: 12px;">Email</th>
                    <th style="padding: 8px 12px; border: 1px solid #e2e8f0; text-align: center; font-size: 12px;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${execRows}
                </tbody>
              </table>
              <div style="margin: 20px 0 10px 0; text-align: center;">
                <a href="${(FRONTEND_URL || '').replace(/\/$/, '')}/work-plans" style="background-color: #1e293b; color: #ffffff; padding: 9px 18px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px; display: inline-block;">
                  Open Work Planner Management
                </a>
              </div>
            </div>
          </div>
        `;

        const adminCcEmails = portalAdmins
          .map((a) => a.email)
          .filter((e) => e && e.toLowerCase() !== String(manager.email || '').toLowerCase());

        await emailHelper.sendEmail(
          manager.email,
          `Team Work Plan Pending Digest — ${dateStr} (${pendingExecs.length} Pending)`,
          '',
          digestHtml,
          [],
          adminCcEmails,
          null,
          'morning_manager_digest'
        ).catch((err) => {
          logger.warn(`[AutoNotification] Failed sending 11:30 AM digest to manager ${manager.email}: ${err.message}`);
        });
      }
    }
  } catch (err) {
    logger.error(`[AutoNotification] Error in sendPendingWorkPlanMorningReminder: ${err.message}`);
  }
}

/**
 * 13. EVENING 6:30 PM PENDING DAY END REMINDER DISPATCHER
 */
async function sendPendingDayEndEveningReminder(pendingPlansWithUsers, dateStr, timeZone) {
  try {
    if (!Array.isArray(pendingPlansWithUsers) || pendingPlansWithUsers.length === 0) {
      logger.info(`[AutoNotification] Evening 6:30 PM reminder: No pending Day End reports for ${dateStr}.`);
      return;
    }

    const { WorkPlan } = getModels();

    // Live safety filter: Query the current status of each plan to make sure none were just submitted/completed
    const planIds = pendingPlansWithUsers.map((i) => i.plan?._id).filter(Boolean);
    const livePlans = await WorkPlan.find({
      _id: { $in: planIds },
      deletedAt: null,
    }).select('status day_end plan_type').lean();

    const livePlanMap = new Map(livePlans.map((p) => [String(p._id), p]));

    const verifiedPending = pendingPlansWithUsers.filter((item) => {
      const live = livePlanMap.get(String(item.plan?._id));
      if (!live) return false;
      // If plan is completed, on Leave, or has completed_at on day_end, exclude!
      if (live.status === 'completed' || live.plan_type === 'Leave' || live.day_end?.completed_at) {
        return false;
      }
      return true;
    });

    if (verifiedPending.length === 0) {
      logger.info(`[AutoNotification] Evening 6:30 PM reminder: All plans verified completed for ${dateStr}. No reminders sent.`);
      return;
    }

    logger.info(`[AutoNotification] Evening 6:30 PM reminder: Sending alerts for ${verifiedPending.length} pending Day End reports.`);

    const managerDigestMap = new Map();

    for (const item of verifiedPending) {
      const exec = item.user;
      const plan = item.plan;
      const execName = exec.name || exec.email.split('@')[0];
      const { directManager } = await resolveStakeholders(exec._id, plan);

      // In-App Notification to Executive
      await sendInAppNotification(exec._id, {
        title: 'Evening Reminder: Day End Report Pending',
        message: `Your Day End report for today (${dateStr}) is pending submission. Please review and complete your visits/tasks and submit Day End.`,
        type: 'warning',
        entity_type: 'day_end_reminder',
        entity_id: plan?._id,
      });

      // Individual Email to Executive
      if (exec.email) {
        const mgrCc = [];
        const subject = `Evening 6:30 PM Reminder: Day End Report Pending for Today (${dateStr})`;
        const emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 550px; margin: 0 auto; color: #1e293b; line-height: 1.5;">
            <div style="background-color: #0284c7; color: #ffffff; padding: 20px 24px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; color: #ffffff;">Day End Submission Pending</h2>
              <p style="margin: 0; font-size: 13px; opacity: 0.95;">Evening 6:30 PM Alert • <strong>${dateStr}</strong></p>
            </div>
            <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; background-color: #ffffff; border-radius: 0 0 8px 8px;">
              <p style="font-size: 14px; margin-top: 0;">Hi <strong>${escapeHtml(execName)}</strong>,</p>
              <p style="font-size: 13px; color: #334155;">
                This is an evening reminder to complete your visits/tasks and submit your <strong>Day End Report</strong> for today (<strong>${dateStr}</strong>).
              </p>
              <p style="font-size: 13px; color: #334155;">
                Submitting your Day End report compiles your visit outcomes, meeting checklists, and day tasks for your reporting manager.
              </p>
              <div style="margin: 24px 0 10px 0; text-align: center;">
                <a href="${(FRONTEND_URL || '').replace(/\/$/, '')}/work-plans" style="background-color: #0284c7; color: #ffffff; padding: 10px 22px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px; display: inline-block;">
                  Submit Day End Report
                </a>
              </div>
            </div>
          </div>
        `;

        await emailHelper.sendEmail(
          exec.email,
          subject,
          '',
          emailHtml,
          [],
          mgrCc,
          null,
          'evening_day_end_reminder'
        ).catch((err) => {
          logger.warn(`[AutoNotification] Failed sending 6:30 PM email to ${exec.email}: ${err.message}`);
        });
      }

      // Add to manager digest bucket
      if (directManager) {
        const mgrId = String(directManager._id);
        if (!managerDigestMap.has(mgrId)) {
          managerDigestMap.set(mgrId, { manager: directManager, pendingItems: [] });
        }
        managerDigestMap.get(mgrId).pendingItems.push({ user: exec, plan });
      }
    }

    // Portal Admins to CC on all manager digests
    const portalAdmins = await getActiveUsersByWpRole('admin');

    // Send Manager Digests
    for (const [mgrId, data] of managerDigestMap.entries()) {
      const { manager, pendingItems } = data;
      if (pendingItems.length === 0) continue;
      const mgrName = manager.name || manager.email.split('@')[0];

      // In-App Notification to Manager
      await sendInAppNotification(mgrId, {
        title: `Day End Pending Digest (${dateStr})`,
        message: `${pendingItems.length} team member(s) have not submitted their Day End report for today: ${pendingItems.map((i) => i.user.name || i.user.email).join(', ')}.`,
        type: 'warning',
        entity_type: 'manager_digest',
      });

      // Digest Email to Manager (CC Portal Admins)
      if (manager.email) {
        const execRows = pendingItems
          .map(
            (item, i) => `
            <tr>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 13px; font-weight: 600;">${i + 1}. ${escapeHtml(item.user.name || item.user.email)}</td>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #475569;">${escapeHtml(item.plan?.plan_type || 'Visits')}</td>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 13px; text-align: center;"><span style="color: #b91c1c; font-weight: 700; font-size: 11px; background: #fee2e2; padding: 2px 8px; border-radius: 9999px;">${escapeHtml(item.plan?.status || 'Incomplete')}</span></td>
            </tr>
          `
          )
          .join('');

        const digestHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.5;">
            <div style="background-color: #1e293b; color: #ffffff; padding: 20px 24px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; color: #ffffff;">Team Day End Pending Digest</h2>
              <p style="margin: 0; font-size: 13px; opacity: 0.85;">Evening 6:30 PM Check • <strong>${dateStr}</strong></p>
            </div>
            <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; background-color: #ffffff; border-radius: 0 0 8px 8px;">
              <p style="font-size: 14px; margin-top: 0;">Hi <strong>${escapeHtml(mgrName)}</strong>,</p>
              <p style="font-size: 13px; color: #334155;">
                The following <strong>${pendingItems.length}</strong> team member(s) have not submitted their Day End report for today (<strong>${dateStr}</strong>):
              </p>
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <thead>
                  <tr style="background-color: #f8fafc;">
                    <th style="padding: 8px 12px; border: 1px solid #e2e8f0; text-align: left; font-size: 12px;">Executive</th>
                    <th style="padding: 8px 12px; border: 1px solid #e2e8f0; text-align: left; font-size: 12px;">Plan Type</th>
                    <th style="padding: 8px 12px; border: 1px solid #e2e8f0; text-align: center; font-size: 12px;">Plan Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${execRows}
                </tbody>
              </table>
              <div style="margin: 20px 0 10px 0; text-align: center;">
                <a href="${(FRONTEND_URL || '').replace(/\/$/, '')}/work-plans" style="background-color: #1e293b; color: #ffffff; padding: 9px 18px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px; display: inline-block;">
                  Open Work Planner
                </a>
              </div>
            </div>
          </div>
        `;

        const adminCcEmails = portalAdmins
          .map((a) => a.email)
          .filter((e) => e && e.toLowerCase() !== String(manager.email || '').toLowerCase());

        await emailHelper.sendEmail(
          manager.email,
          `Team Day End Pending Digest — ${dateStr} (${pendingItems.length} Pending)`,
          '',
          digestHtml,
          [],
          adminCcEmails,
          null,
          'evening_manager_digest'
        ).catch((err) => {
          logger.warn(`[AutoNotification] Failed sending 6:30 PM digest to manager ${manager.email}: ${err.message}`);
        });
      }
    }
  } catch (err) {
    logger.error(`[AutoNotification] Error in sendPendingDayEndEveningReminder: ${err.message}`);
  }
}

module.exports = {
  getWorkPlannerPortalRoles,
  isWpExecutive,
  isWpCoordinator,
  isWpManager,
  isWpAdmin,
  getActiveUsersByWpRole,
  getWorkPlannerManagers,
  getWorkPlannerAdmins,
  resolveStakeholders,
  resolveDirectManagerAndAdmins,
  sendInAppNotification,
  notifyWorkPlanCreated,
  notifyWorkPlanSubmitted: notifyWorkPlanCreated,
  notifyWorkPlanApproved,
  notifyWorkPlanRejected,
  notifyVisitCreated,
  notifyTaskCreated,
  notifyAuthorityRemarkAdded,
  notifyJuniorFollowupAdded,
  notifyDirectiveResolved,
  notifyExpenseSubmitted,
  notifyExpenseApproved,
  notifyExpenseRejected,
  notifyTourAdvanceRequested,
  notifyTourAdvanceApproved,
  notifyTourAdvanceRejected,
  notifyTourAdvanceDisbursed,
  notifyTourAdvanceRefunded,
  notifyExpenseSettlementCompleted,
  notifyDayEndCompleted,
  sendPendingWorkPlanMorningReminder,
  sendPendingDayEndEveningReminder,
  renderVisitsTable,
  renderTasksTable,
};

