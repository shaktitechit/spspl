/**
 * @fileoverview Work Plan notification service to send completion emails to managers.
 * @module modules/workPlanner/workPlanNotification.service
 */
const axios = require('axios');
const { getModels } = require('../../data/mongoRegistry');
const emailHelper = require('../messages/helpers/email.helper');
const { logger } = require('../../utils/logger');
const { resolveEmailAttachments } = require('../../services/fileManagement');
const { resolveReportingStakeholderEmails } = require('./workPlannerTeamReporting.service');

/**
 * Finds all active users with manager/admin access to the work_planner portal.
 */
async function getWorkPlannerManagers() {
  try {
    const { User } = getModels();
    const allActiveUsers = await User.find({ is_active: { $ne: false } }).lean();

    const managers = allActiveUsers.filter((u) => {
      if (!u.email) return false;

      // Check portal roles
      if (Array.isArray(u.portals) && u.portals.length > 0) {
        const wpPortal = u.portals.find(
          (p) =>
            p &&
            ['work_planner'].includes(
              String(p.portal_code || '').toLowerCase()
            )
        );
        if (wpPortal && Array.isArray(wpPortal.access_roles)) {
          const hasManagerAccess = wpPortal.access_roles.some((r) =>
            ['coordinator', 'manager', 'admin'].includes(String(r).toLowerCase())
          );
          if (hasManagerAccess) return true;
        }
      }

      return false;
    });

    return managers;
  } catch (err) {
    logger.error(`[WorkPlanNotification] Failed to fetch managers: ${err.message}`);
    return [];
  }
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
        ? `${v.planned_start_time}${v.planned_end_time ? ' - ' + v.planned_end_time : ''}`
        : '—';

      let statusBadgeStyle = 'background-color: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;';
      if (status === 'completed') {
        statusBadgeStyle = 'background-color: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;';
      } else if (status === 'in_progress') {
        statusBadgeStyle = 'background-color: #fef3c7; color: #b45309; border: 1px solid #fde68a;';
      } else if (status === 'pending' || status === 'checked_in') {
        statusBadgeStyle = 'background-color: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;';
      } else if (status === 'created') {
        statusBadgeStyle = 'background-color: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd;';
      } else if (['cancelled', 'skipped'].includes(status)) {
        statusBadgeStyle = 'background-color: #fee2e2; color: #b91c1c; border: 1px solid #fecaca;';
      }

      let remarksHtml = '—';
      if (status === 'completed') {
        const out = v.outcome || v.notes || '';
        const outHtml = out ? `<div style="color: #15803d; font-weight: 500; margin-bottom: 6px;">${out}</div>` : '';

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
        remarksHtml = inp ? `<div><span style="color: #b45309; font-weight: 700; font-size: 11px; text-transform: uppercase;">In Progress:</span> <span style="color: #334155;">${inp}</span></div>` : '—';
      } else if (status === 'pending' || status === 'created') {
        const pnd = v.pending_remarks || v.notes || '';
        remarksHtml = pnd ? `<div><span style="color: #475569; font-weight: 700; font-size: 11px; text-transform: uppercase;">Pending Reason:</span> <span style="color: #334155;">${pnd}</span></div>` : (v.notes ? `<span>${v.notes}</span>` : '—');
      } else {
        const other = v.outcome || v.in_progress_remarks || v.pending_remarks || v.notes || '';
        remarksHtml = other || '—';
      }

      const formattedStatus = status.replace(/_/g, ' ').toUpperCase();

      return `
        <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #0f172a;">
            <div style="font-weight: 600;">${i + 1}. ${party}</div>
            ${contact ? `<div style="font-size: 11px; color: #64748b;">Contact: ${contact}</div>` : ''}
          </td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #334155;">
            ${purpose}
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

      let statusBadgeStyle = 'background-color: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;';
      if (status === 'completed') {
        statusBadgeStyle = 'background-color: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;';
      } else if (status === 'in_progress') {
        statusBadgeStyle = 'background-color: #fef3c7; color: #b45309; border: 1px solid #fde68a;';
      } else if (status === 'pending') {
        statusBadgeStyle = 'background-color: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;';
      } else if (status === 'created') {
        statusBadgeStyle = 'background-color: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd;';
      } else if (status === 'cancelled') {
        statusBadgeStyle = 'background-color: #fee2e2; color: #b91c1c; border: 1px solid #fecaca;';
      }

      let remarksHtml = '—';
      if (status === 'completed') {
        const out = t.completion_remarks || t.outcome || '';
        remarksHtml = out ? `<div style="color: #15803d; font-weight: 500;">${out}</div>` : '—';
      } else if (status === 'in_progress') {
        const inp = t.in_progress_remarks || '';
        remarksHtml = inp ? `<div><span style="color: #b45309; font-weight: 700; font-size: 11px; text-transform: uppercase;">In Progress:</span> <span style="color: #334155;">${inp}</span></div>` : '—';
      } else if (status === 'pending' || status === 'created') {
        const pnd = t.pending_remarks || '';
        remarksHtml = pnd ? `<div><span style="color: #475569; font-weight: 700; font-size: 11px; text-transform: uppercase;">Pending Reason:</span> <span style="color: #334155;">${pnd}</span></div>` : '—';
      } else {
        const other = t.completion_remarks || t.outcome || t.in_progress_remarks || t.pending_remarks || '';
        remarksHtml = other || '—';
      }

      const formattedStatus = status.replace(/_/g, ' ').toUpperCase();

      return `
        <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #0f172a; font-weight: 600; width: 28%;">
            ${i + 1}. ${title}
          </td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #334155; width: 35%;">
            ${desc}
          </td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; text-align: center; white-space: nowrap; width: 15%;">
            <span style="display: inline-block; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; ${statusBadgeStyle}">
              ${formattedStatus}
            </span>
          </td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #334155; width: 22%;">
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
 * Dispatches work plan completion notification emails to all Work Plan portal managers.
 * The email is sent FROM the completing executive's email address.
 *
 * @param {string} planId
 * @param {object} executiveUser - The user object of the executive completing the plan
 */
async function sendWorkPlanCompletedEmail(planId, executiveUser) {
  try {
    if (!executiveUser || !executiveUser.email) {
      logger.warn(`[WorkPlanNotification] Missing executive user email for planId ${planId}`);
      return;
    }

    const { WorkPlan, WorkPlanVisit, WorkPlanWork, WorkPlanExpense } = getModels();

    const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null }).lean();
    if (!plan) {
      logger.warn(`[WorkPlanNotification] Plan not found for id ${planId}`);
      return;
    }

    // Fetch related visits, work items, and expenses
    const [visits, workItems, expenses] = await Promise.all([
      WorkPlanVisit.find({ work_plan: planId, deletedAt: null }).sort({ sequence: 1 }).lean(),
      WorkPlanWork.find({ work_plan: planId, deletedAt: null }).sort({ sequence: 1 }).lean(),
      WorkPlanExpense.find({ work_plan: planId, deletedAt: null }).select('amount').lean(),
    ]);

    const expensesTotal = expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    const salesUserId = plan.sales_user?._id || plan.sales_user || executiveUser._id || executiveUser.id;
    const {
      directManager,
      primaryRecipientEmail,
      ccList,
    } = await resolveReportingStakeholderEmails(salesUserId, plan);

    if (!primaryRecipientEmail) {
      logger.warn(`[WorkPlanNotification] No reporting manager email found for plan ${planId}`);
      return;
    }

    const planDateStr = plan.plan_date
      ? new Date(plan.plan_date).toISOString().split('T')[0]
      : 'N/A';

    const executiveName = executiveUser.name || executiveUser.email.split('@')[0];
    const executiveEmail = executiveUser.email;
    const fromAddress = `${executiveName} <${executiveEmail}>`;

    const baseUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const workPlanUrl = baseUrl ? `${baseUrl}/work-plans` : '';

    const visitsTableHtml = renderVisitsTable(visits);
    const tasksTableHtml = renderTasksTable(workItems);

    const templateData = {
      subject: `Work Plan Completed — ${executiveName} (${planDateStr})`,
      executiveName,
      executiveEmail,
      planDate: planDateStr,
      planType: plan.plan_type || 'N/A',
      location: plan.location || 'N/A',
      remarks: plan.remarks || 'None',
      visitsCount: String(visits.length),
      workCount: String(workItems.length),
      expensesTotal: expensesTotal.toLocaleString('en-IN'),
      visitsTableHtml,
      tasksTableHtml,
      workPlanUrl,
    };

    const primaryRecipient = primaryRecipientEmail;
    const recipientName = directManager
      ? (directManager.name || primaryRecipient.split('@')[0])
      : 'Manager';

    try {
      await emailHelper.sendTemplateEmail(
        primaryRecipient,
        'work_plan_completed',
        {
          ...templateData,
          recipientName,
        },
        [],
        ccList,
        fromAddress,
        'work_plan_completed'
      );
      logger.info(
        `[WorkPlanNotification] Sent single work plan completion email to ${primaryRecipient} (CC: ${ccList.join(', ') || 'none'}) from ${fromAddress}`
      );
    } catch (sendErr) {
      logger.error(
        `[WorkPlanNotification] Failed sending email to ${primaryRecipient}: ${sendErr.message}`
      );
    }
  } catch (err) {
    logger.error(`[WorkPlanNotification] Error sending completion emails for plan ${planId}: ${err.message}`);
  }
}

/**
 * Dispatches a custom Day End completion email created via the rich mail composer panel.
 *
 * @param {string} planId
 * @param {object} executiveUser - User object of executive submitting Day End
 * @param {object} dayEndData - { to_email, cc_emails, subject, body_html, attachment_ids }
 */
async function sendCustomDayEndEmail(planId, executiveUser, dayEndData = {}) {
  try {
    if (!executiveUser || !executiveUser.email) {
      logger.warn(`[WorkPlanNotification] Missing executive user email for custom Day End on plan ${planId}`);
      return;
    }

    const recipient = dayEndData.to_email?.trim();
    if (!recipient) {
      logger.warn(`[WorkPlanNotification] No recipient specified for custom Day End on plan ${planId}`);
      return;
    }

    const executiveName = executiveUser.name || executiveUser.email.split('@')[0];
    const fromAddress = `${executiveName} <${executiveUser.email}>`;
    const subject = dayEndData.subject?.trim() || `Day End Report — ${executiveName}`;
    const providedCc = dayEndData.cc_emails !== undefined ? dayEndData.cc_emails : dayEndData.ccEmails;
    const ccList = Array.isArray(providedCc)
      ? providedCc.map((e) => String(e).trim()).filter(Boolean)
      : [];

    const htmlBody = dayEndData.body_html || dayEndData.bodyHtml || '';
    const rawAtts = dayEndData.attachment_ids || dayEndData.attachmentIds || dayEndData.attachments;
    const emailAttachments = await resolveEmailAttachments(rawAtts);

    await emailHelper.sendEmail(
      recipient,
      subject,
      '', // text body fallback
      htmlBody,
      emailAttachments,
      ccList,
      fromAddress,
      'work_plan_completed'
    );

    logger.info(
      `[WorkPlanNotification] Sent Day End custom email to ${recipient} (CC: ${ccList.join(', ') || 'none'}, Attachments: ${emailAttachments.length}) from ${fromAddress}`
    );
  } catch (err) {
    logger.error(`[WorkPlanNotification] Error sending custom Day End email for plan ${planId}: ${err.message}`);
  }
}

/**
 * Dispatches a Work Plan Creation notification email created via the rich mail composer panel or standard submission.
 *
 * @param {string} planId
 * @param {object} user - User object of user creating/submitting plan
 * @param {object} creationMailData - { to_email, cc_emails, subject, body_html, attachment_ids }
 */
async function sendCustomWorkPlanCreationEmail(planId, user, creationMailData = {}) {
  try {
    const { User, WorkPlan } = getModels();
    let senderUser = user;
    if ((!senderUser || !senderUser.email) && (user?._id || user?.id)) {
      const uId = user._id || user.id;
      senderUser = (await User.findById(uId).lean()) || user;
    }

    if (!senderUser || !senderUser.email) {
      logger.warn(`[WorkPlanNotification] Missing user email for plan creation email on planId ${planId}`);
      return;
    }

    const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null }).lean();
    if (!plan) {
      logger.warn(`[WorkPlanNotification] Plan not found for id ${planId}`);
      return;
    }

    const rawTo = creationMailData.to_email || creationMailData.toEmail;
    const rawCc = creationMailData.cc_emails !== undefined ? creationMailData.cc_emails : creationMailData.ccEmails;
    const rawBody = creationMailData.body_html || creationMailData.bodyHtml;
    const rawAtts = creationMailData.attachment_ids || creationMailData.attachmentIds;

    let recipient = typeof rawTo === 'string' ? rawTo.trim() : '';
    let ccList = Array.isArray(rawCc)
      ? rawCc.map((e) => String(e).trim()).filter(Boolean)
      : [];

    if (!recipient) {
      const salesUserId = plan.sales_user?._id || plan.sales_user || senderUser._id || senderUser.id;
      const { primaryRecipientEmail } = await resolveReportingStakeholderEmails(salesUserId, plan);
      recipient = primaryRecipientEmail || '';

      if (!recipient && plan.is_discussed_with_manager && plan.discussed_manager_id) {
        const { User } = getModels();
        const discussedId =
          typeof plan.discussed_manager_id === 'object'
            ? plan.discussed_manager_id._id || plan.discussed_manager_id.id
            : plan.discussed_manager_id;
        const discussedManager = discussedId
          ? await User.findOne({ _id: discussedId, is_active: { $ne: false } }).lean()
          : null;
        if (discussedManager?.email) {
          recipient = discussedManager.email;
        }
      }
    }

    if (!recipient) {
      logger.warn(`[WorkPlanNotification] No recipient email resolved for plan creation email on plan ${planId}`);
      return;
    }

    const { WorkPlanVisit, WorkPlanWork } = getModels();

    const [visits, workItems] = await Promise.all([
      WorkPlanVisit.find({ work_plan: planId, deletedAt: null }).sort({ sequence: 1 }).lean(),
      WorkPlanWork.find({ work_plan: planId, deletedAt: null }).sort({ sequence: 1 }).lean(),
    ]);

    const userName = senderUser.name || senderUser.email.split('@')[0];
    const fromAddress = `${userName} <${senderUser.email}>`;
    const planDateStr = plan.plan_date
      ? new Date(plan.plan_date).toISOString().split('T')[0]
      : 'N/A';

    const baseUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const workPlanUrl = baseUrl ? `${baseUrl}/work-plans` : '';

    const visitsTableHtml = renderVisitsTable(visits);
    const tasksTableHtml = renderTasksTable(workItems);

    const managers = await getWorkPlannerManagers();
    const primaryManager = managers.find((m) => m.email === recipient);
    const recipientName = primaryManager ? (primaryManager.name || recipient.split('@')[0]) : recipient.split('@')[0];

    const templateData = {
      subject: creationMailData.subject?.trim() || `New Work Plan Created — ${userName} (${planDateStr})`,
      recipientName,
      executiveName: userName,
      executiveEmail: senderUser.email,
      planDate: planDateStr,
      planType: plan.plan_type || 'N/A',
      location: plan.location || 'N/A',
      remarks: plan.remarks || 'None',
      discussedManagerName: plan.discussed_manager_name || (plan.is_discussed_with_manager ? 'Manager' : ''),
      discussionMethod: plan.discussion_method || '',
      visitsCount: String(visits.length),
      workCount: String(workItems.length),
      visitsTableHtml,
      tasksTableHtml,
      bodyHtml: rawBody || '',
      workPlanUrl,
    };

    const emailAttachments = await resolveEmailAttachments(rawAtts);

    if (rawBody && rawBody.trim()) {
      await emailHelper.sendEmail(
        recipient,
        creationMailData.subject?.trim() || `New Work Plan Created — ${userName} (${planDateStr})`,
        '',
        rawBody,
        emailAttachments,
        ccList,
        fromAddress,
        'work_plan_created'
      );
      logger.info(
        `[WorkPlanNotification] Sent Work Plan creation custom email to ${recipient} (CC: ${ccList.join(', ') || 'none'}, Attachments: ${emailAttachments.length}) from ${fromAddress}`
      );
    } else {
      await emailHelper.sendTemplateEmail(
        recipient,
        'work_plan_created',
        templateData,
        emailAttachments,
        ccList,
        fromAddress,
        'work_plan_created'
      );
      logger.info(
        `[WorkPlanNotification] Sent Work Plan creation template email to ${recipient} (CC: ${ccList.join(', ') || 'none'}, Attachments: ${emailAttachments.length}) from ${fromAddress}`
      );
    }
  } catch (err) {
    logger.error(`[WorkPlanNotification] Error sending Work Plan creation email for plan ${planId}: ${err.message}`);
  }
}

module.exports = {
  getWorkPlannerManagers,
  sendWorkPlanCompletedEmail,
  sendCustomDayEndEmail,
  sendCustomWorkPlanCreationEmail,
  renderVisitsTable,
  renderTasksTable,
};

