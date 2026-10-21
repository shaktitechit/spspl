/**
 * @fileoverview Scheduled cron job for personal note reminders.
 * Checks for due note reminders every minute and triggers:
 * 1. In-app notifications
 * 2. Branded HTML reminder emails
 * @module jobs/noteReminderScheduler
 */

const cron = require('node-cron');
const { getModels } = require('../data/mongoRegistry');
const { logger } = require('../utils/logger');
const notificationService = require('../modules/notifications/notification.service');
const emailHelper = require('../modules/messages/helpers/email.helper');

let started = false;

function formatDateTime(d) {
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata',
    }).format(new Date(d));
  } catch {
    return String(d);
  }
}

function renderNoteReminderEmail(note, user) {
  const noteTitle = note.title || (note.type === 'visit' ? note.party_name : 'Untitled Note');
  const userName = user?.name || 'User';
  const remindTimeStr = formatDateTime(note.reminder?.remind_at || new Date());
  
  const typeBadge =
    note.type === 'task'
      ? '<span style="background-color: #e0f2fe; color: #0369a1; font-size: 11px; font-weight: bold; padding: 3px 8px; border-radius: 6px; text-transform: uppercase;">Task Note</span>'
      : note.type === 'visit'
        ? '<span style="background-color: #fef3c7; color: #b45309; font-size: 11px; font-weight: bold; padding: 3px 8px; border-radius: 6px; text-transform: uppercase;">Visit Note</span>'
        : '<span style="background-color: #f1f5f9; color: #475569; font-size: 11px; font-weight: bold; padding: 3px 8px; border-radius: 6px; text-transform: uppercase;">Quick Note</span>';

  let specificDetailsHtml = '';

  if (note.type === 'task') {
    const priorityColor =
      note.priority === 'urgent' || note.priority === 'high'
        ? '#ef4444'
        : note.priority === 'medium'
          ? '#f59e0b'
          : '#10b981';
    specificDetailsHtml = `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin: 14px 0;">
        <div style="display: flex; gap: 12px; font-size: 13px; color: #334155; margin-bottom: 8px;">
          <span><strong>Priority:</strong> <span style="color: ${priorityColor}; font-weight: 700; text-transform: uppercase;">${note.priority || 'medium'}</span></span>
          ${note.target_date ? `<span>• <strong>Due Date:</strong> ${formatDateTime(note.target_date)}</span>` : ''}
          <span>• <strong>Status:</strong> ${note.is_completed ? '✅ Completed' : '⏳ Pending'}</span>
        </div>
        ${note.description ? `<div style="font-size: 13px; line-height: 1.5; color: #475569;">${note.description}</div>` : ''}
      </div>
    `;
  } else if (note.type === 'visit') {
    const loc = [note.locality, note.city].filter(Boolean).join(', ');
    specificDetailsHtml = `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin: 14px 0;">
        <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 6px;">🏢 ${note.party_name || note.title}</div>
        <div style="font-size: 13px; color: #475569; line-height: 1.6;">
          ${note.contact_person ? `<div>👤 <strong>Contact:</strong> ${note.contact_person} ${note.contact_number ? `(${note.contact_number})` : ''}</div>` : ''}
          ${loc ? `<div>📍 <strong>Location:</strong> ${loc}</div>` : ''}
          ${note.purpose ? `<div>🎯 <strong>Purpose:</strong> ${note.purpose}</div>` : ''}
          ${note.planned_time ? `<div>⏰ <strong>Planned Time:</strong> ${note.planned_time}</div>` : ''}
        </div>
        ${note.description ? `<div style="margin-top: 8px; font-size: 12px; color: #64748b; font-style: italic;">"${note.description}"</div>` : ''}
      </div>
    `;
  } else {
    specificDetailsHtml = note.description || note.content
      ? `<div style="background-color: #f8fafc; border-left: 4px solid #0d9488; padding: 14px 16px; margin: 16px 0; border-radius: 4px; font-size: 14px; line-height: 1.6; color: #334155;">${note.description || note.content}</div>`
      : '';
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Scratchpad Note Reminder</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f766e 0%, #0d9488 100%); padding: 24px 30px; color: #ffffff;">
              <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.85;">OPMS • Work Planner Scratchpad</div>
              <h1 style="margin: 6px 0 0 0; font-size: 20px; font-weight: 800; color: #ffffff;">⏰ Scheduled Note Reminder</h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 28px 30px;">
              <p style="margin: 0 0 14px 0; font-size: 14px; color: #475569;">
                Hello <strong>${userName}</strong>, here is your scheduled reminder for your personal scratchpad note:
              </p>

              <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; background-color: #ffffff;">
                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px; margin-bottom: 12px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    ${typeBadge}
                    <h2 style="margin: 0; font-size: 17px; font-weight: 700; color: #0f172a;">${noteTitle}</h2>
                  </div>
                  <span style="font-size: 11px; color: #64748b; background: #f8fafc; padding: 3px 8px; border-radius: 12px; border: 1px solid #e2e8f0;">${remindTimeStr}</span>
                </div>

                ${specificDetailsHtml}
              </div>

              <!-- Call to Action -->
              <div style="margin-top: 24px; text-align: center;">
                <p style="font-size: 13px; color: #64748b; margin-bottom: 12px;">
                  You can review this note or convert it directly into an active daily Work Plan in OPMS:
                </p>
                <a href="${process.env.APP_URL || 'https://opms.shaktihormann.com'}/dashboard/notes" style="display: inline-block; background-color: #0d9488; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 13px; padding: 10px 24px; border-radius: 8px; box-shadow: 0 2px 4px rgba(13, 148, 136, 0.3);">
                  Open Notes &amp; Scratchpad →
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 18px 30px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
              This automated reminder was configured in your private OPMS Work Planner Scratchpad.<br>
              © ${new Date().getFullYear()} OPMS • Shakti Hormann Ltd.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Execute pending note reminders check.
 */
async function processDueNoteReminders() {
  try {
    const { UserNote } = getModels();
    if (!UserNote) return;

    const now = new Date();
    const dueNotes = await UserNote.find({
      deletedAt: null,
      'reminder.enabled': true,
      'reminder.is_sent': { $ne: true },
      'reminder.remind_at': { $lte: now },
    })
      .populate('user', 'name email')
      .populate('party', 'party_name')
      .limit(50);

    if (!dueNotes || dueNotes.length === 0) return;

    logger.info(`[noteReminderScheduler] Found ${dueNotes.length} due note reminder(s) to process.`);

    for (const note of dueNotes) {
      try {
        const u = note.user;
        const uId = u ? String(u._id || u.id) : null;
        if (!uId) continue;

        const noteTitle = note.title || (note.type === 'visit' ? note.party_name : 'Untitled Note');

        // 1. In-App Notification
        if (note.reminder?.notify_app !== false) {
          await notificationService.createForUser(uId, {
            title: `⏰ Note Reminder: ${noteTitle}`,
            message: `Reminder for ${note.type || 'task'} note "${noteTitle}". Click to view or convert to Work Plan.`,
            type: 'info',
            module: 'work_planner',
            entity_type: 'user_note',
            entity_id: note._id,
          }).catch((err) => {
            logger.warn(`[noteReminderScheduler] Failed to publish in-app notification for note ${note._id}: ${err.message}`);
          });
        }

        // 2. Email Notification
        if (note.reminder?.notify_email !== false && u.email) {
          const subject = `⏰ Scratchpad Reminder: ${noteTitle}`;
          const htmlBody = renderNoteReminderEmail(note, u);
          await emailHelper.sendEmail(
            u.email,
            subject,
            `Reminder: ${noteTitle}`,
            htmlBody,
            [],
            [],
            null,
            'personal_note_reminder'
          ).catch((err) => {
            logger.warn(`[noteReminderScheduler] Failed to send reminder email to ${u.email} for note ${note._id}: ${err.message}`);
          });
        }

        // 3. Mark Reminder as Sent
        note.reminder.is_sent = true;
        note.reminder.sent_at = new Date();
        await note.save();
        logger.info(`[noteReminderScheduler] Processed reminder for note "${noteTitle}" (${note._id}) for user ${u.name || u.email}`);
      } catch (noteErr) {
        logger.error(`[noteReminderScheduler] Error processing note ${note._id}: ${noteErr.message}`);
      }
    }
  } catch (err) {
    logger.error(`[noteReminderScheduler] Main processing loop failed: ${err.message}`);
  }
}

function startNoteReminderScheduler() {
  if (started) return;
  started = true;

  // Run every 2 minutes
  cron.schedule('*/2 * * * *', async () => {
    await processDueNoteReminders();
  });

  logger.info('[noteReminderScheduler] Note reminder background scheduler initialized (every 2 minutes).');
}

module.exports = {
  startNoteReminderScheduler,
  processDueNoteReminders,
};
