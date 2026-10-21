/**
 * @fileoverview Google Gmail API Email Provider.
 * @module modules/messages/providers/gmail.provider
 */
const axios = require('axios');
const MailComposer = require('nodemailer/lib/mail-composer');
const googleGmail = require('../../../config/googleGmail');
const { logger } = require('../../../config/logger');
const { EmailError, EmailErrorCodes } = require('../errors/emailErrors');
const { getModels } = require('../../../data/mongoRegistry');
const { decrypt, encrypt } = require('../../../utils/credentialEncryption');

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
 * Normalizes email attachments for Nodemailer MailComposer.
 */
function normalizeAttachments(attachments = []) {
  return (attachments || []).map((att) => {
    if (att.path) {
      return {
        filename: att.filename || att.name || 'attachment.pdf',
        path: att.path,
        contentType: att.contentType,
      };
    }
    const cleanBase64 = extractCleanBase64(att.content);
    if (cleanBase64) {
      return {
        filename: att.filename || att.name || 'attachment.pdf',
        content: Buffer.from(cleanBase64, 'base64'),
        contentType: att.contentType || 'application/pdf',
      };
    }
    if (Buffer.isBuffer(att.content)) {
      return {
        filename: att.filename || att.name || 'attachment.pdf',
        content: att.content,
        contentType: att.contentType || 'application/pdf',
      };
    }
    return att;
  });
}

/**
 * Converts a MIME message buffer to Gmail-compatible base64url string.
 */
function toBase64Url(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
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

function normalizeRedirectUri(uri) {
  if (!uri) return '';
  return String(uri)
    .trim()
    .replace(/^https?::+\/*/i, (match) => (match.toLowerCase().startsWith('https') ? 'https://' : 'http://'));
}

class GmailProvider {
  constructor(config = {}) {
    this.clientId = (config.clientId || googleGmail.clientId || '').trim();
    this.clientSecret = (config.clientSecret || googleGmail.clientSecret || '').trim();
    this.redirectUri = normalizeRedirectUri(config.redirectUri || googleGmail.redirectUri);
  }

  isConfigured() {
    return Boolean(this.clientId && this.clientSecret);
  }

  /**
   * Generates the OAuth 2.0 authorization URL for connecting a Google account.
   */
  getAuthorizationUrl(state = '') {
    if (!this.isConfigured() || !this.redirectUri) {
      throw new EmailError(
        EmailErrorCodes.EMAIL_PROVIDER_NOT_CONFIGURED,
        'Google OAuth is not configured with CLIENT_ID, CLIENT_SECRET, or REDIRECT_URI',
        500
      );
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: googleGmail.scopes,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
    });

    if (state) {
      params.append('state', state);
    }

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchanges an OAuth authorization code for Google access and refresh tokens.
   */
  async exchangeAuthCode(code) {
    if (!code) {
      throw new EmailError(
        EmailErrorCodes.EMAIL_AUTHENTICATION_FAILED,
        'Authorization code is required',
        400
      );
    }

    try {
      const tokenUrl = 'https://oauth2.googleapis.com/token';
      const params = new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      });

      const response = await axios.post(tokenUrl, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
      });

      const { access_token, refresh_token, expires_in, id_token, token_type, scope } = response.data;

      // Extract user email via id_token payload (offline & reliable) or userinfo endpoint
      let userEmail = null;
      if (id_token) {
        try {
          const parts = id_token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
            if (payload && payload.email) {
              userEmail = payload.email;
            }
          }
        } catch (_jwtErr) {
          // ignore
        }
      }

      if (!userEmail) {
        try {
          const userInfoRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${access_token}` },
            timeout: 5000,
          });
          userEmail = userInfoRes.data.email;
        } catch (_userErr) {
          try {
            const tokenInfoRes = await axios.get(
              `https://oauth2.googleapis.com/tokeninfo?access_token=${access_token}`,
              { timeout: 5000 }
            );
            userEmail = tokenInfoRes.data.email;
          } catch (_tokenInfoErr) {
            logger.warn('[GmailProvider] Could not fetch email from userinfo/tokeninfo');
          }
        }
      }

      const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000);

      return {
        email: userEmail ? userEmail.toLowerCase().trim() : null,
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt,
        scope,
        raw: {
          token_type,
          scope,
          id_token: id_token ? '[REDACTED]' : undefined,
        },
      };
    } catch (err) {
      const errMsg = err.response?.data?.error_description || err.response?.data?.error || err.message;
      logger.error(`[GmailProvider] OAuth token exchange failed: ${errMsg}`);
      throw new EmailError(
        EmailErrorCodes.EMAIL_AUTHENTICATION_FAILED,
        `Failed to exchange authorization code with Google: ${errMsg}`,
        400
      );
    }
  }

  /**
   * Revokes an OAuth token with Google.
   */
  async revokeToken(token) {
    const rawToken = token ? decrypt(token) : null;
    if (!rawToken) return;
    try {
      const revokeUrl = `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(rawToken)}`;
      await axios.post(revokeUrl, null, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 5000,
      });
      logger.info('[GmailProvider] Successfully revoked Google token with Google OAuth server');
    } catch (err) {
      logger.warn(`[GmailProvider] Could not revoke Google token: ${err.message}`);
    }
  }

  /**
   * Refreshes an expired Google access token using the stored refresh token.
   */
  async refreshAccessToken(account) {
    const rawRefreshToken = account ? decrypt(account.refreshToken) : null;
    if (!account || !rawRefreshToken) {
      throw new EmailError(
        EmailErrorCodes.EMAIL_ACCOUNT_NOT_AUTHORIZED,
        `No refresh token available for Google account: ${account?.email || 'unknown'}. Please re-authorize Google account.`,
        401
      );
    }

    try {
      const tokenUrl = 'https://oauth2.googleapis.com/token';
      const params = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: rawRefreshToken,
        grant_type: 'refresh_token',
      });

      const response = await axios.post(tokenUrl, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
      });

      const { access_token, expires_in } = response.data;
      const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000);

      // Update in MongoDB
      const { EmailAccount } = getModels();
      if (account._id && EmailAccount) {
        await EmailAccount.findByIdAndUpdate(account._id, {
          accessToken: access_token,
          accessTokenExpiresAt: expiresAt,
          status: 'active',
        });
      }

      account.accessToken = access_token;
      account.accessTokenExpiresAt = expiresAt;

      logger.info(`[GmailProvider] Successfully refreshed access token for ${account.email}`);
      return access_token;
    } catch (err) {
      const errMsg = err.response?.data?.error_description || err.response?.data?.error || err.message;
      logger.error(`[GmailProvider] Token refresh failed for ${account.email}: ${errMsg}`);

      if (
        err.response?.status === 400 &&
        (errMsg.includes('invalid_grant') || errMsg.includes('revoked'))
      ) {
        const { EmailAccount } = getModels();
        if (account._id && EmailAccount) {
          await EmailAccount.findByIdAndUpdate(account._id, {
            status: 'revoked',
          });
        }
        throw new EmailError(
          EmailErrorCodes.EMAIL_ACCOUNT_NOT_AUTHORIZED,
          `Google account ${account.email} authorization has expired or been revoked. Re-authorization required.`,
          401
        );
      }

      throw new EmailError(
        EmailErrorCodes.EMAIL_TOKEN_REFRESH_FAILED,
        `Failed to refresh Google access token: ${errMsg}`,
        500
      );
    }
  }

  /**
   * Retrieves a valid access token for the given account, refreshing if necessary.
   */
  async getValidAccessToken(account) {
    if (!account) {
      throw new EmailError(
        EmailErrorCodes.EMAIL_ACCOUNT_NOT_AUTHORIZED,
        'Google account configuration not found',
        401
      );
    }

    const plainAccessToken = decrypt(account.accessToken);

    const bufferMs = 5 * 60 * 1000; // 5 minutes before expiry
    const isExpired =
      !plainAccessToken ||
      !account.accessTokenExpiresAt ||
      new Date(account.accessTokenExpiresAt).getTime() - Date.now() < bufferMs;

    if (isExpired) {
      return this.refreshAccessToken(account);
    }

    return plainAccessToken;
  }

  /**
   * Builds an RFC 2822 MIME message and returns base64url encoded string.
   */
  async buildMimeMessage({ from, to, cc, bcc, replyTo, subject, html, text, attachments = [] }) {
    const toList = parseEmailAddresses(to);
    const ccList = parseEmailAddresses(cc);
    const bccList = parseEmailAddresses(bcc);
    const replyToList = parseEmailAddresses(replyTo);

    const mailOptions = {
      from,
      to: toList.join(', '),
      ...(ccList.length > 0 ? { cc: ccList.join(', ') } : {}),
      ...(bccList.length > 0 ? { bcc: bccList.join(', ') } : {}),
      ...(replyToList.length > 0 ? { replyTo: replyToList.join(', ') } : {}),
      subject: subject || 'Notification',
      text: text || '',
      html: html || undefined,
      attachments: normalizeAttachments(attachments),
    };

    const composer = new MailComposer(mailOptions);
    const mimeBuffer = await new Promise((resolve, reject) => {
      composer.compile().build((err, message) => {
        if (err) return reject(err);
        resolve(message);
      });
    });

    return toBase64Url(mimeBuffer);
  }

  /**
   * Sends an email via Gmail API using OAuth credentials.
   */
  async send({ from, to, cc, bcc, replyTo, subject, html, text, attachments = [], account = null }) {
    if (!account) {
      throw new EmailError(
        EmailErrorCodes.EMAIL_ACCOUNT_NOT_AUTHORIZED,
        `No authorized Google account provided for sender: ${from}`,
        401
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

    const accessToken = await this.getValidAccessToken(account);

    let rawMime;
    try {
      rawMime = await this.buildMimeMessage({
        from: from || account.email,
        to,
        cc,
        bcc,
        replyTo,
        subject,
        html,
        text,
        attachments,
      });
    } catch (mimeErr) {
      logger.error(`[GmailProvider] MIME construction failed: ${mimeErr.message}`);
      throw new EmailError(
        EmailErrorCodes.EMAIL_SEND_FAILED,
        `Failed to construct email MIME message: ${mimeErr.message}`,
        400
      );
    }

    logger.info(
      `[GmailProvider] Sending email to ${toRecipients.join(', ')} via Gmail API (From: ${from || account.email})...`
    );

    const sendUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

    try {
      const response = await axios.post(
        sendUrl,
        { raw: rawMime },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );

      const messageId = response.data?.id;
      logger.info(`[GmailProvider] Email sent successfully via Gmail API. Message ID: ${messageId}`);

      return {
        success: true,
        provider: 'google',
        from: from || account.email,
        recipients: toRecipients,
        messageId,
        data: response.data,
      };
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.message;
      logger.error(`[GmailProvider] Gmail API send failed for ${from || account.email}: ${errMsg}`);

      if (err.response?.status === 401) {
        throw new EmailError(
          EmailErrorCodes.EMAIL_ACCOUNT_NOT_AUTHORIZED,
          `Gmail authorization failed or token expired: ${errMsg}`,
          401
        );
      }

      throw new EmailError(
        EmailErrorCodes.EMAIL_SEND_FAILED,
        `Gmail API sending failed: ${errMsg}`,
        err.response?.status || 500,
        { originalError: errMsg }
      );
    }
  }
}

module.exports = GmailProvider;
