/**
 * @fileoverview Notification and Email dispatcher service for Help Desk Module.
 * @module modules/helpDesk/helpDeskNotification.service
 */

const axios = require('axios');
const { getModels } = require('../../data/mongoRegistry');
const { sendEmail } = require('../messages/helpers/email.helper');
const { NOTIFICATION_SERVICE_URL } = require('../../config/env');
const { logger } = require('../../utils/logger');

const FRONTEND_BASE_URL = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:7008';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function priorityBadgeColor(priority) {
  switch (String(priority).toLowerCase()) {
    case 'urgent':
      return { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5', label: '🔥 URGENT' };
    case 'high':
      return { bg: '#ffedd5', text: '#ea580c', border: '#fdba74', label: '⚡ HIGH' };
    case 'low':
      return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1', label: 'LOW' };
    default:
      return { bg: '#e0f2fe', text: '#0284c7', border: '#bae6fd', label: 'MEDIUM' };
  }
}

function formatCategoryLabel(cat) {
  const map = {
    work_plan_support: 'Work Plan Support',
    visit_assistance: 'Field Visit Assistance',
    client_lead_requirement: 'Client / Lead Requirement',
    product_pricing_query: 'Product & Pricing Query',
    expense_account_query: 'Expense & Account Query',
    technical_portal_issue: 'Technical & Portal Issue',
    urgent_coordination: 'Urgent Coordination',
    general_requirement: 'General Requirement',
    other: 'Other Support',
  };
  return map[cat] || cat || 'General Support';
}

/**
 * Sends in-app notification (SSE / WebPush via notification-service + local Notification doc fallback).
 */
async function sendInAppNotification(userId, { title, message, type = 'info', entity_type = 'help_ticket', entity_id = null }) {
  if (!userId) return null;
  const strUserId = String(userId);

  try {
    const { Notification } = getModels();
    await Notification.create({
      user: strUserId,
      title,
      message,
      type,
      module: 'help_desk',
      entity_type,
      entity_id: entity_id ? String(entity_id) : undefined,
      is_read: false,
    });
  } catch (err) {
    logger.warn(`[HelpDeskNotification] Local notification write failed: ${err.message}`);
  }

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
            module: 'help_desk',
            entity_type,
            entity_id: entity_id ? String(entity_id) : undefined,
          },
        },
        { timeout: 4000 }
      );
    } catch (pushErr) {
      // Best-effort push
    }
  }
}

let _cachedCompanyInfo = null;
let _cachedCompanyInfoTime = 0;

/**
 * Retrieves company letterhead information from CompanyInfo collection.
 */
async function getCompanyLetterhead(companyId = null) {
  const now = Date.now();
  if (_cachedCompanyInfo && now - _cachedCompanyInfoTime < 60000 && !companyId) {
    return _cachedCompanyInfo;
  }

  try {
    const { CompanyInfo } = getModels();
    if (CompanyInfo) {
      let doc = null;
      if (companyId) {
        doc = await CompanyInfo.findById(companyId).lean();
      }
      if (!doc) {
        doc = (await CompanyInfo.findOne({ is_default: true }).lean()) || (await CompanyInfo.findOne().lean());
      }
      if (doc) {
        const primaryColor = doc.primary_color || '#4f46e5';
        const secondaryColor = doc.secondary_color || '#3b82f6';
        const companyName = doc.trade_name || doc.legal_name || 'OPMS Operations & Management Portal';
        const addressParts = [doc.address, doc.city, doc.state, doc.pincode].filter(Boolean);

        const info = {
          company_name: companyName,
          legal_name: doc.legal_name || companyName,
          trade_name: doc.trade_name || companyName,
          logo_url: doc.logo_url || '',
          email: doc.email || doc.billing_email || '',
          phone: doc.phone || '',
          website: doc.website || '',
          address: addressParts.join(', '),
          gstin: doc.gstin || '',
          cin: doc.cin || '',
          primary_color: primaryColor,
          secondary_color: secondaryColor,
        };

        if (!companyId) {
          _cachedCompanyInfo = info;
          _cachedCompanyInfoTime = now;
        }
        return info;
      }
    }
  } catch (err) {
    logger.warn(`[HelpDeskNotification] Failed to query CompanyInfo: ${err.message}`);
  }

  return {
    company_name: 'OPMS Operations & Management',
    legal_name: 'OPMS Operations & Management',
    trade_name: 'OPMS Portal',
    logo_url: '',
    email: 'support@opms.local',
    phone: '',
    website: '',
    address: '',
    gstin: '',
    cin: '',
    primary_color: '#4f46e5',
    secondary_color: '#3b82f6',
  };
}

/**
 * Builds responsive, styled company letterhead HTML email template for Help Desk notifications.
 */
function buildHelpDeskEmailHtml({
  company = {},
  headerTitle,
  headerSubtitle,
  badgeText,
  ticket,
  mainContentHtml,
  actionButtonText,
  actionButtonUrl,
  noteText,
}) {
  const ticketNum = ticket.ticket_number || 'HD-TICKET';
  const priority = priorityBadgeColor(ticket.priority);
  const categoryStr = formatCategoryLabel(ticket.category);
  const creatorName = ticket.creator_snapshot?.name || 'Portal User';
  const creatorDept = ticket.creator_snapshot?.department ? `(${ticket.creator_snapshot.department})` : '';

  const companyName = company.trade_name || company.legal_name || company.company_name || 'OPMS Portal';
  const logoUrl = company.logo_url || '';
  const primaryColor = company.primary_color || '#4f46e5';
  const secondaryColor = company.secondary_color || '#3b82f6';
  const currentYear = new Date().getFullYear();

  const contactItems = [];
  if (company.phone) contactItems.push(`Phone: ${escapeHtml(company.phone)}`);
  if (company.email) contactItems.push(`Email: <a href="mailto:${escapeHtml(company.email)}" style="color: inherit; text-decoration: none;">${escapeHtml(company.email)}</a>`);
  if (company.website) contactItems.push(`Web: <a href="${escapeHtml(company.website)}" target="_blank" style="color: inherit; text-decoration: none;">${escapeHtml(company.website)}</a>`);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(ticket.title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 660px; background-color: #ffffff; border-radius: 12px; border: 1px solid #cbd5e1; overflow: hidden; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);">
          
          <!-- ── OFFICIAL COMPANY LETTERHEAD HEADER ── -->
          <tr>
            <td style="background-color: #ffffff; padding: 24px 32px 18px 32px; text-align: center; border-bottom: 1px solid #f1f5f9;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    ${
                      logoUrl
                        ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(companyName)}" style="max-height: 58px; max-width: 200px; display: block; margin: 0 auto 10px auto;" />`
                        : `<div style="display: inline-block; background: linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%); color: #ffffff; font-weight: 900; font-size: 16px; padding: 8px 16px; border-radius: 8px; letter-spacing: 0.05em; margin-bottom: 8px;">${escapeHtml(companyName.toUpperCase())}</div>`
                    }
                    <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.2px; text-transform: uppercase;">
                      ${escapeHtml(companyName)}
                    </h2>
                    ${
                      company.address
                        ? `<p style="margin: 4px 0 0 0; font-size: 11.5px; color: #64748b; line-height: 1.4;">${escapeHtml(company.address)}</p>`
                        : ''
                    }
                    ${
                      contactItems.length > 0
                        ? `<p style="margin: 3px 0 0 0; font-size: 11px; color: #64748b;">${contactItems.join(' &bull; ')}</p>`
                        : ''
                    }
                    <!-- Elegant Letterhead Gradient Bar -->
                    <div style="height: 3px; background: linear-gradient(90deg, ${primaryColor} 0%, ${secondaryColor} 70%, #93c5fd 100%); margin-top: 16px; border-radius: 2px;"></div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── NOTIFICATION CONTEXT & SUBJECT BANNER ── -->
          <tr>
            <td style="background: linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%); padding: 18px 32px; color: #ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="display: inline-block; background: rgba(255, 255, 255, 0.22); padding: 3px 10px; border-radius: 9999px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
                      ${escapeHtml(badgeText || 'Help Desk Notification')}
                    </span>
                    <h1 style="margin: 8px 0 3px 0; font-size: 18px; font-weight: 800; line-height: 1.3; color: #ffffff;">
                      ${escapeHtml(headerTitle)}
                    </h1>
                    <p style="margin: 0; font-size: 12.5px; opacity: 0.92; color: #e0e7ff;">
                      ${escapeHtml(headerSubtitle || `Ticket #${ticketNum}`)}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── TICKET SUMMARY CARD & BODY ── -->
          <tr>
            <td style="padding: 26px 32px 18px 32px;">
              <!-- Ticket Overview Metadata Box -->
              <div style="background-color: #f8fafc; border-radius: 10px; padding: 14px 18px; border: 1px solid #e2e8f0; margin-bottom: 22px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="font-size: 12px; color: #64748b; font-weight: 600; padding-bottom: 5px;">Ticket Number:</td>
                    <td style="font-size: 13px; color: #0f172a; font-weight: 700; padding-bottom: 5px; text-align: right;">
                      <span style="background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 5px; font-family: monospace; font-size: 12px;">#${escapeHtml(ticketNum)}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size: 12px; color: #64748b; font-weight: 600; padding-bottom: 5px;">Created By:</td>
                    <td style="font-size: 13px; color: #0f172a; font-weight: 600; padding-bottom: 5px; text-align: right;">
                      ${escapeHtml(creatorName)} ${escapeHtml(creatorDept)}
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size: 12px; color: #64748b; font-weight: 600; padding-bottom: 5px;">Priority & Category:</td>
                    <td style="font-size: 12px; color: #0f172a; font-weight: 600; padding-bottom: 5px; text-align: right;">
                      <span style="background-color: ${priority.bg}; color: ${priority.text}; border: 1px solid ${priority.border}; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; margin-right: 4px;">
                        ${priority.label}
                      </span>
                      <span style="color: #475569;">${escapeHtml(categoryStr)}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size: 12px; color: #64748b; font-weight: 600;">Subject / Requirement:</td>
                    <td style="font-size: 13px; color: #0f172a; font-weight: 700; text-align: right;">
                      ${escapeHtml(ticket.title)}
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Main Dynamic Content -->
              <div style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 24px;">
                ${mainContentHtml}
              </div>

              <!-- Primary Call To Action Button -->
              ${
                actionButtonUrl && actionButtonText
                  ? `<div style="text-align: center; margin: 28px 0 16px 0;">
                      <a href="${actionButtonUrl}" style="display: inline-block; background: ${primaryColor}; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-size: 14px; font-weight: 700; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.25);">
                        ${escapeHtml(actionButtonText)} &rarr;
                      </a>
                    </div>`
                  : ''
              }

              ${
                noteText
                  ? `<p style="font-size: 12px; color: #64748b; text-align: center; margin-top: 12px; font-style: italic;">
                      ${escapeHtml(noteText)}
                    </p>`
                  : ''
              }
            </td>
          </tr>

          <!-- ── OFFICIAL COMPANY LETTERHEAD FOOTER ── -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center; font-size: 11.5px; color: #64748b; line-height: 1.6;">
              <p style="margin: 0; font-weight: 700; color: #334155;">
                ${escapeHtml(company.legal_name || companyName)}
              </p>
              ${
                company.address
                  ? `<p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b;">${escapeHtml(company.address)}</p>`
                  : ''
              }
              <div style="margin: 6px 0; font-size: 10.5px; color: #94a3b8;">
                ${company.gstin ? `GSTIN: ${escapeHtml(company.gstin)} &bull; ` : ''}
                ${company.cin ? `CIN: ${escapeHtml(company.cin)} &bull; ` : ''}
                Help Desk & Support System
              </div>
              <p style="margin: 6px 0 0 0; font-size: 10.5px; color: #94a3b8;">
                This is an official automated notification. &copy; ${currentYear} ${escapeHtml(companyName)}. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * 1. Dispatch Ticket Created Notifications & Emails to Tagged Users
 */
async function dispatchTicketCreatedNotification(ticket) {
  const ticketId = String(ticket._id || ticket.id);
  const ticketNum = ticket.ticket_number || 'HD-TICKET';
  const creatorName = ticket.creator_snapshot?.name || 'A team member';
  const title = ticket.title;
  const deepLink = `${FRONTEND_BASE_URL}/dashboard/help-desk?ticket=${ticketId}`;
  const company = await getCompanyLetterhead(ticket.company_id);

  const inAppTitle = `Help Request: Tagged in #${ticketNum}`;
  const inAppMessage = `${creatorName} tagged you for help: "${title}"`;

  for (const tagged of ticket.tagged_users || []) {
    const userId = tagged.user?._id || tagged.user;
    if (!userId) continue;

    // In-App Notification
    await sendInAppNotification(userId, {
      title: inAppTitle,
      message: inAppMessage,
      type: ticket.priority === 'urgent' ? 'error' : 'info',
      entity_type: 'help_ticket',
      entity_id: ticketId,
    });

    // Email Notification
    if (tagged.email) {
      try {
        const emailHtml = buildHelpDeskEmailHtml({
          company,
          headerTitle: 'You Were Tagged in a Help Request',
          headerSubtitle: `${creatorName} requested your assistance on ticket #${ticketNum}`,
          badgeText: 'New Help Request',
          ticket,
          mainContentHtml: `
            <p><strong>Hi ${escapeHtml(tagged.name || 'there')},</strong></p>
            <p><strong>${escapeHtml(creatorName)}</strong> has tagged you to assist with a help request / requirement.</p>
            <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase;">Requirement Details:</p>
              <p style="margin: 0; color: #1e293b;">${escapeHtml(ticket.description)}</p>
            </div>
            <p style="font-size: 13px; color: #475569;">Please review the ticket, acknowledge the requirement, or provide your reply/solution.</p>
          `,
          actionButtonText: 'View Ticket & Respond',
          actionButtonUrl: deepLink,
          noteText: 'Please acknowledge or reply at your earliest convenience.',
        });

        await sendEmail(
          tagged.email,
          `[Help Desk] ${creatorName} tagged you: "${title}" (#${ticketNum})`,
          `${creatorName} tagged you for help on ticket #${ticketNum}: "${title}". View it here: ${deepLink}`,
          emailHtml,
          [],
          [],
          null,
          'help_ticket_tagged'
        );
      } catch (err) {
        logger.warn(`[HelpDeskNotification] Failed to send creation email to ${tagged.email}: ${err.message}`);
      }
    }
  }
}

/**
 * 2. Dispatch Reply Added Notification
 */
async function dispatchReplyNotification(ticket, reply, newlyTaggedUsers = []) {
  const ticketId = String(ticket._id || ticket.id);
  const ticketNum = ticket.ticket_number || 'HD-TICKET';
  const authorName = reply.user_snapshot?.name || 'A team member';
  const authorId = String(reply.user?._id || reply.user);
  const deepLink = `${FRONTEND_BASE_URL}/dashboard/help-desk?ticket=${ticketId}`;
  const company = await getCompanyLetterhead(ticket.company_id);

  const recipientMap = new Map();

  // Add creator
  const creatorId = String(ticket.created_by?._id || ticket.created_by);
  if (creatorId !== authorId) {
    recipientMap.set(creatorId, {
      userId: creatorId,
      name: ticket.creator_snapshot?.name || 'Creator',
      email: ticket.creator_snapshot?.email,
    });
  }

  // Add all tagged users
  for (const tagged of ticket.tagged_users || []) {
    const uId = String(tagged.user?._id || tagged.user);
    if (uId && uId !== authorId) {
      recipientMap.set(uId, {
        userId: uId,
        name: tagged.name,
        email: tagged.email,
      });
    }
  }

  const inAppTitle = `New Reply on #${ticketNum}`;
  const inAppMessage = `${authorName} replied on "${ticket.title}"`;

  for (const recipient of recipientMap.values()) {
    await sendInAppNotification(recipient.userId, {
      title: inAppTitle,
      message: inAppMessage,
      type: 'info',
      entity_type: 'help_ticket',
      entity_id: ticketId,
    });

    if (recipient.email) {
      try {
        const emailHtml = buildHelpDeskEmailHtml({
          company,
          headerTitle: 'New Message on Help Ticket',
          headerSubtitle: `Update on Ticket #${ticketNum}`,
          badgeText: 'Ticket Update',
          ticket,
          mainContentHtml: `
            <p><strong>${escapeHtml(authorName)}</strong> posted an update:</p>
            <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
              <p style="margin: 0; color: #1e293b;">${escapeHtml(reply.message)}</p>
            </div>
            ${
              Array.isArray(reply.attachments) && reply.attachments.length > 0
                ? `<p style="font-size: 12px; color: #64748b; font-weight: 600;">📎 ${reply.attachments.length} attachment(s) included.</p>`
                : ''
            }
          `,
          actionButtonText: 'Open Discussion Thread',
          actionButtonUrl: deepLink,
        });

        await sendEmail(
          recipient.email,
          `[Help Desk Update] ${authorName} replied on #${ticketNum} - "${ticket.title}"`,
          `${authorName} posted a reply on #${ticketNum}. View it here: ${deepLink}`,
          emailHtml,
          [],
          [],
          null,
          'help_ticket_reply'
        );
      } catch (err) {
        logger.warn(`[HelpDeskNotification] Failed to send reply email to ${recipient.email}: ${err.message}`);
      }
    }
  }
}

/**
 * 3. Dispatch Solution Proposed Notification (Sent to Creator for approval)
 */
async function dispatchSolutionProposedNotification(ticket, solution) {
  const ticketId = String(ticket._id || ticket.id);
  const ticketNum = ticket.ticket_number || 'HD-TICKET';
  const proposedByName = solution.proposed_by_name || 'Collaborator';
  const creatorId = String(ticket.created_by?._id || ticket.created_by);
  const creatorEmail = ticket.creator_snapshot?.email;
  const deepLink = `${FRONTEND_BASE_URL}/dashboard/help-desk?ticket=${ticketId}`;
  const company = await getCompanyLetterhead(ticket.company_id);

  const inAppTitle = `Solution Proposed for #${ticketNum}`;
  const inAppMessage = `${proposedByName} proposed a solution for "${ticket.title}". Please verify and resolve.`;

  await sendInAppNotification(creatorId, {
    title: inAppTitle,
    message: inAppMessage,
    type: 'success',
    entity_type: 'help_ticket',
    entity_id: ticketId,
  });

  if (creatorEmail) {
    try {
      const emailHtml = buildHelpDeskEmailHtml({
        company,
        headerTitle: 'Solution Proposed — Action Required',
        headerSubtitle: `${proposedByName} has provided deliverables for Ticket #${ticketNum}`,
        badgeText: 'Action Required: Verify Solution',
        ticket,
        mainContentHtml: `
          <p><strong>Hi ${escapeHtml(ticket.creator_snapshot?.name || 'there')},</strong></p>
          <p><strong>${escapeHtml(proposedByName)}</strong> has submitted a solution for your requirement:</p>
          <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 14px 16px; margin: 16px 0; border-radius: 4px;">
            <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #065f46; text-transform: uppercase;">Proposed Solution:</p>
            <p style="margin: 0; color: #064e3b; font-size: 14px;">${escapeHtml(solution.solution_text)}</p>
          </div>
          <p style="font-size: 13px; color: #334155;">
            As the ticket creator, you have the final authority to <strong>Confirm &amp; Resolve</strong> this request, or request revisions if more assistance is needed.
          </p>
        `,
        actionButtonText: 'Review & Confirm Resolution',
        actionButtonUrl: deepLink,
        noteText: 'Only you can close this ticket by confirming resolution.',
      });

      await sendEmail(
        creatorEmail,
        `[Action Required] Solution proposed for your Help Request #${ticketNum}`,
        `Solution proposed for #${ticketNum} by ${proposedByName}. Please review and confirm resolution: ${deepLink}`,
        emailHtml,
        [],
        [],
        null,
        'help_ticket_solution'
      );
    } catch (err) {
      logger.warn(`[HelpDeskNotification] Failed to send solution proposed email: ${err.message}`);
    }
  }
}

/**
 * 4. Dispatch Ticket Resolved Notification (Alert all tagged collaborators)
 */
async function dispatchTicketResolvedNotification(ticket, resolverName) {
  const ticketId = String(ticket._id || ticket.id);
  const ticketNum = ticket.ticket_number || 'HD-TICKET';
  const deepLink = `${FRONTEND_BASE_URL}/dashboard/help-desk?ticket=${ticketId}`;
  const company = await getCompanyLetterhead(ticket.company_id);

  for (const tagged of ticket.tagged_users || []) {
    const userId = tagged.user?._id || tagged.user;
    if (!userId) continue;

    await sendInAppNotification(userId, {
      title: `Ticket Resolved: #${ticketNum}`,
      message: `${resolverName || 'Creator'} marked #${ticketNum} as Resolved. Thank you for your help!`,
      type: 'success',
      entity_type: 'help_ticket',
      entity_id: ticketId,
    });

    if (tagged.email) {
      try {
        const rating = ticket.resolution_details?.satisfaction_rating ? ` (${ticket.resolution_details.satisfaction_rating} / 5 ⭐)` : '';
        const emailHtml = buildHelpDeskEmailHtml({
          company,
          headerTitle: 'Help Ticket Successfully Resolved',
          headerSubtitle: `Ticket #${ticketNum} has been marked Resolved by ${resolverName}`,
          badgeText: 'Resolved & Closed',
          ticket,
          mainContentHtml: `
            <p><strong>Hi ${escapeHtml(tagged.name || 'there')},</strong></p>
            <p><strong>${escapeHtml(resolverName || 'The creator')}</strong> has verified and officially marked Ticket <strong>#${escapeHtml(ticketNum)}</strong> as <strong>Resolved</strong>${rating}.</p>
            ${
              ticket.resolution_details?.resolution_notes
                ? `<div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
                    <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; color: #065f46; text-transform: uppercase;">Closing Notes:</p>
                    <p style="margin: 0; color: #064e3b;">${escapeHtml(ticket.resolution_details.resolution_notes)}</p>
                  </div>`
                : ''
            }
            <p style="font-size: 13px; color: #475569;">Thank you for your collaboration and support!</p>
          `,
          actionButtonText: 'View Resolved Ticket',
          actionButtonUrl: deepLink,
        });

        await sendEmail(
          tagged.email,
          `[Help Desk Resolved] #${ticketNum} marked Resolved by ${resolverName}`,
          `Ticket #${ticketNum} has been resolved by ${resolverName}. View it here: ${deepLink}`,
          emailHtml,
          [],
          [],
          null,
          'help_ticket_status'
        );
      } catch (err) {
        logger.warn(`[HelpDeskNotification] Failed to send resolution email to ${tagged.email}: ${err.message}`);
      }
    }
  }
}

/**
 * 5. Dispatch Ticket Reopened Notification
 */
async function dispatchTicketReopenedNotification(ticket, reopenerName, reason) {
  const ticketId = String(ticket._id || ticket.id);
  const ticketNum = ticket.ticket_number || 'HD-TICKET';
  const deepLink = `${FRONTEND_BASE_URL}/dashboard/help-desk?ticket=${ticketId}`;
  const company = await getCompanyLetterhead(ticket.company_id);

  for (const tagged of ticket.tagged_users || []) {
    const userId = tagged.user?._id || tagged.user;
    if (!userId) continue;

    await sendInAppNotification(userId, {
      title: `Ticket Reopened: #${ticketNum}`,
      message: `${reopenerName} requested further assistance on "${ticket.title}"`,
      type: 'warning',
      entity_type: 'help_ticket',
      entity_id: ticketId,
    });

    if (tagged.email) {
      try {
        const emailHtml = buildHelpDeskEmailHtml({
          company,
          headerTitle: 'Help Ticket Reopened',
          headerSubtitle: `Further assistance requested on #${ticketNum}`,
          badgeText: 'Ticket Reopened',
          ticket,
          mainContentHtml: `
            <p><strong>Hi ${escapeHtml(tagged.name || 'there')},</strong></p>
            <p><strong>${escapeHtml(reopenerName)}</strong> reviewed the proposed solution and determined that further revisions are required.</p>
            <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
              <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; color: #92400e; text-transform: uppercase;">Feedback / Reason:</p>
              <p style="margin: 0; color: #78350f;">${escapeHtml(reason || 'Additional assistance needed.')}</p>
            </div>
            <p style="font-size: 13px; color: #475569;">Please review the feedback and continue collaboration on the ticket thread.</p>
          `,
          actionButtonText: 'Open Ticket & Provide Feedback',
          actionButtonUrl: deepLink,
        });

        await sendEmail(
          tagged.email,
          `[Help Desk Reopened] ${reopenerName} requested changes on #${ticketNum}`,
          `Ticket #${ticketNum} reopened with feedback: "${reason}". View it here: ${deepLink}`,
          emailHtml,
          [],
          [],
          null,
          'help_ticket_status'
        );
      } catch (err) {
        logger.warn(`[HelpDeskNotification] Failed to send reopened email to ${tagged.email}: ${err.message}`);
      }
    }
  }
}

module.exports = {
  sendInAppNotification,
  dispatchTicketCreatedNotification,
  dispatchReplyNotification,
  dispatchSolutionProposedNotification,
  dispatchTicketResolvedNotification,
  dispatchTicketReopenedNotification,
};
