/**
 * @fileoverview SMTP Outbound Email Provider.
 * @module modules/messages/providers/smtp.provider
 */
const nodemailer = require('nodemailer');
const smtpConfig = require('../../../config/smtp');
const { logger } = require('../../../config/logger');
const { EmailError, EmailErrorCodes } = require('../errors/emailErrors');

/**
 * Extracts clean base64 string from string, data URI, or Buffer.
 */
function extractCleanBase64(content) {
  if (!content) return '';
  if (Buffer.isBuffer(content)) {
    return content.toString('base64');
  }
  if (typeof content === 'string') {
    const commaIdx = content.indexOf(',');
    if (content.startsWith('data:') && commaIdx !== -1) {
      return content.slice(commaIdx + 1).trim();
    }
    return content.trim();
  }
  return '';
}

/**
 * Parses email strings or arrays into a clean list of unique email addresses.
 */
function parseEmailAddresses(value) {
  if (!value) return [];
  const parts = Array.isArray(value)
    ? value.flatMap((v) => String(v || '').split(/[,;]/))
    : String(value).split(/[,;]/);
  const seen = new Set();
  const out = [];
  for (const part of parts) {
    const email = String(part).trim();
    if (!email || !email.includes('@')) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(email);
  }
  return out;
}

class SmtpProvider {
  constructor() {
    this.transporterInstance = null;
  }

  isConfigured() {
    return smtpConfig.isConfigured();
  }

  getTransporter() {
    if (this.transporterInstance) {
      return this.transporterInstance;
    }
    const options = smtpConfig.transportOptions();
    this.transporterInstance = nodemailer.createTransport(options);
    return this.transporterInstance;
  }

  async send({ from, to, cc, bcc, replyTo, subject, html, text, attachments = [] }) {
    const transporter = this.getTransporter();

    const toRecipients = parseEmailAddresses(to);
    if (!toRecipients.length) {
      throw new EmailError(
        EmailErrorCodes.EMAIL_INVALID_RECIPIENT,
        'At least one valid recipient is required',
        400
      );
    }

    const defaultFrom =
      smtpConfig.transportOptions().auth?.user ||
      process.env.SMTP_FROM ||
      process.env.SMTP_USER ||
      'noreply@localhost';
    const mailFrom = from || defaultFrom;

    const normalizedAttachments = (attachments || []).map((att) => {
      if (att.path) {
        return {
          filename: att.filename || att.name || 'document.pdf',
          path: att.path,
          contentType: att.contentType,
        };
      }
      const cleanBase64 = extractCleanBase64(att.content);
      if (cleanBase64) {
        return {
          filename: att.filename || att.name || 'document.pdf',
          content: Buffer.from(cleanBase64, 'base64'),
          contentType: att.contentType || 'application/pdf',
        };
      }
      if (Buffer.isBuffer(att.content)) {
        return {
          filename: att.filename || att.name || 'document.pdf',
          content: att.content,
          contentType: att.contentType || 'application/pdf',
        };
      }
      return att;
    });

    const toKeys = new Set(toRecipients.map((e) => e.toLowerCase()));
    const ccList = parseEmailAddresses(cc).filter((e) => !toKeys.has(e.toLowerCase()));
    const bccList = parseEmailAddresses(bcc).filter((e) => !toKeys.has(e.toLowerCase()));
    const replyToList = parseEmailAddresses(replyTo);

    const mailOptions = {
      from: mailFrom,
      to: toRecipients.join(', '),
      subject: subject || 'Notification',
      text: text || '',
      html: html || undefined,
      attachments: normalizedAttachments,
      ...(ccList.length > 0 ? { cc: ccList.join(', ') } : {}),
      ...(bccList.length > 0 ? { bcc: bccList.join(', ') } : {}),
      ...(replyToList.length > 0 ? { replyTo: replyToList.join(', ') } : {}),
    };

    logger.info(
      `[SmtpProvider] Sending email to ${toRecipients.join(', ')} via SMTP (From: ${mailFrom})...`
    );

    try {
      const info = await transporter.sendMail(mailOptions);
      logger.info(`[SmtpProvider] Email sent successfully via SMTP. Message ID: ${info.messageId}`);
      return {
        success: true,
        provider: 'smtp',
        from: mailFrom,
        recipients: toRecipients,
        messageId: info.messageId,
        data: info,
      };
    } catch (error) {
      logger.error(`[SmtpProvider] Error sending email via SMTP: ${error.message}`);
      throw new EmailError(
        EmailErrorCodes.EMAIL_SEND_FAILED,
        `SMTP email send failed: ${error.message}`,
        500,
        { originalError: error.message }
      );
    }
  }
}

module.exports = SmtpProvider;
