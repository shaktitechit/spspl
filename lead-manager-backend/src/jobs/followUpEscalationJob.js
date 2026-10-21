/**
 * @fileoverview Overdue Follow-up Escalation Job (runs twice daily at 12:30 PM & 05:30 PM).
 * Escalates >24h overdue items to Managers/Coordinators (team-scoped), and >48h stale deals/leads to Admins.
 * @module jobs/followUpEscalationJob
 */
const { FOLLOWUP_REMINDER_TZ } = require('../config/env');
const { getModels } = require('../data/mongoRegistry');
const notificationHelper = require('../utils/notificationHelper');
const emailHelper = require('../modules/messages/helpers/email.helper');
const { logger } = require('../utils/logger');
const { getVisibleLeadUserIds } = require('../modules/team/teamVisibility.service');
const {
  resolveSalesRepFromFollowUp,
  resolveFollowUpOwnerUserId,
} = require('../utils/followUpSalesRep');

function ymdInTz(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCurrencyINR(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) return '₹0';
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function getLeadManagerRole(user) {
  const p = user.portals?.find((pt) => pt.portal_code === 'lead_manager' || pt.portal === 'lead_manager');
  if (!p?.access_roles?.length) return null;
  if (p.access_roles.includes('admin')) return 'admin';
  if (p.access_roles.includes('manager')) return 'manager';
  if (p.access_roles.includes('coordinator')) return 'coordinator';
  return null;
}

function daysLateSince(startOfToday, followUpDate) {
  return Math.round((startOfToday - new Date(followUpDate)) / (1000 * 60 * 60 * 24));
}

function buildEscalationRowsHtml(followUps, startOfToday) {
  return followUps
    .map((fu, idx) => {
      const isQuote = Boolean(fu.quotation);
      const target = isQuote
        ? `Quotation #${escapeHtml(fu.quotation.quotation_no)} (${formatCurrencyINR(fu.quotation.grand_total)})`
        : `Lead #${escapeHtml(fu.lead?.lead_no || '')}`;
      const party = isQuote
        ? fu.quotation.customer_name
        : fu.lead?.company_name || fu.lead?.name || 'Customer';
      const salesRep = escapeHtml(resolveSalesRepFromFollowUp(fu));
      const daysLate = daysLateSince(startOfToday, fu.follow_up_date);
      return `
                <tr>
                  <td style="padding:6px 8px;border-bottom:1px solid #fee2e2;">${idx + 1}</td>
                  <td style="padding:6px 8px;border-bottom:1px solid #fee2e2;font-weight:700;">${target}</td>
                  <td style="padding:6px 8px;border-bottom:1px solid #fee2e2;">${escapeHtml(party)}</td>
                  <td style="padding:6px 8px;border-bottom:1px solid #fee2e2;font-weight:600;">${salesRep}</td>
                  <td style="padding:6px 8px;border-bottom:1px solid #fee2e2;color:#b91c1c;font-weight:700;">${daysLate} days late</td>
                </tr>`;
    })
    .join('');
}

function escalationTableHtml(rowsHtml, variant = 'admin') {
  const isAdmin = variant === 'admin';
  const headerBg = isAdmin ? '#fef2f2' : '#fff7ed';
  const headerColor = isAdmin ? '#991b1b' : '#9a3412';
  const borderColor = isAdmin ? '#fee2e2' : '#ffedd5';

  return `
              <table style="width:100%;border-collapse:collapse;font-size:12px;margin:16px 0;">
                <thead>
                  <tr style="background:${headerBg};text-align:left;color:${headerColor};">
                    <th style="padding:6px 8px;">#</th>
                    <th style="padding:6px 8px;">Target</th>
                    <th style="padding:6px 8px;">Customer</th>
                    <th style="padding:6px 8px;">Sales rep</th>
                    <th style="padding:6px 8px;">Delay</th>
                  </tr>
                </thead>
                <tbody>${rowsHtml.replace(/border-bottom:1px solid #fee2e2/g, `border-bottom:1px solid ${borderColor}`)}</tbody>
              </table>`;
}

async function runOverdueEscalationCheck(options = {}) {
  const timeZone = options.timeZone || FOLLOWUP_REMINDER_TZ || 'Asia/Kolkata';
  const { LeadFollowUp, User } = getModels();

  const now = new Date();
  const todayYmd = ymdInTz(now, timeZone);
  const [y, m, d] = todayYmd.split('-').map(Number);
  const startOfToday = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));

  const overdueFollowUps = await LeadFollowUp.find({
    deletedAt: null,
    status: 'pending',
    follow_up_date: { $lt: startOfToday },
  })
    .populate({
      path: 'lead',
      select: 'lead_no name company_name phone email status priority assigned_to requirement products party_id',
      populate: [
        { path: 'party_id', select: 'party_name' },
        { path: 'assigned_to', select: 'name email' },
      ],
    })
    .populate({
      path: 'quotation',
      select:
        'quotation_no version grand_total status customer_name phone email created_by sales_person_name sales_person_user',
      populate: { path: 'sales_person_user', select: 'name email' },
    })
    .populate('created_by', 'name email portals')
    .sort({ follow_up_date: 1 })
    .lean();

  if (overdueFollowUps.length === 0) {
    logger.info('[followUpEscalationJob] No overdue follow-ups found.');
    return { escalatedCount: 0 };
  }

  const allUsers = await User.find({ deletedAt: null }).select('name email portals').lean();
  const admins = allUsers.filter((u) => getLeadManagerRole(u) === 'admin');
  const teamLeads = allUsers.filter((u) => {
    const role = getLeadManagerRole(u);
    return role === 'manager' || role === 'coordinator';
  });

  let escalatedCount = 0;

  const twoDaysAgo = new Date(startOfToday.getTime() - 2 * 24 * 60 * 60 * 1000);
  const severeOverdue = overdueFollowUps.filter((f) => new Date(f.follow_up_date) <= twoDaysAgo);
  const managerWindow = overdueFollowUps.filter((f) => {
    const days = daysLateSince(startOfToday, f.follow_up_date);
    return days >= 1 && days < 2;
  });

  if (severeOverdue.length > 0 && admins.length > 0) {
    const title = `🚨 Admin Alert: ${severeOverdue.length} Follow-ups Overdue > 48h`;
    const message = `There are ${severeOverdue.length} follow-ups critically overdue past 48 hours requiring intervention.`;

    const rowsHtml = buildEscalationRowsHtml(severeOverdue, startOfToday);

    for (const admin of admins) {
      try {
        await notificationHelper.createForUser(admin._id, {
          title,
          message: `${message} Reps: ${[...new Set(severeOverdue.map((f) => resolveSalesRepFromFollowUp(f)))].slice(0, 5).join(', ')}`,
          type: 'danger',
          module: 'lead',
          entity_type: 'escalation_digest',
        });

        if (admin.email) {
          const emailSubject = `🔴 CRITICAL ESCALATION: ${severeOverdue.length} Follow-ups overdue > 48 hours`;
          const htmlBody = `
            <div style="font-family:Inter,sans-serif;max-width:650px;margin:0 auto;padding:24px;border:2px solid #ef4444;border-radius:16px;background:#ffffff;">
              <div style="background:#fee2e2;border-radius:10px;padding:12px 16px;margin-bottom:16px;">
                <span style="font-size:11px;font-weight:800;color:#991b1b;text-transform:uppercase;">🚨 Executive Escalation Alert</span>
                <h3 style="margin:4px 0 0 0;color:#7f1d1d;font-size:16px;">${severeOverdue.length} Stalled Follow-ups Require Action</h3>
              </div>
              <p style="font-size:14px;color:#334155;">
                Hello <strong>${escapeHtml(admin.name)}</strong>, the following follow-up interactions have remained unaddressed for over 48 hours:
              </p>
              ${escalationTableHtml(rowsHtml, 'admin')}
              <p style="font-size:12px;color:#64748b;">Please coordinate with the named sales representatives or reassign these items in the Lead Manager portal.</p>
            </div>
          `;

          await emailHelper.sendEmail(admin.email, emailSubject, message, htmlBody).catch(() => {});
        }
        escalatedCount += 1;
      } catch (err) {
        logger.error(`[followUpEscalationJob] Failed to alert admin ${admin._id}: ${err.message}`);
      }
    }
  }

  if (managerWindow.length > 0 && teamLeads.length > 0) {
    for (const lead of teamLeads) {
      let visibleIds;
      try {
        visibleIds = await getVisibleLeadUserIds(lead);
      } catch (err) {
        logger.error(`[followUpEscalationJob] visibility failed for ${lead._id}: ${err.message}`);
        continue;
      }
      if (Array.isArray(visibleIds) && visibleIds.length === 0) continue;

      const visibleSet =
        visibleIds === null ? null : new Set(visibleIds.map((id) => String(id)));

      const teamItems = managerWindow.filter((fu) => {
        const ownerId = resolveFollowUpOwnerUserId(fu);
        if (!ownerId) return false;
        if (visibleSet === null) return true;
        return visibleSet.has(String(ownerId));
      });

      if (teamItems.length === 0) continue;

      const title = `⚠️ Team Alert: ${teamItems.length} Follow-up(s) Overdue > 24h`;
      const repSummary = [...new Set(teamItems.map((f) => resolveSalesRepFromFollowUp(f)))].join(', ');
      const message = `${teamItems.length} team follow-up(s) are overdue by 24+ hours. Sales reps: ${repSummary}`;

      try {
        await notificationHelper.createForUser(lead._id, {
          title,
          message,
          type: 'warning',
          module: 'lead',
          entity_type: 'escalation_digest',
        });

        if (lead.email) {
          const rowsHtml = buildEscalationRowsHtml(teamItems, startOfToday);
          const emailSubject = `⚠️ Team escalation: ${teamItems.length} follow-up(s) overdue > 24 hours`;
          const htmlBody = `
            <div style="font-family:Inter,sans-serif;max-width:650px;margin:0 auto;padding:24px;border:2px solid #f97316;border-radius:16px;background:#ffffff;">
              <div style="background:#ffedd5;border-radius:10px;padding:12px 16px;margin-bottom:16px;">
                <span style="font-size:11px;font-weight:800;color:#9a3412;text-transform:uppercase;">Manager / Coordinator Alert</span>
                <h3 style="margin:4px 0 0 0;color:#7c2d12;font-size:16px;">${teamItems.length} overdue follow-up(s) on your team</h3>
              </div>
              <p style="font-size:14px;color:#334155;">
                Hello <strong>${escapeHtml(lead.name)}</strong>, please follow up with the sales representatives below:
              </p>
              ${escalationTableHtml(rowsHtml, 'manager')}
            </div>
          `;
          await emailHelper.sendEmail(lead.email, emailSubject, message, htmlBody).catch(() => {});
        }
        escalatedCount += 1;
      } catch (err) {
        logger.error(`[followUpEscalationJob] Failed to alert manager ${lead._id}: ${err.message}`);
      }
    }
  }

  logger.info(`[followUpEscalationJob] Processed escalation check: ${escalatedCount} alerts dispatched.`);
  return { escalatedCount, totalOverdue: overdueFollowUps.length };
}

module.exports = {
  runOverdueEscalationCheck,
};
