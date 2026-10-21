/**
 * @fileoverview Email Helper: manages template compilation and delegates sending to UnifiedEmailService.
 * @module modules/messages/helpers/email.helper
 */
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const smtpConfig = require('../../../config/smtp');
const { logger } = require('../../../config/logger');
const unifiedEmailService = require('../services/unifiedEmail.service');

let transporterInstance = null;
let cachedCompanyInfo = null;
let lastCompanyFetch = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Returns the nodemailer transporter singleton.
 */
function getTransporter() {
  if (transporterInstance) {
    return transporterInstance;
  }

  if (!smtpConfig.isConfigured()) {
    logger.warn('[Email Helper] SMTP is not fully configured (missing host, user, or pass). Email sending might fail.');
  }

  const options = smtpConfig.transportOptions();
  transporterInstance = nodemailer.createTransport(options);

  return transporterInstance;
}

async function getCompanyInfoFromAuthService() {
  const now = Date.now();
  if (cachedCompanyInfo && (now - lastCompanyFetch < CACHE_TTL_MS)) {
    return cachedCompanyInfo;
  }

  const env = require('../../../config/env');
  const authServiceUrl = env.AUTH_SERVICE_URL || 'http://auth-service:7003';
  try {
    const url = `${authServiceUrl.replace(/\/$/, '')}/api/company-info`;
    const res = await axios.get(url, { timeout: 4000 });
    const data = res.data?.data || res.data || {};
    if (data && typeof data === 'object') {
      cachedCompanyInfo = data;
      lastCompanyFetch = now;
      logger.info(`[Email Helper] Successfully fetched company info from auth-service (${data.trade_name || data.legal_name || 'Company'}).`);
      return cachedCompanyInfo;
    }
  } catch (err) {
    logger.warn(`[Email Helper] Could not fetch company info from auth-service (${err.message}). Using fallback company info.`);
  }

  return cachedCompanyInfo || {};
}

/**
 * Core send email function.
 * @param {string|string[]} recipient - Recipient email(s).
 * @param {string} subject - Subject line.
 * @param {string} textBody - Plain text body.
 * @param {string} htmlBody - HTML body.
 * @param {Array} [attachments] - List of attachments [{ filename, content, contentType, path }].
 * @param {string|string[]} [cc] - CC recipient email(s).
 * @param {string} [from] - From email.
 * @returns {Promise<object>} Send status result.
 */
async function sendEmail(recipient, subject, textBody, htmlBody, attachments = [], cc = [], from = null) {
  return unifiedEmailService.send({
    from,
    to: recipient,
    subject,
    text: textBody,
    html: htmlBody,
    attachments,
    cc,
  });
}

/**
 * Formats plain text message body into HTML paragraphs and breaks.
 */
function formatBodyToHtml(text) {
  if (!text) return '';
  const str = String(text).trim();
  if (/<(p|br|div|table|ul|ol|li)\b/i.test(str)) {
    return str;
  }
  const paragraphs = str.split(/\n\s*\n/);
  return paragraphs
    .map((p) => {
      const lineFormatted = p.trim().replace(/\n/g, '<br>');
      return `<p style="margin: 0 0 14px 0; line-height: 1.6;">${lineFormatted}</p>`;
    })
    .join('');
}

/**
 * Basic template compilation (substitutes {{variable}} placeholders).
 */
function compileTemplate(template, data) {
  if (!template) return '';
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    return data[key] !== undefined ? String(data[key]) : match;
  });
}

/**
 * Sends a template-based email.
 */
async function sendTemplateEmail(recipient, templateName, templateData = {}, attachments = [], cc = [], from = null) {
  const templatesDir = path.join(__dirname, '..', 'templates', 'emails');
  const templatePath = path.join(templatesDir, `${templateName}.html`);
  const defaultTemplatePath = path.join(templatesDir, 'default.html');

  const company = await getCompanyInfoFromAuthService();
  const companyName =
    templateData.companyName ||
    company.trade_name ||
    company.legal_name ||
    process.env.COMPANY_NAME ||
    '';
  const companyLegalName =
    templateData.companyLegalName ||
    company.legal_name ||
    company.trade_name ||
    process.env.COMPANY_NAME ||
    '';
  const companyLogo = (() => {
    const raw = templateData.companyLogo || templateData.logoUrl || company.logo_url || '';
    if (!raw) return '';
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:image/')) return raw;
    const base = (
      process.env.API_PUBLIC_BASE_URL ||
      process.env.NEXT_PUBLIC_API_ORIGIN ||
      ''
    ).replace(/\/$/, '');
    return base ? `${base}${raw.startsWith('/') ? '' : '/'}${raw}` : raw;
  })();
  const companyPhone = templateData.companyPhone || company.phone || '';
  const companyEmail = templateData.companyEmail || company.email || company.billing_email || '';
  const companyWebsite = templateData.companyWebsite || company.website || '';
  const companyAddress = templateData.companyAddress || [company.address, company.city, company.state, company.pincode, company.country].filter(Boolean).join(', ');
  const companyTagline = templateData.companyTagline || company.tagline || '';
  const companyGstin = templateData.companyGstin || company.gstin || '';
  const companyPan = templateData.companyPan || company.pan || '';
  const companyBankName = templateData.companyBankName || company.bank_name || '';
  const companyAccountName = templateData.companyAccountName || company.account_name || '';
  const companyAccountNo = templateData.companyAccountNo || company.account_number || '';
  const companyIfsc = templateData.companyIfsc || company.ifsc_code || '';
  const companyBranch = templateData.companyBranch || company.branch_name || '';
  const companyUpi = templateData.companyUpi || company.upi_id || '';
  const invoiceFooterNote = company.invoice_footer_note || '';
  const year = new Date().getFullYear();

  const footerLines = [];
  if (companyAddress) footerLines.push(`<p style="margin: 0 0 4px 0;">Head Office: ${companyAddress}</p>`);
  const contactParts = [];
  if (companyPhone) contactParts.push(`Phone: ${companyPhone}`);
  if (companyEmail) contactParts.push(`Email: <a href="mailto:${companyEmail}" style="color: #2563eb; text-decoration: none;">${companyEmail}</a>`);
  if (companyWebsite) contactParts.push(`Website: <a href="${companyWebsite}" style="color: #2563eb; text-decoration: none;">${companyWebsite}</a>`);
  if (companyGstin) contactParts.push(`GSTIN: ${companyGstin}`);
  if (contactParts.length) footerLines.push(`<p style="margin: 0 0 4px 0;">${contactParts.join(' &nbsp;|&nbsp; ')}</p>`);
  if (invoiceFooterNote) footerLines.push(`<p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 11px;">${invoiceFooterNote}</p>`);
  const companyFooterHtml = footerLines.join('\n');

  const defaultCompanyLogoHtml = companyLogo
    ? `<img src="${companyLogo}" alt="${companyName} Logo" class="header-logo" style="max-height: 72px; max-width: 180px; display: block; margin: 0 auto 10px auto;">`
    : '';

  const companyHeaderHtml = `
    <div style="text-align: center; border-bottom: 2px solid #1e3a5f; padding-bottom: 12px; margin-bottom: 20px;">
      ${companyLogo ? `<img src="${companyLogo}" alt="${companyName}" style="max-height: 60px; max-width: 180px; display: block; margin: 0 auto 8px auto;">` : ''}
      <h2 style="margin: 0; color: #1e3a5f; font-size: 20px; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase;">${companyName}</h2>
      ${companyAddress ? `<p style="margin: 3px 0 0 0; font-size: 12px; color: #475569; line-height: 16px;">${companyAddress}</p>` : ''}
      ${contactParts.length ? `<p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b; line-height: 15px;">${contactParts.join(' &nbsp;|&nbsp; ')}</p>` : ''}
    </div>
  `.trim();

  const rawBodyContent =
    templateData.messageBody ||
    templateData.body ||
    templateData.text ||
    templateData.message ||
    templateData.content ||
    '';

  const htmlBodyContent = formatBodyToHtml(rawBodyContent);

  const mergedData = {
    companyName,
    companyLegalName,
    companyLogo,
    logoUrl: companyLogo,
    companyLogoHtml: templateData.companyLogoHtml || defaultCompanyLogoHtml,
    companyHeaderHtml: templateData.companyHeaderHtml || companyHeaderHtml,
    companyPhone,
    companyEmail,
    companyWebsite,
    companyAddress,
    companyTagline,
    companyFooterHtml,
    companyGstin,
    companyPan,
    companyBankName,
    companyAccountName,
    companyAccountNo,
    companyIfsc,
    companyBranch,
    companyUpi,
    year,
    messageBody: htmlBodyContent,
    body: htmlBodyContent,
    rawBody: rawBodyContent,
    ...templateData,
  };

  let htmlBody;
  const subject = mergedData.subject || 'Notification';
  const textBody = mergedData.body || mergedData.text || mergedData.messageBody || '';

  try {
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    htmlBody = compileTemplate(templateContent, mergedData);
  } catch (err) {
    logger.warn(`[Email Helper] Template "${templateName}" not found on disk. Falling back to default.html.`);
    try {
      const defaultContent = await fs.readFile(defaultTemplatePath, 'utf-8');
      htmlBody = compileTemplate(defaultContent, mergedData);
    } catch (fallbackErr) {
      logger.error(`[Email Helper] Failed to read default.html template. Sending plain text fallback.`);
      htmlBody = textBody;
    }
  }

  const finalAttachments = attachments && attachments.length > 0 ? attachments : mergedData.attachments || [];
  const finalCc = (Array.isArray(cc) && cc.length > 0) || (typeof cc === 'string' && cc.trim())
    ? cc
    : mergedData.cc || [];
  const finalFrom = from || mergedData.from;
  return sendEmail(recipient, subject, textBody, htmlBody, finalAttachments, finalCc, finalFrom);
}

module.exports = {
  getTransporter,
  sendEmail,
  sendTemplateEmail,
};
