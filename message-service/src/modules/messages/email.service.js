/**
 * @fileoverview Email Service: service methods for email messaging, OAuth, and email accounts.
 * @module modules/messages/email.service
 */
const messageService = require('./message.service');
const { getModels } = require('../../data/mongoRegistry');
const { toPlain } = require('../../utils/mongoJson');
const GmailProvider = require('./providers/gmail.provider');
const { ApiError } = require('../../utils/ApiError');
const { logger } = require('../../config/logger');

const gmailProvider = new GmailProvider();

/**
 * Creates and queues a new outbound email.
 */
async function sendEmailMessage(data) {
  const { recipient, to, from, subject, body, templateName, templateParams, orderId, attachments, cc, bcc } = data;

  const targetRecipient = recipient || to;

  const messageData = {
    recipient: targetRecipient,
    from: from || (templateParams && templateParams.from) || undefined,
    channel: 'email',
    subject: subject || 'Notification',
    body: body || '',
    templateName: templateName || undefined,
    templateParams: templateParams || undefined,
    order: orderId || undefined,
    attachments: attachments || (templateParams && templateParams.attachments) || undefined,
    cc: cc || (templateParams && templateParams.cc) || undefined,
    bcc: bcc || (templateParams && templateParams.bcc) || undefined,
  };

  return messageService.createAndQueueMessage(messageData);
}

/**
 * List email messages with filtering and pagination.
 */
async function listEmails(filter = {}, options = {}) {
  const { Message } = getModels();
  const limit = Math.min(Number(options.limit) || 20, 100);
  const page = Math.max(Number(options.page) || 1, 1);
  const skip = (page - 1) * limit;

  const mongoFilter = { channel: 'email' };
  if (filter.order) mongoFilter.order = filter.order;
  if (filter.status) mongoFilter.status = filter.status;
  if (filter.recipient) {
    mongoFilter.recipient = { $regex: filter.recipient, $options: 'i' };
  }

  const [total, rows] = await Promise.all([
    Message.countDocuments(mongoFilter),
    Message.find(mongoFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  return {
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
    data: rows.map((r) => toPlain(r)),
  };
}

/**
 * Get an email message by its ID.
 */
async function getEmailById(id) {
  const { Message } = getModels();
  const row = await Message.findOne({ _id: id, channel: 'email' }).lean();
  return row ? toPlain(row) : null;
}

/**
 * Generates the Google OAuth authorization URL.
 */
function getGoogleAuthUrl(state = '') {
  return gmailProvider.getAuthorizationUrl(state);
}

/**
 * Handles Google OAuth callback: exchanges code, saves/updates account in DB.
 */
async function handleGoogleCallback(code) {
  const { EmailAccount } = getModels();
  if (!EmailAccount) {
    throw new ApiError(500, 'EmailAccount model is not registered');
  }

  const tokenData = await gmailProvider.exchangeAuthCode(code);
  if (!tokenData.email) {
    throw new ApiError(400, 'Unable to determine email address for authorized Google account');
  }

  const grantedScopes = tokenData.scope || '';
  const hasSendScope =
    grantedScopes.includes('gmail.send') ||
    grantedScopes.includes('mail.google.com') ||
    grantedScopes.includes('gmail.compose');

  if (grantedScopes && !hasSendScope) {
    logger.warn(
      `[Email Service] Account ${tokenData.email} was connected but granted scopes (${grantedScopes}) do not include 'gmail.send'. Please ensure the user checks the 'Send email on your behalf' permission on the consent screen.`
    );
  }

  const updateFields = {
    email: tokenData.email.toLowerCase().trim(),
    provider: 'google',
    authType: 'google_oauth',
    accessToken: tokenData.accessToken,
    refreshToken: tokenData.refreshToken,
    accessTokenExpiresAt: tokenData.expiresAt,
    status: hasSendScope || !grantedScopes ? 'active' : 'error',
    metadata: {
      connectedAt: new Date(),
      scopes: require('../../config/googleGmail').scopes,
      grantedScopes: grantedScopes || undefined,
      hasSendScope,
    },
  };

  // Preserve existing refresh token if Google didn't return a new one on re-auth
  if (!tokenData.refreshToken) {
    delete updateFields.refreshToken;
  }

  const account = await EmailAccount.findOneAndUpdate(
    { email: updateFields.email },
    { $set: updateFields },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  logger.info(`[Email Service] Successfully connected Google account: ${account.email} (sendScope=${hasSendScope})`);
  return account.toSafeObject();
}

/**
 * Lists configured email accounts without exposing credentials.
 */
async function listAccounts() {
  const { EmailAccount } = getModels();
  if (!EmailAccount) return [];
  const accounts = await EmailAccount.find({}).sort({ createdAt: -1 });
  return accounts.map((acc) => acc.toSafeObject());
}

/**
 * Deactivates or removes an email account by ID.
 */
async function deleteAccount(id) {
  const { EmailAccount } = getModels();
  if (!EmailAccount) {
    throw new ApiError(500, 'EmailAccount model is not registered');
  }
  const account = await EmailAccount.findById(id);
  if (!account) {
    throw new ApiError(404, 'Email account not found');
  }

  // Revoke token with Google if it is a Google account
  if (account.provider === 'google' && (account.refreshToken || account.accessToken)) {
    try {
      await gmailProvider.revokeToken(account.refreshToken || account.accessToken);
    } catch (_revokeErr) {
      logger.warn(`[Email Service] Failed to revoke Google token for ${account.email}`);
    }
  }

  await EmailAccount.findByIdAndDelete(id);
  return { success: true, message: `Account ${account.email} disconnected and deleted successfully.` };
}

module.exports = {
  sendEmailMessage,
  listEmails,
  getEmailById,
  getGoogleAuthUrl,
  handleGoogleCallback,
  listAccounts,
  deleteAccount,
};
