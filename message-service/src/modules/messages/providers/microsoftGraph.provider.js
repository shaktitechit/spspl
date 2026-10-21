/**
 * @fileoverview Microsoft Graph API Email Provider.
 * @module modules/messages/providers/microsoftGraph.provider
 */
const axios = require('axios');
const microsoftGraph = require('../../../config/microsoftGraph');
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

/**
 * Converts array of email strings into Graph recipient objects.
 */
function toGraphRecipients(emails) {
  return emails.map((address) => ({ emailAddress: { address } }));
}

/**
 * Parses a "From" string into name and email components.
 */
function parseFromAddress(fromVal) {
  if (!fromVal) return null;
  const str = String(fromVal).trim();
  if (!str) return null;
  const match = str.match(/^(?:["']?([^"']+)["']?\s+<)?([^<>\s]+@[^<>\s]+)>?$/);
  if (match) {
    return {
      name: match[1] ? match[1].trim() : undefined,
      address: match[2].trim(),
    };
  }
  if (str.includes('@')) {
    return { address: str };
  }
  return null;
}

class MicrosoftGraphProvider {
  constructor(config = {}) {
    this.tenantId = config.tenantId || microsoftGraph.tenantId;
    this.clientId = config.clientId || microsoftGraph.clientId;
    this.clientSecret = config.clientSecret || microsoftGraph.clientSecret;
    this.senderEmail = config.senderEmail || microsoftGraph.senderEmail;
  }

  isConfigured() {
    return Boolean(
      this.tenantId &&
      this.clientId &&
      this.clientSecret &&
      this.senderEmail
    );
  }

  async getAccessToken() {
    try {
      const tokenUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
      const params = new URLSearchParams();
      params.append('client_id', this.clientId);
      params.append('scope', 'https://graph.microsoft.com/.default');
      params.append('client_secret', this.clientSecret);
      params.append('grant_type', 'client_credentials');

      const tokenRes = await axios.post(tokenUrl, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
      });

      return tokenRes.data.access_token;
    } catch (err) {
      const msg = err.response?.data?.error_description || err.message;
      logger.error(`[MicrosoftGraphProvider] Failed to acquire token: ${msg}`);
      throw new EmailError(
        EmailErrorCodes.EMAIL_AUTHENTICATION_FAILED,
        `Microsoft Graph authentication failed: ${msg}`,
        500
      );
    }
  }

  /**
   * Sends an email via Microsoft Graph.
   */
  async send({ from, to, cc, bcc, replyTo, subject, html, text, attachments = [] }) {
    if (!this.isConfigured()) {
      throw new EmailError(
        EmailErrorCodes.EMAIL_PROVIDER_NOT_CONFIGURED,
        'Microsoft Graph API is not configured with required credentials',
        500
      );
    }

    const toRecipients = parseEmailAddresses(to);
    if (!toRecipients.length) {
      throw new EmailError(
        EmailErrorCodes.EMAIL_INVALID_RECIPIENT,
        'At least one valid recipient is required',
        400
      );
    }

    const accessToken = await this.getAccessToken();

    const graphAttachments = (attachments || []).map((att) => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: att.filename || att.name || 'attachment.pdf',
      contentType: att.contentType || 'application/pdf',
      contentBytes: extractCleanBase64(att.content),
    }));

    const toKeys = new Set(toRecipients.map((e) => e.toLowerCase()));
    const ccRecipients = parseEmailAddresses(cc).filter((e) => !toKeys.has(e.toLowerCase()));
    const bccRecipients = parseEmailAddresses(bcc).filter((e) => !toKeys.has(e.toLowerCase()));

    const fromObj = parseFromAddress(from);
    const isExternalSender = fromObj?.address && (
      fromObj.address.endsWith('@gmail.com') ||
      fromObj.address.endsWith('@googlemail.com') ||
      fromObj.address.endsWith('@yahoo.com') ||
      fromObj.address.endsWith('@outlook.com') ||
      fromObj.address.endsWith('@hotmail.com')
    );

    const senderEmailAddress = !isExternalSender && fromObj && fromObj.address ? fromObj.address : this.senderEmail;

    const fromPayload = isExternalSender
      ? { emailAddress: { address: this.senderEmail, name: fromObj.name || undefined } }
      : (fromObj
        ? { emailAddress: { address: fromObj.address, name: fromObj.name } }
        : { emailAddress: { address: this.senderEmail } });

    let replyToPayload;
    if (replyTo) {
      const parsedReplyTo = parseEmailAddresses(replyTo);
      replyToPayload = toGraphRecipients(parsedReplyTo);
    } else if (fromObj && fromObj.address) {
      replyToPayload = [{ emailAddress: { address: fromObj.address, name: fromObj.name } }];
    } else {
      replyToPayload = [{ emailAddress: { address: senderEmailAddress } }];
    }

    const mailBody = {
      message: {
        subject: subject || 'Notification',
        body: {
          contentType: html ? 'HTML' : 'Text',
          content: html || text || '',
        },
        toRecipients: toGraphRecipients(toRecipients),
        ...(ccRecipients.length > 0 ? { ccRecipients: toGraphRecipients(ccRecipients) } : {}),
        ...(bccRecipients.length > 0 ? { bccRecipients: toGraphRecipients(bccRecipients) } : {}),
        from: fromPayload,
        replyTo: replyToPayload,
        ...(graphAttachments.length > 0 ? { attachments: graphAttachments } : {}),
      },
      saveToSentItems: 'true',
    };

    logger.info(
      `[MicrosoftGraphProvider] Sending email to ${toRecipients.join(', ')} via Graph API (Mailbox: ${senderEmailAddress}, Reply-To: ${fromObj?.address || senderEmailAddress})${ccRecipients.length ? ` (CC: ${ccRecipients.join(', ')})` : ''}...`
    );

    const sendMailUrl = `https://graph.microsoft.com/v1.0/users/${senderEmailAddress}/sendMail`;

    try {
      const response = await axios.post(sendMailUrl, mailBody, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      logger.info(`[MicrosoftGraphProvider] Email sent successfully from ${senderEmailAddress}.`);
      return {
        success: true,
        provider: 'microsoft',
        from: senderEmailAddress,
        recipients: toRecipients,
        data: response.data || { success: true },
      };
    } catch (graphErr) {
      // If custom from address failed, retry with default mailbox
      if (senderEmailAddress !== this.senderEmail && this.senderEmail) {
        logger.warn(
          `[MicrosoftGraphProvider] Failed to send email via Graph API using sender ${senderEmailAddress} (${graphErr.message}). Retrying with default Graph mailbox (${this.senderEmail})...`
        );
        const fallbackUrl = `https://graph.microsoft.com/v1.0/users/${this.senderEmail}/sendMail`;
        const fallbackMailBody = {
          ...mailBody,
          message: {
            ...mailBody.message,
            from: { emailAddress: { address: this.senderEmail, name: fromObj?.name } },
            replyTo: fromObj?.address
              ? [{ emailAddress: { address: fromObj.address, name: fromObj.name } }]
              : mailBody.message.replyTo,
          },
        };
        const response = await axios.post(fallbackUrl, fallbackMailBody, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        });

        logger.info(`[MicrosoftGraphProvider] Email sent successfully via fallback Graph mailbox (${this.senderEmail}).`);
        return {
          success: true,
          provider: 'microsoft',
          from: this.senderEmail,
          recipients: toRecipients,
          data: response.data || { success: true },
        };
      }

      const errMsg = graphErr.response?.data?.error?.message || graphErr.message;
      logger.error(`[MicrosoftGraphProvider] Email send failed: ${errMsg}`);
      throw new EmailError(
        EmailErrorCodes.EMAIL_SEND_FAILED,
        `Microsoft Graph email send failed: ${errMsg}`,
        500,
        { originalError: errMsg }
      );
    }
  }
}

module.exports = MicrosoftGraphProvider;
