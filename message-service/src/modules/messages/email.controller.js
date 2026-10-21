/**
 * @fileoverview Email controller handling endpoints for email messages and accounts.
 * @module modules/messages/email.controller
 */
const asyncHandler = require('../../utils/asyncHandler');
const service = require('./email.service');
const { ApiError } = require('../../utils/ApiError');

/**
 * Send/queue an email message.
 * POST /api/emails
 */
exports.sendEmail = asyncHandler(async (req, res) => {
  const { recipient, to, from, subject, body, templateName, templateParams, orderId, attachments, cc, bcc } = req.body;

  const targetRecipient = recipient || to;
  if (!targetRecipient) {
    throw new ApiError(400, 'Recipient email (recipient or to) is required');
  }

  const result = await service.sendEmailMessage({
    recipient: targetRecipient,
    from,
    subject,
    body,
    templateName,
    templateParams,
    orderId,
    attachments,
    cc,
    bcc,
  });

  res.status(201).json({
    success: true,
    data: result,
  });
});

/**
 * List email message logs.
 * GET /api/emails
 */
exports.listEmails = asyncHandler(async (req, res) => {
  const { order, recipient, status, page, limit } = req.query;

  const filter = { order, recipient, status };
  const options = { page, limit };

  const result = await service.listEmails(filter, options);
  res.json({
    success: true,
    ...result,
  });
});

/**
 * Get specific email message log by ID.
 * GET /api/emails/:id
 */
exports.getEmailById = asyncHandler(async (req, res) => {
  const row = await service.getEmailById(req.params.id);
  if (!row) {
    throw new ApiError(404, 'Email message log not found');
  }
  res.json({
    success: true,
    data: row,
  });
});

/**
 * Initiates Google OAuth flow.
 * GET /api/emails/google/auth or GET /api/email/google/auth
 */
exports.getGoogleAuth = asyncHandler(async (req, res) => {
  const state = req.query.state || req.query.returnUrl || '';
  const authUrl = service.getGoogleAuthUrl(state);

  if (req.query.redirect === 'true' || req.query.redirect === '1') {
    return res.redirect(authUrl);
  }

  res.json({
    success: true,
    authUrl,
  });
});

/**
 * Handles Google OAuth callback.
 * GET /api/emails/google/callback or GET /api/email/google/callback
 */
exports.googleCallback = asyncHandler(async (req, res) => {
  const { code, error, state } = req.query;

  if (error) {
    throw new ApiError(400, `Google authorization error: ${error}`);
  }

  if (!code) {
    throw new ApiError(400, 'Authorization code is missing from callback');
  }

  const account = await service.handleGoogleCallback(code);

  const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');
  if (acceptsHtml) {
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Google Account Connected</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; }
            .card { background: white; padding: 2.5rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); text-align: center; max-width: 420px; }
            .badge { background: #dcfce7; color: #166534; padding: 0.5rem 1rem; border-radius: 9999px; font-weight: 600; display: inline-block; margin-bottom: 1rem; }
            h2 { margin: 0 0 0.5rem 0; color: #0f172a; }
            p { color: #64748b; font-size: 14px; margin-bottom: 1.5rem; }
            .btn { background: #2563eb; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: 500; cursor: pointer; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">✓ Connected</div>
            <h2>Google Account Connected</h2>
            <p>Successfully authorized <strong>${account.email}</strong> for sending emails.</p>
            <button class="btn" onclick="window.close()">Close Window</button>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', account: ${JSON.stringify(account)} }, '*');
              setTimeout(() => window.close(), 2000);
            }
          </script>
        </body>
      </html>
    `);
  }

  res.json({
    success: true,
    message: `Google account ${account.email} connected successfully`,
    data: account,
  });
});

/**
 * List configured email accounts.
 * GET /api/emails/accounts
 */
exports.listAccounts = asyncHandler(async (req, res) => {
  const accounts = await service.listAccounts();
  res.json({
    success: true,
    data: accounts,
  });
});

/**
 * Remove an email account.
 * DELETE /api/emails/accounts/:id
 */
exports.deleteAccount = asyncHandler(async (req, res) => {
  const result = await service.deleteAccount(req.params.id);
  res.json(result);
});
