/**
 * @fileoverview Intraday Pre-Due Warning Job for Lead and Quotation follow-ups (runs every 15 minutes).
 * Dispatches real-time In-App Notification and Urgent Alert Email T-15m to T-30m prior to scheduled appointment.
 * @module jobs/followUpPreDueJob
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

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function ymdInTz(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr || !String(timeStr).trim()) return null;
  const parts = String(timeStr).trim().split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function getCurrentMinutesInTz(timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value])
  );
  return parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10);
}

function formatCurrencyINR(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) return '₹0';
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

async function runPreDueFollowUpCheck(options = {}) {
  const timeZone = options.timeZone || FOLLOWUP_REMINDER_TZ || 'Asia/Kolkata';
  const { LeadFollowUp, User, FollowUpReminderLog } = getModels();

  const now = new Date();
  const todayYmd = ymdInTz(now, timeZone);
  const currentMinutes = getCurrentMinutesInTz(timeZone);

  // Look for items today where follow_up_time is in [currentMinutes - 5, currentMinutes + 40]
  const [y, m, d] = todayYmd.split('-').map(Number);
  const startOfDay = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const endOfDay = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));

  const candidates = await LeadFollowUp.find({
    deletedAt: null,
    status: 'pending',
    follow_up_date: { $gte: startOfDay, $lte: endOfDay },
  })
    .populate({
      path: 'lead',
      select: 'lead_no name company_name phone email status priority assigned_to requirement products party_id',
      populate: [
        { path: 'party_id', select: 'party_name legal_name' },
        { path: 'assigned_to', select: 'name email' },
      ],
    })
    .populate({
      path: 'quotation',
      select:
        'quotation_no version grand_total status customer_name kind_attn phone email subject party_id created_by sales_person_name sales_person_user',
      populate: { path: 'sales_person_user', select: 'name email' },
    })
    .populate('created_by', 'name email')
    .lean();

  let sentCount = 0;

  for (const fu of candidates) {
    if (!fu.follow_up_time) continue;
    const itemMinutes = parseTimeToMinutes(fu.follow_up_time);
    if (itemMinutes === null) continue;

    // Trigger if within 35 minutes ahead or up to 10 minutes past scheduled time
    const diff = itemMinutes - currentMinutes;
    if (diff < -10 || diff > 35) continue;

    const userId = resolveFollowUpOwnerUserId(fu);
    if (!userId) continue;

    // Check idempotency in FollowUpReminderLog
    const alreadySent = await FollowUpReminderLog.findOne({
      follow_up: fu._id,
      kind: 'pre_due_warning',
      scheduled_date: todayYmd,
    });
    if (alreadySent) continue;

    const user = await User.findById(userId).select('name email portals').lean();
    if (!user) continue;

    const isQuote = Boolean(fu.quotation);
    const party = isQuote
      ? fu.quotation.customer_name || fu.quotation.kind_attn || 'Customer'
      : fu.lead?.company_name || fu.lead?.name || 'Customer';

    const phone = isQuote
      ? fu.quotation.phone || fu.quotation.cell || ''
      : fu.lead?.phone || fu.lead?.alternate_phone || '';

    const ref = isQuote
      ? `Quotation #${fu.quotation.quotation_no} (${formatCurrencyINR(fu.quotation.grand_total || 0)})`
      : `Lead #${fu.lead?.lead_no || ''}`;

    const salesRep = resolveSalesRepFromFollowUp(fu);
    const title = `⏰ Follow-up in ${Math.max(0, diff)}m: ${party}`;
    const message = `${fu.type || 'Call'} scheduled at ${fu.follow_up_time} for ${ref} (Sales rep: ${salesRep}). Click to review details.`;

    try {
      // 1. In-App Notification
      await notificationHelper.createForUser(userId, {
        title,
        message,
        type: 'warning',
        module: 'lead',
        entity_type: isQuote ? 'quotation' : 'lead',
        entity_id: isQuote ? fu.quotation._id : fu.lead?._id,
      });

      // 2. Email Notification
      if (user.email) {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const whatsappUrl = cleanPhone
          ? `https://wa.me/${cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`}?text=${encodeURIComponent(
              isQuote
                ? `Hello, following up on our quotation #${fu.quotation.quotation_no} from Shakti Enterprises.`
                : `Hello, following up on your inquiry with Shakti Enterprises.`
            )}`
          : '';

        const emailSubject = `⚡ Upcoming Follow-up in ${Math.max(0, diff)} mins: ${party} (${fu.follow_up_time})`;
        const htmlBody = `
          <div style="font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px;background:#ffffff;">
            <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:12px;padding:12px 16px;margin-bottom:16px;">
              <span style="font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.05em;">⏰ PRE-DUE REMINDER</span>
              <h3 style="margin:4px 0 0 0;color:#78350f;font-size:16px;">Follow-up due at ${fu.follow_up_time}</h3>
            </div>
            <p style="font-size:14px;color:#334155;margin:0 0 16px 0;">
              Hi <strong>${escapeHtml(user.name || 'there')}</strong>, you have an upcoming <strong>${escapeHtml(fu.type || 'call')}</strong> follow-up in approx. <strong>${Math.max(0, diff)} minutes</strong>.
            </p>
            <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">
              <tr>
                <td style="padding:8px 0;color:#64748b;width:120px;">Target Entity:</td>
                <td style="padding:8px 0;font-weight:700;color:#0f172a;">${escapeHtml(ref)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;">Customer/Party:</td>
                <td style="padding:8px 0;font-weight:700;color:#0f172a;">${escapeHtml(party)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;">Sales representative:</td>
                <td style="padding:8px 0;font-weight:700;color:#0f172a;">${escapeHtml(salesRep)}</td>
              </tr>
              ${phone ? `<tr>
                <td style="padding:8px 0;color:#64748b;">Phone:</td>
                <td style="padding:8px 0;font-weight:600;color:#2563eb;">${escapeHtml(phone)}</td>
              </tr>` : ''}
              ${fu.notes ? `<tr>
                <td style="padding:8px 0;color:#64748b;">Notes:</td>
                <td style="padding:8px 0;color:#475569;">${escapeHtml(fu.notes)}</td>
              </tr>` : ''}
            </table>
            <div style="display:flex;gap:10px;padding-top:12px;border-top:1px solid #f1f5f9;">
              ${phone ? `<a href="tel:${phone}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:13px;">📞 Call Customer</a>` : ''}
              ${whatsappUrl ? `<a href="${whatsappUrl}" target="_blank" style="display:inline-block;padding:10px 18px;background:#16a34a;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:13px;margin-left:8px;">💬 Open WhatsApp</a>` : ''}
            </div>
          </div>
        `;

        await emailHelper.sendEmail(user.email, emailSubject, message, htmlBody).catch((e) => {
          logger.error(`[followUpPreDueJob] Email failed to ${user.email}: ${e.message}`);
        });
      }

      // 3. Log Reminder Sent
      await FollowUpReminderLog.create({
        follow_up: fu._id,
        kind: 'pre_due_warning',
        user: userId,
        channel: 'in_app',
        scheduled_date: todayYmd,
        scheduled_time: fu.follow_up_time,
        sent_at: new Date(),
        metadata: { diffMinutes: diff, isQuote },
      });

      sentCount += 1;
    } catch (err) {
      logger.error(`[followUpPreDueJob] Failed to dispatch pre-due warning for ${fu._id}: ${err.message}`);
    }
  }

  if (sentCount > 0) {
    logger.info(`[followUpPreDueJob] Sent ${sentCount} pre-due follow-up alerts at ${todayYmd} ${currentMinutes}m`);
  }
  return { sentCount };
}

module.exports = {
  runPreDueFollowUpCheck,
};
