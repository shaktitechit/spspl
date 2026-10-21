/**
 * @fileoverview Role-Aware Daily digests for today's + overdue pending follow-ups (in-app + email).
 * Supports both Lead Follow-Ups and Quotation Follow-Ups with direct WhatsApp/Call CTA and proposal values.
 * Scoped specifically for Executive, Manager, and Admin access roles.
 * @module jobs/followUpDailyReminder
 */
const { FOLLOWUP_REMINDER_TZ } = require('../config/env');
const { getModels } = require('../data/mongoRegistry');
const notificationHelper = require('../utils/notificationHelper');
const emailHelper = require('../modules/messages/helpers/email.helper');
const { logger } = require('../utils/logger');
const {
  resolveSalesRepFromFollowUp,
  resolveFollowUpOwnerUserId,
} = require('../utils/followUpSalesRep');

const CLOSED_LEAD_STATUSES = new Set(['won', 'lost', 'converted']);
const CLOSED_QUOTATION_STATUSES = new Set(['accepted', 'rejected', 'expired']);
const EMAIL_TEMPLATE = 'lead_followups_digest';
const SUBJECT_MAX_LEN = 140;

function ymdInTz(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function zonedDateTimeToUtc(ymd, hms, timeZone) {
  const [y, mo, d] = ymd.split('-').map(Number);
  const [hh, mm, ss] = hms.split(':').map(Number);
  let utcMs = Date.UTC(y, mo - 1, d, hh, mm, ss || 0);

  for (let i = 0; i < 3; i += 1) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(new Date(utcMs))
        .filter((p) => p.type !== 'literal')
        .map((p) => [p.type, p.value])
    );
    const gotMs = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    const wantedMs = Date.UTC(y, mo - 1, d, hh, mm, ss || 0);
    utcMs += wantedMs - gotMs;
  }

  return new Date(utcMs);
}

function dayBoundsInTz(date, timeZone) {
  const ymd = ymdInTz(date, timeZone);
  const [y, m, d] = ymd.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const nextYmd = next.toISOString().slice(0, 10);
  return {
    start: zonedDateTimeToUtc(ymd, '00:00:00', timeZone),
    endExclusive: zonedDateTimeToUtc(nextYmd, '00:00:00', timeZone),
  };
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

function formatTime(timeStr) {
  if (!timeStr || !String(timeStr).trim()) return '';
  return String(timeStr).trim();
}

function formatFollowUpDate(fu, timeZone) {
  if (!fu.follow_up_date) return '';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(fu.follow_up_date));
}

function partyName(fu = {}) {
  if (fu.quotation) {
    return fu.quotation.customer_name || fu.quotation.kind_attn || 'Customer';
  }
  const lead = fu.lead || {};
  const party = lead.party_id;
  if (party && typeof party === 'object') {
    return party.party_name || party.legal_name || '';
  }
  return lead.company_name || lead.name || 'Unknown party';
}

function contactPhone(fu = {}) {
  if (fu.quotation) {
    return fu.quotation.phone || fu.quotation.cell || '';
  }
  const lead = fu.lead || {};
  return lead.phone || lead.alternate_phone || lead.contacts?.[0]?.phone || '';
}

function formatRequirementsOrValue(fu = {}) {
  if (fu.quotation) {
    const q = fu.quotation;
    const total = formatCurrencyINR(q.grand_total || 0);
    const status = q.status ? q.status.replace('_', ' ') : 'active';
    return `Quotation ${total} (${status})`;
  }
  const lead = fu.lead || {};
  const parts = [];
  if (lead.requirement && String(lead.requirement).trim()) {
    parts.push(String(lead.requirement).trim());
  }
  if (Array.isArray(lead.products) && lead.products.length) {
    const productLine = lead.products
      .map((p) => {
        const name = p.product_name || 'Product';
        const qty = p.quantity != null ? ` × ${p.quantity}` : '';
        const unit = p.unit && p.unit !== 'pcs' ? ` ${p.unit}` : '';
        return `${name}${qty}${unit}`;
      })
      .join(', ');
    if (productLine) parts.push(productLine);
  }
  return parts.filter(Boolean).join(' | ') || '—';
}

function whenLabel(fu, { timeZone, includeDate }) {
  const datePart = includeDate ? formatFollowUpDate(fu, timeZone) : '';
  const time = formatTime(fu.follow_up_time);
  return [datePart, time].filter(Boolean).join(' ') || '—';
}

function formatNotifLine(fu, opts) {
  const when = whenLabel(fu, opts);
  const type = fu.type || 'call';
  const party = partyName(fu);
  const rep = resolveSalesRepFromFollowUp(fu);
  if (fu.quotation) {
    const qNo = fu.quotation.quotation_no || 'Quotation';
    const total = formatCurrencyINR(fu.quotation.grand_total || 0);
    return `${when} · ${type} · Quotation #${qNo} (${total}) · ${party} · Rep: ${rep}`;
  }
  const lead = fu.lead || {};
  const leadNo = lead.lead_no ? `#${lead.lead_no}` : 'Lead';
  const req = formatRequirementsOrValue(fu);
  return `${when} · ${type} · ${leadNo} · ${party} · ${req} · Rep: ${rep}`;
}

function truncateSubject(text) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= SUBJECT_MAX_LEN) return s;
  return `${s.slice(0, SUBJECT_MAX_LEN - 1).trim()}…`;
}

function buildEmailSubject({ isOverdue, count, dateLabel, followUps }) {
  const quoteCount = followUps.filter((f) => f.quotation).length;
  const leadCount = followUps.filter((f) => f.lead && !f.quotation).length;

  let labelCount = `${count} follow-ups`;
  if (quoteCount > 0 && leadCount > 0) {
    labelCount = `${quoteCount} Quotation${quoteCount > 1 ? 's' : ''}, ${leadCount} Lead${leadCount > 1 ? 's' : ''}`;
  } else if (quoteCount > 0) {
    labelCount = `${quoteCount} Quotation Follow-up${quoteCount > 1 ? 's' : ''}`;
  }

  const prefix = isOverdue
    ? count === 1 ? 'Overdue follow-up' : `Overdue follow-ups (${labelCount})`
    : count === 1 ? "Today's follow-up" : `Today's follow-ups (${labelCount})`;

  const snippets = followUps.map((fu) => {
    const party = partyName(fu);
    if (fu.quotation) {
      return `${party} (Quote #${fu.quotation.quotation_no})`;
    }
    const req = formatRequirementsOrValue(fu);
    return req && req !== '—' ? `${party} — ${req}` : party;
  });

  if (snippets.length === 1) {
    return truncateSubject(`${prefix}: ${snippets[0]} · ${dateLabel}`);
  }

  return truncateSubject(`${prefix}: ${snippets.slice(0, 3).join('; ')}${snippets.length > 3 ? '…' : ''} · ${dateLabel}`);
}

function buildFollowUpsRows(followUps, { timeZone, includeDate }) {
  return followUps
    .map((fu, idx) => {
      const isQuote = Boolean(fu.quotation);
      const refLabel = isQuote
        ? `<span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;background:#e0e7ff;color:#3730a3;">QUOTE #${escapeHtml(fu.quotation.quotation_no || '')}</span>`
        : fu.lead?.lead_no
        ? `<span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;background:#dbeafe;color:#1e40af;">LEAD #${escapeHtml(fu.lead.lead_no)}</span>`
        : '—';

      const party = escapeHtml(partyName(fu));
      const req = escapeHtml(formatRequirementsOrValue(fu));
      const type = escapeHtml(fu.type || 'call');
      const when = escapeHtml(whenLabel(fu, { timeZone, includeDate }));
      const salesRep = escapeHtml(resolveSalesRepFromFollowUp(fu));

      const phone = contactPhone(fu);
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const whatsappUrl = cleanPhone
        ? `https://wa.me/${cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`}?text=${encodeURIComponent(
            isQuote
              ? `Hello, following up on our proposal #${fu.quotation.quotation_no} from Shakti Enterprises.`
              : `Hello, following up regarding your requirement with Shakti Enterprises.`
          )}`
        : '';

      const actions = [
        phone ? `<a href="tel:${phone}" style="color:#2563eb;text-decoration:none;font-weight:600;margin-right:8px;">📞 Call</a>` : '',
        whatsappUrl ? `<a href="${whatsappUrl}" target="_blank" style="color:#16a34a;text-decoration:none;font-weight:600;">💬 WhatsApp</a>` : '',
      ].filter(Boolean).join(' ');

      return `
              <tr>
                <td class="muted">${idx + 1}</td>
                <td>${refLabel}</td>
                <td class="party"><strong>${party}</strong>${phone ? `<div style="font-size:11px;color:#64748b;">${escapeHtml(phone)}</div>` : ''}</td>
                <td class="req">${req}</td>
                <td><span style="text-transform:capitalize;">${type}</span></td>
                <td><strong>${when}</strong></td>
                <td>${salesRep}</td>
                <td>${actions || '<span class="muted">—</span>'}</td>
              </tr>`;
    })
    .join('\n');
}

function getUserRole(user) {
  if (!user || !Array.isArray(user.portals)) return 'executive';
  const p = user.portals.find(
    (pt) => pt && (pt.portal_code === 'lead_manager' || pt.portal === 'lead_manager')
  );
  if (!p || !Array.isArray(p.access_roles)) return 'executive';
  if (p.access_roles.includes('admin')) return 'admin';
  if (p.access_roles.includes('manager')) return 'manager';
  if (p.access_roles.includes('coordinator')) return 'coordinator';
  return 'executive';
}

function groupByAssignee(rows) {
  /** @type {Map<string, typeof rows>} */
  const byUser = new Map();
  for (const fu of rows) {
    if (fu.lead) {
      const status = fu.lead.status;
      if (status && CLOSED_LEAD_STATUSES.has(status)) continue;
    }
    if (fu.quotation) {
      const qStatus = fu.quotation.status;
      if (qStatus && CLOSED_QUOTATION_STATUSES.has(qStatus)) continue;
    }

    const userId = resolveFollowUpOwnerUserId(fu);
    if (!userId) continue;
    if (!byUser.has(userId)) byUser.set(userId, []);
    byUser.get(userId).push(fu);
  }
  return byUser;
}

/**
 * Send grouped digests scoped by user and role.
 */
async function sendGroupedDigest({
  kind,
  timeZone,
  force,
  query,
  isOverdue,
  includeDateInLines = false,
}) {
  const { LeadFollowUp, User, FollowUpDigestLog, FollowUpReminderLog } = getModels();

  const now = new Date();
  const digestDate = ymdInTz(now, timeZone);
  const dateLabel = new Intl.DateTimeFormat('en-IN', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(now);

  const rows = await LeadFollowUp.find(query)
    .populate({
      path: 'lead',
      select:
        'lead_no name company_name phone email status priority assigned_to requirement products party_id contacts billing_address',
      populate: [
        { path: 'party_id', select: 'party_name legal_name' },
        { path: 'assigned_to', select: 'name email' },
      ],
    })
    .populate({
      path: 'quotation',
      select:
        'quotation_no version grand_total status customer_name kind_attn phone email subject party_id created_by lead sales_person_name sales_person_user',
      populate: { path: 'sales_person_user', select: 'name email' },
    })
    .populate('created_by', 'name email')
    .sort({ follow_up_date: 1, follow_up_time: 1 })
    .lean();

  const byUser = groupByAssignee(rows);
  const userIds = [...byUser.keys()];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select('name email portals').lean()
    : [];
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  const notified = [];
  let skipped = 0;
  let eligibleFollowUps = 0;

  for (const [userId, followUps] of byUser.entries()) {
    eligibleFollowUps += followUps.length;

    if (!force) {
      try {
        await FollowUpDigestLog.create({
          kind,
          user: userId,
          digest_date: digestDate,
          follow_up_count: followUps.length,
          sent_at: new Date(),
        });
      } catch (err) {
        if (err && err.code === 11000) {
          skipped += 1;
          continue;
        }
        throw err;
      }
    }

    const user = userMap.get(userId);
    const userRole = getUserRole(user);
    const count = followUps.length;
    const lines = followUps.map((fu) =>
      formatNotifLine(fu, { timeZone, includeDate: includeDateInLines })
    );

    const quoteCount = followUps.filter((f) => f.quotation).length;
    const leadCount = followUps.filter((f) => f.lead && !f.quotation).length;

    const title = isOverdue
      ? `Overdue follow-ups (${count})`
      : userRole === 'manager' && quoteCount > 0
      ? `Today's Agenda (${quoteCount} Quotes, ${leadCount} Leads)`
      : `Today's follow-ups (${count})`;

    const message =
      count === 1
        ? `${isOverdue ? 'Overdue: ' : ''}${lines[0]}`
        : count <= 5
        ? lines.join(' | ')
        : `${lines.slice(0, 5).join(' | ')} … +${count - 5} more`;

    const subject = buildEmailSubject({ isOverdue, count, dateLabel, followUps });
    const followUpsRows = buildFollowUpsRows(followUps, {
      timeZone,
      includeDate: includeDateInLines || isOverdue,
    });

    try {
      const created = await notificationHelper.createForUser(userId, {
        title,
        message,
        type: isOverdue ? 'warning' : 'info',
        module: 'lead',
        entity_type: isOverdue ? 'follow_up_overdue_digest' : 'follow_up_digest',
      });

      if (user?.email) {
        try {
          await emailHelper.sendTemplateEmail(user.email, EMAIL_TEMPLATE, {
            subject,
            recipientName: user.name || 'there',
            dateLabel,
            count: String(count),
            digestSubtitle: isOverdue
              ? `Overdue Follow-up Reminder · ${dateLabel}`
              : `Today's Follow-up Agenda (${userRole.toUpperCase()}) · ${dateLabel}`,
            introText: isOverdue
              ? `You have <strong>${count}</strong> overdue follow-up${count === 1 ? '' : 's'} (${quoteCount} Quotations, ${leadCount} Leads). Please complete or reschedule promptly.`
              : `You have <strong>${count}</strong> follow-up${count === 1 ? '' : 's'} scheduled for today (${quoteCount} Quotation proposals, ${leadCount} Leads). Details and quick actions are listed below.`,
            tableTitle: isOverdue ? 'Overdue follow-ups' : "Today's follow-ups",
            badgeLabel: isOverdue ? 'OVERDUE' : 'TODAY',
            badgeClass: isOverdue ? 'badge-overdue' : 'badge-today',
            headerVariant: isOverdue ? 'overdue' : '',
            actionVariant: isOverdue ? 'overdue' : '',
            actionTitle: isOverdue ? 'Action required' : 'Plan your day',
            actionText: isOverdue
              ? 'Please resolve every overdue item below. Use direct call or WhatsApp links for quick outreach.'
              : 'Prepare in advance with customer specifications and commercial quotes before calling or visiting.',
            followUpsRows,
          });
        } catch (err) {
          logger.error(`[followUpDailyReminder] email failed for ${user.email}: ${err.message}`);
        }
      }

      // Record granular reminder logs
      for (const fu of followUps) {
        await FollowUpReminderLog.findOneAndUpdate(
          {
            follow_up: fu._id,
            kind: isOverdue ? 'overdue_alert' : 'daily_agenda',
            scheduled_date: digestDate,
          },
          {
            $set: {
              user: userId,
              channel: 'email',
              scheduled_time: fu.follow_up_time || '',
              sent_at: new Date(),
              metadata: { role: userRole, isQuote: Boolean(fu.quotation) },
            },
          },
          { upsert: true }
        ).catch(() => {});
      }

      if (force) {
        await FollowUpDigestLog.findOneAndUpdate(
          { kind, user: userId, digest_date: digestDate },
          {
            $set: { follow_up_count: followUps.length, sent_at: new Date() },
            $setOnInsert: { kind, user: userId, digest_date: digestDate },
          },
          { upsert: true }
        );
      }

      notified.push(userId);
    } catch (err) {
      if (!force) {
        await FollowUpDigestLog.deleteOne({
          kind,
          user: userId,
          digest_date: digestDate,
        }).catch(() => {});
      }
      logger.error(`[followUpDailyReminder] ${kind} notify failed for user ${userId}: ${err.message}`);
    }
  }

  const summary = {
    kind,
    dateLabel,
    digestDate,
    recipientCount: notified.length,
    followUpCount: eligibleFollowUps,
    skipped,
    notified,
  };
  logger.info(
    `[followUpDailyReminder] kind=${kind} sent=${summary.recipientCount} skipped=${summary.skipped} followUps=${summary.followUpCount} date=${digestDate}`
  );
  return summary;
}

/**
 * Send today's pending follow-up reminders.
 */
async function runTodaysFollowUpReminders(options = {}) {
  const timeZone = options.timeZone || FOLLOWUP_REMINDER_TZ || 'Asia/Kolkata';
  const { start, endExclusive } = dayBoundsInTz(new Date(), timeZone);

  return sendGroupedDigest({
    kind: 'todays_followups',
    timeZone,
    force: Boolean(options.force),
    isOverdue: false,
    includeDateInLines: false,
    query: {
      deletedAt: null,
      status: 'pending',
      follow_up_date: { $gte: start, $lt: endExclusive },
    },
  });
}

/**
 * Send overdue pending follow-up reminders.
 */
async function runOverdueFollowUpReminders(options = {}) {
  const timeZone = options.timeZone || FOLLOWUP_REMINDER_TZ || 'Asia/Kolkata';
  const { start } = dayBoundsInTz(new Date(), timeZone);

  return sendGroupedDigest({
    kind: 'overdue_followups',
    timeZone,
    force: Boolean(options.force),
    isOverdue: true,
    includeDateInLines: true,
    query: {
      deletedAt: null,
      status: 'pending',
      follow_up_date: { $lt: start },
    },
  });
}

/** Run both digests. */
async function runAllFollowUpReminders(options = {}) {
  const today = await runTodaysFollowUpReminders(options);
  const overdue = await runOverdueFollowUpReminders(options);
  return { today, overdue };
}

module.exports = {
  runTodaysFollowUpReminders,
  runOverdueFollowUpReminders,
  runAllFollowUpReminders,
};
