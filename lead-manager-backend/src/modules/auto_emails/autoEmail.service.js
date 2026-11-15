/**
 * @fileoverview Auto-Emails Service - Centralizes automated email sending and follow-up digest triggers.
 * @module modules/auto_emails/autoEmail.service
 */
const emailHelper = require('../messages/helpers/email.helper');
const microsoftGraph = require('../../config/microsoftGraph');
const { LEAD_MANAGER_URL } = require('../../config/env');
const { logger } = require('../../utils/logger');
const { resolveSalesRepFromLead } = require('../../utils/followUpSalesRep');
const {
  runTodaysFollowUpReminders,
  runOverdueFollowUpReminders,
  runAllFollowUpReminders,
} = require('../../jobs/followUpDailyReminder');

const TEMPLATE_LEAD_ASSIGNED = 'lead_assigned';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatProductsSummary(products) {
  if (!Array.isArray(products) || products.length === 0) return 'Not specified';
  const names = products
    .map((p) => {
      const name = p.product_name || p.name || (p.product && p.product.product_name) || '';
      const qty = p.quantity ? ` (Qty: ${p.quantity})` : '';
      return name ? `${name}${qty}` : null;
    })
    .filter(Boolean);
  return names.length > 0 ? names.join(', ') : 'Not specified';
}

function formatLeadLocation(lead) {
  const b = lead.billing_address || {};
  const parts = [b.city, b.state, b.country].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'Not specified';
}

function getLeadPortalUrl(leadId) {
  const base = LEAD_MANAGER_URL || 'http://localhost:7010/dashboard';
  const cleanBase = String(base).replace(/\/$/, '');
  return `${cleanBase}/leads/${leadId}`;
}

/**
 * Best-effort template email dispatch via message-service helper.
 */
async function sendTemplateEmail(recipientEmail, templateName, templateParams, contextLabel = 'AutoEmail') {
  if (!recipientEmail) return;
  try {
    await emailHelper.sendTemplateEmail(
      recipientEmail,
      templateName,
      templateParams,
      [],
      [],
      microsoftGraph.senderEmail || null
    );
  } catch (err) {
    logger.error(`[${contextLabel}] template email (${templateName}) failed for ${recipientEmail}: ${err.message}`);
  }
}

/**
 * Send automated assignment / handover / collaborator email for a lead.
 */
async function sendLeadAssignmentEmail({
  lead,
  recipientEmail,
  recipientName,
  actor,
  subject,
  badgeLabel,
  headerSubtitle,
  introText,
  portalHint,
  coAssigneeNames = [],
  notes = '',
}) {
  if (!recipientEmail) return;

  const leadNo = lead.lead_no || '';
  const leadName = lead.name || 'Lead';
  const partyCompany = lead.company_name || 'Individual';
  const priority = (lead.priority || 'medium').toString().toUpperCase();
  const departmentName = (lead.department || 'sales').toString().toUpperCase();
  const actorName = actor?.name || actor?.email || 'Lead Manager';
  const location = formatLeadLocation(lead);
  const productsInterested = formatProductsSummary(lead.products);
  const leadPortalUrl = getLeadPortalUrl(lead._id);

  const handoverNotesRowHtml = notes
    ? `<tr><td class="label">Notes / Instructions</td><td class="value" style="font-size:12px;font-style:italic;">${escapeHtml(notes)}</td></tr>`
    : '';

  const ctaButtonHtml = `<a href="${leadPortalUrl}" style="display:inline-block;padding:10px 22px;background-color:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:13px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">View Lead in Portal &rarr;</a>`;

  await sendTemplateEmail(
    recipientEmail,
    TEMPLATE_LEAD_ASSIGNED,
    {
      subject,
      recipientName: recipientName || 'Team Member',
      leadNo,
      leadName,
      partyCompany,
      department: departmentName,
      contactPhone: lead.phone || '—',
      location,
      priority,
      productsInterested,
      salesRepName: recipientName || resolveSalesRepFromLead(lead),
      actorName,
      coAssignees: coAssigneeNames.length > 0 ? coAssigneeNames.join(', ') : 'None',
      headerSubtitle,
      badgeLabel,
      introText,
      portalHint,
      handoverNotesRowHtml,
      ctaButtonHtml,
    },
    'AutoEmail:Lead'
  );
}

/**
 * Send automated stakeholder notification email for a quotation.
 */
async function sendQuotationStakeholderEmail({ recipientEmail, templateName, templateParams }) {
  await sendTemplateEmail(recipientEmail, templateName, templateParams, 'AutoEmail:Quotation');
}

module.exports = {
  sendTemplateEmail,
  sendLeadAssignmentEmail,
  sendQuotationStakeholderEmail,
  runTodaysFollowUpReminders,
  runOverdueFollowUpReminders,
  runAllFollowUpReminders,
};
